# Employee photo Blob warning fix

Date: 5 October 2026 (Asia/Jakarta).

## Change and root cause

The employee avatar called `Response.blob()` on every platform. Expo's native fetch implementation detects React Native's global Blob and warns about copying response bytes into the native Blob store. The avatar then used FileReader to convert that Blob to a base64 data URI, adding another conversion.

Before: authenticated fetch -> native Blob -> FileReader -> data URI.
After on Android/iOS: authenticated fetch -> ArrayBuffer -> base64 data URI.
Web retains its browser Blob, object URL and URL revocation.

This is an isolated conversion fix. The protected-fetch approach already exists to work around native Image networking/header issues documented in `RELEASE-1.1.0.md`. It is preserved. Expo also documents [expo-blob](https://docs.expo.dev/versions/latest/sdk/blob/) as an alternative Blob implementation; this path no longer needs a native Blob or a global replacement.

## Baseline, version and files

- Baseline: app repository commit `c2d0bc8`, package/app version `1.1.0`; working tree was clean before this fix.
- New iteration: uncommitted source patch to `1.1.0`; no release version bump, APK rebuild or deployment.
- Source, dependencies and tests: +48 / -7 lines (net +41), excluding this report. No dependency versions upgraded.
- Modified: `src/components/EmployeeAvatar.tsx:22` selects the platform conversion; native helper call at line 28.
- Modified: `package.json:10` and `package-lock.json:15` declare `base64-js` directly. Its existing locked/installed version is `1.5.1`, already required by React Native; no new native module.
- Added: `src/services/photoDataUri.ts:5` converts response bytes while preserving the response content type.
- Added: `src/services/photoDataUri.test.ts:4` contains seven regression cases.
- Removed: the six-line native FileReader Promise wrapper. The former unconditional Blob read now runs only on web. No legacy system or entire original file deleted.

## Compatibility, performance and regression review

Authentication headers, API URLs, HTTP error handling, abort cleanup, photo-version reload dependencies, fallback initials, Image rendering and web object URL cleanup remain in the existing component. No storage format, saved data, API contract or database change; no migration required. The change adds no effect, listener, background request or persistence write. Existing component state/timing behavior is preserved.

The native conversion avoids the Blob store round trip. It still loads the entire photo and allocates a base64 string (approximately 4/3 the binary size); it is not a streaming solution. Actual device timing and memory improvements have not been measured. Regression risks are native binary-body handling and data URI rendering; byte fidelity is covered by automated tests, while device rendering needs confirmation.

## QA/STQA results

- Baseline verified: TypeScript check passed; existing 13 tests passed.
- Patched source verified: `npm.cmd run typecheck` passed; `npm.cmd test` passed (4 files, 20 tests).
- Conversion coverage: exact JPEG data URI, unchanged content type, padding at 1/2/3 bytes, all byte values in a 65,537-byte response, absent content type, aborted body read propagation, and no call to `Response.blob()`.
- Structurally validated: `git diff --check` passed; `npm.cmd ls base64-js --depth=0` resolved `1.5.1`. Diff review confirmed the existing component and its lifecycle guards remain present, with no unrelated runtime edits.
- Device QA not performed in this iteration. Reload the development app, view Home/Profile, confirm the employee photo and absence of this warning, update the HR photo, then check offline/fallback behavior and rapid navigation/logout during loading. Repeat web loading to confirm object URL behavior.

- Bundle validation passed: `npx.cmd expo export --platform all --output-dir dist/blob-warning-fix` produced Android/iOS Hermes bundles and web bundles. Artifacts are under the existing ignored `dist/` directory. Successful JavaScript export does not establish native device acceptance.
