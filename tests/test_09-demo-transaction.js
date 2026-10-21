import { beforeEach, describe, expect, it, vi } from 'vitest';
import pool from '../api/src/db/pool.js';
import { withOrderTransaction } from '../api/src/repos/demoOrdersRepo.js';

vi.mock('../api/src/db/pool.js', () => ({ default: { connect: vi.fn() } }));
let db;
beforeEach(() => {
  db = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };
  pool.connect.mockResolvedValue(db);
});

describe('demo transaction', () => {
  it('commits successful work and releases the connection', async () => {
    const result = await withOrderTransaction(async (tx) => {
      await tx.createReferral({ id: 'r1', advocateId: 'a1', programId: 'p1' });
      return { ok: true };
    });
    expect(result).toEqual({ ok: true });
    expect(db.query.mock.calls[0][0]).toBe('BEGIN');
    expect(db.query.mock.calls[1][0]).toContain('ON CONFLICT (id) DO NOTHING');
    expect(db.query.mock.calls[2][0]).toBe('COMMIT');
    expect(db.release).toHaveBeenCalledOnce();
  });
  it('rolls back failures and releases the connection', async () => {
    await expect(withOrderTransaction(async () => { throw new Error('Webhook failed'); })).rejects.toThrow('Webhook failed');
    expect(db.query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'ROLLBACK']);
    expect(db.release).toHaveBeenCalledOnce();
  });
});
