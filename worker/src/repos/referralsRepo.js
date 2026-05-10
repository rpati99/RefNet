import pool from "../db/pool.js";

export async function findEligibleForPayout() {
  const result = await pool.query(
    `SELECT r.id, r.advocate_id, r.program_id, r.customer_email, r.order_id,
            p.reward_amount_cents
     FROM referrals r
     JOIN programs p ON p.id = r.program_id
     LEFT JOIN payouts pay ON pay.referral_id = r.id
     WHERE r.status = 'eligible'
       AND r.order_id IS NOT NULL
       AND pay.id IS NULL
     ORDER BY r.signup_ts ASC`
  );
  return result.rows;
}