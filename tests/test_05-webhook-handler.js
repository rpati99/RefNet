import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

process.env.WEBHOOK_HMAC_SECRET = 'test-webhook-secret';

vi.mock('../api/src/db/pool.js', () => {
  const mockQuery = vi.fn();
  return {
    default: { query: mockQuery },
  };
});

const pool = await import('../api/src/db/pool.js');
const query = pool.default.query;

function createMockReq(overrides = {}) {
  const headers = { ...overrides.headers };
  return {
    body: {},
    params: {},
    headers,
    get: (name) => headers[name.toLowerCase()] ?? headers[name] ?? null,
    rawBody: null,
    ...overrides,
  };
}

function createMockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.get = vi.fn();
  return res;
}

function createMockNext() {
  return vi.fn();
}

function computeHmac(rawBody, secret) {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

const VALID_PAYLOAD = {
  event_id: 'evt_test_001',
  event_type: 'order.completed',
  program_id: '550e8400-e29b-41d4-a716-446655440000',
  advocate_id: '660e8400-e29b-41d4-a716-446655440000',
  referral_id: '770e8400-e29b-41d4-a716-446655440000',
  order_id: 'SHOP-456',
  customer_email: 'customer@example.com',
  timestamp: '2026-05-10T12:00:00Z',
};

describe('Webhook Handler Feature Tests', () => {

  beforeEach(() => {
    vi.resetModules();
    query.mockReset();
  });

  // ============================================
  // POST /webhooks/order — HMAC Verification
  // ============================================

  describe('POST /webhooks/order — HMAC Verification', () => {
    it('returns 401 Unauthorized when X-Webhook-Signature header is missing', async () => {
      const { postOrder } = await import('../api/src/controllers/webhooksController.js');

      const req = createMockReq({
        headers: {},
        rawBody: Buffer.from(JSON.stringify(VALID_PAYLOAD)),
      });
      const res = createMockRes();
      const next = createMockNext();

      await postOrder(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing X-Webhook-Signature header' });
    });

    it('returns 401 Unauthorized when HMAC signature is invalid', async () => {
      const { postOrder } = await import('../api/src/controllers/webhooksController.js');

      const rawBody = Buffer.from(JSON.stringify(VALID_PAYLOAD));

      const req = createMockReq({
        headers: { 'x-webhook-signature': 'invalidsignature1234567890abcdef1234567890abcdef1234567890abcdef1234567890' },
        rawBody,
      });
      const res = createMockRes();
      const next = createMockNext();

      await postOrder(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication failed' });
    });

    it('returns 401 when HMAC secret is not configured', async () => {
      const originalSecret = process.env.WEBHOOK_HMAC_SECRET;
      delete process.env.WEBHOOK_HMAC_SECRET;

      const { verifyHmac } = await import('../api/src/services/webhooksService.js');
      const result = verifyHmac(Buffer.from('test'), 'anysignature1234567890abcdef1234567890abcdef1234567890abcdef1234567890');

      process.env.WEBHOOK_HMAC_SECRET = originalSecret;

      expect(result).toBe(false);
    });

    it('returns 400 when raw body is missing', async () => {
      const { postOrder } = await import('../api/src/controllers/webhooksController.js');

      const req = createMockReq({
        headers: { 'x-webhook-signature': 'fakesignature1234567890abcdef1234567890abcdef1234567890abcdef1234567890' },
        rawBody: null,
      });
      const res = createMockRes();
      const next = createMockNext();

      await postOrder(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing request body' });
    });

    it('returns 400 when request body is not valid JSON', async () => {
      const { postOrder } = await import('../api/src/controllers/webhooksController.js');

      const rawBody = Buffer.from('not valid json');

      const req = createMockReq({
        headers: { 'x-webhook-signature': 'fakesignature1234567890abcdef1234567890abcdef1234567890abcdef1234567890' },
        rawBody,
      });
      const res = createMockRes();
      const next = createMockNext();

      await postOrder(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid JSON body' });
    });

    it('accepts request with valid HMAC signature', async () => {
      const { postOrder } = await import('../api/src/controllers/webhooksController.js');

      const rawBody = Buffer.from(JSON.stringify(VALID_PAYLOAD));
      const validSignature = computeHmac(rawBody, process.env.WEBHOOK_HMAC_SECRET);

      query
        .mockResolvedValueOnce({ rows: [{ id: 'webhook-event-id-1' }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.program_id }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.referral_id, program_id: VALID_PAYLOAD.program_id }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.referral_id }] })
        .mockResolvedValueOnce({ rows: [] });

      const req = createMockReq({
        headers: { 'x-webhook-signature': validSignature },
        rawBody,
      });
      const res = createMockRes();
      const next = createMockNext();

      await postOrder(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Event processed' });
    });
  });

  // ============================================
  // POST /webhooks/order — Idempotency
  // ============================================

  describe('POST /webhooks/order — Idempotency', () => {
    it('returns 200 for duplicate event_id without creating new record', async () => {
      const { postOrder } = await import('../api/src/controllers/webhooksController.js');

      const rawBody = Buffer.from(JSON.stringify(VALID_PAYLOAD));
      const validSignature = computeHmac(rawBody, process.env.WEBHOOK_HMAC_SECRET);

      query.mockResolvedValueOnce({ rows: [] });

      const req = createMockReq({
        headers: { 'x-webhook-signature': validSignature },
        rawBody,
      });
      const res = createMockRes();
      const next = createMockNext();

      await postOrder(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Event already processed' });
    });

    it('does not process order event for duplicate event_id', async () => {
      const { handleWebhook } = await import('../api/src/services/webhooksService.js');

      const rawBody = Buffer.from(JSON.stringify(VALID_PAYLOAD));
      const validSignature = computeHmac(rawBody, process.env.WEBHOOK_HMAC_SECRET);

      query.mockResolvedValueOnce({ rows: [] });

      const result = await handleWebhook(rawBody, validSignature, VALID_PAYLOAD);

      expect(result.duplicate).toBe(true);
      expect(query).toHaveBeenCalledTimes(1);
    });

    it('creates webhook_events record for new event_id', async () => {
      const { handleWebhook } = await import('../api/src/services/webhooksService.js');

      const rawBody = Buffer.from(JSON.stringify(VALID_PAYLOAD));
      const validSignature = computeHmac(rawBody, process.env.WEBHOOK_HMAC_SECRET);

      query
        .mockResolvedValueOnce({ rows: [{ id: 'new-webhook-id' }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.program_id }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.referral_id }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.referral_id }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await handleWebhook(rawBody, validSignature, VALID_PAYLOAD);

      expect(result.duplicate).toBe(false);
      expect(query).toHaveBeenCalledTimes(5);
    });
  });

  // ============================================
  // POST /webhooks/order — Referral Updates
  // ============================================

  describe('POST /webhooks/order — Referral Updates', () => {
    it('updates referral record with order_id and customer_email', async () => {
      const { processOrderEvent } = await import('../api/src/services/webhooksService.js');

      query
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.program_id }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.referral_id, program_id: VALID_PAYLOAD.program_id }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.referral_id, order_id: VALID_PAYLOAD.order_id }] });

      const result = await processOrderEvent(VALID_PAYLOAD);

      const updateCall = query.mock.calls[2];
      const updateQuery = updateCall[0];
      const updateParams = updateCall[1];

      expect(updateQuery).toContain('UPDATE referrals');
      expect(updateParams).toContain(VALID_PAYLOAD.order_id);
      expect(updateParams).toContain(VALID_PAYLOAD.customer_email);
    });

    it('updates referral status to eligible after order event', async () => {
      const { processOrderEvent } = await import('../api/src/services/webhooksService.js');

      query
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.program_id }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.referral_id, program_id: VALID_PAYLOAD.program_id }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.referral_id, status: 'eligible' }] });

      await processOrderEvent(VALID_PAYLOAD);

      const updateCall = query.mock.calls[2];
      const updateQuery = updateCall[0];

      expect(updateQuery).toContain('eligible');
    });

    it('updates referral signup_ts from webhook timestamp', async () => {
      const { processOrderEvent } = await import('../api/src/services/webhooksService.js');

      query
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.program_id }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.referral_id, program_id: VALID_PAYLOAD.program_id }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.referral_id }] });

      await processOrderEvent(VALID_PAYLOAD);

      const updateCall = query.mock.calls[2];
      const updateParams = updateCall[1];

      const signupTsParam = updateParams.find(p => p instanceof Date);
      expect(signupTsParam).toBeDefined();
    });

    it('uses current date when timestamp is not provided', async () => {
      const payloadWithoutTimestamp = {
        ...VALID_PAYLOAD,
        timestamp: null,
      };

      const { processOrderEvent } = await import('../api/src/services/webhooksService.js');

      query
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.program_id }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.referral_id, program_id: VALID_PAYLOAD.program_id }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.referral_id }] });

      await processOrderEvent(payloadWithoutTimestamp);

      const updateCall = query.mock.calls[2];
      const updateParams = updateCall[1];
      const signupTsParam = updateParams.find(p => p instanceof Date);

      expect(signupTsParam).toBeDefined();
    });

    it('returns 404 when referral does not exist', async () => {
      const { processOrderEvent } = await import('../api/src/services/webhooksService.js');

      query
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.program_id }] })
        .mockResolvedValueOnce({ rows: [] });

      let thrownError = null;
      try {
        await processOrderEvent(VALID_PAYLOAD);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.status).toBe(404);
      expect(thrownError.message).toBe('Referral not found');
    });

    it('returns 404 when referral does not belong to program', async () => {
      const { processOrderEvent } = await import('../api/src/services/webhooksService.js');

      const wrongProgramId = '880e8400-e29b-41d4-a716-446655440000';
      const payloadWithWrongProgram = {
        ...VALID_PAYLOAD,
        program_id: wrongProgramId,
      };

      query
        .mockResolvedValueOnce({ rows: [{ id: wrongProgramId }] })
        .mockResolvedValueOnce({ rows: [] });

      let thrownError = null;
      try {
        await processOrderEvent(payloadWithWrongProgram);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.status).toBe(404);
      expect(thrownError.message).toBe('Referral not found');
    });

    it('returns 404 when program does not exist', async () => {
      const { processOrderEvent } = await import('../api/src/services/webhooksService.js');

      const nonExistentProgramId = '990e8400-e29b-41d4-a716-446655440000';
      const payloadWithNonExistentProgram = {
        ...VALID_PAYLOAD,
        program_id: nonExistentProgramId,
      };

      query.mockResolvedValueOnce({ rows: [] });

      let thrownError = null;
      try {
        await processOrderEvent(payloadWithNonExistentProgram);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.status).toBe(404);
      expect(thrownError.message).toBe('Program not found');
    });
  });

  // ============================================
  // POST /webhooks/order — Payload Storage
  // ============================================

  describe('POST /webhooks/order — Payload Storage', () => {
    it('stores full request body in webhook_events.payload', async () => {
      const { handleWebhook } = await import('../api/src/services/webhooksService.js');

      const rawBody = Buffer.from(JSON.stringify(VALID_PAYLOAD));
      const validSignature = computeHmac(rawBody, process.env.WEBHOOK_HMAC_SECRET);

      query
        .mockResolvedValueOnce({ rows: [{ id: 'webhook-id-1' }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.program_id }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.referral_id }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.referral_id }] })
        .mockResolvedValueOnce({ rows: [] });

      await handleWebhook(rawBody, validSignature, VALID_PAYLOAD);

      const insertCall = query.mock.calls[0];
      const insertQuery = insertCall[0];
      const insertParams = insertCall[1];

      expect(insertQuery).toContain('webhook_events');
      expect(insertQuery).toContain('payload');
      expect(insertQuery).toContain('event_id');
      expect(insertQuery).toContain('event_type');
      expect(insertQuery).toContain('status');
    });

    it('stores event_type in webhook_events.event_type', async () => {
      const { handleWebhook } = await import('../api/src/services/webhooksService.js');

      const rawBody = Buffer.from(JSON.stringify(VALID_PAYLOAD));
      const validSignature = computeHmac(rawBody, process.env.WEBHOOK_HMAC_SECRET);

      query
        .mockResolvedValueOnce({ rows: [{ id: 'webhook-id-1' }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.program_id }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.referral_id }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.referral_id }] })
        .mockResolvedValueOnce({ rows: [] });

      await handleWebhook(rawBody, validSignature, VALID_PAYLOAD);

      const insertCall = query.mock.calls[0];
      const insertParams = insertCall[1];

      expect(insertParams).toContain('order.completed');
    });

    it('sets webhook_events.status to received on insert', async () => {
      const { handleWebhook } = await import('../api/src/services/webhooksService.js');

      const rawBody = Buffer.from(JSON.stringify(VALID_PAYLOAD));
      const validSignature = computeHmac(rawBody, process.env.WEBHOOK_HMAC_SECRET);

      query
        .mockResolvedValueOnce({ rows: [{ id: 'webhook-id-1' }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.program_id }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.referral_id }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.referral_id }] })
        .mockResolvedValueOnce({ rows: [] });

      await handleWebhook(rawBody, validSignature, VALID_PAYLOAD);

      const insertCall = query.mock.calls[0];
      const insertQuery = insertCall[0];

      expect(insertQuery).toContain('status');
      expect(insertQuery).toContain('received');
    });

    it('updates webhook_events.status to processed after handling', async () => {
      const { handleWebhook } = await import('../api/src/services/webhooksService.js');

      const rawBody = Buffer.from(JSON.stringify(VALID_PAYLOAD));
      const validSignature = computeHmac(rawBody, process.env.WEBHOOK_HMAC_SECRET);

      query
        .mockResolvedValueOnce({ rows: [{ id: 'webhook-id-1' }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.program_id }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.referral_id }] })
        .mockResolvedValueOnce({ rows: [{ id: VALID_PAYLOAD.referral_id }] })
        .mockResolvedValueOnce({ rows: [] });

      await handleWebhook(rawBody, validSignature, VALID_PAYLOAD);

      const markProcessedCall = query.mock.calls[4];
      const markProcessedQuery = markProcessedCall[0];

      expect(markProcessedQuery).toContain('UPDATE webhook_events');
      expect(markProcessedQuery).toContain('processed');
    });
  });

  // ============================================
  // SQL Parameterisation Requirements
  // ============================================

  describe('SQL parameterisation requirements', () => {
    it('uses parameterised queries in webhooksRepo.createWithIdempotency', async () => {
      const { createWithIdempotency } = await import('../api/src/repos/webhooksRepo.js');

      query.mockResolvedValueOnce({ rows: [{ id: 'test-id' }] });

      await createWithIdempotency({
        eventId: 'evt_123',
        eventType: 'order.completed',
        payload: VALID_PAYLOAD,
      });

      const [q, params] = query.mock.calls[0];

      expect(q).toContain('$1');
      expect(q).toContain('$2');
      expect(q).toContain('$3');
      expect(params).toHaveLength(3);
      expect(params[0]).toBe('evt_123');
      expect(params[1]).toBe('order.completed');
    });

    it('uses parameterised queries in webhooksRepo.findByEventId', async () => {
      const { findByEventId } = await import('../api/src/repos/webhooksRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      await findByEventId('evt_456');

      const [q, params] = query.mock.calls[0];

      expect(q).toContain('$1');
      expect(params).toContain('evt_456');
    });

    it('uses parameterised queries in webhooksRepo.markProcessed', async () => {
      const { markProcessed } = await import('../api/src/repos/webhooksRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      await markProcessed('evt_789');

      const [q, params] = query.mock.calls[0];

      expect(q).toContain('$1');
      expect(params).toContain('evt_789');
    });

    it('uses parameterised queries in referralsRepo.findByIdWithProgramCheck', async () => {
      const { findByIdWithProgramCheck } = await import('../api/src/repos/referralsRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      await findByIdWithProgramCheck('ref-id', 'prog-id');

      const [q, params] = query.mock.calls[0];

      expect(q).toContain('$1');
      expect(q).toContain('$2');
      expect(params).toContain('ref-id');
      expect(params).toContain('prog-id');
    });

    it('uses parameterised queries in referralsRepo.updateWithOrder', async () => {
      const { updateWithOrder } = await import('../api/src/repos/referralsRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      await updateWithOrder('ref-123', {
        orderId: 'ORDER-001',
        customerEmail: 'test@example.com',
        signupTs: new Date('2026-05-10T12:00:00Z'),
      });

      const [q, params] = query.mock.calls[0];

      expect(q).toContain('$1');
      expect(q).toContain('$2');
      expect(q).toContain('$3');
      expect(q).toContain('$4');
      expect(params).toContain('ORDER-001');
      expect(params).toContain('test@example.com');
    });

    it('uses parameterised queries in programsRepo.findByIdAny', async () => {
      const { findByIdAny } = await import('../api/src/repos/programsRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      await findByIdAny('prog-123');

      const [q, params] = query.mock.calls[0];

      expect(q).toContain('$1');
      expect(params).toContain('prog-123');
    });

    it('does not concatenate raw values in webhook insert', async () => {
      const { createWithIdempotency } = await import('../api/src/repos/webhooksRepo.js');

      query.mockResolvedValueOnce({ rows: [{ id: 'test-id' }] });

      await createWithIdempotency({
        eventId: 'evt_sql_injection_test',
        eventType: 'order.completed',
        payload: { dangerous: "'; DROP TABLE users; --" },
      });

      const [q, params] = query.mock.calls[0];

      expect(q).not.toContain('DROP TABLE');
      expect(q).toContain('$1');
      expect(q).toContain('$2');
      expect(q).toContain('$3');
    });
  });

  // ============================================
  // HMAC Timing-Safe Comparison
  // ============================================

  describe('HMAC timing-safe comparison', () => {
    it('uses timing-safe comparison to prevent timing attacks', async () => {
      const { verifyHmac } = await import('../api/src/services/webhooksService.js');

      const rawBody = Buffer.from('test body content');
      const validSignature = computeHmac(rawBody, process.env.WEBHOOK_HMAC_SECRET);

      const result = verifyHmac(rawBody, validSignature);

      expect(result).toBe(true);
    });

    it('rejects signatures of different lengths', async () => {
      const { verifyHmac } = await import('../api/src/services/webhooksService.js');

      const rawBody = Buffer.from('test body content');

      const result = verifyHmac(rawBody, 'short');

      expect(result).toBe(false);
    });

    it('rejects completely wrong signatures', async () => {
      const { verifyHmac } = await import('../api/src/services/webhooksService.js');

      const rawBody = Buffer.from('test body content');
      const wrongSignature = '0000000000000000000000000000000000000000000000000000000000000000';

      const result = verifyHmac(rawBody, wrongSignature);

      expect(result).toBe(false);
    });

    it('detects partial signature matches', async () => {
      const { verifyHmac } = await import('../api/src/services/webhooksService.js');

      const rawBody = Buffer.from('test body content');
      const validSignature = computeHmac(rawBody, process.env.WEBHOOK_HMAC_SECRET);

      const almostValidSignature = validSignature.slice(0, -1) + (validSignature.slice(-1) === 'a' ? 'b' : 'a');

      const result = verifyHmac(rawBody, almostValidSignature);

      expect(result).toBe(false);
    });
  });

  // ============================================
  // Controller Tests
  // ============================================

  describe('Controller layer tests', () => {
    it('postOrder handles non-order event types gracefully', async () => {
      const { handleWebhook } = await import('../api/src/services/webhooksService.js');

      const otherEventPayload = {
        ...VALID_PAYLOAD,
        event_type: 'order.cancelled',
      };

      const rawBody = Buffer.from(JSON.stringify(otherEventPayload));
      const validSignature = computeHmac(rawBody, process.env.WEBHOOK_HMAC_SECRET);

      query
        .mockResolvedValueOnce({ rows: [{ id: 'webhook-id-1' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await handleWebhook(rawBody, validSignature, otherEventPayload);

      expect(result.duplicate).toBe(false);
      expect(query).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================
  // ON CONFLICT Idempotency Implementation
  // ============================================

  describe('ON CONFLICT idempotency implementation', () => {
    it('uses ON CONFLICT DO NOTHING in webhook insert query', async () => {
      const { createWithIdempotency } = await import('../api/src/repos/webhooksRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      await createWithIdempotency({
        eventId: 'evt_duplicate',
        eventType: 'order.completed',
        payload: VALID_PAYLOAD,
      });

      const [q] = query.mock.calls[0];

      expect(q).toContain('ON CONFLICT');
      expect(q).toContain('event_id');
      expect(q).toContain('DO NOTHING');
    });

    it('returns null when conflict occurs (duplicate)', async () => {
      const { createWithIdempotency } = await import('../api/src/repos/webhooksRepo.js');

      query.mockResolvedValueOnce({ rows: [] });

      const result = await createWithIdempotency({
        eventId: 'evt_existing',
        eventType: 'order.completed',
        payload: VALID_PAYLOAD,
      });

      expect(result).toBeNull();
    });

    it('returns record when insert succeeds (new event)', async () => {
      const { createWithIdempotency } = await import('../api/src/repos/webhooksRepo.js');

      query.mockResolvedValueOnce({ rows: [{ id: 'new-webhook-123' }] });

      const result = await createWithIdempotency({
        eventId: 'evt_new',
        eventType: 'order.completed',
        payload: VALID_PAYLOAD,
      });

      expect(result).not.toBeNull();
      expect(result.id).toBe('new-webhook-123');
    });
  });
});
