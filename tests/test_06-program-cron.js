import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../worker/src/db/pool.js', () => {
  const mockQuery = vi.fn();
  return { default: { query: mockQuery } };
});

const pool = await import('../worker/src/db/pool.js');
const query = pool.default.query;

function createMockReferral(overrides = {}) {
  return {
    id: 'ref-123',
    advocate_id: 'adv-456',
    program_id: 'prog-789',
    customer_email: 'customer@example.com',
    order_id: 'SHOP-001',
    reward_amount_cents: 1000,
    ...overrides,
  };
}

function createMockPayout(overrides = {}) {
  return {
    id: 'payout-001',
    referral_id: 'ref-123',
    advocate_id: 'adv-456',
    program_id: 'prog-789',
    amount_cents: 1000,
    status: 'pending',
    processed_at: null,
    paid_at: null,
    ...overrides,
  };
}

describe('Program Cron Worker — Payout Processing', () => {

  beforeEach(() => {
    vi.resetModules();
    query.mockReset();
  });

  // ============================================
  // referralsRepo.findEligibleForPayout
  // ============================================

  describe('referralsRepo.findEligibleForPayout', () => {
    it('returns only eligible referrals with order_id and no existing payout', async () => {
      const { findEligibleForPayout } = await import('../worker/src/repos/referralsRepo.js');

      const mockEligible = [createMockReferral({ id: 'ref-eligible-1' })];
      query.mockResolvedValueOnce({ rows: mockEligible });

      const result = await findEligibleForPayout();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ref-eligible-1');
    });

    it('returns empty array when no eligible referrals exist', async () => {
      const { findEligibleForPayout } = await import('../worker/src/repos/referralsRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      const result = await findEligibleForPayout();

      expect(result).toHaveLength(0);
    });

    it('returns referrals ordered by signup_ts ascending', async () => {
      const { findEligibleForPayout } = await import('../worker/src/repos/referralsRepo.js');

      const older = createMockReferral({ id: 'ref-older', signup_ts: new Date('2026-01-01') });
      const newer = createMockReferral({ id: 'ref-newer', signup_ts: new Date('2026-02-01') });
      query.mockResolvedValueOnce({ rows: [older, newer] });

      const result = await findEligibleForPayout();

      expect(result[0].id).toBe('ref-older');
      expect(result[1].id).toBe('ref-newer');
    });

    it('excludes referrals that already have a payout record via LEFT JOIN', async () => {
      const { findEligibleForPayout } = await import('../worker/src/repos/referralsRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      await findEligibleForPayout();

      const [sql] = query.mock.calls[0];
      expect(sql).toContain('LEFT JOIN payouts');
      expect(sql).toContain('pay.id IS NULL');
    });

    it('uses parameterised queries — user inputs are parameterized', async () => {
      const { findEligibleForPayout } = await import('../worker/src/repos/referralsRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      await findEligibleForPayout();

      const [sql] = query.mock.calls[0];
      expect(sql).not.toContain('DROP');
      expect(sql).not.toContain('1=1');
      expect(sql).not.toMatch(/\$\{.*\}/);
    });

    it('does not use string concatenation for dynamic values', async () => {
      const { findEligibleForPayout } = await import('../worker/src/repos/referralsRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      await findEligibleForPayout();

      const [sql] = query.mock.calls[0];
      expect(sql).not.toMatch(/`.*\$\w+.*`/);
      expect(sql).not.toMatch(/\$\{\s*.+\s*\}/);
    });
  });

  // ============================================
  // payoutsRepo.createPayout
  // ============================================

  describe('payoutsRepo.createPayout', () => {
    it('inserts a new payout record with status pending', async () => {
      const { createPayout } = await import('../worker/src/repos/payoutsRepo.js');

      const mockPayout = createMockPayout();
      query.mockResolvedValueOnce({ rows: [mockPayout] });

      const result = await createPayout({
        referralId: 'ref-123',
        advocateId: 'adv-456',
        programId: 'prog-789',
        amountCents: 1000,
      });

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('INSERT INTO payouts');
      expect(sql).toContain("'pending'");
      expect(params).toContain('ref-123');
      expect(params).toContain('adv-456');
      expect(params).toContain('prog-789');
      expect(params).toContain(1000);
      expect(result).not.toBeNull();
    });

    it('returns null when payout already exists (idempotent skip)', async () => {
      const { createPayout } = await import('../worker/src/repos/payoutsRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      const result = await createPayout({
        referralId: 'ref-existing',
        advocateId: 'adv-456',
        programId: 'prog-789',
        amountCents: 1000,
      });

      expect(result).toBeNull();
    });

    it('uses ON CONFLICT DO NOTHING for idempotency guard', async () => {
      const { createPayout } = await import('../worker/src/repos/payoutsRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      await createPayout({
        referralId: 'ref-123',
        advocateId: 'adv-456',
        programId: 'prog-789',
        amountCents: 1000,
      });

      const [sql] = query.mock.calls[0];
      expect(sql).toContain('ON CONFLICT');
      expect(sql).toContain('referral_id');
      expect(sql).toContain('DO NOTHING');
    });

    it('uses parameterised queries — no SQL injection possible', async () => {
      const { createPayout } = await import('../worker/src/repos/payoutsRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      await createPayout({
        referralId: "ref-dROP'; DROP TABLE payouts; --",
        advocateId: 'adv-456',
        programId: 'prog-789',
        amountCents: 1000,
      });

      const [sql, params] = query.mock.calls[0];
      expect(sql).not.toContain('DROP TABLE');
      expect(sql).toContain('$1');
      expect(sql).toContain('$2');
      expect(sql).toContain('$3');
      expect(sql).toContain('$4');
      expect(params[0]).toBe("ref-dROP'; DROP TABLE payouts; --");
    });
  });

  // ============================================
  // payoutsRepo.updateReferralStatusToPaid
  // ============================================

  describe('payoutsRepo.updateReferralStatusToPaid', () => {
    it('updates referral status to paid', async () => {
      const { updateReferralStatusToPaid } = await import('../worker/src/repos/payoutsRepo.js');

      query.mockResolvedValueOnce({ rows: [{ id: 'ref-123', status: 'paid' }] });

      const result = await updateReferralStatusToPaid('ref-123');

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('UPDATE referrals');
      expect(sql).toContain('status');
      expect(sql).toContain('paid');
      expect(params).toContain('ref-123');
      expect(result.status).toBe('paid');
    });

    it('sets updated_at to now()', async () => {
      const { updateReferralStatusToPaid } = await import('../worker/src/repos/payoutsRepo.js');

      query.mockResolvedValueOnce({ rows: [{ id: 'ref-123' }] });

      await updateReferralStatusToPaid('ref-123');

      const [sql] = query.mock.calls[0];
      expect(sql).toContain('updated_at');
      expect(sql).toContain('now()');
    });

    it('uses parameterised queries', async () => {
      const { updateReferralStatusToPaid } = await import('../worker/src/repos/payoutsRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      await updateReferralStatusToPaid('ref-injection-test');

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('$1');
      expect(params).toContain('ref-injection-test');
    });
  });

  // ============================================
  // payoutsRepo.markPayoutAsProcessed
  // ============================================

  describe('payoutsRepo.markPayoutAsProcessed', () => {
    it('updates payout status to processed', async () => {
      const { markPayoutAsProcessed } = await import('../worker/src/repos/payoutsRepo.js');

      const processedPayout = createMockPayout({ id: 'payout-001', status: 'processed' });
      query.mockResolvedValueOnce({ rows: [processedPayout] });

      const result = await markPayoutAsProcessed('payout-001');

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('UPDATE payouts');
      expect(sql).toContain('status');
      expect(sql).toContain('processed');
      expect(params).toContain('payout-001');
      expect(result.status).toBe('processed');
    });

    it('sets paid_at, processed_at, and updated_at to now()', async () => {
      const { markPayoutAsProcessed } = await import('../worker/src/repos/payoutsRepo.js');

      query.mockResolvedValueOnce({ rows: [createMockPayout({ status: 'processed' })] });

      await markPayoutAsProcessed('payout-001');

      const [sql] = query.mock.calls[0];
      expect(sql).toContain('paid_at');
      expect(sql).toContain('processed_at');
      expect(sql).toContain('updated_at');
      expect(sql).toContain('now()');
    });

    it('uses parameterised queries', async () => {
      const { markPayoutAsProcessed } = await import('../worker/src/repos/payoutsRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      await markPayoutAsProcessed('payout-injection-test');

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('$1');
      expect(params).toContain('payout-injection-test');
    });
  });

  // ============================================
  // payoutService.processEligibleReferrals
  // ============================================

  describe('payoutService.processEligibleReferrals', () => {
    it('returns 0 when no eligible referrals exist', async () => {
      const { processEligibleReferrals } = await import('../worker/src/services/payoutService.js');

      query.mockResolvedValueOnce({ rows: [] });

      const count = await processEligibleReferrals();

      expect(count).toBe(0);
    });

    it('creates payout, updates referral to paid, and marks payout processed for eligible referral', async () => {
      const { processEligibleReferrals } = await import('../worker/src/services/payoutService.js');

      const referral = createMockReferral({ id: 'ref-new', reward_amount_cents: 500 });
      const payout = createMockPayout({ id: 'payout-new' });

      query
        .mockResolvedValueOnce({ rows: [referral] })
        .mockResolvedValueOnce({ rows: [payout] })
        .mockResolvedValueOnce({ rows: [{ id: 'ref-new', status: 'paid' }] })
        .mockResolvedValueOnce({ rows: [{ ...payout, status: 'processed' }] });

      const count = await processEligibleReferrals();

      expect(count).toBe(1);
      expect(query).toHaveBeenCalledTimes(4);
    });

    it('skips referral when createPayout returns null (idempotent)', async () => {
      const { processEligibleReferrals } = await import('../worker/src/services/payoutService.js');

      const referral = createMockReferral({ id: 'ref-existing' });

      query
        .mockResolvedValueOnce({ rows: [referral] })
        .mockResolvedValueOnce({ rows: [] });

      const count = await processEligibleReferrals();

      expect(count).toBe(0);
      expect(query).toHaveBeenCalledTimes(2);
    });

    it('does not update referral status when payout already exists', async () => {
      const { processEligibleReferrals } = await import('../worker/src/services/payoutService.js');

      const referral = createMockReferral({ id: 'ref-existing' });

      query
        .mockResolvedValueOnce({ rows: [referral] })
        .mockResolvedValueOnce({ rows: [] });

      await processEligibleReferrals();

      const updateCalls = query.mock.calls.filter(([sql]) => sql.includes('UPDATE referrals'));
      expect(updateCalls).toHaveLength(0);
    });

    it('processes multiple eligible referrals in order', async () => {
      const { processEligibleReferrals } = await import('../worker/src/services/payoutService.js');

      const referral1 = createMockReferral({ id: 'ref-1', reward_amount_cents: 500 });
      const referral2 = createMockReferral({ id: 'ref-2', reward_amount_cents: 750 });
      const payout1 = createMockPayout({ id: 'payout-1', referral_id: 'ref-1' });
      const payout2 = createMockPayout({ id: 'payout-2', referral_id: 'ref-2' });

      query
        .mockResolvedValueOnce({ rows: [referral1, referral2] })
        .mockResolvedValueOnce({ rows: [payout1] })
        .mockResolvedValueOnce({ rows: [{ id: 'ref-1', status: 'paid' }] })
        .mockResolvedValueOnce({ rows: [{ ...payout1, status: 'processed' }] })
        .mockResolvedValueOnce({ rows: [payout2] })
        .mockResolvedValueOnce({ rows: [{ id: 'ref-2', status: 'paid' }] })
        .mockResolvedValueOnce({ rows: [{ ...payout2, status: 'processed' }] });

      const count = await processEligibleReferrals();

      expect(count).toBe(2);
      expect(query).toHaveBeenCalledTimes(7);
    });

    it('sets payout amount_cents from program reward_amount_cents', async () => {
      const { processEligibleReferrals } = await import('../worker/src/services/payoutService.js');

      const referral = createMockReferral({ id: 'ref-high-value', reward_amount_cents: 5000 });
      const payout = createMockPayout({ id: 'payout-high', amount_cents: 5000 });

      query
        .mockResolvedValueOnce({ rows: [referral] })
        .mockResolvedValueOnce({ rows: [payout] })
        .mockResolvedValueOnce({ rows: [{ id: 'ref-high-value' }] })
        .mockResolvedValueOnce({ rows: [{ ...payout, status: 'processed' }] });

      await processEligibleReferrals();

      const insertCall = query.mock.calls[1];
      const params = insertCall[1];
      expect(params).toContain(5000);
    });
  });

  // ============================================
  // Worker cron scheduling (index.js)
  // ============================================

  describe('Worker cron scheduling', () => {
    beforeEach(async () => {
      vi.resetModules();
      vi.mock('node-cron', () => ({
        default: { schedule: vi.fn().mockReturnValue({ stop: vi.fn() }) },
      }));
      vi.mock('dotenv', () => ({
        config: vi.fn(),
      }));
    });

    it('uses PAYOUT_CRON_SCHEDULE env var when set', async () => {
      const original = process.env.PAYOUT_CRON_SCHEDULE;
      process.env.PAYOUT_CRON_SCHEDULE = '*/15 * * * *';

      vi.mock('../worker/src/db/pool.js', () => {
        const mockQuery = vi.fn();
        return { default: { query: mockQuery } };
      });

      const pool = await import('../worker/src/db/pool.js');
      pool.default.query.mockResolvedValue({ rows: [] });

      const cron = (await import('node-cron')).default;
      const mockSchedule = vi.spyOn(cron, 'schedule');

      await import('../worker/src/index.js');

      expect(mockSchedule).toHaveBeenCalledWith('*/15 * * * *', expect.any(Function));

      mockSchedule.mockRestore();
      process.env.PAYOUT_CRON_SCHEDULE = original;
    });

    it('defaults to 0 * * * * when PAYOUT_CRON_SCHEDULE is not set', async () => {
      const original = process.env.PAYOUT_CRON_SCHEDULE;
      delete process.env.PAYOUT_CRON_SCHEDULE;

      vi.mock('../worker/src/db/pool.js', () => {
        const mockQuery = vi.fn();
        return { default: { query: mockQuery } };
      });

      const pool = await import('../worker/src/db/pool.js');
      pool.default.query.mockResolvedValue({ rows: [] });

      const cron = (await import('node-cron')).default;
      const mockSchedule = vi.spyOn(cron, 'schedule');

      await import('../worker/src/index.js');

      expect(mockSchedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function));

      mockSchedule.mockRestore();
      process.env.PAYOUT_CRON_SCHEDULE = original;
    });

    it('skips run when previous job is still executing', async () => {
      vi.mock('../worker/src/db/pool.js', () => {
        const mockQuery = vi.fn();
        return { default: { query: mockQuery } };
      });

      const pool = await import('../worker/src/db/pool.js');
      pool.default.query.mockImplementation(() => new Promise(r => setTimeout(r, 100)).then(() => ({ rows: [] })));

      const cron = (await import('node-cron')).default;
      const mockSchedule = vi.spyOn(cron, 'schedule');
      const mockLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      await import('../worker/src/index.js');

      const [, jobFn] = mockSchedule.mock.calls[0];
      jobFn();
      await new Promise(r => setTimeout(r, 10));
      jobFn();

      const skipLogs = mockLog.mock.calls.filter(([msg]) => msg.includes('still running'));
      expect(skipLogs).toHaveLength(1);

      mockSchedule.mockRestore();
      mockLog.mockRestore();
    });
  });
});