import { describe, expect, it, vi } from 'vitest';
vi.mock('expo-crypto', () => ({ randomUUID: () => 'test-id' }));
vi.mock('./tokenStorage', () => ({ getAccessToken: async () => 'token', removeAccessToken: async () => undefined }));
import { createApiClient } from './api';
import { sameOriginAssetUrl, validateBaseUrl } from './apiConfiguration';
import { validData } from './apiValidation';
const profile = { id: 'EMP-QA', name: 'QA', email: 'qa@example.test', role: 'staff', division: 'QA' };
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ success: status < 400, message: 'QA response', data }), { status });
describe('API security boundary', () => {
  it.each([null, [], 'text', { success: true, message: 'OK', data: null }, { success: true, message: [], data: profile }, { success: true, message: 'OK', errors: { field: {} }, data: profile }])('rejects malformed envelope/data %j', async (body) => {
    const client = createApiClient(async () => new Response(JSON.stringify(body)), async () => 'token', async () => {}, 'http://localhost:4011', 100, 0);
    await expect(client.getEmployee()).rejects.toMatchObject({ code: 'invalid_response' });
  });
  it.each([400, 401, 403, 404, 409, 422, 429, 500])('handles HTTP %i without treating it as success', async (status) => {
    const client = createApiClient(async () => response(null, status), async () => 'token', async () => {}, 'http://localhost:4011', 100, 0);
    await expect(client.getEmployee()).rejects.toMatchObject({ status, code: 'http' });
  });
  it('retries transient GET once, never retries POST automatically', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(null, 503)).mockResolvedValueOnce(response(profile));
    const client = createApiClient(fetcher, async () => 'token', async () => {}, 'http://localhost:4011');
    await expect(client.getEmployee()).resolves.toEqual(profile); expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockClear().mockRejectedValue(new Error('offline'));
    await expect(client.login('qa@example.test', 'fixture-only')).rejects.toMatchObject({ code: 'network' }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('coalesces simultaneous POSTs, rejects key reuse with changed payload', async () => {
    let release!: (value: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>((r) => { release = r; }));
    const client = createApiClient(fetcher, async () => 'token', async () => {}, 'http://localhost:4011');
    const payload = { leave_type: 'annual', start_date: '2026-10-20', end_date: '2026-10-20', reason: 'QA' };
    const a = client.postLeaveRequest(payload, 'same-key'); const b = client.postLeaveRequest(payload, 'same-key');
    await expect(client.postLeaveRequest({ ...payload, reason: 'different' }, 'same-key')).rejects.toMatchObject({ status: 409 });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    release(response({ ...payload, id: 'LEAVE-QA', status: 'pending', created_at: new Date().toISOString() }, 201));
    expect(await a).toEqual(await b);
  });
  it('blocks cross-origin, credential and non-HTTP asset URLs including protocol-relative paths', () => {
    for (const path of ['//attacker.test/photo', 'https://attacker.test/photo', 'javascript:alert(1)', 'https://user:pass@api.company.test/photo']) expect(() => sameOriginAssetUrl('https://api.company.test', path)).toThrow();
    expect(sameOriginAssetUrl('https://api.company.test', '/api/v1/employee/photo')).toBe('https://api.company.test/api/v1/employee/photo');
  });
  it('fails closed for unknown env, production HTTP and embedded credentials', () => {
    for (const [url, env] of [['http://api.company.test', 'production'], ['https://api.company.test', 'prod'], ['https://user:pass@api.company.test', 'development'], ['https://example.com', 'staging'], ['https://localhost', 'production']]) expect(() => validateBaseUrl(url, env)).toThrow();
    expect(validateBaseUrl('https://api.company.test', 'production')).toBe('https://api.company.test');
  });
  it('rejects forged verification success without server ID/expiry and malformed dashboard items', () => {
    expect(validData('/attendance/face-verification', { status: 'verified', message: 'OK' })).toBe(false);
    expect(validData('/attendance', [{ id: 'a', recorded_at: 'invalid' }])).toBe(false);
    expect(validData('/attendance/challenge', { id: 'a', expires_at: new Date().toISOString(), office: {} })).toBe(false);
  });
  it('bounds binary streams and blocks redirects/origin leaks before sending a token', async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array(20), { headers: { 'Content-Type': 'application/pdf' } }));
    const client = createApiClient(fetcher, async () => 'token', async () => {}, 'http://localhost:4011');
    await expect(client.getBinary('//attacker.test/file', 10)).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled();
    await expect(client.getBinary('/files/1', 10)).rejects.toMatchObject({ code: 'invalid_response' });
    expect(fetcher).toHaveBeenCalledWith('http://localhost:4011/files/1', expect.objectContaining({ redirect: 'error', headers: { Authorization: 'Bearer token' } }));
  });
  it('does not deliver binary data after the account token changes', async () => {
    let token = 'old'; const client = createApiClient(async () => { token = 'new'; return new Response('data'); }, async () => token, async () => {}, 'http://localhost:4011');
    await expect(client.getBinary('/files/1', 100)).rejects.toMatchObject({ status: 401 });
  });
});
