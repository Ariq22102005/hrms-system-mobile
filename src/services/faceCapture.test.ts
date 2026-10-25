import { describe, expect, it, vi } from 'vitest';
vi.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/', deleteAsync: vi.fn(async () => undefined) }));
import { deleteAsync } from 'expo-file-system/legacy';
import { makeFaceCapture, removeTemporaryPhoto, requireCaptures } from './faceCapture';
describe('temporary face captures', () => {
  it('normalizes browser images and enforces size/encoding', () => {
    expect(makeFaceCapture('front', 'data:image/jpeg;base64,AQID', new Date().toISOString()).photo_base64).toBe('AQID');
    expect(() => makeFaceCapture('front', '!invalid', '')).toThrow();
    expect(() => makeFaceCapture('front', 'A'.repeat(2796208), '')).toThrow();
  });
  it('requires policy captures without interpreting poses as biometric proof', () => {
    const captures = (['front', 'left', 'right'] as const).map((pose) => makeFaceCapture(pose, 'AQID', new Date().toISOString()));
    expect(requireCaptures(captures)).toHaveLength(3);
    expect(() => requireCaptures(captures, { version: 1, require_without_glasses: true, verification_endpoint: '/attendance/face-verification' })).toThrow();
    expect(() => requireCaptures([...captures, captures[0]])).toThrow();
  });
  it('deletes only app cache files and skips browser data URIs', async () => {
    await removeTemporaryPhoto('file:///cache/capture.jpg'); expect(deleteAsync).toHaveBeenCalledWith('file:///cache/capture.jpg', { idempotent: true });
    await expect(removeTemporaryPhoto('file:///documents/employee.jpg')).rejects.toThrow();
    await removeTemporaryPhoto('data:image/jpeg;base64,AQID');
  });
});
