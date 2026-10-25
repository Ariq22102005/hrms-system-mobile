import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['src/**/*.test.ts'], env: { EXPO_PUBLIC_APP_ENV: 'mock', EXPO_PUBLIC_API_BASE_URL_MOCK: 'http://localhost:4011' } } });
