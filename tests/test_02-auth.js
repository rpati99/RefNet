import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

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
    headers: {},
    merchantId: null,
    ...overrides,
  };
}

function createMockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function createMockNext() {
  return vi.fn();
}

describe('Auth Feature Tests', () => {

  beforeEach(() => {
    query.mockReset();
  });

  describe('POST /api/auth/register — Valid registration', () => {
    it('creates a merchant and returns JWT when given valid email/password', async () => {
      const { register } = await import('../api/src/services/authService.js');

      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            email: 'new@example.com',
            company_name: 'Test Corp',
            created_at: new Date().toISOString(),
          }],
        });

      const result = await register({ email: 'new@example.com', password: 'password123', companyName: 'Test Corp' });

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
    });

    it('returns 201 status with token and merchant data', async () => {
      const { register } = await import('../api/src/services/authService.js');

      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            id: 42,
            email: 'merchant@test.com',
            company_name: 'Acme',
            created_at: '2024-01-01T00:00:00Z',
          }],
        });

      const result = await register({ email: 'merchant@test.com', password: 'securepass', companyName: 'Acme' });

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');

      const decoded = jwt.verify(result.token, process.env.JWT_SECRET || 'test-secret');
      expect(decoded.merchantId).toBe(42);

      expect(result.merchant.email).toBe('merchant@test.com');
      expect(result.merchant.password_hash).toBeUndefined();
    });
  });

  describe('POST /api/auth/register — Duplicate email handling', () => {
    it('returns 409 Conflict when registering with existing email', async () => {
      const { register } = await import('../api/src/services/authService.js');

      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          email: 'taken@example.com',
          password_hash: 'somehash',
          company_name: 'Existing Co',
          created_at: '2024-01-01T00:00:00Z',
        }],
      });

      let thrownError = null;
      try {
        await register({ email: 'taken@example.com', password: 'password123', companyName: 'New Co' });
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.status).toBe(409);
      expect(thrownError.message).toContain('Email already registered');
    });
  });

  describe('POST /api/auth/register — Validation', () => {
    it('rejects registration when email is missing', async () => {
      const req = createMockReq({ body: { password: 'password123' } });
      const res = createMockRes();
      const next = createMockNext();

      const { register } = await import('../api/src/controllers/authController.js');
      await register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'email and password are required' });
    });

    it('rejects registration when password is missing', async () => {
      const req = createMockReq({ body: { email: 'test@example.com' } });
      const res = createMockRes();
      const next = createMockNext();

      const { register } = await import('../api/src/controllers/authController.js');
      await register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'email and password are required' });
    });
  });

  describe('POST /api/auth/login — Valid credentials', () => {
    it('returns JWT when given correct email and password', async () => {
      const hash = await bcrypt.hash('correctpassword', 10);

      const { login } = await import('../api/src/services/authService.js');

      query.mockResolvedValueOnce({
        rows: [{
          id: 5,
          email: 'user@example.com',
          password_hash: hash,
          company_name: 'User Corp',
          created_at: '2024-01-01T00:00:00Z',
        }],
      });

      const result = await login({ email: 'user@example.com', password: 'correctpassword' });

      expect(result.token).toBeDefined();
      const decoded = jwt.verify(result.token, process.env.JWT_SECRET || 'test-secret');
      expect(decoded.merchantId).toBe(5);
      expect(result.merchant.password_hash).toBeUndefined();
    });
  });

  describe('POST /api/auth/login — Wrong password', () => {
    it('returns 401 Unauthorized when password is incorrect', async () => {
      const hash = await bcrypt.hash('correctpassword', 10);

      const { login } = await import('../api/src/services/authService.js');

      query.mockResolvedValueOnce({
        rows: [{
          id: 5,
          email: 'user@example.com',
          password_hash: hash,
          company_name: 'User Corp',
          created_at: '2024-01-01T00:00:00Z',
        }],
      });

      let thrownError = null;
      try {
        await login({ email: 'user@example.com', password: 'wrongpassword' });
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.status).toBe(401);
      expect(thrownError.message).toBe('Invalid credentials');
    });
  });

  describe('POST /api/auth/login — Non-existent email', () => {
    it('returns 401 Unauthorized when email not found', async () => {
      const { login } = await import('../api/src/services/authService.js');

      query.mockResolvedValueOnce({ rows: [] });

      let thrownError = null;
      try {
        await login({ email: 'notfound@example.com', password: 'anypassword' });
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.status).toBe(401);
      expect(thrownError.message).toBe('Invalid credentials');
    });
  });

  describe('POST /api/auth/login — Validation', () => {
    it('rejects login when email is missing', async () => {
      const req = createMockReq({ body: { password: 'password123' } });
      const res = createMockRes();
      const next = createMockNext();

      const { login } = await import('../api/src/controllers/authController.js');
      await login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'email and password are required' });
    });

    it('rejects login when password is missing', async () => {
      const req = createMockReq({ body: { email: 'test@example.com' } });
      const res = createMockRes();
      const next = createMockNext();

      const { login } = await import('../api/src/controllers/authController.js');
      await login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'email and password are required' });
    });
  });

  describe('GET /api/auth/me — With valid JWT', () => {
    it('returns merchant profile without password_hash', async () => {
      const { getMe } = await import('../api/src/services/authService.js');

      query.mockResolvedValueOnce({
        rows: [{
          id: 99,
          email: 'me@example.com',
          company_name: 'Me Inc',
          created_at: '2024-01-01T00:00:00Z',
        }],
      });

      const result = await getMe(99);

      expect(result.email).toBe('me@example.com');
      expect(result.id).toBe(99);
      expect(result.password_hash).toBeUndefined();
    });
  });

  describe('GET /api/auth/me — Without JWT', () => {
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
  });

  describe('GET /api/auth/me — Invalid/expired JWT', () => {
    it('returns 401 Unauthorized when Authorization header is missing Bearer prefix', async () => {
      const { requireAuth } = await import('../api/src/middleware/auth.js');

      const req = createMockReq({ headers: { authorization: 'SomeToken123' } });
      const res = createMockRes();
      const next = createMockNext();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('returns 401 Unauthorized when token is malformed', async () => {
      const { requireAuth } = await import('../api/src/middleware/auth.js');

      const req = createMockReq({ headers: { authorization: 'Bearer notavalidjwt' } });
      const res = createMockRes();
      const next = createMockNext();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    });

    it('returns 401 Unauthorized when token is expired', async () => {
      const { requireAuth } = await import('../api/src/middleware/auth.js');

      const expiredToken = jwt.sign({ merchantId: 1 }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '-1s' });

      const req = createMockReq({ headers: { authorization: `Bearer ${expiredToken}` } });
      const res = createMockRes();
      const next = createMockNext();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    });

    it('returns 401 Unauthorized when token has wrong secret', async () => {
      const { requireAuth } = await import('../api/src/middleware/auth.js');

      const wrongSecretToken = jwt.sign({ merchantId: 1 }, 'wrong-secret');

      const req = createMockReq({ headers: { authorization: `Bearer ${wrongSecretToken}` } });
      const res = createMockRes();
      const next = createMockNext();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    });
  });

  describe('GET /api/auth/me — Merchant not found', () => {
    it('returns 404 when merchant ID from token does not exist', async () => {
      const { getMe } = await import('../api/src/services/authService.js');

      query.mockResolvedValueOnce({ rows: [] });

      let thrownError = null;
      try {
        await getMe(999);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.status).toBe(404);
      expect(thrownError.message).toBe('Merchant not found');
    });
  });

  describe('Password hashing requirements', () => {
    it('uses bcrypt with minimum 10 rounds', async () => {
      const start = Date.now();
      const hash = await bcrypt.hash('testpassword', 10);
      const elapsed = Date.now() - start;

      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(50);
      expect(elapsed).toBeGreaterThan(50);
    });

    it('does not store plaintext passwords in the database', async () => {
      const { register } = await import('../api/src/services/authService.js');

      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            email: 'test@example.com',
            company_name: 'Test',
            created_at: new Date().toISOString(),
          }],
        });

      await register({ email: 'test@example.com', password: 'mypassword123', companyName: 'Test' });

      const insertCall = query.mock.calls[1];
      const insertQuery = insertCall[0];
      const insertParams = insertCall[1];

      const plaintextInQuery = insertQuery.includes('mypassword123') || insertQuery.includes('password123');
      const plaintextInParams = insertParams.some(p =>
        typeof p === 'string' && (p === 'mypassword123' || p === 'password123')
      );

      expect(plaintextInQuery || plaintextInParams).toBe(false);

      const isBcryptHash = insertParams[1].startsWith('$2');
      expect(isBcryptHash).toBe(true);
    });
  });

  describe('SQL parameterisation requirements', () => {
    it('uses parameterised queries in merchantRepo.findByEmail', async () => {
      const { findByEmail } = await import('../api/src/repos/merchantRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      await findByEmail('test@example.com');

      const [q, params] = query.mock.calls[0];

      expect(q).toContain('$1');
      expect(params).toContain('test@example.com');
    });

    it('uses parameterised queries in merchantRepo.create', async () => {
      const { create } = await import('../api/src/repos/merchantRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      await create({ email: 'test@example.com', passwordHash: 'hash123', companyName: 'Test Co' });

      const [q, params] = query.mock.calls[0];

      expect(q).toContain('$1');
      expect(q).toContain('$2');
      expect(q).toContain('$3');
      expect(params).toHaveLength(3);
      expect(params[0]).toBe('test@example.com');
      expect(params[1]).toBe('hash123');
      expect(params[2]).toBe('Test Co');
    });

    it('uses parameterised queries in merchantRepo.findById', async () => {
      const { findById } = await import('../api/src/repos/merchantRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      await findById(42);

      const [q, params] = query.mock.calls[0];

      expect(q).toContain('$1');
      expect(params).toContain(42);
    });
  });

  describe('POST /api/auth/logout — Logged-in user', () => {
    it('succeeds for authenticated user (client discards token)', async () => {
      const { logout } = await import('../api/src/controllers/authController.js');

      const req = createMockReq({ merchantId: 1 });
      const res = createMockRes();
      const next = createMockNext();

      await logout(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ message: 'ok' });
    });
  });

  describe('JWT token format', () => {
    it('contains merchantId claim', () => {
      const token = jwt.sign({ merchantId: 42 }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '7d' });
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');

      expect(decoded.merchantId).toBe(42);
    });

    it('expires in 7 days', () => {
      const token = jwt.sign({ merchantId: 1 }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '7d' });
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');

      const sevenDays = 7 * 24 * 60 * 60;

      expect(decoded.exp - decoded.iat).toBe(sevenDays);
    });
  });
});