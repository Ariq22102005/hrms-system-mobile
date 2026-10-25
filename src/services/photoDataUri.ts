import { fromByteArray } from 'base64-js';

// Native Image still needs a data URI for protected photos. Encode the response
// bytes directly instead of copying them into React Native's Blob store first.
export async function photoDataUri(response: Response): Promise<string> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const type = response.headers.get('content-type') ?? '';
  return photoBytesDataUri(bytes, type);
}
export function photoBytesDataUri(bytes: Uint8Array, type: string): string {
  return `data:${type};base64,${fromByteArray(bytes)}`;
}
