import * as referralsRepo from "../repos/referralsRepo.js";
import * as payoutsRepo from "../repos/payoutsRepo.js";

export async function processEligibleReferrals() {
  const eligible = await referralsRepo.findEligibleForPayout();

  if (eligible.length === 0) {
    console.log("[payout] No eligible referrals found for payout processing.");
    return 0;
  }

  console.log(`[payout] Found ${eligible.length} eligible referral(s) for payout processing.`);

  let processed = 0;

  for (const referral of eligible) {
    const payout = await payoutsRepo.createPayout({
      referralId: referral.id,
      advocateId: referral.advocate_id,
      programId: referral.program_id,
      amountCents: referral.reward_amount_cents,
    });

    if (payout) {
      await payoutsRepo.updateReferralStatusToPaid(referral.id);
      processed++;
      console.log(`[payout] Created payout ${payout.id} for referral ${referral.id} (order: ${referral.order_id})`);
    } else {
      console.log(`[payout] Payout for referral ${referral.id} already exists (idempotent skip).`);
    }
  }

  console.log(`[payout] Processed ${processed} payout(s) in this run.`);
  return processed;
}