import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { validateBuild } = require('../../scripts/eas-build-result.cjs');
describe('release artifact selection', () => {
  const build = { id: 'build-id', status: 'FINISHED', platform: 'ANDROID', buildProfile: 'production-apk', gitCommitHash: 'commit', project: { id: 'project' } };
  it('accepts only the exact finished build', () => { expect(validateBuild([build], 'android', 'production-apk', 'commit', 'project')).toBe(build); });
  it.each([{ status: 'ERRORED' }, { gitCommitHash: 'unrelated' }, { buildProfile: 'preview' }, { platform: 'IOS' }, { project: { id: 'other-project' } }])('rejects unrelated/failed builds %j', (override) => {
    expect(() => validateBuild([{ ...build, ...override }], 'android', 'production-apk', 'commit', 'project')).toThrow();
  });
  it('rejects ambiguous list and absent commit', () => {
    expect(() => validateBuild([build, build], 'android', 'production-apk', 'commit', 'project')).toThrow();
    expect(() => validateBuild(build, 'android', 'production-apk', undefined, 'project')).toThrow();
  });
});
