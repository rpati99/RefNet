import pool from "../db/pool.js";

export async function findByMerchantId(merchantId) {
  const result = await pool.query(
    "SELECT * FROM programs WHERE merchant_id = $1 ORDER BY created_at DESC",
    [merchantId]
  );
  return result.rows;
}

export async function findById(id, merchantId) {
  const result = await pool.query(
    "SELECT * FROM programs WHERE id = $1 AND merchant_id = $2",
    [id, merchantId]
  );
  return result.rows[0] ?? null;
}

export async function create(merchantId, { name, rewardDescription, rewardAmountCents }) {
  const result = await pool.query(
    `INSERT INTO programs (merchant_id, name, reward_description, reward_amount_cents)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [merchantId, name, rewardDescription ?? null, rewardAmountCents ?? 0]
  );
  return result.rows[0];
}

export async function update(id, merchantId, fields) {
  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  if (fields.name !== undefined) {
    values.push(fields.name);
    setClauses.push(`name = $${paramIndex++}`);
  }
  if (fields.rewardDescription !== undefined) {
    values.push(fields.rewardDescription);
    setClauses.push(`reward_description = $${paramIndex++}`);
  }
  if (fields.rewardAmountCents !== undefined) {
    values.push(fields.rewardAmountCents);
    setClauses.push(`reward_amount_cents = $${paramIndex++}`);
  }
  if (fields.isActive !== undefined) {
    values.push(fields.isActive);
    setClauses.push(`is_active = $${paramIndex++}`);
  }

  if (setClauses.length === 0) {
    return findById(id, merchantId);
  }

  setClauses.push("updated_at = now()");
  values.push(id, merchantId);

  const result = await pool.query(
    `UPDATE programs SET ${setClauses.join(", ")}
     WHERE id = $${paramIndex++} AND merchant_id = $${paramIndex}
     RETURNING *`,
    values
  );
  return result.rows[0] ?? null;
}

export async function softDelete(id, merchantId) {
  const result = await pool.query(
    `UPDATE programs SET is_active = false, updated_at = now()
     WHERE id = $1 AND merchant_id = $2
     RETURNING *`,
    [id, merchantId]
  );
  return result.rows[0] ?? null;
}