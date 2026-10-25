import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { colors as lightColors } from '../theme';
export type ThemeColors = typeof lightColors;
const darkColors: ThemeColors = { ...lightColors, background: '#0B0B0B', surface: '#191717', ink: '#F5F2ED', muted: '#BDB5AD', border: '#3C3333', accent: '#E49BA4', primarySoft: '#351B20', success: '#8CC7A6', successSoft: '#192F25', danger: '#F0A0A7', dangerSoft: '#3B2025', warning: '#DEBE80', warningSoft: '#332B1E' };
const key = 'aranus.theme.v1';
const Context = createContext<{ colors: ThemeColors; dark: boolean; toggle: () => void } | undefined>(undefined);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setMode] = useState<'light' | 'dark' | null>(null);
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const saved = Platform.OS === 'web' ? localStorage.getItem(key) : await SecureStore.getItemAsync(key);
        if (active && (saved === 'dark' || saved === 'light')) setMode(saved);
      } catch { /* Default to system appearance. */ }
      finally { if (active) setRestored(true); }
    })();
    return () => { active = false; };
  }, []);
  const dark = (mode ?? system) === 'dark';
  const toggle = () => {
    if (!restored) return;
    const next = dark ? 'light' : 'dark'; setMode(next);
    if (Platform.OS === 'web') { try { localStorage.setItem(key, next); } catch {} }
    else void SecureStore.setItemAsync(key, next).catch(() => {});
  };
  return <Context.Provider value={{ dark, colors: dark ? darkColors : lightColors, toggle }}>{children}</Context.Provider>;
}
export function useTheme() { const value = useContext(Context); if (!value) throw new Error('useTheme requires ThemeProvider'); return value; }
export function useThemedStyles<T>(factory: (colors: ThemeColors) => T) { const { colors } = useTheme(); return useMemo(() => factory(colors), [colors, factory]); }
