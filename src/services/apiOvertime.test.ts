import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-crypto', () => ({ randomUUID: () => 'request-id-test' }));
vi.mock('./tokenStorage', () => ({ getAccessToken: async () => 'stored-token', removeAccessToken: async () => undefined }));

import { ApiError, createApiClient } from './api';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function client(response: Response) {
  const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response) as unknown as typeof fetch;
  return { api: createApiClient(fetcher, async () => 'test-token', async () => undefined, 'https://api.example.test', 20, 0), fetcher };
}
const payload = { date: '2026-10-20', start_time: '17:00', end_time: '19:30', description: 'Laporan bulanan' };
const item = { id: 'o1', ...payload, status: 'pending', created_at: '2026-10-20T10:00:00.000Z' };

describe('overtime request API', () => {
  it('posts the request with an idempotency key and returns the pending item', async () => {
    const { api, fetcher } = client(json({ success: true, message: 'OK', data: item }, 201));
    await expect(api.postOvertimeRequest(payload, 'overtime-key-1')).resolves.toMatchObject({ id: 'o1', status: 'pending' });
    const [url, init] = vi.mocked(fetcher).mock.calls[0];
    expect(url).toBe('https://api.example.test/api/v1/overtime');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['Idempotency-Key']).toBe('overtime-key-1');
    expect(JSON.parse(String(init?.body))).toEqual(payload);
  });
  it('still validates the list returned by GET /overtime', async () => {
    const { api } = client(json({ success: true, message: 'OK', data: [item, { ...item, id: 'o2', status: 'rejected', rejection_reason: 'Tidak disetujui' }] }));
    await expect(api.getOvertime()).resolves.toHaveLength(2);
  });
  it('rejects a response that is not an overtime item', async () => {
    const { api } = client(json({ success: true, message: 'OK', data: { id: 'o1' } }, 201));
    await expect(api.postOvertimeRequest(payload, 'overtime-key-2')).rejects.toMatchObject({ code: 'invalid_response' });
  });
  it('surfaces the server message when the request overlaps another one', async () => {
    const { api } = client(json({ success: false, message: 'Jam lembur bertabrakan dengan lembur lain pada tanggal ini.' }, 409));
    const error = await api.postOvertimeRequest(payload, 'overtime-key-3').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError); expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).message).toContain('bertabrakan');
  });
});
