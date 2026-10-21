import pool from "../db/pool.js";

export async function list(merchantId, { programId, offset, limit }) {
  const result = await pool.query(
    `SELECT r.id, r.program_id, p.name AS program_name, a.email AS advocate_email,
            r.customer_email, r.order_id, r.status, r.created_at, r.signup_ts,
            po.id AS payout_id, po.status AS payout_status, po.amount_cents,
            po.processed_at
     FROM referrals r
     JOIN programs p ON p.id = r.program_id
     JOIN advocates a ON a.id = r.advocate_id
     LEFT JOIN payouts po ON po.referral_id = r.id
     WHERE p.merchant_id = $1 AND ($2::uuid IS NULL OR p.id = $2::uuid)
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT $3 OFFSET $4`,
    [merchantId, programId ?? null, limit, offset]
  );
  return result.rows;
}
