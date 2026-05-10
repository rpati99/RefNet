import pool from "../db/pool.js";

export async function getMerchantStats(merchantId) {
  const programsResult = await pool.query(
    `SELECT p.id, p.name, p.reward_amount_cents, p.is_active, p.created_at
     FROM programs p
     WHERE p.merchant_id = $1
     ORDER BY p.created_at DESC`,
    [merchantId]
  );
  const programs = programsResult.rows;

  if (programs.length === 0) {
    return {
      programs: [],
      totalReferrals: 0,
      referralsByStatus: { pending: 0, eligible: 0, paid: 0, failed: 0 },
      totalPayoutsCents: 0,
      payoutsByStatus: { pending: 0, processed: 0, failed: 0 },
    };
  }

  const programIds = programs.map((p) => p.id);

  const referralsResult = await pool.query(
    `SELECT program_id, status, COUNT(*) as count
     FROM referrals
     WHERE program_id = ANY($1)
     GROUP BY program_id, status`,
    [programIds]
  );

  const referralCountMap = {};
  for (const row of referralsResult.rows) {
    const pid = row.program_id;
    if (!referralCountMap[pid]) {
      referralCountMap[pid] = { pending: 0, eligible: 0, paid: 0, failed: 0 };
    }
    referralCountMap[pid][row.status] = parseInt(row.count, 10);
  }

  const programsWithCounts = programs.map((p) => ({
    ...p,
    referralCounts: referralCountMap[p.id] ?? { pending: 0, eligible: 0, paid: 0, failed: 0 },
  }));

  const referralsByStatus = { pending: 0, eligible: 0, paid: 0, failed: 0 };
  for (const p of programsWithCounts) {
    for (const status of Object.keys(p.referralCounts)) {
      referralsByStatus[status] += p.referralCounts[status];
    }
  }

  const totalReferrals = Object.values(referralsByStatus).reduce((a, b) => a + b, 0);

  const payoutsResult = await pool.query(
    `SELECT status, SUM(amount_cents) as total_cents, COUNT(*) as count
     FROM payouts
     WHERE program_id = ANY($1)
     GROUP BY status`,
    [programIds]
  );

  const payoutsByStatus = { pending: 0, processed: 0, failed: 0 };
  let totalPayoutsCents = 0;
  for (const row of payoutsResult.rows) {
    const cents = parseInt(row.total_cents, 10) || 0;
    payoutsByStatus[row.status] += cents;
    totalPayoutsCents += cents;
  }

  return {
    programs: programsWithCounts,
    totalReferrals,
    referralsByStatus,
    totalPayoutsCents,
    payoutsByStatus,
  };
}

export async function getProgramStats(programId, merchantId) {
  const programResult = await pool.query(
    `SELECT p.*
     FROM programs p
     WHERE p.id = $1 AND p.merchant_id = $2`,
    [programId, merchantId]
  );
  const program = programResult.rows[0];
  if (!program) return null;

  const advocateResult = await pool.query(
    `SELECT COUNT(*) as count FROM advocates WHERE program_id = $1`,
    [programId]
  );
  const advocateCount = parseInt(advocateResult.rows[0].count, 10);

  const referralsResult = await pool.query(
    `SELECT status, COUNT(*) as count
     FROM referrals
     WHERE program_id = $1
     GROUP BY status`,
    [programId]
  );

  const referralsByStatus = { pending: 0, eligible: 0, paid: 0, failed: 0 };
  for (const row of referralsResult.rows) {
    referralsByStatus[row.status] = parseInt(row.count, 10);
  }

  const payoutsResult = await pool.query(
    `SELECT status, SUM(amount_cents) as total_cents, COUNT(*) as count
     FROM payouts
     WHERE program_id = $1
     GROUP BY status`,
    [programId]
  );

  const payoutsByStatus = { pending: 0, processed: 0, failed: 0 };
  let totalPayoutsCents = 0;
  for (const row of payoutsResult.rows) {
    const cents = parseInt(row.total_cents, 10) || 0;
    payoutsByStatus[row.status] += cents;
    totalPayoutsCents += cents;
  }

  return {
    program,
    advocateCount,
    referralsByStatus,
    totalReferrals: Object.values(referralsByStatus).reduce((a, b) => a + b, 0),
    payoutsByStatus,
    totalPayoutsCents,
  };
}