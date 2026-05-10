import pool from "../db/pool.js";

export async function findByProgramId(programId) {
  const result = await pool.query(
    "SELECT * FROM advocates WHERE program_id = $1 ORDER BY created_at DESC",
    [programId]
  );
  return result.rows;
}

export async function findById(id) {
  const result = await pool.query(
    "SELECT * FROM advocates WHERE id = $1",
    [id]
  );
  return result.rows[0] ?? null;
}

export async function findByIdWithMerchantCheck(advocateId, merchantId) {
  const result = await pool.query(
    `SELECT a.* FROM advocates a
     JOIN programs p ON p.id = a.program_id
     WHERE a.id = $1 AND p.merchant_id = $2`,
    [advocateId, merchantId]
  );
  return result.rows[0] ?? null;
}

export async function create({ programId, email, referralCode }) {
  const result = await pool.query(
    `INSERT INTO advocates (program_id, email, referral_code)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [programId, email, referralCode]
  );
  return result.rows[0];
}

export async function deleteById(id) {
  const result = await pool.query(
    "DELETE FROM advocates WHERE id = $1 RETURNING *",
    [id]
  );
  return result.rows[0] ?? null;
}

export async function findByReferralCode(code) {
  const result = await pool.query(
    `SELECT a.*, p.name as program_name, p.reward_amount_cents, p.reward_description
     FROM advocates a
     JOIN programs p ON p.id = a.program_id
     WHERE lower(a.referral_code) = lower($1)`,
    [code]
  );
  return result.rows[0] ?? null;
}

export async function existsByProgramAndEmail(programId, email) {
  const result = await pool.query(
    "SELECT id FROM advocates WHERE program_id = $1 AND lower(email) = lower($2)",
    [programId, email]
  );
  return result.rows.length > 0;
}