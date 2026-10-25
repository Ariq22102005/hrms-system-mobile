import * as FileSystem from 'expo-file-system/legacy';
import type { FaceCapture, FaceCapturePolicy, FacePose } from './api';
export const facePoses: FacePose[] = ['front', 'without_glasses', 'left', 'right'];
export function makeFaceCapture(pose: FacePose, base64: string, capturedAt: string): FaceCapture {
  const raw = base64.replace(/^data:image\/[^;,]+;base64,/, '');
  // 2 MiB decoded per photo, at most four photos. The server must enforce its own limit.
  if (!raw || raw.length > 2796204 || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw) || raw.length % 4 !== 0) throw new Error('Foto tidak valid/terlalu besar. Ulangi dengan pencahayaan cukup.');
  return { pose, photo_base64: raw, captured_at: capturedAt };
}
export function requireCaptures(captures: FaceCapture[], policy?: FaceCapturePolicy): FaceCapture[] {
  const required: FacePose[] = policy?.require_without_glasses ? facePoses : ['front', 'left', 'right'];
  if (required.some((pose) => !captures.some((c) => c.pose === pose))) throw new Error('Capture belum lengkap. Ulangi panduan wajah.');
  if (captures.length > 4 || new Set(captures.map((c) => c.pose)).size !== captures.length) throw new Error('Capture duplikat/tidak valid.');
  return captures;
}
export async function removeTemporaryPhoto(uri?: string): Promise<void> {
  if (!uri || uri.startsWith('data:')) return;
  if (!FileSystem.cacheDirectory || !uri.startsWith(FileSystem.cacheDirectory)) throw new Error('Lokasi foto sementara tidak valid.');
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

export const enrollmentPoses = ['front', 'left', 'right'] as const satisfies readonly FacePose[];
export type EnrollmentPose = (typeof enrollmentPoses)[number];

function fileUri(path: string) { return /^[a-z][a-z0-9+.-]*:/i.test(path) ? path : `file://${path}`; }

/**
 * Reads a photo written by the camera library into memory (base64) and ALWAYS deletes the file afterwards.
 * The path comes straight from the camera library (Android cache dir, iOS tmp dir), so unlike
 * removeTemporaryPhoto() it is not restricted to FileSystem.cacheDirectory.
 */
export async function consumeCapturedPhoto(path: string): Promise<string> {
  const uri = fileUri(path);
  if (!uri.startsWith('file://') || !/\.(jpe?g|png)$/i.test(uri)) throw new Error('Lokasi foto sementara tidak valid.');
  try { return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }); }
  finally { await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined); }
}

/** Startup cleanup for photos left behind by a crash/kill (VisionCamera temp files and expo-camera's Camera/ cache dir). */
export async function purgeOrphanedFacePhotos(): Promise<void> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) return;
  const names = await FileSystem.readDirectoryAsync(dir);
  await Promise.all(names.filter((name) => name === 'Camera' || /^mrousavy.*\.(jpe?g|png)$/i.test(name))
    .map((name) => FileSystem.deleteAsync(`${dir}${name}`, { idempotent: true })));
}

/** Server 422 details -> poses that must be retaken. Empty result means "unknown": the user picks which pose to retake. */
export function failedPosesFromErrors(errors: Record<string, string | string[]> | undefined, captures: FaceCapture[]): EnrollmentPose[] {
  const failed = new Set<EnrollmentPose>();
  for (const key of Object.keys(errors ?? {})) {
    const index = /(?:^|\.)captures[.[](\d+)/.exec(key)?.[1];
    if (index !== undefined && captures[Number(index)]) {
      const pose = captures[Number(index)].pose;
      if ((enrollmentPoses as readonly string[]).includes(pose)) failed.add(pose as EnrollmentPose);
      continue;
    }
    const named = enrollmentPoses.find((pose) => new RegExp(`(^|[._\\[])${pose}($|[._\\]])`).test(key));
    if (named) failed.add(named);
  }
  return enrollmentPoses.filter((pose) => failed.has(pose));
}
