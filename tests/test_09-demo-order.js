import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { withOrderTransaction } from '../api/src/repos/demoOrdersRepo.js';
import { handleWebhook } from '../api/src/services/webhooksService.js';
import { simulateOrder } from '../api/src/services/demoOrdersService.js';

vi.mock('../api/src/repos/demoOrdersRepo.js', () => ({ withOrderTransaction: vi.fn() }));
vi.mock('../api/src/services/webhooksService.js', () => ({ handleWebhook: vi.fn() }));

const request = { customerEmail: 'customer@example.com', requestId: '12345678-1234-4234-8234-123456789012' };
let tx;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('ENABLE_DEMO_ORDERS', 'true');
  vi.stubEnv('WEBHOOK_HMAC_SECRET', 'local-test-secret');
  tx = { findOwnedAdvocate: vi.fn().mockResolvedValue({ id: 'a1', program_id: 'p1', is_active: true }), createReferral: vi.fn(), webhookRepos: {} };
  withOrderTransaction.mockImplementation((work) => work(tx));
  handleWebhook.mockResolvedValue({ duplicate: false });
});
afterEach(() => vi.unstubAllEnvs());

describe('demo order safety', () => {
  it('is disabled by default', async () => {
    vi.stubEnv('ENABLE_DEMO_ORDERS', 'false');
    await expect(simulateOrder('m1', 'code', request)).rejects.toMatchObject({ status: 404 });
    expect(withOrderTransaction).not.toHaveBeenCalled();
  });
  it('requires valid email and UUID', async () => {
    await expect(simulateOrder('m1', 'code', { ...request, customerEmail: 'bad' })).rejects.toMatchObject({ status: 400 });
    await expect(simulateOrder('m1', 'code', { ...request, requestId: 'bad' })).rejects.toMatchObject({ status: 400 });
    expect(withOrderTransaction).not.toHaveBeenCalled();
  });
  it('rejects a referral owned by another merchant', async () => {
    tx.findOwnedAdvocate.mockResolvedValue(null);
    await expect(simulateOrder('m2', 'code', request)).rejects.toMatchObject({ status: 404 });
    expect(tx.findOwnedAdvocate).toHaveBeenCalledWith('code', 'm2');
    expect(handleWebhook).not.toHaveBeenCalled();
  });
  it('rejects inactive programs', async () => {
    tx.findOwnedAdvocate.mockResolvedValue({ is_active: false });
    await expect(simulateOrder('m1', 'code', request)).rejects.toMatchObject({ status: 409 });
  });
  it('signs an order server-side and reuses its referral identity on retry', async () => {
    const first = await simulateOrder('m1', 'code', request);
    handleWebhook.mockResolvedValueOnce({ duplicate: true });
    const retry = await simulateOrder('m1', 'code', request);
    expect(first.referralId).toBe(retry.referralId);
    expect(retry.duplicate).toBe(true);
    const [raw, signature, payload, repos] = handleWebhook.mock.calls[0];
    expect(JSON.parse(raw.toString())).toEqual(payload);
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
    expect(payload).toMatchObject({ event_type: 'order.completed', referral_id: first.referralId, demo: true });
    expect(repos).toBe(tx.webhookRepos);
  });
  it('propagates webhook failures so the transaction rolls back', async () => {
    handleWebhook.mockRejectedValue(new Error('database unavailable'));
    await expect(simulateOrder('m1', 'code', request)).rejects.toThrow('database unavailable');
  });
});
