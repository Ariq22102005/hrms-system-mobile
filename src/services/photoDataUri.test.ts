import { describe, expect, it, vi } from 'vitest';
import { photoDataUri } from './photoDataUri';

describe('native protected photo data URI', () => {
  it('preserves JPEG bytes and MIME type without invoking the native Blob path', async () => {
    const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
    const response = new Response(bytes, { headers: { 'Content-Type': 'image/jpeg' } });
    const blob = vi.spyOn(response, 'blob').mockRejectedValue(new Error('Native Blob must not be used'));

    await expect(photoDataUri(response)).resolves.toBe('data:image/jpeg;base64,/9j/4AAQ');
    expect(blob).not.toHaveBeenCalled();
  });

  it.each([1, 2, 3, 65537])('round-trips %i binary bytes including base64 padding and large input', async (length) => {
    const bytes = Uint8Array.from({ length }, (_, index) => index % 256);
    const response = new Response(bytes, { headers: { 'Content-Type': 'image/png' } });
    const uri = await photoDataUri(response);

    expect(uri.startsWith('data:image/png;base64,')).toBe(true);
    expect(Uint8Array.from(atob(uri.split(',')[1]), (character) => character.charCodeAt(0))).toEqual(bytes);
  });

  it('preserves an absent content type', async () => {
    await expect(photoDataUri(new Response(Uint8Array.from([0])))).resolves.toBe('data:;base64,AA==');
  });

  it('propagates a cancelled body read so the caller can keep its existing abort guard', async () => {
    const response = new Response();
    const error = new DOMException('Cancelled', 'AbortError');
    vi.spyOn(response, 'arrayBuffer').mockRejectedValue(error);

    await expect(photoDataUri(response)).rejects.toBe(error);
  });
});
