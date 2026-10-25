import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
vi.mock('expo-crypto', () => ({ randomUUID: () => 'test-id' }));
vi.mock('./tokenStorage', () => ({ getAccessToken: async () => null, removeAccessToken: async () => undefined }));
import { createApiClient } from './api';
// Test fixture is JavaScript, deliberately outside the app bundle.
import { createFixtureServer } from '../../test/support/stateful-api.mjs';
describe('stateful HTTP API contract', () => {
  let server: Server; let url: string; let token: string | null = null;
  beforeAll(async () => { server = createFixtureServer(); await new Promise<void>((r) => server.listen(0, '127.0.0.1', r)); const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test port'); url = `http://127.0.0.1:${address.port}`; });
  afterAll(async () => { await new Promise<void>((r) => server.close(() => r())); });
  it('retrieves POST results with GET, replays keys without duplicates, and remains pending', async () => {
    const client = createApiClient(fetch, async () => token, async () => { token = null; }, url);
    token = (await client.login('qa@example.test', 'fixture-only-password')).token;
    expect((await client.getEmployee()).id).toBe('EMP-QA');
    const payload = { leave_type: 'annual', start_date: '2026-10-20', end_date: '2026-10-20', reason: 'HTTP integration QA' };
    const created = await client.postLeaveRequest(payload, 'leave-key');
    const replay = await client.postLeaveRequest(payload, 'leave-key'); expect(replay.id).toBe(created.id);
    expect(await client.getLeaveRequests()).toEqual([created]);
    const challenge = await client.getAttendanceChallenge();
    const capture = { type: 'check-in' as const, challenge_id: challenge.id, location_samples: [], photo_base64: 'AQID', captured_at: new Date().toISOString() };
    const attendance = await client.postAttendance(capture, 'attendance-key');
    expect(attendance.face_status).toBe('pending');
    await client.postAttendance(capture, 'attendance-key'); expect(await client.getAttendance()).toEqual([attendance]);
    expect((await client.getDashboard()).leaves[0].id).toBe(created.id);
    await client.logout(); await expect(client.getEmployee()).rejects.toMatchObject({ status: 401 });
  });
});
