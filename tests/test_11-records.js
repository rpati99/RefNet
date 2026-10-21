import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import pool from '../api/src/db/pool.js';
import * as recordsService from '../api/src/services/recordsService.js';
import RecordsPage from '../frontend/src/pages/RecordsPage.jsx';
import { fetchWithAuth } from '../frontend/src/lib/api.js';

vi.mock('../api/src/db/pool.js', () => ({ default: { query: vi.fn() } }));
vi.mock('../frontend/src/lib/api.js', () => ({ fetchWithAuth: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); });
afterEach(() => cleanup());

const programId = '12345678-1234-4234-8234-123456789012';
const record = { id: 'r1', program_id: programId, program_name: 'Demo', advocate_email: 'friend@example.com', customer_email: 'customer@example.com', order_id: 'order-demo', status: 'paid', payout_id: 'po1', payout_status: 'processed', amount_cents: 1000, created_at: '2026-10-21T12:00:00Z' };

describe('records backend', () => {
  it('scopes SQL to the authenticated merchant and program, with deterministic pagination', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await recordsService.list('merchant-1', { page: '2', programId });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('WHERE p.merchant_id = $1');
    expect(sql).toContain('ORDER BY r.created_at DESC, r.id DESC');
    expect(params).toEqual(['merchant-1', programId, 21, 20]);
    expect(sql).not.toContain('password');
  });
  it('returns only 20 rows and indicates another page', async () => {
    pool.query.mockResolvedValue({ rows: Array.from({ length: 21 }, (_, id) => ({ id })) });
    const result = await recordsService.list('m1');
    expect(result.records).toHaveLength(20);
    expect(result.hasMore).toBe(true);
  });
  it('rejects invalid pages and program IDs before querying', async () => {
    for (const page of ['0', '-1', '1.5', '100001', ['1']]) {
      await expect(recordsService.list('m1', { page })).rejects.toMatchObject({ status: 400 });
    }
    await expect(recordsService.list('m1', { programId: "' OR 1=1" })).rejects.toMatchObject({ status: 400 });
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('records browser page', () => {
  function setup(records = [record], hasMore = false) {
    fetchWithAuth.mockImplementation((url) => Promise.resolve(url === '/api/programs'
      ? { programs: [{ id: programId, name: 'Demo' }] }
      : { records, page: url.includes('page=2') ? 2 : 1, hasMore }));
    render(React.createElement(MemoryRouter, null, React.createElement(RecordsPage)));
  }
  it('displays records and payout amounts and refreshes on request', async () => {
    setup();
    await screen.findByText('customer@example.com');
    expect(screen.getByText('processed')).toBeTruthy();
    expect(screen.getByText('$10.00')).toBeTruthy();
    expect(screen.getByText('r1')).toBeTruthy();
    fireEvent.click(screen.getByText('Refresh records'));
    await waitFor(() => expect(fetchWithAuth.mock.calls.filter(([url]) => url.startsWith('/api/records'))).toHaveLength(2));
  });
  it('shows missing payouts accurately', async () => {
    setup([{ ...record, payout_id: null, payout_status: null, amount_cents: null }]);
    await screen.findByText('Not created');
    expect(screen.queryByText('$0.00')).toBeNull();
  });
  it('filters by program and paginates', async () => {
    setup([record], true);
    await screen.findByText('customer@example.com');
    fireEvent.change(screen.getByLabelText('Filter by program'), { target: { value: programId } });
    await waitFor(() => expect(fetchWithAuth).toHaveBeenCalledWith(`/api/records?page=1&programId=${programId}`));
    await screen.findByText('customer@example.com');
    fireEvent.click(screen.getByText('Next'));
    await waitFor(() => expect(fetchWithAuth).toHaveBeenCalledWith(`/api/records?page=2&programId=${programId}`));
    await screen.findByText('Page 2');
  });
  it('shows the empty state', async () => {
    setup([]);
    await screen.findByText(/No records on this page/);
    expect(screen.getByText('Next').disabled).toBe(true);
  });
  it('shows API errors', async () => {
    fetchWithAuth.mockImplementation((url) => url === '/api/programs' ? Promise.resolve({ programs: [] }) : Promise.reject(new Error('Records unavailable')));
    render(React.createElement(MemoryRouter, null, React.createElement(RecordsPage)));
    expect((await screen.findByRole('alert')).textContent).toBe('Records unavailable');
  });
});
