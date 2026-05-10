import pool from "../db/pool.js";

export async function createPayout({ referralId, advocateId, programId, amountCents }) {
  const result = await pool.query(
    `INSERT INTO payouts (referral_id, advocate_id, program_id, amount_cents, status, processed_at)
     VALUES ($1, $2, $3, $4, 'pending', now())
     ON CONFLICT (referral_id) DO NOTHING
     RETURNING *`,
    [referralId, advocateId, programId, amountCents]
  );
  return result.rows[0] ?? null;
}

export async function updateReferralStatusToPaid(referralId) {
  const result = await pool.query(
    `UPDATE referrals
     SET status = 'paid', updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [referralId]
  );
  return result.rows[0] ?? null;
}