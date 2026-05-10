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
      Buffer.from(expected.toLowerCase(), "hex")
    );
  } catch {
    return false;
  }
}

export async function processOrderEvent(payload) {
  const { referral_id, program_id, order_id, customer_email, timestamp } =
    payload;

  const program = await programsRepo.findByIdAny(program_id);
  if (!program) {
    const err = new Error("Program not found");
    err.status = 404;
    throw err;
  }

  const referral = await referralsRepo.findByIdWithProgramCheck(
    referral_id,
    program_id
  );
  if (!referral) {
    const err = new Error("Referral not found");
    err.status = 404;
    throw err;
  }

  const signupTs = timestamp ? new Date(timestamp) : new Date();
  await referralsRepo.updateWithOrder(referral_id, {
    orderId: order_id,
    customerEmail: customer_email,
    signupTs,
  });

  return referral;
}

export async function handleWebhook(rawBody, signature, payload) {
  if (!verifyHmac(rawBody, signature)) {
    const err = new Error("Invalid webhook signature");
    err.status = 401;
    throw err;
  }

  const { event_id, event_type } = payload;

  const record = await webhooksRepo.createWithIdempotency({
    eventId: event_id,
    eventType: event_type,
    payload,
  });

  if (!record) {
    return { duplicate: true };
  }

  if (event_type === "order.completed") {
    await processOrderEvent(payload);
  }

  await webhooksRepo.markProcessed(event_id);
  return { duplicate: false };
}
