import { expect, test } from '@playwright/test';
// Test-only JavaScript fixture.
import { createFixtureServer } from '../support/stateful-api.mjs';
import type { Server } from 'node:http';
let server: Server;
test.beforeAll(async () => { server = createFixtureServer(); await new Promise<void>((r) => server.listen(4011, '127.0.0.1', r)); });
test.afterAll(async () => { await new Promise<void>((r) => server.close(() => r())); });
// Attendance contract tests use a deterministic fresh GPS provider. The separate
// geofence test exercises Chromium geolocation and live coordinate changes.
test.beforeEach(async ({ context, page }, testInfo) => {
  await context.route('https://tile.openstreetmap.org/**', route => route.abort());
  if (testInfo.title.startsWith('GPS preview')) return;
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (success) => {
      const position = { coords: { latitude: -3.8, longitude: 102.2, accuracy: 5, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() };
      queueMicrotask(() => success(position as GeolocationPosition));
    };
  });
});
async function login(page: import('@playwright/test').Page) {
  await page.goto('/'); await page.getByPlaceholder('Email perusahaan').fill('qa@example.test');
  await page.getByPlaceholder('Enter your password').fill('fixture-only-password'); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('tab')).toHaveCount(5);
}
test('login errors, dashboard, profile, leave persistence, payroll, overtime, files, themes, navigation and logout', async ({ page }) => {
  test.setTimeout(120000); // Includes cold Metro compilation and all five tabs.
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/'); await page.getByPlaceholder('Email perusahaan').fill('qa@example.test'); await page.getByPlaceholder('Enter your password').fill('wrong'); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Invalid test credentials')).toBeVisible();
  await login(page); await expect(page.getByText('QA assignment', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Use dark mode' }).click(); await expect(page.getByRole('button', { name: 'Use light mode' })).toBeVisible();
  await page.screenshot({ path: 'test-results/home-dark-test-1.0.0.png', fullPage: true });
  await page.getByRole('button', { name: 'Use light mode' }).click(); await expect(page.getByRole('button', { name: 'Use dark mode' })).toBeVisible();
  await page.getByRole('button', { name: 'Bahasa Indonesia' }).click(); await expect(page.getByRole('tab', { name: 'Cuti', exact: true })).toBeVisible(); await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.screenshot({ path: 'test-results/home-light-test-1.0.0.png', fullPage: true });
  await page.getByRole('button', { name: 'Shared Drive', exact: true }).click(); await expect(page.getByText('No files available yet.')).toBeVisible(); await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Profile', exact: true }).click(); await page.getByRole('button', { name: 'Edit profile' }).click(); await page.getByLabel('Name', { exact: true }).fill('QA Updated'); await page.getByLabel('Phone number').fill('08123456789'); await page.getByRole('button', { name: 'Save profile' }).click(); await expect(page.getByText('Profile saved.')).toBeVisible();
  await page.getByRole('tab', { name: 'Leave', exact: true }).click(); await page.getByPlaceholder('Write the reason for your request').fill('Browser stateful QA'); await page.getByRole('button', { name: 'Submit request' }).dblclick(); await expect(page.getByText('Leave request sent to the server.')).toBeVisible(); await expect(page.getByText('Browser stateful QA', { exact: true })).toHaveCount(1);
  await page.getByRole('tab', { name: 'Payroll', exact: true }).click(); await expect(page.getByText('Rp 1.000.000').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Overtime', exact: true }).click(); await expect(page.getByText('QA assignment', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Home', exact: true }).click(); await page.getByRole('button', { name: 'Open profile', exact: true }).click(); await expect(page.getByRole('button', { name: 'Edit profile' })).toBeVisible(); await page.getByRole('button', { name: 'Back', exact: true }).click();
  for (const width of [360, 390, 1280]) { await page.setViewportSize({ width, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false); }
  await page.getByRole('button', { name: 'Profile', exact: true }).click(); await page.getByRole('button', { name: 'Sign out' }).click(); await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/login-light-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Use dark mode' }).click();
  await page.screenshot({ path: 'test-results/login-dark.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('guided front, glasses, left/right capture stays pending; exception does not save attendance', async ({ page, context }) => {
  await context.grantPermissions(['camera', 'geolocation']); await context.setGeolocation({ latitude: -3.8, longitude: 102.2, accuracy: 5 });
  await login(page); await page.getByRole('tab', { name: 'Attendance', exact: true }).click(); await page.getByRole('button', { name: 'Check-in', exact: true }).click();
  await expect(page.getByText('Consent to facial photo use')).toBeVisible(); await page.getByRole('button', { name: 'I need assistance from HR' }).click(); await expect(page.getByText('Capture cancelled.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Check-in', exact: true }).click(); await page.getByRole('button', { name: 'I agree, continue' }).click();
  await expect(page.getByRole('heading', { name: /Front face/ })).toBeVisible();
  await page.getByRole('button', { name: 'Capture and continue' }).click(); await expect(page.getByRole('heading', { name: /Remove glasses/ })).toBeVisible();
  await page.getByRole('button', { name: 'No glasses, continue' }).click(); await expect(page.getByRole('heading', { name: /Turn your head left/ })).toBeVisible();
  await page.getByRole('button', { name: 'Capture and continue' }).click(); await expect(page.getByRole('heading', { name: /Turn your head right/ })).toBeVisible();
  await page.getByRole('button', { name: 'Capture and continue' }).click(); await expect(page.getByText('Awaiting server verification', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check-in', exact: true })).toBeEnabled(); await expect(page.getByText('Present', { exact: true })).toHaveCount(0);
});
test('offline dashboard shows an error and recovers', async ({ page }) => {
  await login(page);
  await page.route('**/api/v1/dashboard', (route) => route.abort());
  await expect(page.getByText('Data is not synchronized.', { exact: false })).toBeVisible({ timeout: 15000 });
  await page.unroute('**/api/v1/dashboard');
  await expect(page.getByText('Data is not synchronized.', { exact: false })).toHaveCount(0, { timeout: 15000 });
});

test('GPS preview refreshes server area and accuracy without writing attendance', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -3.8, longitude: 102.2, accuracy: 5 });
  let submissions = 0;
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().endsWith('/attendance')) submissions++; });
  await login(page);
  await expect(page.getByLabel('Perseverance Technology Indonesia logo')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Attendance', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh GPS', exact: true }).click();
  await expect(page.getByText('Inside office area', { exact: true })).toBeVisible();
  await expect(page.getByText('± 5 m', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/geofence-light.png', fullPage: true });
  await context.setGeolocation({ latitude: -3.81, longitude: 102.2, accuracy: 5 });
  await page.getByRole('button', { name: 'Refresh GPS', exact: true }).click();
  await expect(page.getByText('Outside office · HR review required', { exact: true })).toBeVisible();
  await context.setGeolocation({ latitude: -3.8, longitude: 102.2, accuracy: 500 });
  await page.getByRole('button', { name: 'Refresh GPS', exact: true }).click();
  await expect(page.getByText('Refresh GPS · location expired or inaccurate', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Use dark mode' }).click();
  await page.screenshot({ path: 'test-results/geofence-dark.png', fullPage: true });
  expect(submissions).toBe(0);
});
test('an expired authenticated API session returns to login', async ({ page }) => {
  await login(page);
  await page.route('**/api/v1/dashboard', (route) => route.fulfill({ status: 401, json: { success: false, message: 'Session expired', errors: {} } }));
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible({ timeout: 12000 });
});
test('camera denial stops attendance before capture', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']); await context.setGeolocation({ latitude: -3.8, longitude: 102.2, accuracy: 5 });
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Camera denied for QA', 'NotAllowedError'); }; });
  await login(page); await page.getByRole('tab', { name: 'Attendance', exact: true }).click(); await page.getByRole('button', { name: 'Check-in', exact: true }).click(); await page.getByRole('button', { name: 'I agree, continue' }).click();
  await expect(page.getByText('Camera permission required', { exact: false })).toBeVisible(); await expect(page.getByRole('heading', { name: /Front face/ })).toHaveCount(0);
});
test('location denial stops attendance before capture', async ({ page, context }) => {
  await context.grantPermissions(['camera']);
  await page.addInitScript(() => {
    const query = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = async (descriptor) => descriptor.name === 'geolocation' ? { state: 'denied' } as PermissionStatus : query(descriptor);
  });
  await login(page); await page.getByRole('tab', { name: 'Attendance', exact: true }).click(); await page.getByRole('button', { name: 'Check-in', exact: true }).click(); await page.getByRole('button', { name: 'I agree, continue' }).click();
  await expect(page.getByText('Location permission required', { exact: false })).toBeVisible(); await expect(page.getByRole('heading', { name: /Front face/ })).toHaveCount(0);
});
for (const status of ['verified', 'rejected', 'retry_required', 'pending', 'unavailable'] as const) {
  test(`negotiated multi-photo contract handles server status ${status} without fake completion`, async ({ page, context }) => {
    // Test response fixtures exercise the API/UI contract, not a recognition engine.
    await context.grantPermissions(['camera', 'geolocation']); await context.setGeolocation({ latitude: -3.8, longitude: 102.2, accuracy: 5 });
    await page.route('**/api/v1/attendance/challenge', async (route) => {
      const response = await route.fetch(); const json = await response.json(); json.data.face_capture_policy = { version: 1, require_without_glasses: true, verification_endpoint: '/attendance/face-verification' };
      await route.fulfill({ response, json });
    });
    let verifyCalls = 0; let attendanceCalls = 0;
    await page.route('**/api/v1/attendance/face-verification', async (route) => {
      verifyCalls++; const body = route.request().postDataJSON(); expect(body.captures.map((c: { pose: string }) => c.pose)).toEqual(['front', 'without_glasses', 'left', 'right']); expect(body.consent_version).toBe('1');
      await route.fulfill({ json: { success: true, message: 'Test response only', data: { status, message: 'Contract fixture', ...(status === 'verified' ? { verification_id: 'fixture-verification', expires_at: new Date(Date.now() + 60000).toISOString() } : {}) } } });
    });
    await page.route('**/api/v1/attendance', async (route) => { if (route.request().method() === 'POST') { attendanceCalls++; expect(route.request().postDataJSON().face_verification_id).toBe('fixture-verification'); } await route.continue(); });
    await login(page); await page.getByRole('tab', { name: 'Attendance', exact: true }).click(); await page.getByRole('button', { name: 'Check-in', exact: true }).click(); await page.getByRole('button', { name: 'I agree, continue' }).click();
    for (const heading of ['Front face', 'Remove glasses', 'Turn your head left', 'Turn your head right']) { await expect(page.getByRole('heading', { name: new RegExp(heading) })).toBeVisible(); await page.getByRole('button', { name: 'Capture and continue' }).click(); }
    const expected = status === 'rejected' ? 'The server rejected face verification.' : status === 'retry_required' ? 'The server requires a new capture.' : status === 'pending' ? 'Backend verification is pending.' : status === 'unavailable' ? 'Verification unavailable.' : 'Awaiting server verification';
    await expect(page.getByText(expected, { exact: false }).first()).toBeVisible();
    expect(verifyCalls).toBe(1); expect(attendanceCalls).toBe(status === 'verified' ? 1 : 0);
    await expect(page.getByText('Present', { exact: true })).toHaveCount(0);
  });
}
