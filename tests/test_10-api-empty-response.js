import { afterEach, expect, it, vi } from 'vitest';
import { fetchWithAuth } from '../frontend/src/lib/api.js';

afterEach(() => vi.unstubAllGlobals());
it('accepts a successful 204 without parsing a JSON body', async () => {
  const json = vi.fn();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 204, ok: true, json }));
  expect(await fetchWithAuth('/api/programs/p1/advocates/a1', { method: 'DELETE' })).toBeNull();
  expect(json).not.toHaveBeenCalled();
});
