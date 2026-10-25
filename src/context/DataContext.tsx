import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { api, DashboardDto } from '../services/api';
import { cacheDashboard, getCachedDashboard } from '../services/dashboardCache';
import { useAuth } from './AuthContext';
type DataValue = { data: DashboardDto | null; error: string | null; refresh: (force?: boolean) => Promise<void>; loading: boolean; lastSynced: number | null };
const DataContext = createContext<DataValue | undefined>(undefined);
export function DataProvider({ children }: { children: ReactNode }) {
  const { employee } = useAuth();
  const [data, setData] = useState<DashboardDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const dataRef = useRef<DashboardDto | null>(null);
  const identity = employee?.id;
  const generation = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const refresh = useCallback((force = false): Promise<void> => {
    if (!identity) return Promise.resolve();
    const version = generation.current;
    if (inFlight.current) return force ? inFlight.current.then(() => version === generation.current ? refresh() : undefined) : inFlight.current;
    setLoading(true);
    const task = (async () => {
      try {
        if (dataRef.current?.employee.id !== identity) {
          try {
            const cached = await getCachedDashboard(identity);
            if (cached && version === generation.current) {
              dataRef.current = cached;
              setData(cached);
            }
          } catch {
            // Continue with the authoritative GET if the memory snapshot is unavailable.
          }
        }
        const next = await api.getDashboard();
        if (!Array.isArray(next.attendance) || !Array.isArray(next.leaves) || !Array.isArray(next.notifications) || !Array.isArray(next.payroll) || !Array.isArray(next.overtime) || !next.office || next.employee?.id !== identity) throw new Error('Invalid dashboard response');
        if (version !== generation.current) return;
        if (dataRef.current && next.revision < dataRef.current.revision) return;
        const unchanged = dataRef.current && JSON.stringify(next) === JSON.stringify(dataRef.current);
        dataRef.current = next;
        if (!unchanged) setData(next);
        setError(null); setLastSynced(Date.now());
        void cacheDashboard(next);
      } catch (e) {
        if (version === generation.current) {
          setError(e instanceof Error ? e.message : 'Sync failed');
          if (dataRef.current?.employee.id !== identity) { dataRef.current = null; setData(null); }
        }
      }
      finally { if (version === generation.current) { setLoading(false); inFlight.current = null; } }
    })();
    inFlight.current = task; return task;
  }, [identity]);
  useEffect(() => {
    generation.current++; inFlight.current = null;
    dataRef.current = null;
    setData(null); setError(null); setLastSynced(null);
    if (!identity) { setLoading(false); return; }
    void refresh();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 3000);
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => { generation.current++; clearInterval(timer); listener.remove(); };
  }, [identity, refresh]);
  return <DataContext.Provider value={{ data, error, refresh, loading, lastSynced }}>{children}</DataContext.Provider>;
}
export function useData() { const value = useContext(DataContext); if (!value) throw new Error('useData requires DataProvider'); return value; }
