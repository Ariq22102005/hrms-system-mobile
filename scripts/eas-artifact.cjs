const { readFileSync, writeFileSync } = require('node:fs');
const { validateBuild } = require('./eas-build-result.cjs');
(async () => {
  const [input, platform, profile, output] = process.argv.slice(2);
  const build = validateBuild(JSON.parse(readFileSync(input, 'utf8')), platform, profile, process.env.GITHUB_SHA, JSON.parse(readFileSync('app.json')).expo.extra.eas.projectId);
  if (output === '--id') { process.stdout.write(build.id); return; }
  if (!output?.endsWith('.apk') || platform !== 'android') throw new Error('APK output required');
  const url = build.artifacts?.buildUrl || build.artifacts?.applicationArchiveUrl;
  if (!url || new URL(url).protocol !== 'https:') throw new Error('Missing HTTPS artifact URL');
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Artifact download failed (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('Artifact is not an APK archive');
  writeFileSync(output, bytes);
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
