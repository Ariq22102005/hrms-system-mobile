import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { api, EmployeeDto, isApiConfigured, registerUnauthorizedHandler } from '../services/api';
import { clearCachedDashboard, purgeLegacyDashboardCache } from '../services/dashboardCache';
import { getAccessToken, removeAccessToken, setAccessToken } from '../services/tokenStorage';
type AuthContextValue = {
  employee: EmployeeDto | null; isLoading: boolean; error: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>; updateEmployee: (employee: EmployeeDto) => void;
};
const AuthContext = createContext<AuthContextValue | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<EmployeeDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const signingIn = useRef(false);
  const employeeIdRef = useRef<string | null>(null);
  employeeIdRef.current = employee?.id ?? null;
  const renderGeneration = generation.current;
  const updateEmployee = (next: EmployeeDto) => {
    if (generation.current === renderGeneration) setEmployee((current) => current?.id === next.id ? next : current);
  };
  useEffect(() => {
    let active = true;
    void purgeLegacyDashboardCache().catch(() => { if (active) setError('Cache lama belum dapat dibersihkan. Hubungi tim IT sebelum memakai perangkat bersama.'); });
    const unregister = registerUnauthorizedHandler(() => {
      const previousEmployeeId = employeeIdRef.current;
      generation.current++; setEmployee(null);
      if (previousEmployeeId) void clearCachedDashboard(previousEmployeeId);
      setError('Session expired / Sesi berakhir. Silakan masuk kembali.');
    });
    const version = generation.current;
    void (async () => {
      try {
        if (!isApiConfigured()) { setError('API belum dikonfigurasi. Isi EXPO_PUBLIC_API_BASE_URL_DEV di .env.'); return; }
        if (!await getAccessToken()) return;
        const profile = await api.getEmployee();
        if (active && generation.current === version) setEmployee(profile);
      } catch (e) { if (active && generation.current === version) setError(e instanceof Error ? e.message : 'Unable to restore session'); }
      finally { if (active) setIsLoading(false); }
    })();
    return () => { active = false; unregister(); };
  }, []);
  async function signIn(email: string, password: string) {
    if (signingIn.current) return false;
    setError(null);
    if (!email.trim() || !password) { setError('Email and password required / Email dan password wajib diisi.'); return false; }
    const version = ++generation.current;
    signingIn.current = true;
    let issuedToken: string | undefined;
    try {
      const { token } = await api.login(email.trim(), password);
      issuedToken = token;
      if (!token) throw new Error('Access token missing');
      if (generation.current !== version) return false;
      await setAccessToken(token);
      if (generation.current !== version) { await removeAccessToken(token); return false; }
      const profile = await api.getEmployee();
      if (generation.current !== version) return false;
      setEmployee(profile); return true;
    } catch (e) {
      if (generation.current === version) { await removeAccessToken(issuedToken); setError(e instanceof Error ? e.message : 'Login failed'); }
      return false;
    } finally { signingIn.current = false; }
  }
  async function signOut() {
    generation.current++;
    const employeeId = employee?.id;
    setEmployee(null);
    const token = await getAccessToken();
    await removeAccessToken(token ?? undefined);
    if (employeeId) {
      try { await clearCachedDashboard(employeeId); }
      catch { setError('Cache sesi belum dapat dibersihkan.'); }
    }
    if (token) void api.logout(token).catch(() => { /* Backend expiry still applies if offline. */ });
  }
  return <AuthContext.Provider value={{ employee, isLoading, error, signIn, signOut, updateEmployee }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth requires AuthProvider'); return value; }
