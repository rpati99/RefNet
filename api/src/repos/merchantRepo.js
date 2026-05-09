import pool from "../db/pool.js";

export async function findByEmail(email) {
  const result = await pool.query(
    "SELECT id, email, password_hash, company_name, created_at FROM merchants WHERE email = $1",
    [email]
  );
  return result.rows[0] ?? null;
}

export async function create({ email, passwordHash, companyName }) {
  const result = await pool.query(
    `INSERT INTO merchants (email, password_hash, company_name)
     VALUES ($1, $2, $3)
     RETURNING id, email, company_name, created_at`,
    [email, passwordHash, companyName]
  );
  return result.rows[0];
}

export async function findById(id) {
  const result = await pool.query(
    "SELECT id, email, company_name, created_at FROM merchants WHERE id = $1",
    [id]
  );
  return result.rows[0] ?? null;
}