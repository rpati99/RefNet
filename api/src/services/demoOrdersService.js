import crypto from "crypto";
import { withOrderTransaction } from "../repos/demoOrdersRepo.js";
import { handleWebhook } from "./webhooksService.js";

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

export async function simulateOrder(merchantId, referralCode, { customerEmail, requestId }) {
  if (process.env.ENABLE_DEMO_ORDERS !== "true") fail(404, "Not found");
  if (!process.env.WEBHOOK_HMAC_SECRET) fail(503, "Demo orders are not configured");
  if (typeof customerEmail !== "string" || customerEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    fail(400, "A valid customer email is required");
  }
  if (typeof requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    fail(400, "A UUID requestId is required");
  }
  return withOrderTransaction(async (tx) => {
    const advocate = await tx.findOwnedAdvocate(referralCode, merchantId);
    if (!advocate) fail(404, "Referral not found for your account");
    if (!advocate.is_active) fail(409, "This program is inactive");
    const hash = crypto.createHash("sha256").update(`${merchantId}:${advocate.id}:${requestId.toLowerCase()}`).digest("hex");
    const referralId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    await tx.createReferral({ id: referralId, advocateId: advocate.id, programId: advocate.program_id });
    const payload = {
      event_id: `demo-${referralId}`, event_type: "order.completed", referral_id: referralId,
      program_id: advocate.program_id, order_id: `demo-order-${referralId}`,
      customer_email: customerEmail.trim(), timestamp: new Date().toISOString(), demo: true,
    };
    const raw = Buffer.from(JSON.stringify(payload));
    const signature = crypto.createHmac("sha256", process.env.WEBHOOK_HMAC_SECRET).update(raw).digest("hex");
    const result = await handleWebhook(raw, signature, payload, tx.webhookRepos);
    return { ...result, referralId, programId: advocate.program_id };
  });
}
