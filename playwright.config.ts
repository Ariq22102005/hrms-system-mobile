import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './test/browser', timeout: 45000, workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://localhost:8082', viewport: { width: 390, height: 844 }, screenshot: 'only-on-failure', trace: 'retain-on-failure', launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } },
  webServer: {
    command: 'npx expo start --web --port 8082', url: 'http://localhost:8082', timeout: 120000,
    reuseExistingServer: false,
    env: { EXPO_PUBLIC_APP_ENV: 'mock', EXPO_PUBLIC_API_BASE_URL_MOCK: 'http://localhost:4011', CI: '1' },
  },
});
