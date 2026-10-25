import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ value: null as string | null }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
  getItemAsync: vi.fn(async () => state.value),
  setItemAsync: vi.fn(async (_key: string, value: string) => { await new Promise((r) => setTimeout(r, 1)); state.value = value; }),
  deleteItemAsync: vi.fn(async () => { state.value = null; }),
}));
import { getAccessToken, setAccessToken, removeAccessToken } from './tokenStorage';
import { setItemAsync } from 'expo-secure-store';
describe('serialized secure token storage', () => {
  beforeEach(async () => { await removeAccessToken(); vi.clearAllMocks(); });
  it('stores the token only in device-bound SecureStore', async () => {
    await setAccessToken('token'); expect(setItemAsync).toHaveBeenCalledWith('aranus.access-token.v1', 'token', { keychainAccessible: 'device-only' });
    expect(await getAccessToken()).toBe('token');
  });
  it('protects a new login from a late old-session removal', async () => {
    await setAccessToken('old'); const login = setAccessToken('new'); const oldLogout = removeAccessToken('old');
    await Promise.all([login, oldLogout]); expect(await getAccessToken()).toBe('new');
    await removeAccessToken('new'); expect(await getAccessToken()).toBeNull();
  });
});
