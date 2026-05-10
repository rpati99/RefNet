import pool from "../db/pool.js";

export async function findById(id) {
  const result = await pool.query("SELECT * FROM referrals WHERE id = $1", [id]);
  return result.rows[0] ?? null;
}

export async function findByIdWithProgramCheck(id, programId) {
  const result = await pool.query(
    "SELECT * FROM referrals WHERE id = $1 AND program_id = $2",
    [id, programId]
  );
  return result.rows[0] ?? null;
}

export async function updateWithOrder(id, { orderId, customerEmail, signupTs }) {
  const result = await pool.query(
    `UPDATE referrals
     SET order_id = $2, customer_email = $3, signup_ts = $4,
         status = 'eligible', updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, orderId, customerEmail, signupTs]
  );
  return result.rows[0] ?? null;
}
