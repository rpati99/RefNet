import pool from "../db/pool.js";
import * as programsRepo from "./programsRepo.js";
import * as referralsRepo from "./referralsRepo.js";
import * as webhooksRepo from "./webhooksRepo.js";

export async function withOrderTransaction(work) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const result = await work({
      findOwnedAdvocate: async (code, merchantId) => {
        const result = await db.query(
          `SELECT a.id, a.program_id, p.is_active FROM advocates a
           JOIN programs p ON p.id = a.program_id
           WHERE a.referral_code = $1 AND p.merchant_id = $2 FOR SHARE OF a, p`,
          [code, merchantId]
        );
        return result.rows[0] ?? null;
      },
      // A deterministic UUID makes retries serialize on the same primary key.
      createReferral: async ({ id, advocateId, programId }) => {
        await db.query(
          `INSERT INTO referrals (id, advocate_id, program_id) VALUES ($1, $2, $3)
           ON CONFLICT (id) DO NOTHING`, [id, advocateId, programId]
        );
      },
      webhookRepos: {
        programs: { findByIdAny: (id) => programsRepo.findByIdAny(id, db) },
        referrals: {
          findByIdWithProgramCheck: (id, programId) => referralsRepo.findByIdWithProgramCheck(id, programId, db),
          updateWithOrder: (id, fields) => referralsRepo.updateWithOrder(id, fields, db),
        },
        webhooks: {
          createWithIdempotency: (fields) => webhooksRepo.createWithIdempotency(fields, db),
          markProcessed: (id) => webhooksRepo.markProcessed(id, db),
        },
      },
    });
    await db.query("COMMIT");
    return result;
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  } finally {
    db.release();
  }
}
