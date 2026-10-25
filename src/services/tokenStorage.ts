import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const accessTokenKey = 'aranus.access-token.v1';
let webAccessToken: string | null = null;
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

export async function getAccessToken() {
  await queue;
  return Platform.OS === 'web' ? webAccessToken : SecureStore.getItemAsync(accessTokenKey);
}

export async function setAccessToken(token: string) {
  return serialized(async () => {
    if (Platform.OS === 'web') { webAccessToken = token; return; }
    await SecureStore.setItemAsync(accessTokenKey, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  });
}

export async function removeAccessToken(expectedToken?: string) {
  return serialized(async () => {
    const current = Platform.OS === 'web' ? webAccessToken : await SecureStore.getItemAsync(accessTokenKey);
    if (expectedToken !== undefined && current !== expectedToken) return;
    if (Platform.OS === 'web') { webAccessToken = null; return; }
    await SecureStore.deleteItemAsync(accessTokenKey);
  });
}
