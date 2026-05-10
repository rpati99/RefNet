import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/src/db/pool.js', () => {
  const mockQuery = vi.fn();
  return { default: { query: mockQuery } };
});

vi.mock('react-router-dom', async () => {
  const Link = vi.fn(({ to, children }) => children);
  return { Link };
});

const pool = await import('../api/src/db/pool.js');
const query = pool.default.query;

function createMockProgram(overrides = {}) {
  return {
    id: 'prog-123',
    name: 'Test Program',
    reward_amount_cents: 1000,
    is_active: true,
    created_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function createMockReferralCount(programId, statusCounts) {
  return { program_id: programId, ...statusCounts };
}

describe('Dashboard Feature', () => {

  beforeEach(() => {
    vi.resetModules();
    query.mockReset();
    vi.mocked(vi.fn()).mockReset();
  });

  // ============================================
  // dashboardRepo.getMerchantStats
  // ============================================

  describe('dashboardRepo.getMerchantStats', () => {
    it('returns empty shape when no programs', async () => {
      const { getMerchantStats } = await import('../api/src/repos/dashboardRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      const result = await getMerchantStats('merchant-123');

      expect(result.programs).toEqual([]);
      expect(result.totalReferrals).toBe(0);
      expect(result.referralsByStatus).toEqual({ pending: 0, eligible: 0, paid: 0, failed: 0 });
      expect(result.totalPayoutsCents).toBe(0);
      expect(result.payoutsByStatus).toEqual({ pending: 0, processed: 0, failed: 0 });
    });

    it('returns programs with per-program referralCounts attached', async () => {
      const { getMerchantStats } = await import('../api/src/repos/dashboardRepo.js');

      const program = createMockProgram({ id: 'prog-1' });
      query.mockResolvedValueOnce({ rows: [program] });
      query.mockResolvedValueOnce({ rows: [{ program_id: 'prog-1', status: 'paid', count: '5' }] });
      query.mockResolvedValueOnce({ rows: [] });

      const result = await getMerchantStats('merchant-123');

      expect(result.programs).toHaveLength(1);
      expect(result.programs[0].id).toBe('prog-1');
      expect(result.programs[0].referralCounts).toEqual({ pending: 0, eligible: 0, paid: 5, failed: 0 });
    });

    it('aggregates totalReferrals and referralsByStatus correctly across programs', async () => {
      const { getMerchantStats } = await import('../api/src/repos/dashboardRepo.js');

      const program1 = createMockProgram({ id: 'prog-1' });
      const program2 = createMockProgram({ id: 'prog-2' });
      query.mockResolvedValueOnce({ rows: [program1, program2] });
      query.mockResolvedValueOnce({ rows: [
        { program_id: 'prog-1', status: 'paid', count: '2' },
        { program_id: 'prog-1', status: 'pending', count: '3' },
        { program_id: 'prog-2', status: 'paid', count: '4' },
      ]});
      query.mockResolvedValueOnce({ rows: [] });

      const result = await getMerchantStats('merchant-123');

      expect(result.totalReferrals).toBe(9);
      expect(result.referralsByStatus).toEqual({ pending: 3, eligible: 0, paid: 6, failed: 0 });
    });

    it('aggregates totalPayoutsCents and payoutsByStatus', async () => {
      const { getMerchantStats } = await import('../api/src/repos/dashboardRepo.js');

      const program = createMockProgram({ id: 'prog-1' });
      query.mockResolvedValueOnce({ rows: [program] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [
        { status: 'processed', total_cents: '5000' },
        { status: 'pending', total_cents: '2000' },
      ]});

      const result = await getMerchantStats('merchant-123');

      expect(result.totalPayoutsCents).toBe(7000);
      expect(result.payoutsByStatus).toEqual({ pending: 2000, processed: 5000, failed: 0 });
    });

    it('uses parameterised queries (no injection possible)', async () => {
      const { getMerchantStats } = await import('../api/src/repos/dashboardRepo.js');

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await getMerchantStats("merchant-dROP'; DROP TABLE programs; --");

      const calls = query.mock.calls;
      for (const [sql] of calls) {
        expect(sql).not.toContain('DROP TABLE');
        expect(sql).not.toMatch(/\$\{.*\}/);
      }
    });
  });

  // ============================================
  // dashboardRepo.getProgramStats
  // ============================================

  describe('dashboardRepo.getProgramStats', () => {
    it('returns null when program not found (merchant check)', async () => {
      const { getProgramStats } = await import('../api/src/repos/dashboardRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      const result = await getProgramStats('prog-999', 'merchant-123');

      expect(result).toBeNull();
    });

    it('returns null when program belongs to different merchant', async () => {
      const { getProgramStats } = await import('../api/src/repos/dashboardRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      const result = await getProgramStats('prog-123', 'merchant-other');

      expect(result).toBeNull();
    });

    it('returns program, advocateCount, referral/payout breakdowns when found', async () => {
      const { getProgramStats } = await import('../api/src/repos/dashboardRepo.js');

      const program = createMockProgram({ id: 'prog-123', merchant_id: 'merchant-123' });
      query.mockResolvedValueOnce({ rows: [program] });
      query.mockResolvedValueOnce({ rows: [{ count: '10' }] });
      query.mockResolvedValueOnce({ rows: [
        { status: 'paid', count: '5' },
        { status: 'pending', count: '3' },
      ]});
      query.mockResolvedValueOnce({ rows: [
        { status: 'processed', total_cents: '5000' },
      ]});

      const result = await getProgramStats('prog-123', 'merchant-123');

      expect(result).not.toBeNull();
      expect(result.program.id).toBe('prog-123');
      expect(result.advocateCount).toBe(10);
      expect(result.referralsByStatus).toEqual({ pending: 3, eligible: 0, paid: 5, failed: 0 });
      expect(result.totalReferrals).toBe(8);
      expect(result.payoutsByStatus).toEqual({ pending: 0, processed: 5000, failed: 0 });
      expect(result.totalPayoutsCents).toBe(5000);
    });

    it('uses parameterised queries', async () => {
      const { getProgramStats } = await import('../api/src/repos/dashboardRepo.js');

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await getProgramStats("prog-injection'; DROP TABLE --", "merchant-inject");

      const calls = query.mock.calls;
      for (const [sql] of calls) {
        expect(sql).not.toContain('DROP TABLE');
        expect(sql).toMatch(/\$[0-9]+/);
      }
    });
  });

  // ============================================
  // dashboardService
  // ============================================

  describe('dashboardService.getMerchantStats', () => {
    it('passes through to repo', async () => {
      const { getMerchantStats } = await import('../api/src/services/dashboardService.js');

      const expectedResult = {
        programs: [],
        totalReferrals: 0,
        referralsByStatus: { pending: 0, eligible: 0, paid: 0, failed: 0 },
        totalPayoutsCents: 0,
        payoutsByStatus: { pending: 0, processed: 0, failed: 0 },
      };
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      const result = await getMerchantStats('merchant-123');

      expect(result).toEqual(expectedResult);
    });
  });

  describe('dashboardService.getProgramStats', () => {
    it('throws 404 when repo returns null (merchant check)', async () => {
      const { getProgramStats } = await import('../api/src/services/dashboardService.js');

      query.mockResolvedValueOnce({ rows: [] });

      await expect(getProgramStats('prog-999', 'merchant-123')).rejects.toThrow('Program not found');
    });

    it('returns stats when repo finds program', async () => {
      const { getProgramStats } = await import('../api/src/services/dashboardService.js');

      const program = createMockProgram({ merchant_id: 'merchant-123' });
      query.mockResolvedValueOnce({ rows: [program] });
      query.mockResolvedValueOnce({ rows: [{ count: '5' }] });
      query.mockResolvedValueOnce({ rows: [{ status: 'paid', count: '3' }] });
      query.mockResolvedValueOnce({ rows: [{ status: 'processed', total_cents: '3000' }] });

      const result = await getProgramStats('prog-123', 'merchant-123');

      expect(result.program.id).toBe('prog-123');
      expect(result.advocateCount).toBe(5);
    });
  });

  // ============================================
  // dashboardController
  // ============================================

  describe('dashboardController.getDashboard', () => {
    it('calls service with req.merchantId, returns JSON', async () => {
      const { getDashboard } = await import('../api/src/controllers/dashboardController.js');

      const mockReq = { merchantId: 'merchant-123' };
      const mockRes = {
        json: vi.fn(),
      };
      const mockNext = vi.fn();

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await getDashboard(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          programs: [],
          totalReferrals: 0,
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('propagates errors to next(err)', async () => {
      const { getDashboard } = await import('../api/src/controllers/dashboardController.js');

      const mockReq = { merchantId: 'merchant-123' };
      const mockRes = {};
      const mockNext = vi.fn();

      query.mockRejectedValueOnce(new Error('DB error'));

      await getDashboard(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('dashboardController.getProgramDetail', () => {
    it('calls service with req.params.programId and req.merchantId', async () => {
      const { getProgramDetail } = await import('../api/src/controllers/dashboardController.js');

      const mockReq = { params: { programId: 'prog-123' }, merchantId: 'merchant-456' };
      const mockRes = { json: vi.fn() };
      const mockNext = vi.fn();

      const program = createMockProgram({ merchant_id: 'merchant-456' });
      query.mockResolvedValueOnce({ rows: [program] });
      query.mockResolvedValueOnce({ rows: [{ count: '2' }] });
      query.mockResolvedValueOnce({ rows: [{ status: 'paid', count: '2' }] });
      query.mockResolvedValueOnce({ rows: [{ status: 'processed', total_cents: '2000' }] });

      await getProgramDetail(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          program: expect.objectContaining({ id: 'prog-123' }),
        })
      );
    });

    it('propagates errors to next(err)', async () => {
      const { getProgramDetail } = await import('../api/src/controllers/dashboardController.js');

      const mockReq = { params: { programId: 'prog-123' }, merchantId: 'merchant-456' };
      const mockRes = {};
      const mockNext = vi.fn();

      query.mockRejectedValueOnce(new Error('DB error'));

      await getProgramDetail(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ============================================
  // dashboard routes
  // ============================================

  describe('dashboard routes', () => {
    it('GET / calls getDashboard', async () => {
      const fs = await import('fs');
      const routeCode = fs.readFileSync('./api/src/routes/dashboard.js', 'utf-8');

      expect(routeCode).toContain('getDashboard');
      expect(routeCode).toMatch(/router\.get\("\/"/);
    });

    it('GET /programs/:programId calls getProgramDetail', async () => {
      const fs = await import('fs');
      const routeCode = fs.readFileSync('./api/src/routes/dashboard.js', 'utf-8');

      expect(routeCode).toContain('getProgramDetail');
      expect(routeCode).toMatch(/router\.get\("\/programs\/:programId"/);
    });

    it('Route module exports router with 2 routes', async () => {
      await import('../api/src/routes/dashboard.js');
      const fs = await import('fs');
      const routeCode = fs.readFileSync('./api/src/routes/dashboard.js', 'utf-8');

      const getMatches = routeCode.match(/router\.get\(/g);
      expect(getMatches).toHaveLength(2);
    });

    it('Auth middleware requireAuth is imported in dashboard routes', async () => {
      const fs = await import('fs');
      const routeCode = fs.readFileSync('./api/src/routes/dashboard.js', 'utf-8');

      expect(routeCode).toContain('requireAuth');
      expect(routeCode).toContain('import { requireAuth }');
    });
  });

  // ============================================
  // Frontend: lib/api.js fetchWithAuth
  // ============================================

  describe('fetchWithAuth', () => {
    beforeEach(() => {
      vi.stubGlobal('localStorage', {
        getItem: vi.fn(),
        removeItem: vi.fn(),
      });
      vi.stubGlobal('window', {
        location: { href: '' },
      });
      global.fetch = vi.fn();
    });

    it('attaches Authorization: Bearer <token> header from localStorage', async () => {
      localStorage.getItem.mockReturnValue('test-token-123');

      const { fetchWithAuth } = await import('../frontend/src/lib/api.js');

      fetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: { get: vi.fn(() => 'application/json') },
        json: vi.fn().mockResolvedValueOnce({ data: 'test' }),
      });

      await fetchWithAuth('/api/test');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
          }),
        })
      );
    });

    it('returns parsed JSON on success', async () => {
      localStorage.getItem.mockReturnValue('test-token');

      const { fetchWithAuth } = await import('../frontend/src/lib/api.js');

      fetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: { get: vi.fn(() => 'application/json') },
        json: vi.fn().mockResolvedValueOnce({ result: 'ok' }),
      });

      const result = await fetchWithAuth('/api/test');

      expect(result).toEqual({ result: 'ok' });
    });

    it('throws Error on non-2xx response', async () => {
      localStorage.getItem.mockReturnValue('test-token');

      const { fetchWithAuth } = await import('../frontend/src/lib/api.js');

      fetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        headers: { get: vi.fn(() => 'application/json') },
        json: vi.fn().mockResolvedValueOnce({ error: 'Bad request' }),
      });

      await expect(fetchWithAuth('/api/test')).rejects.toThrow('Bad request');
    });

    it('does NOT follow redirects or throw on 2xx', async () => {
      localStorage.getItem.mockReturnValue('test-token');

      const { fetchWithAuth } = await import('../frontend/src/lib/api.js');

      fetch.mockResolvedValueOnce({
        status: 201,
        ok: true,
        headers: { get: vi.fn(() => 'application/json') },
        json: vi.fn().mockResolvedValueOnce({ created: true }),
      });

      const result = await fetchWithAuth('/api/test');

      expect(result).toEqual({ created: true });
    });
  });

  // ============================================
  // Frontend: StatCard.jsx
  // ============================================

  describe('StatCard', () => {
    it('renders label, value, optional subtext', async () => {
      const { render } = await import('@testing-library/react');
      const { default: StatCard } = await import('../frontend/src/components/StatCard.jsx');

      const { getByText } = render(StatCard({ label: 'Total Referrals', value: '42', subtext: 'this month' }));

      expect(getByText('Total Referrals')).toBeTruthy();
      expect(getByText('42')).toBeTruthy();
      expect(getByText('this month')).toBeTruthy();
    });

    it('applies color style when provided', async () => {
      const { render } = await import('@testing-library/react');
      const { default: StatCard } = await import('../frontend/src/components/StatCard.jsx');

      const { getByText } = render(StatCard({ label: 'Test', value: '10', color: 'var(--color-primary)' }));

      const valueEl = getByText('10');
      expect(valueEl.style.color).toBe('var(--color-primary)');
    });
  });

  // ============================================
  // Frontend: ProgramRow.jsx
  // ============================================

  describe('ProgramRow', () => {
    it('renders program name, status badge, total referrals, reward amount', async () => {
      const { render } = await import('@testing-library/react');
      const React = await import('react');
      const { default: ProgramRow } = await import('../frontend/src/components/ProgramRow.jsx');

      const program = { id: 'prog-1', name: 'My Program', is_active: true, reward_amount_cents: 1500 };
      const referralCounts = { pending: 2, eligible: 1, paid: 3, failed: 0 };

      const { getByText } = render(
        React.createElement(ProgramRow, { program, referralCounts })
      );

      expect(getByText('My Program')).toBeTruthy();
      expect(getByText('Active')).toBeTruthy();
      expect(getByText('6')).toBeTruthy();
      expect(getByText('$15.00')).toBeTruthy();
    });

    it('Total referrals = sum of referralCounts values', async () => {
      const { render } = await import('@testing-library/react');
      const React = await import('react');
      const { default: ProgramRow } = await import('../frontend/src/components/ProgramRow.jsx');

      const program = { id: 'prog-1', name: 'Test', is_active: false, reward_amount_cents: 500 };
      const referralCounts = { pending: 5, eligible: 2, paid: 10, failed: 1 };

      const { getByText } = render(
        React.createElement(ProgramRow, { program, referralCounts })
      );

      expect(getByText('18')).toBeTruthy();
    });
  });
});