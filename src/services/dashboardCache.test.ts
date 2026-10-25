import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rows, database } = vi.hoisted(() => {
  const rows = new Map<string, { payload: string; updated_at: number }>();
  const database = {
    execAsync: vi.fn(async () => undefined),
    closeAsync: vi.fn(async () => undefined),
    runAsync: vi.fn(async (_sql: string, employeeId: string, payload?: string) => {
      if (payload === undefined) rows.delete(employeeId);
      else rows.set(employeeId, { payload, updated_at: Date.now() });
    }),
    getFirstAsync: vi.fn(async (_sql: string, employeeId: string) => rows.get(employeeId) ?? null),
  };
  return { rows, database };
});

vi.mock('expo-sqlite', () => ({ openDatabaseAsync: async () => database }));

import { cacheDashboard, clearCachedDashboard, getCachedDashboard, purgeLegacyDashboardCache } from './dashboardCache';
import { DashboardDto } from './api';

const dashboard = (employeeId: string): DashboardDto => ({
  revision: 3,
  employee: { id: employeeId, name: 'Employee', email: 'employee@example.test', role: 'Staff', division: 'Ops' },
  office: { latitude: 0, longitude: 0, radius_meters: 50, max_accuracy_meters: 50, time_zone: 'Asia/Jakarta' },
  attendance: [], leaves: [], overtime: [], payroll: [], notifications: [],
});

describe('server dashboard memory snapshot', () => {
  beforeEach(() => { rows.clear(); vi.clearAllMocks(); });

  it('stores server data by employee and only returns it for the matching account', async () => {
    const response = dashboard('EMP-1');
    await cacheDashboard(response);
    await expect(getCachedDashboard('EMP-1')).resolves.toEqual(response);
    await expect(getCachedDashboard('EMP-2')).resolves.toBeNull();
    expect(database.runAsync).not.toHaveBeenCalled();
    expect(database.execAsync).not.toHaveBeenCalled();
  });

  it('clears cached sensitive data when an employee signs out', async () => {
    await cacheDashboard(dashboard('EMP-1'));
    await clearCachedDashboard('EMP-1');
    await expect(getCachedDashboard('EMP-1')).resolves.toBeNull();
  });
  it('purges only the obsolete local cache and closes the SQLite handle', async () => {
    await purgeLegacyDashboardCache();
    expect(database.execAsync).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM dashboard_cache'));
    expect(database.closeAsync).toHaveBeenCalledOnce();
  });
});
