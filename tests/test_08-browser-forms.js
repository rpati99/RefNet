import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProgramForm from '../frontend/src/components/ProgramForm.jsx';
import AdvocatesPanel from '../frontend/src/components/AdvocatesPanel.jsx';
import SignupPage from '../frontend/src/pages/SignupPage.jsx';
import AccountPage from '../frontend/src/pages/AccountPage.jsx';
import { fetchWithAuth } from '../frontend/src/lib/api.js';

vi.mock('../frontend/src/lib/api.js', () => ({ fetchWithAuth: vi.fn() }));

beforeEach(() => { vi.clearAllMocks(); fetchWithAuth.mockReset(); localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('browser forms', () => {
  it('creates a program with dollars converted to integer cents', async () => {
    fetchWithAuth.mockResolvedValue({ id: 'new-program' });
    const saved = vi.fn();
    render(React.createElement(ProgramForm, { onSaved: saved, onCancel: vi.fn() }));
    fireEvent.change(screen.getByLabelText('Program name'), { target: { value: ' Summer ' } });
    fireEvent.change(screen.getByLabelText('Reward (USD)'), { target: { value: '12.34' } });
    fireEvent.click(screen.getByText('Create program', { selector: 'button' }));
    await waitFor(() => expect(saved).toHaveBeenCalledWith({ id: 'new-program' }));
    expect(JSON.parse(fetchWithAuth.mock.calls[0][1].body)).toEqual({ name: 'Summer', rewardDescription: '', rewardAmountCents: 1234 });
  });

  it('edits program status and preserves server errors', async () => {
    fetchWithAuth.mockRejectedValue(new Error('Program not found'));
    render(React.createElement(ProgramForm, { program: { id: 'p1', name: 'Existing', reward_amount_cents: 100, is_active: true }, onSaved: vi.fn(), onCancel: vi.fn() }));
    fireEvent.click(screen.getByLabelText('Program active'));
    fireEvent.click(screen.getByText('Save changes'));
    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toBe('Program not found');
    expect(JSON.parse(fetchWithAuth.mock.calls[0][1].body).isActive).toBe(false);
    expect(screen.getByText('Save changes').disabled).toBe(false);
  });

  it('enrolls an advocate, refreshes stats and retrieves a referral link', async () => {
    fetchWithAuth.mockResolvedValueOnce({ advocates: [] })
      .mockResolvedValueOnce({ id: 'a1', email: 'friend@example.com' })
      .mockResolvedValueOnce({ referralLink: 'http://localhost:5173/ref/abc' });
    const changed = vi.fn();
    render(React.createElement(AdvocatesPanel, { programId: 'p1', onChanged: changed }));
    await screen.findByText('No advocates yet. Enroll one above.');
    fireEvent.change(screen.getByLabelText('Advocate email'), { target: { value: 'friend@example.com' } });
    fireEvent.click(screen.getByText('Enroll advocate'));
    await screen.findByText('friend@example.com', { selector: 'strong' });
    expect(changed).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: /Show referral link/ }));
    const link = await screen.findByRole('link');
    expect(link.getAttribute('href')).toBe('http://localhost:5173/ref/abc');
  });

  it('shows duplicate advocate errors without a success message', async () => {
    fetchWithAuth.mockResolvedValueOnce({ advocates: [] }).mockRejectedValueOnce(new Error('Already enrolled'));
    render(React.createElement(AdvocatesPanel, { programId: 'p1', onChanged: vi.fn() }));
    await screen.findByText('No advocates yet. Enroll one above.');
    fireEvent.change(screen.getByLabelText('Advocate email'), { target: { value: 'friend@example.com' } });
    fireEvent.click(screen.getByText('Enroll advocate'));
    expect((await screen.findByRole('alert')).textContent).toBe('Already enrolled');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('registers with the API and stores the returned token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: 'test-jwt' }) });
    vi.stubGlobal('fetch', fetchMock);
    render(React.createElement(MemoryRouter, null, React.createElement(SignupPage)));
    fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'Demo' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'demo@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'TestPassword123!' } });
    fireEvent.click(screen.getByText('Create account'));
    await waitFor(() => expect(localStorage.getItem('token')).toBe('test-jwt'));
    expect(fetchMock.mock.calls[0][0]).toContain('/api/auth/register');
  });

  it('submits an optional custom referral code', async () => {
    fetchWithAuth.mockResolvedValueOnce({ advocates: [] }).mockResolvedValueOnce({ id: 'a1', email: 'custom@example.com' });
    render(React.createElement(AdvocatesPanel, { programId: 'p1', onChanged: vi.fn() }));
    await screen.findByText('No advocates yet. Enroll one above.');
    fireEvent.change(screen.getByLabelText('Advocate email'), { target: { value: 'custom@example.com' } });
    fireEvent.change(screen.getByLabelText('Custom referral code (optional)'), { target: { value: 'summer_2026' } });
    fireEvent.click(screen.getByText('Enroll advocate'));
    await screen.findByText('custom@example.com', { selector: 'strong' });
    expect(JSON.parse(fetchWithAuth.mock.calls[1][1].body)).toEqual({ email: 'custom@example.com', referralCode: 'summer_2026' });
  });

  it('cancels removal without a request, then confirms and refreshes statistics', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    fetchWithAuth.mockResolvedValueOnce({ advocates: [{ id: 'a1', email: 'remove@example.com' }] }).mockResolvedValueOnce(null);
    const changed = vi.fn();
    render(React.createElement(AdvocatesPanel, { programId: 'p1', onChanged: changed }));
    const button = await screen.findByRole('button', { name: /Remove advocate/ });
    fireEvent.click(button);
    expect(fetchWithAuth).toHaveBeenCalledTimes(1);
    fireEvent.click(button);
    await screen.findByText('Advocate removed.');
    expect(fetchWithAuth).toHaveBeenLastCalledWith('/api/programs/p1/advocates/a1', { method: 'DELETE' });
    expect(screen.queryByText('remove@example.com')).toBeNull();
    expect(changed).toHaveBeenCalledOnce();
    expect(confirm.mock.calls[0][0]).toContain('referral and payout history');
    confirm.mockRestore();
  });

  it('keeps the advocate visible when removal fails', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fetchWithAuth.mockResolvedValueOnce({ advocates: [{ id: 'a1', email: 'keep@example.com' }] }).mockRejectedValueOnce(new Error('Deletion failed'));
    render(React.createElement(AdvocatesPanel, { programId: 'p1', onChanged: vi.fn() }));
    fireEvent.click(await screen.findByRole('button', { name: /Remove advocate/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('Deletion failed');
    expect(screen.getByText('keep@example.com', { selector: 'strong' })).toBeTruthy();
    confirm.mockRestore();
  });

  it('loads read-only account details', async () => {
    fetchWithAuth.mockResolvedValueOnce({ merchant: { id: 'm1', email: 'owner@example.com', company_name: 'Demo Company', created_at: '2026-10-21T12:00:00Z' } });
    render(React.createElement(MemoryRouter, null, React.createElement(AccountPage)));
    await screen.findByText('owner@example.com');
    expect(screen.getByText('Demo Company')).toBeTruthy();
    expect(screen.getByText('m1')).toBeTruthy();
    expect(fetchWithAuth).toHaveBeenCalledWith('/api/auth/me');
  });

  it('shows account load errors', async () => {
    fetchWithAuth.mockRejectedValueOnce(new Error('Account unavailable'));
    render(React.createElement(MemoryRouter, null, React.createElement(AccountPage)));
    expect((await screen.findByRole('alert')).textContent).toBe('Account unavailable');
  });
});
