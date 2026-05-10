import cron from "node-cron";
import { config } from "dotenv";
import * as payoutService from "./services/payoutService.js";

config();

const schedule = process.env.PAYOUT_CRON_SCHEDULE ?? "0 * * * *";

console.log(`[worker] RefNet payout worker starting...`);
console.log(`[worker] Payout cron schedule: ${schedule}`);

let isRunning = false;

cron.schedule(schedule, async () => {
  if (isRunning) {
    console.log("[worker] Previous payout job still running, skipping this tick.");
    return;
  }

  isRunning = true;
  const start = Date.now();

  try {
    console.log(`[worker] Payout job started at ${new Date().toISOString()}`);
    const count = await payoutService.processEligibleReferrals();
    const elapsed = Date.now() - start;
    console.log(`[worker] Payout job finished. Processed ${count} payout(s) in ${elapsed}ms.`);
  } catch (err) {
    console.error("[worker] Payout job failed:", err.message);
  } finally {
    isRunning = false;
  }
});

console.log(`[worker] Cron scheduled. Waiting for next run...`);