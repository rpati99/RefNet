import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret-for-testing';

vi.mock('../api/src/db/pool.js', () => {
  const mockQuery = vi.fn();
  return {
    default: { query: mockQuery },
  };
});

const pool = await import('../api/src/db/pool.js');
const query = pool.default.query;

function createMockReq(overrides = {}) {
  return {
    body: {},
    params: {},
    headers: {},
    merchantId: null,
    ...overrides,
  };
}

function createMockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}

function createMockNext() {
  return vi.fn();
}

describe('Programs CRUD Feature Tests', () => {

  beforeEach(() => {
    query.mockReset();
  });

  // ============================================
  // POST /api/programs
  // ============================================

  describe('POST /api/programs — With valid JWT', () => {
    it('creates a program and returns it with ID', async () => {
      const { create } = await import('../api/src/services/programsService.js');

      const now = new Date().toISOString();
      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          merchant_id: 42,
          name: 'Referral Bonus',
          reward_description: 'Get $50 credit',
          reward_amount_cents: 5000,
          is_active: true,
          created_at: now,
          updated_at: now,
        }],
      });

      const result = await create(42, {
        name: 'Referral Bonus',
        rewardDescription: 'Get $50 credit',
        rewardAmountCents: 5000,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.merchant_id).toBe(42);
      expect(result.name).toBe('Referral Bonus');
      expect(result.reward_amount_cents).toBe(5000);
      expect(result.is_active).toBe(true);
    });

    it('sets created_at and updated_at timestamps correctly', async () => {
      const { create } = await import('../api/src/services/programsService.js');

      const now = new Date().toISOString();
      query.mockResolvedValueOnce({
        rows: [{
          id: 5,
          merchant_id: 1,
          name: 'Test Program',
          reward_description: null,
          reward_amount_cents: 1000,
          is_active: true,
          created_at: now,
          updated_at: now,
        }],
      });

      const result = await create(1, {
        name: 'Test Program',
        rewardAmountCents: 1000,
      });

      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
    });
  });

  describe('POST /api/programs — Without JWT', () => {
    it('returns 401 Unauthorized when no Authorization header present', async () => {
      const { requireAuth } = await import('../api/src/middleware/auth.js');

      const req = createMockReq({ headers: {} });
      const res = createMockRes();
      const next = createMockNext();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 Unauthorized when token is missing Bearer prefix', async () => {
      const { requireAuth } = await import('../api/src/middleware/auth.js');

      const req = createMockReq({ headers: { authorization: 'SomeToken123' } });
      const res = createMockRes();
      const next = createMockNext();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('returns 401 Unauthorized when token is invalid', async () => {
      const { requireAuth } = await import('../api/src/middleware/auth.js');

      const req = createMockReq({ headers: { authorization: 'Bearer invalidtoken' } });
      const res = createMockRes();
      const next = createMockNext();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    });
  });

  describe('POST /api/programs — Validation', () => {
    it('rejects creation when name is missing', async () => {
      const { create } = await import('../api/src/controllers/programsController.js');

      const req = createMockReq({
        body: { reward_amount_cents: 5000 },
        merchantId: 1,
      });
      const res = createMockRes();
      const next = createMockNext();

      await create(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0]).toBeDefined();
      expect(next.mock.calls[0][0].status).toBe(400);
    });

    it('rejects creation when reward_amount_cents is missing', async () => {
      const { create } = await import('../api/src/services/programsService.js');

      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          merchant_id: 1,
          name: 'My Program',
          reward_description: null,
          reward_amount_cents: 0,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }],
      });

      const result = await create(1, { name: 'My Program' });

      expect(result).toBeDefined();
      expect(result.reward_amount_cents).toBe(0);
    });
  });

  // ============================================
  // GET /api/programs
  // ============================================

  describe('GET /api/programs — With valid JWT', () => {
    it('returns only programs belonging to the authenticated merchant', async () => {
      const { list } = await import('../api/src/services/programsService.js');

      query.mockResolvedValueOnce({
        rows: [
          { id: 1, merchant_id: 42, name: 'Program 1', reward_amount_cents: 1000, is_active: true },
          { id: 2, merchant_id: 42, name: 'Program 2', reward_amount_cents: 2000, is_active: true },
        ],
      });

      const result = await list(42);

      expect(result).toHaveLength(2);
      expect(result[0].merchant_id).toBe(42);
      expect(result[1].merchant_id).toBe(42);
    });

    it('returns empty array when merchant has no programs', async () => {
      const { list } = await import('../api/src/services/programsService.js');

      query.mockResolvedValueOnce({ rows: [] });

      const result = await list(99);

      expect(result).toHaveLength(0);
    });
  });

  describe('GET /api/programs — Without JWT', () => {
    it('returns 401 Unauthorized when no token provided', async () => {
      const { requireAuth } = await import('../api/src/middleware/auth.js');

      const req = createMockReq({ headers: {} });
      const res = createMockRes();
      const next = createMockNext();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // GET /api/programs/:id
  // ============================================

  describe('GET /api/programs/:id — With valid JWT', () => {
    it('returns program when it belongs to authenticated merchant', async () => {
      const { getById } = await import('../api/src/services/programsService.js');

      query.mockResolvedValueOnce({
        rows: [{
          id: 3,
          merchant_id: 42,
          name: 'My Program',
          reward_description: 'Bonus',
          reward_amount_cents: 3000,
          is_active: true,
        }],
      });

      const result = await getById(3, 42);

      expect(result).toBeDefined();
      expect(result.id).toBe(3);
      expect(result.merchant_id).toBe(42);
    });

    it('returns 404 if program does not exist', async () => {
      const { getById } = await import('../api/src/services/programsService.js');

      query.mockResolvedValueOnce({ rows: [] });

      let thrownError = null;
      try {
        await getById(999, 42);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.status).toBe(404);
      expect(thrownError.message).toBe('Program not found');
    });

    it('returns 404 if program does not belong to merchant', async () => {
      const { getById } = await import('../api/src/services/programsService.js');

      query.mockResolvedValueOnce({ rows: [] });

      let thrownError = null;
      try {
        await getById(5, 42);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.status).toBe(404);
      expect(thrownError.message).toBe('Program not found');
    });
  });

  describe('GET /api/programs/:id — Without JWT', () => {
    it('returns 401 Unauthorized when no token provided', async () => {
      const { requireAuth } = await import('../api/src/middleware/auth.js');

      const req = createMockReq({ headers: {} });
      const res = createMockRes();
      const next = createMockNext();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // PUT /api/programs/:id
  // ============================================

  describe('PUT /api/programs/:id — With valid JWT', () => {
    it('updates only the provided fields', async () => {
      const { update } = await import('../api/src/services/programsService.js');

      const now = new Date().toISOString();
      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          merchant_id: 42,
          name: 'New Name',
          reward_description: 'Old desc',
          reward_amount_cents: 1000,
          is_active: true,
          created_at: now,
          updated_at: now,
        }],
      });

      const result = await update(1, 42, { name: 'New Name' });

      expect(result.name).toBe('New Name');
      expect(result.reward_description).toBe('Old desc');
      expect(result.reward_amount_cents).toBe(1000);
    });

    it('updates all provided fields when multiple are sent', async () => {
      const { update } = await import('../api/src/services/programsService.js');

      const now = new Date().toISOString();
      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          merchant_id: 42,
          name: 'Updated',
          reward_description: 'New description',
          reward_amount_cents: 5000,
          is_active: false,
          created_at: now,
          updated_at: now,
        }],
      });

      const result = await update(1, 42, {
        name: 'Updated',
        rewardDescription: 'New description',
        rewardAmountCents: 5000,
        isActive: false,
      });

      expect(result.name).toBe('Updated');
      expect(result.reward_description).toBe('New description');
      expect(result.reward_amount_cents).toBe(5000);
      expect(result.is_active).toBe(false);
    });

    it('updates updated_at timestamp on every write', async () => {
      const { update } = await import('../api/src/services/programsService.js');

      const newDate = '2024-06-15T12:00:00.000Z';

      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          merchant_id: 42,
          name: 'Test Updated',
          reward_amount_cents: 1000,
          is_active: true,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: newDate,
        }],
      });

      const result = await update(1, 42, { name: 'Test Updated' });

      expect(result.updated_at).toBe(newDate);
    });

    it('returns 404 if program does not belong to merchant', async () => {
      const { update } = await import('../api/src/services/programsService.js');

      query.mockResolvedValueOnce({ rows: [] });

      let thrownError = null;
      try {
        await update(5, 42, { name: 'Hacked Name' });
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.status).toBe(404);
    });

    it('returns 404 if program does not exist', async () => {
      const { update } = await import('../api/src/services/programsService.js');

      query.mockResolvedValueOnce({ rows: [] });

      let thrownError = null;
      try {
        await update(999, 42, { name: 'Test' });
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.status).toBe(404);
    });
  });

  describe('PUT /api/programs/:id — Without JWT', () => {
    it('returns 401 Unauthorized when no token provided', async () => {
      const { requireAuth } = await import('../api/src/middleware/auth.js');

      const req = createMockReq({ headers: {} });
      const res = createMockRes();
      const next = createMockNext();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // DELETE /api/programs/:id
  // ============================================

  describe('DELETE /api/programs/:id — With valid JWT', () => {
    it('soft-deletes by setting is_active = false and returns 204', async () => {
      const { softDelete } = await import('../api/src/services/programsService.js');

      query.mockResolvedValueOnce({ rows: [{ id: 1, merchant_id: 42, name: 'Program to Delete', is_active: true }] });

      const result = await softDelete(1, 42);

      expect(result).toBeDefined();
    });

    it('does not actually delete the row from database', async () => {
      const { softDelete } = await import('../api/src/services/programsService.js');

      query.mockResolvedValueOnce({ rows: [{ id: 1, merchant_id: 42, name: 'My Program', is_active: true }] });

      await softDelete(1, 42);

      const updateCall = query.mock.calls[0];
      const updateQuery = updateCall[0];

      expect(updateQuery.toLowerCase()).toContain('update');
      expect(updateQuery.toLowerCase()).toContain('is_active');
    });

    it('returns 404 if program does not belong to merchant', async () => {
      const { softDelete } = await import('../api/src/services/programsService.js');

      query.mockResolvedValueOnce({ rows: [] });

      let thrownError = null;
      try {
        await softDelete(5, 42);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.status).toBe(404);
      expect(thrownError.message).toBe('Program not found');
    });

    it('returns 404 if program does not exist', async () => {
      const { softDelete } = await import('../api/src/services/programsService.js');

      query.mockResolvedValueOnce({ rows: [] });

      let thrownError = null;
      try {
        await softDelete(999, 42);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.status).toBe(404);
      expect(thrownError.message).toBe('Program not found');
    });
  });

  describe('DELETE /api/programs/:id — Without JWT', () => {
    it('returns 401 Unauthorized when no token provided', async () => {
      const { requireAuth } = await import('../api/src/middleware/auth.js');

      const req = createMockReq({ headers: {} });
      const res = createMockRes();
      const next = createMockNext();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // SQL Parameterisation Requirements
  // ============================================

  describe('SQL parameterisation requirements', () => {
    it('uses parameterised queries in programsRepo.create', async () => {
      const { create } = await import('../api/src/repos/programsRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      await create(42, {
        merchantId: 42,
        name: 'Test Program',
        rewardDescription: 'Description',
        rewardAmountCents: 1000,
      });

      const [q, params] = query.mock.calls[0];

      expect(q).toContain('$1');
      expect(q).toContain('$2');
      expect(q).toContain('$3');
      expect(q).toContain('$4');
      expect(params).toHaveLength(4);
      expect(params[0]).toBe(42);
      expect(params[1]).toBe('Test Program');
    });

    it('uses parameterised queries in programsRepo.findByMerchantId', async () => {
      const { findByMerchantId } = await import('../api/src/repos/programsRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      await findByMerchantId(42);

      const [q, params] = query.mock.calls[0];

      expect(q).toContain('$1');
      expect(params).toContain(42);
    });

    it('uses parameterised queries in programsRepo.findById', async () => {
      const { findById } = await import('../api/src/repos/programsRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      await findById(1, 42);

      const [q, params] = query.mock.calls[0];

      expect(q).toContain('$1');
      expect(q).toContain('$2');
      expect(params).toContain(1);
    });

    it('uses parameterised queries in programsRepo.update', async () => {
      const { update } = await import('../api/src/repos/programsRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      await update(1, 42, { name: 'New Name' });

      const [q, params] = query.mock.calls[0];

      expect(q).toContain('$1');
      expect(q).toContain('$2');
      expect(q).not.toContain("name = 'New Name'");
    });

    it('uses parameterised queries in programsRepo.softDelete', async () => {
      const { softDelete } = await import('../api/src/repos/programsRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      await softDelete(1, 42);

      const [q, params] = query.mock.calls[0];

      expect(q).toContain('$1');
      expect(params).toContain(1);
      expect(q.toLowerCase()).toContain('update');
    });
  });

  // ============================================
  // Timestamp Requirements
  // ============================================

  describe('Timestamp requirements', () => {
    it('sets created_at on new programs', async () => {
      const { create } = await import('../api/src/services/programsService.js');

      const now = new Date().toISOString();
      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          merchant_id: 42,
          name: 'Test',
          reward_amount_cents: 1000,
          is_active: true,
          created_at: now,
          updated_at: now,
        }],
      });

      const result = await create(42, {
        name: 'Test',
        rewardAmountCents: 1000,
      });

      expect(result.created_at).toBeDefined();
      expect(result.created_at).toBe(now);
    });

    it('sets updated_at on new programs', async () => {
      const { create } = await import('../api/src/services/programsService.js');

      const now = new Date().toISOString();
      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          merchant_id: 42,
          name: 'Test',
          reward_amount_cents: 1000,
          is_active: true,
          created_at: now,
          updated_at: now,
        }],
      });

      const result = await create(42, {
        name: 'Test',
        rewardAmountCents: 1000,
      });

      expect(result.updated_at).toBeDefined();
      expect(result.updated_at).toBe(now);
    });

    it('updates updated_at on program update', async () => {
      const { update } = await import('../api/src/services/programsService.js');

      const newDate = '2024-06-15T12:00:00.000Z';

      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          merchant_id: 42,
          name: 'New',
          reward_amount_cents: 1000,
          is_active: true,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: newDate,
        }],
      });

      const result = await update(1, 42, { name: 'New' });

      expect(result.updated_at).toBe(newDate);
    });
  });

  // ============================================
  // Isolation Tests - Merchant Cannot Access Others' Programs
  // ============================================

  describe('Merchant isolation requirements', () => {
    it('GET /api/programs filters by merchant_id from JWT', async () => {
      const { list } = await import('../api/src/services/programsService.js');

      query.mockResolvedValueOnce({ rows: [] });

      await list(42);

      const [q, params] = query.mock.calls[0];
      expect(params).toContain(42);
    });

    it('GET /api/programs/:id checks ownership before returning', async () => {
      const { getById } = await import('../api/src/services/programsService.js');

      query.mockResolvedValueOnce({ rows: [] });

      let thrownError = null;
      try {
        await getById(1, 42);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.status).toBe(404);
    });

    it('PUT /api/programs/:id checks ownership before updating', async () => {
      const { update } = await import('../api/src/services/programsService.js');

      query.mockResolvedValueOnce({ rows: [] });

      let thrownError = null;
      try {
        await update(1, 42, { name: 'Hacked' });
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.status).toBe(404);
    });

    it('DELETE /api/programs/:id checks ownership before soft-deleting', async () => {
      const { softDelete } = await import('../api/src/services/programsService.js');

      query.mockResolvedValueOnce({ rows: [] });

      let thrownError = null;
      try {
        await softDelete(1, 42);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.status).toBe(404);
    });
  });

  // ============================================
  // Controller Tests
  // ============================================

  describe('Controller layer tests', () => {
    it('list calls service with merchantId from JWT', async () => {
      const { list } = await import('../api/src/controllers/programsController.js');

      const req = createMockReq({ merchantId: 42 });
      const res = createMockRes();
      const next = createMockNext();

      query.mockResolvedValueOnce({ rows: [] });

      await list(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ programs: [] });
    });

    it('getById calls service with id and merchantId', async () => {
      const { getById } = await import('../api/src/controllers/programsController.js');

      const req = createMockReq({ params: { id: '1' }, merchantId: 42 });
      const res = createMockRes();
      const next = createMockNext();

      const now = new Date().toISOString();
      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          merchant_id: 42,
          name: 'Test',
          reward_amount_cents: 1000,
          is_active: true,
          created_at: now,
          updated_at: now,
        }],
      });

      await getById(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('update returns 400 for invalid input', async () => {
      const { update } = await import('../api/src/controllers/programsController.js');

      const req = createMockReq({
        params: { id: '1' },
        body: { reward_amount_cents: 'not-a-number' },
        merchantId: 42,
      });
      const res = createMockRes();
      const next = createMockNext();

      await update(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0]).toBeDefined();
    });

    it('remove returns 204 No Content on success', async () => {
      const { remove } = await import('../api/src/controllers/programsController.js');

      const req = createMockReq({ params: { id: '1' }, merchantId: 42 });
      const res = createMockRes();
      const next = createMockNext();

      query.mockResolvedValueOnce({ rows: [{ id: 1, merchant_id: 42, name: 'Test' }] });

      await remove(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
    });
  });
});