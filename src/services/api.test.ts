import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-crypto', () => ({ randomUUID: () => 'request-id-test' }));
vi.mock('./tokenStorage', () => ({
  getAccessToken: async () => 'stored-token',
  removeAccessToken: async () => undefined,
}));

import { createApiClient, registerUnauthorizedHandler } from './api';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function makeClient(response: Response, token: string | null = 'test-token') {
  const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response) as unknown as typeof fetch;
  const removeToken = vi.fn(async () => undefined);
  const client = createApiClient(fetcher, async () => token, removeToken, 'https://api.example.test', 20, 0);
  return { client, fetcher, removeToken };
}

describe('API client', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses the versioned URL and sends the Bearer token for profile reads', async () => {
    const profile = { id: 'EMP-7', name: 'Test Employee', email: 'employee@example.test', role: 'staff', division: 'ops' };
    const { client, fetcher } = makeClient(jsonResponse({ success: true, message: 'OK', data: profile }));

    await expect(client.getEmployee()).resolves.toEqual(profile);
    expect(fetcher).toHaveBeenCalledWith('https://api.example.test/api/v1/employee', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({ Authorization: 'Bearer test-token', Accept: 'application/json' }),
    }));
  });

  it('sends the attendance payload and idempotency key as JSON', async () => {
    const result = { id: 17, type: 'check-in', recorded_at: '2026-09-27T08:00:00Z', latitude: -3.8, longitude: 102.2 };
    const { client, fetcher } = makeClient(jsonResponse({ success: true, message: 'Created', data: result }, 201));
    const payload = { type: 'check-in' as const, challenge_id: 'challenge', location_samples: [], photo_base64: 'test', captured_at: '2026-09-27T08:00:00Z' };

    await expect(client.postAttendance(payload, 'same-request')).resolves.toEqual(result);
    const request = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const init = request[1] as RequestInit;
    expect(init.headers).toEqual(expect.objectContaining({
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'same-request',
    }));
    expect(JSON.parse(String(init.body))).toEqual(payload);
  });

  it('posts an employee clarification with an idempotent retry key', async () => {
    const result = { id: 'attendance-id', type: 'check-in', recorded_at: '2026-10-12T01:00:00Z', latitude: 0, longitude: 0, review_status: 'clarification_received' };
    const { client, fetcher } = makeClient(jsonResponse({ success: true, message: 'OK', data: result }));
    const payload = { attendance_id: 'attendance-id', explanation: 'Assigned to a customer site.' };
    await expect(client.postAttendanceClarification(payload, 'clarification-request')).resolves.toEqual(result);
    const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.test/api/v1/attendance/clarification');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual(expect.objectContaining({ 'Idempotency-Key': 'clarification-request' }));
    expect(JSON.parse(String(init.body))).toEqual(payload);
  });

  it('does not attach a bearer token to login', async () => {
    const { client, fetcher } = makeClient(jsonResponse({ success: true, message: 'OK', data: { token: 'new-token' } }));

    await expect(client.login('employee@example.test', 'secret')).resolves.toEqual({ token: 'new-token' });
    const init = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(init.headers).not.toHaveProperty('Authorization');
    expect(JSON.parse(String(init.body))).toEqual({ email: 'employee@example.test', password: 'secret' });
  });

  it('keeps a rejected login separate from an expired authenticated session', async () => {
    const { client, removeToken } = makeClient(jsonResponse({ success: false, message: 'Wrong password' }, 401), null);
    const handler = vi.fn(); const unregister = registerUnauthorizedHandler(handler);
    try {
      await expect(client.login('employee@example.test', 'wrong')).rejects.toMatchObject({ status: 401, message: 'Wrong password' });
      expect(handler).not.toHaveBeenCalled(); expect(removeToken).not.toHaveBeenCalled();
    } finally { unregister(); }
  });

  it('clears the token and notifies auth state on 401', async () => {
    const { client, removeToken } = makeClient(jsonResponse({ success: false, message: 'Expired', errors: {} }, 401));
    const onUnauthorized = vi.fn();
    const unregister = registerUnauthorizedHandler(onUnauthorized);

    try {
      await expect(client.getEmployee()).rejects.toMatchObject({ name: 'ApiError', status: 401, message: 'Expired' });
      expect(removeToken).toHaveBeenCalledOnce();
      expect(onUnauthorized).toHaveBeenCalledOnce();
    } finally {
      unregister();
    }
  });

  it('does not let an old 401 erase a newer session token', async () => {
    let token = 'old-token';
    const fetcher = vi.fn(async () => { token = 'new-token'; return jsonResponse({ success: false, message: 'Old session expired' }, 401); }) as unknown as typeof fetch;
    const remover = vi.fn(async () => undefined); const handler = vi.fn();
    const unregister = registerUnauthorizedHandler(handler);
    try {
      const client = createApiClient(fetcher, async () => token, remover, 'https://api.example.test');
      await expect(client.getEmployee()).rejects.toMatchObject({ status: 401 });
      expect(remover).not.toHaveBeenCalled(); expect(handler).not.toHaveBeenCalled();
    } finally { unregister(); }
  });

  it('preserves credentials and field errors on 403 and 422 responses', async () => {
    const forbidden = makeClient(jsonResponse({ success: false, message: 'Forbidden' }, 403));
    await expect(forbidden.client.getEmployee()).rejects.toMatchObject({ status: 403 });
    expect(forbidden.removeToken).not.toHaveBeenCalled();

    const validation = makeClient(jsonResponse({ success: false, message: 'Validation failed', errors: { latitude: ['Required'] } }, 422));
    await expect(validation.client.getEmployee()).rejects.toMatchObject({
      status: 422,
      message: 'Validation failed latitude: Required',
      errors: { latitude: ['Required'] },
    });
  });

  it('surfaces server errors and rejects an empty success response', async () => {
    const serverError = makeClient(jsonResponse({ success: false, message: 'Unavailable' }, 500));
    await expect(serverError.client.getEmployee()).rejects.toMatchObject({ status: 500, message: 'Unavailable' });

    const emptyResponse = makeClient(new Response('', { status: 200 }));
    await expect(emptyResponse.client.getEmployee()).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('maps network failure and timeout to distinct error codes', async () => {
    const offlineFetch = vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    const offlineClient = createApiClient(offlineFetch, async () => 'token', async () => undefined, 'https://api.example.test', 20, 0);
    await expect(offlineClient.getEmployee()).rejects.toMatchObject({ code: 'network' });

    const slowFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    })) as unknown as typeof fetch;
    const timeoutClient = createApiClient(slowFetch, async () => 'token', async () => undefined, 'https://api.example.test', 1, 0);
    await expect(timeoutClient.getEmployee()).rejects.toMatchObject({ name: 'ApiError', code: 'timeout' });
  });
});
