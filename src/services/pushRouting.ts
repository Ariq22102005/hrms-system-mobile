// Push payload routing kept free of expo-notifications so it can be unit-tested.
export function isFaceEnrollmentPush(data: unknown): boolean {
  return typeof data === 'object' && data !== null && !Array.isArray(data) && (data as Record<string, unknown>).screen === 'FaceEnrollment';
}
const handled = new Set<string>();
/** Returns true the first time a notification response id is seen (cold-start + listener may both deliver it). */
export function claimNotificationOnce(id: string | undefined): boolean {
  if (!id) return true;
  if (handled.has(id)) return false;
  handled.add(id); if (handled.size > 50) handled.delete(handled.values().next().value as string);
  return true;
}
