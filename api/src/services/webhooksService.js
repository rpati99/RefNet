import crypto from "crypto";
import * as webhooksRepo from "../repos/webhooksRepo.js";
import * as referralsRepo from "../repos/referralsRepo.js";
import * as programsRepo from "../repos/programsRepo.js";

export function verifyHmac(rawBody, signature) {
  const secret = process.env.WEBHOOK_HMAC_SECRET;
  if (!secret) {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature.toLowerCase(), "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

export async function processOrderEvent(payload, { programs = programsRepo, referrals = referralsRepo } = {}) {
  const { referral_id, program_id, order_id, customer_email, timestamp } =
    payload;

  const program = await programs.findByIdAny(program_id);
  if (!program) {
    const err = new Error("Program not found");
    err.status = 404;
    throw err;
  }

  const referral = await referrals.findByIdWithProgramCheck(
    referral_id,
    program_id
  );
  if (!referral) {
    const err = new Error("Referral not found");
    err.status = 404;
    throw err;
  }

  const signupTs = timestamp ? new Date(timestamp) : new Date();
  await referrals.updateWithOrder(referral_id, {
    orderId: order_id,
    customerEmail: customer_email,
    signupTs,
  });

  return referral;
}

export async function handleWebhook(rawBody, signature, payload, { webhooks = webhooksRepo, ...orderRepos } = {}) {
  if (!verifyHmac(rawBody, signature)) {
    const err = new Error("Invalid webhook signature");
    err.status = 401;
    throw err;
  }

  const { event_id, event_type } = payload;

  const record = await webhooks.createWithIdempotency({
    eventId: event_id,
    eventType: event_type,
    payload,
  });

  if (!record) {
    return { duplicate: true };
  }

  if (event_type === "order.completed") {
    await processOrderEvent(payload, orderRepos);
  }

  await webhooks.markProcessed(event_id);
  return { duplicate: false };
}
