import { openDatabaseAsync } from 'expo-sqlite';
import type { DashboardDto } from './api';

// Compatibility API: sensitive server snapshots now live only in process memory.
const snapshots = new Map<string, DashboardDto>();
let cleanup: Promise<void> | null = null;
export function purgeLegacyDashboardCache(): Promise<void> {
  if (!cleanup) cleanup = (async () => {
    const db = await openDatabaseAsync('aranus-cache.db');
    try {
      await db.execAsync('PRAGMA secure_delete=ON; CREATE TABLE IF NOT EXISTS dashboard_cache (employee_id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, updated_at INTEGER NOT NULL); DELETE FROM dashboard_cache; PRAGMA wal_checkpoint(TRUNCATE); VACUUM;');
    } finally { await db.closeAsync(); }
  })().catch((error) => { cleanup = null; throw error; });
  return cleanup;
}
export async function cacheDashboard(value: DashboardDto) { snapshots.set(value.employee.id, value); }
export async function getCachedDashboard(employeeId: string): Promise<DashboardDto | null> { return snapshots.get(employeeId) ?? null; }
export async function clearCachedDashboard(employeeId: string) { snapshots.delete(employeeId); }
