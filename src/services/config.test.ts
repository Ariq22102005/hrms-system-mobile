import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const configure = require('../../app.config.js');
describe('native network/build policy', () => {
  it('rejects missing/insecure staging and production URLs', () => {
    const saved = { ...process.env };
    try {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
      for (const environment of ['staging', 'production']) {
        process.env.EXPO_PUBLIC_APP_ENV = environment;
        const key = environment === 'production' ? 'EXPO_PUBLIC_API_BASE_URL_PROD' : 'EXPO_PUBLIC_API_BASE_URL_STAGING';
        for (const url of ['', 'http://api.company.test', 'https://localhost', 'https://example.com', 'https://user:password@api.company.test']) {
          process.env[key] = url; expect(() => configure({ config: {} })).toThrow();
        }
        process.env[key] = 'https://api.company.test';
        expect(configure({ config: {} }).ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads).toBe(false);
      }
    } finally { process.env = saved; }
  });
});
