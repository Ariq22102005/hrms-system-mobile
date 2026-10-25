import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { api, FaceEnrollmentStatus, FaceStatusDto } from '../services/api';
import { purgeOrphanedFacePhotos } from '../services/faceCapture';
import { useAuth } from './AuthContext';

type FaceStatusValue = {
  /** Raw server DTO, null until the first successful read. */
  info: FaceStatusDto | null;
  /** Convenience: info?.status. null = unknown (loading or request failed) and is treated as NOT approved. */
  faceStatus: FaceEnrollmentStatus | null;
  error: string | null; loading: boolean;
  refresh: () => Promise<void>;
  /** Used right after a successful enroll so the UI shows `pending` without waiting for the network. */
  markPending: () => void;
};
const Context = createContext<FaceStatusValue | undefined>(undefined);

export function FaceStatusProvider({ children }: { children: ReactNode }) {
  const { employee } = useAuth(); const identity = employee?.id;
  const [info, setInfo] = useState<FaceStatusDto | null>(null);
  const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const generation = useRef(0); const inFlight = useRef<Promise<void> | null>(null);

  // Remove face photos left in the cache by a crash or kill (the app never keeps photos on purpose).
  useEffect(() => { void purgeOrphanedFacePhotos().catch(() => undefined); }, []);

  const refresh = useCallback((): Promise<void> => {
    if (!identity) return Promise.resolve();
    if (inFlight.current) return inFlight.current;
    const version = generation.current; setLoading(true);
    const task = (async () => {
      try {
        const next = await api.getFaceStatus();
        if (version !== generation.current) return; // account switched / logged out meanwhile
        setInfo(next); setError(null);
      } catch (e) {
        if (version === generation.current) setError(e instanceof Error ? e.message : 'Face status unavailable');
      } finally { if (version === generation.current) { setLoading(false); inFlight.current = null; } }
    })();
    inFlight.current = task; return task;
  }, [identity]);

  useEffect(() => {
    generation.current++; inFlight.current = null; setInfo(null); setError(null); setLoading(false);
    if (!identity) return;
    void refresh();
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => { generation.current++; listener.remove(); };
  }, [identity, refresh]);

  const markPending = useCallback(() => setInfo({ status: 'pending', rejection_reason: null, updated_at: new Date().toISOString() }), []);
  return <Context.Provider value={{ info, faceStatus: info?.status ?? null, error, loading, refresh, markPending }}>{children}</Context.Provider>;
}
export function useFaceStatus() { const value = useContext(Context); if (!value) throw new Error('useFaceStatus requires FaceStatusProvider'); return value; }
