import { describe, expect, it, vi } from 'vitest';
vi.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/', EncodingType: { Base64: 'base64' }, deleteAsync: vi.fn(async () => undefined), readAsStringAsync: vi.fn(async () => 'AQID'), readDirectoryAsync: vi.fn(async () => ['Camera', 'mrousavy123.jpg', 'keep.db']) }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'request-id-test' }));
vi.mock('./tokenStorage', () => ({ getAccessToken: async () => 'stored-token', removeAccessToken: async () => undefined }));
import { deleteAsync } from 'expo-file-system/legacy';
import { createApiClient } from './api';
import { consumeCapturedPhoto, failedPosesFromErrors, makeFaceCapture, purgeOrphanedFacePhotos } from './faceCapture';
import { claimNotificationOnce, isFaceEnrollmentPush } from './pushRouting';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const client = (response: Response) => { const fetcher = vi.fn(async () => response) as unknown as typeof fetch; return { fetcher, api: createApiClient(fetcher, async () => 't', async () => undefined, 'https://api.example.test', 50, 0) }; };

describe('face enrollment API', () => {
  it('reads and validates /face/status', async () => {
    const body = { status: 'rejected', rejection_reason: 'Foto buram', updated_at: '2026-10-19T08:00:00Z' };
    const { api, fetcher } = client(json({ success: true, message: 'OK', data: body }));
    await expect(api.getFaceStatus()).resolves.toEqual(body);
    expect(fetcher).toHaveBeenCalledWith('https://api.example.test/api/v1/face/status', expect.objectContaining({ method: 'GET' }));
  });
  it('rejects an unknown status value', async () => {
    const { api } = client(json({ success: true, message: 'OK', data: { status: 'maybe', rejection_reason: null, updated_at: 'x' } }));
    await expect(api.getFaceStatus()).rejects.toMatchObject({ code: 'invalid_response' });
  });
  it('posts the three captures with consent version 1 and surfaces 422 messages', async () => {
    const captures = (['front', 'left', 'right'] as const).map((p) => makeFaceCapture(p, 'AQID', '2026-10-19T08:00:00Z'));
    const ok = client(json({ success: true, message: 'OK', data: null }, 201));
    await ok.api.enrollFace({ challenge_id: 'c1', consent_version: '1', captures }, 'k1');
    const [, init] = (ok.fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ challenge_id: 'c1', consent_version: '1' });
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('k1');
    const bad = client(json({ success: false, message: 'Wajah tidak terdeteksi.', errors: { 'captures.1.photo_base64': ['Terlalu gelap'] } }, 422));
    await expect(bad.api.enrollFace({ challenge_id: 'c1', consent_version: '1', captures }, 'k2')).rejects.toMatchObject({ status: 422, message: expect.stringContaining('Wajah tidak terdeteksi.') });
  });
});

describe('enrollment helpers', () => {
  const captures = (['front', 'left', 'right'] as const).map((p) => makeFaceCapture(p, 'AQID', ''));
  it('maps 422 field errors to poses', () => {
    expect(failedPosesFromErrors({ 'captures.2.photo_base64': 'x', 'captures.0': 'y' }, captures)).toEqual(['front', 'right']);
    expect(failedPosesFromErrors({ 'captures.left': 'x' }, captures)).toEqual(['left']);
    expect(failedPosesFromErrors({ challenge_id: 'expired' }, captures)).toEqual([]);
  });
  it('reads a captured photo into memory and always deletes the file', async () => {
    await expect(consumeCapturedPhoto('/data/cache/mrousavy1.jpg')).resolves.toBe('AQID');
    expect(deleteAsync).toHaveBeenCalledWith('file:///data/cache/mrousavy1.jpg', { idempotent: true });
    await expect(consumeCapturedPhoto('https://evil.test/a.jpg')).rejects.toThrow();
  });
  it('purges only camera leftovers at startup', async () => {
    await purgeOrphanedFacePhotos();
    expect(deleteAsync).toHaveBeenCalledWith('file:///cache/Camera', { idempotent: true });
    expect(deleteAsync).toHaveBeenCalledWith('file:///cache/mrousavy123.jpg', { idempotent: true });
    expect(deleteAsync).not.toHaveBeenCalledWith('file:///cache/keep.db', expect.anything());
  });
  it('recognizes the FaceEnrollment push and dedupes responses', () => {
    expect(isFaceEnrollmentPush({ screen: 'FaceEnrollment' })).toBe(true);
    expect(isFaceEnrollmentPush({ screen: 'Payroll' })).toBe(false);
    expect(isFaceEnrollmentPush(null)).toBe(false);
    expect(claimNotificationOnce('n1')).toBe(true); expect(claimNotificationOnce('n1')).toBe(false);
  });
});
