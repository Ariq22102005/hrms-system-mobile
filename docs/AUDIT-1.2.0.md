# Laporan engineering dan QA — Aranus Attendance 1.2.0

Tanggal: 12 Oktober 2026, Asia/Jakarta. Ini laporan audit source lokal, bukan release/deployment produksi.

## 1. Ringkasan

Hardening diterapkan pada sistem existing: transport API, token lifecycle, cache sensitif, capture wajah, file, feedback/error, dokumentasi, dan proses CI/release. Lima tab, gesture, profil, notifikasi, cuti, payroll/PDF, geofence/outside-office review, serta klarifikasi HR dipertahankan. Tidak ada penggantian framework, recognition engine client, database perusahaan dalam APK, atau mutasi PUT/PATCH/DELETE mobile.

Alur sumber kebenaran tetap mobile/Web Admin → HTTPS REST API → backend → database. SQLite dalam app hanya tersisa untuk cleanup cache legacy; snapshot profil/payroll/attendance kini hanya di memori.

## 2. Baseline, versi, dan ukuran perubahan

- Baseline repository bersih: `6624f6a`, package/app 1.1.0.
- Source baru: package/app/lockfile 1.2.0. Branch existing `release/attendance-1.1.0` dipertahankan; nama branch bukan nomor versi source terbaru.
- Tidak membuat commit/tag, push, merge, GitHub Release, EAS cloud build, atau store submission.
- Di luar laporan ini dan asset yang berubah bersamaan: 32 file existing dimodifikasi, 23 file baru; sekitar +3259/-784 baris, net +2475. Termasuk lockfile, collection Postman, dan konsolidasi dokumentasi. Laporan ini menambah satu file dokumentasi.
- Runtime `src` tanpa tes: sekitar +434/-142 baris. Tidak ada penghapusan sistem besar atau file runtime existing.
- Identitas Android/iOS, EAS project ID/owner, route utama, dan adapter print existing tetap sama. Previous source baseline tetap dapat ditinjau melalui Git.

## 3. Temuan dan akar masalah

| Temuan | Mekanisme / perbaikan |
|---|---|
| Cache SQLite sensitif | Snapshot lengkap employee, attendance/lokasi, cuti, notifikasi, dan payroll ditulis plaintext setiap refresh. Ganti penulisan dengan memori; cleanup tabel cache lama pada startup. Database backend/history tidak disentuh. |
| JSON bertipe hanya saat compile | Cast envelope/DTO tidak memvalidasi payload jaringan; bentuk field yang salah dapat masuk UI. Validator runtime kini memeriksa envelope dan DTO endpoint, termasuk policy, timezone, timestamp, angka, serta field opsional yang dipakai UI. |
| URL aset protocol-relative | Guard lama memeriksa URL absolute HTTP saja; `//origin-lain/...` pada branch relative dapat menuju origin lain dengan header Bearer. Resolusi URL sekarang wajib HTTP(S), origin API yang sama, tanpa embedded credentials; request menolak redirect. |
| Race token login/logout | SecureStore write/delete async tidak diserialisasi. Tambahkan antrean operasi dan conditional remove sesuai token; handler 401 tidak menghapus sesi baru. Login punya ref lock/generation guard; logout melepaskan UI sebelum invalidasi server background. |
| Capture satu foto | Alur lama langsung mengambil satu foto. Tambahkan consent, front/glasses/left/right, framing, bantuan HR, ukuran foto, deletion cache kamera, retention deadline, dan verifikasi server negotiated. Tidak ada glasses/pose/liveness detector palsu. |
| GPS awal kedaluwarsa | Guided workflow memperpanjang waktu dibanding capture tunggal; menggunakan sampel sebelum capture berisiko melampaui freshness policy. Dua sampel final kini dibaca kembali sebelum attendance POST; expiry challenge/verification ID diperiksa. |
| Completion terlalu generik | UI lama menampilkan attendance saved untuk semua POST sukses. Kini status pending/unknown, outside pending, dan response type mismatch tidak dipresentasikan sebagai absensi sah. Ringkasan mengabaikan face/location status non-verified yang eksplisit. Record legacy tanpa status tetap dapat ditampilkan sebagai history server, tanpa klaim biometrik. |
| Render dashboard berulang | Poll GET 3 detik mengganti state meski snapshot sama. Snapshot identik tidak mengganti data state; revision menurun tidak menimpa state lebih baru. Poll/resume/single-flight existing tetap dipertahankan. |
| File kamera/PDF sementara | Camera/PDF menghasilkan file cache native. Capture cache dihapus segera, PDF setelah save/share, dan file Shared Drive setelah share. Native failure/cleanup harus tetap diuji hardware. |
| Halaman web refused | Port 8081 tidak mempunyai listener saat audit awal. Expo berhasil dimulai; QA Chromium benar-benar memuat aplikasi. Server preview lokal disiapkan kembali sesudah suite. |
| CI/Postman tidak tersedia | Tidak ada workflow active di app repo; collection lama sudah dihapus sebelum audit ini. Tambahkan CI, release approved, collection parameterized, serta stateful test fixture. |
| Dependency advisory | Sesudah alat QA ditambahkan, npm audit melaporkan 26 advisori (1 critical, 17 high, 8 moderate). Update shell-quote/source-map-js dan patch SDK mengurangi menjadi 23 (0 critical, 15 high, 8 moderate). Major downgrade Expo/RN tidak dijalankan. |

## 4. Fitur dan lokasi penting

| Lokasi source | Perubahan / anchor |
|---|---|
| `src/services/api.ts:173` | `createApiClient`: JSON/Bearer, timeout, GET retry, POST coalescing/idempotency |
| `src/services/api.ts:288` | `getBinary`: origin/redirect guard, size limit, abort, dan session guard |
| `src/services/api.ts:338` | `verifyFace`: kontrak POST tambahan, bukan recognition engine |
| `src/services/apiValidation.ts:1` | Validator envelope/DTO/policy/timestamp/timezone |
| `src/services/apiConfiguration.ts:1` | Pemisahan environment dan same-origin URL |
| `src/services/tokenStorage.ts:7` | Antrean SecureStore dan conditional deletion |
| `src/services/dashboardCache.ts:7` | Purge legacy SQLite; fungsi compatibility snapshot di memori |
| `src/context/AuthContext.tsx:44` | Lock sign-in/generation dan sign-out pada baris 66 |
| `src/context/DataContext.tsx:18` | Shared server state, single-flight, revision guard, unchanged-data check |
| `src/screens/AttendanceScreen.tsx:63` | Retention deadline; `capture` pada baris 169; consent UI sekitar baris 246 |
| `src/services/faceCapture.ts:1` | Ukuran/base64, pose completeness, temporary cache deletion |
| `src/components/SharedDrive.tsx:1` | Modal Home tanpa menambah/mengganti tab |
| `src/services/sharedFiles.ts:1` | Download authorized dan share/cleanup |
| `src/screens/PayrollScreen.tsx:38` | Generated PDF cleanup setelah save/share/cancel |
| `.github/workflows/ci.yml:1` | PR/development validation dan artifact QA |
| `.github/workflows/release.yml:44` | Production approval, audit gate, EAS hasil spesifik, optional TestFlight, draft release |
| `scripts/eas-build-result.cjs:1` | Validasi FINISHED/platform/profile/commit/project |
| `README.md:1` | Panduan utama Indonesia + kontrak existing dan tambahan |

Line merupakan posisi iterasi ini; gunakan nama fungsi/section untuk navigasi jika source berubah.

## 5. File existing yang dimodifikasi

| Kelompok | File |
|---|---|
| Konfigurasi/versi/dependency | `.env.example`, `.gitignore`, `app.config.js`, `app.json`, `eas.json`, `package.json`, `package-lock.json`, `plugins/withDevelopmentNetwork.js` |
| API/state/security | `src/services/api.ts`, `src/services/tokenStorage.ts`, `src/services/dashboardCache.ts`, `src/services/attendanceSummary.ts`, `src/services/attendanceFeedback.ts`, `src/context/AuthContext.tsx`, `src/context/DataContext.tsx`, `src/context/LanguageContext.tsx` |
| UI/features existing | `src/screens/AttendanceScreen.tsx`, `HomeScreen.tsx`, `LeaveScreen.tsx`, `LoginScreen.tsx`, `PayrollScreen.tsx`, `src/components/EmployeeAvatar.tsx`, `ScreenHeader.tsx`, `src/services/photoDataUri.ts` |
| Tes existing | `src/services/api.test.ts`, `src/services/dashboardCache.test.ts`, `src/services/attendanceSummary.test.ts` |
| Dokumentasi | `README.md`, `docs/API-INTEGRATION.md`, `DEVELOPER-GUIDE.md`, `DEVICE-QA.md`, `ONLINE-TEST-GUIDE.md` |

Before/after utama: cache disk→memori; single capture→guided capture dengan branch kontrak backend; URL guard absolute-only→resolved same-origin; submit success generik→keputusan berdasarkan status record server. Kamera/geofence, profile command POST, leave enum, PDF formatting, serta workflow outside review tetap diperluas melalui infrastrukur existing.

## 6. Original yang dihapus

Tidak ada file original repository yang dihapus. Yang dikeluarkan dari runtime adalah SQL insert/read dashboard plaintext, fetch aset tersebar yang digantikan transport binary terpusat, log error auth/cache yang dapat membawa detail server, import unused, dan enam style ScreenHeader yang tidak dirujuk.

Isi empat panduan redundant dikonsolidasikan sebelum diganti pointer ke README; detail DTO, command admin, payroll, review/klarifikasi, dan hosting penting dipertahankan. LICENSE, laporan `RELEASE-1.1.0.md`, dan `BLOB-WARNING-FIX.md` tidak dihapus. Asset existing tetap disimpan; ikon screen lama teridentifikasi tidak dirujuk tetapi tidak dimasukkan bundle jika tidak diimport. Foto referensi existing masih dipakai backend saudara, sehingga tidak dihapus hanya karena tidak diimport UI.

SQLite cleanup hanya menghapus salinan tabel `dashboard_cache` pada perangkat; bukan database bisnis atau attendance authoritative. Snapshot disk lama tidak dipulihkan lagi. Dampak kompatibilitasnya adalah tidak ada dashboard persisten setelah proses ditutup; online GET diperlukan untuk sesi baru.

## 7. File baru

- `.github/workflows/ci.yml`, `.github/workflows/release.yml`.
- `eslint.config.mjs`, `vitest.config.mts`, `playwright.config.ts`.
- `postman/Aranus.postman_collection.json`, `postman/Aranus.local.postman_environment.json`.
- `scripts/eas-artifact.cjs`, `eas-build-result.cjs`, `validate-release.cjs`.
- `src/components/SharedDrive.tsx`.
- `src/services/apiConfiguration.ts`, `apiValidation.ts`, `faceCapture.ts`, `sharedFiles.ts`.
- `src/services/apiHardening.test.ts`, `apiStateful.test.ts`, `config.test.ts`, `faceCapture.test.ts`, `release.test.ts`, `tokenStorage.test.ts`.
- `test/browser/app.spec.ts`, `test/support/stateful-api.mjs`.
- `docs/AUDIT-1.2.0.md` (laporan ini).

## 8. Kontrak dan backward compatibility

Required endpoint login/employee/attendance/leave/overtime/payroll dipertahankan. Profile edit/logout/notification read/clarification tetap command POST, tanpa PUT/PATCH/DELETE. Bearer/SecureStore dan DTO legacy optional tetap didukung; unknown extra fields backend diperbolehkan. Backend malformed/error tidak dianggap success.

Frontend Shared Drive mengharapkan GET `/files` metadata `{id,name,url}` dan binary GET di origin API. Backend demo existing tidak menyediakan route itu; tampilkan unavailable/404, bukan data mock seolah resmi.

Multi-photo merupakan **kontrak tambahan yang didokumentasikan, belum diimplementasikan backend perusahaan**. Challenge optional `face_capture_policy:{version:1,require_without_glasses,verification_endpoint:"/attendance/face-verification"}` menegosiasikan penggunaan endpoint tersebut. Payload POST `{challenge_id,consent_version:"1",captures:[{pose,photo_base64,captured_at}]}`; response status `verified|rejected|retry_required|pending|unavailable`. Verified wajib verification ID/expiry server. Attendance POST hanya menambah `face_verification_id` bila policy itu aktif. Backend harus mengikat/mengonsumsi ID secara atomik serta memvalidasi sesi, enrollment revision, expiry, liveness dan attendance.

Tanpa policy, frontend mempertahankan POST attendance frontal existing. Foto gerakan tidak dikirim; UI menjelaskan bahwa server memverifikasi frontal saja. Tidak mengklaim gerakan sebagai liveness. Server demo mempunyai YuNet/SFace matching, tetapi layanan biometrik produksi yang dievaluasi, liveness/anti-spoofing, consent/retention/deletion, dan exception HR tetap diperlukan.

`preview` sekarang staging HTTPS (`EXPO_PUBLIC_API_BASE_URL_STAGING`); demo LAN menggunakan profile development/DEV. Tim harus memperbarui environment EAS preview sebelum build berikutnya. Package ID/EAS owner/project/signing existing tidak diganti.

## 9. Performance

POST identik single-flight, GET retry hanya satu kali, polling foreground 3 detik dipertahankan agar workflow sinkron existing tidak berubah. Snapshot data identik tidak mengganti state dashboard; timestamp sinkronisasi tetap diperbarui. JSON comparison tetap O(n); pagination/push dibutuhkan pada skala besar, dan manfaat render belum diprofilkan pada hardware.

Foto bounded 2 MiB decoded per capture, maksimal empat. File download 10 MiB, avatar 5 MiB. Browser stream dihentikan bila ukuran melampaui batas; native fetch yang tidak menawarkan stream masih memerlukan server bounds karena arrayBuffer dapat teralokasi sebelum pemeriksaan akhir. Base64 menambah memory overhead; tidak ada recognition model di APK. SQLite cache tidak ditulis pada setiap poll; cleanup legacy berjalan terpisah dari interaksi utama. GC/flash erasure tidak dijamin hanya dengan melepaskan reference atau secure delete.

## 10. Security findings dan residual

Tidak ditemukan password/token/secret produksi hardcoded pada source mobile yang diperiksa; token native device-bound SecureStore, web memory-only. `EXPO_PUBLIC_*` hanya konfigurasi publik. Permission native tetap camera dan location foreground; RECORD_AUDIO diblokir. Runtime token/face/employee payload tidak dicetak. Asset foto enrollment yang sudah ada tetap data pribadi: repository memerlukan kontrol akses dan izin penggunaan fixture sebelum dibagikan.

Audit final `dist/security-audit-final.json`: **23 advisori, 15 high, 8 moderate, 0 critical**. Ini jumlah paket yang ditandai termasuk transitive propagation, bukan 23 exploit berbeda atau bukti 15 vulnerability reachable di APK. Contoh root advisories tersisa: node-forge signature verification, braces stack exhaustion, dan uuid bounds pada dependency toolchain. Reachability/upgrade upstream masih perlu review. Fix force menyarankan downgrade mayor SDK/RN; tidak diterapkan. Shell-quote menjadi 1.12.0 dan source-map-js 1.2.2; SDK expo 57.0.27 serta sqlite 57.0.4 sesuai compatibility check.

Production gate `npm audit --omit=dev --audit-level=high` sengaja akan menghambat release sampai advisori high/critical ditangani. Tidak ada klaim audit bersih atau aplikasi sepenuhnya aman. Backend wajib TLS, authorization setiap record/file, transaction/idempotency atomik, credential/session lifecycle, rate limiting, secure enrollment, calibrated matching, liveness/anti-spoofing, retention/deletion/audit, dan geofence/server-time rules. GPS, timestamp, dan app yang dimodifikasi tidak menjadi bukti authoritative. Offline logout masih bergantung server expiry jika token revocation tidak tersampaikan. Native redirect/cleanup/keychain perlu acceptance perangkat.

## 11. QA/STQA yang benar-benar dieksekusi

| Pemeriksaan | Hasil dan cakupan |
|---|---|
| Baseline TypeScript/Vitest | Lulus, 27 tes existing sebelum perubahan |
| TypeScript strict final | Lulus `npm run typecheck` |
| ESLint final | Lulus `npm run lint --max-warnings 0` melalui script |
| Vitest final | **64/64**, 12 file: parser/envelope/HTTP, old 401 race, token serialization, GET retry/POST coalescing, idempotent HTTP POST→GET, capture limits/cleanup policy, cache memory/purge SQL invocation, timezone/summary, HTML escaping/binary conversion, artifact selection |
| Stateful HTTP fixture | Login, employee, attendance/cuti POST→GET/replay, dashboard, logout; fixture attendance selalu pending dan tidak menggunakan engine biometrik/database perusahaan |
| Backend dummy suite existing | **13/13** lulus pada proyek saudara: role/profile ownership, geofence failures, sequence/concurrency/idempotency, face mismatch/unavailable handling, cuti/admin/overtime/notifikasi/payroll, outside review/clarification, restart persistence. Suite ini menginjeksi verifier tes; bukan pengukuran recognition/liveness aktual |
| Playwright final | **11/11**: wrong/valid login/logout; profile/leave stateful, duplicate taps, dashboard/overtime/payroll/files empty; light/dark, ID/EN, viewport 360/390/1280 tanpa overflow; capture front/glasses guidance/left/right; HR exception; offline recovery; 401 session expiry; injected camera/GPS denial; negotiated multi-photo verified/rejected/retry/pending/unavailable |
| Verified response fixture | Verified ID memungkinkan submission, tetapi fixture attendance pending tetap tidak ditampilkan present/official completion; status capture saja tidak cukup |
| Expo compatibility | Lulus `expo install --check` setelah patch SDK |
| Android/iOS/web JS export | Lulus `expo export --platform all`; hasil ignored pada `dist/qa-1.2.0-final`. Ini bundle JS/Hermes, bukan signed native build |
| Workflow/Postman structural | Kedua YAML valid; Postman JSON dan 12 embedded request scripts valid secara parsing; release tag validator menerima v1.2.0. Tidak menjalankan Postman runner atau GitHub/EAS remote |
| Whitespace/deletion review | `git diff --check` lulus setelah memperbaiki trailing blank README; tidak ada file original deleted |
| Source security scan | Request sentral; tidak ada verified:true/runtime credential/logging sensitive yang ditambahkan; localStorage hanya preference tema |

Screenshot kedua tema: `test-results/home-light-1.2.0.png`, `home-dark-1.2.0.png`. Laporan browser HTML di `playwright-report/index.html`; output ini ignored Git dan tidak mengandung capture karyawan nyata. Browser suite memakai kamera dan GPS simulasi, serta test-only API/verifikasi fixture. Hasilnya tidak membuktikan native hardware, biometric accuracy, liveness, atau persistence backend perusahaan.

Browser Share with Agent/VS Code screen-control connector tidak tersedia pada tool sesi ini; halaman shared juga tidak diberikan. QA dilakukan melalui Playwright lokal yang tersedia, dengan screenshot dibaca langsung. ERR_CONNECTION_REFUSED diselesaikan dengan listener Expo, bukan diasumsikan berhasil dari screenshot lama.

**Structurally validated:** YAML/JSON, state generation, listener/timer cleanup, DTO/GET/POST compatibility, native permission config, exact build selection, print adapter dipertahankan.

**Inferred/belum diukur:** pengurangan rerender/IO, native URL redirect behavior, kemampuan signing/provisioning lingkungan tim, UX hardware di luar simulasi browser.

**Tidak dilakukan:** signed APK/AAB/IPA 1.2.0, real device Android/iOS, TestFlight/Play upload, actual recognition/liveness calibration, server perusahaan, GitHub Actions remote, postman runner, user data migration atau production deployment. Hasil emulator versi 1.1.0 pada laporan lama tidak diwariskan sebagai acceptance 1.2.0.

## 12. CI/CD dan build readiness

Validation PR/development/branch utama: npm ci, typecheck, lint, tests, Expo compatibility/export, Playwright, artifact audit. Release menunggu validation; production environment harus punya required reviewers (preflight fail-closed), dependency high gate, dan EXPO_TOKEN secret. Secret injection dibatasi pada step terkait, tidak ditulis source/log. Tag harus semantic dan cocok app/package.

EAS profile development/preview APK internal; production Android AAB dan iOS store IPA; production-apk untuk APK dengan konfigurasi produksi. Source config disiapkan; kredensial/signing/akses belum dibuktikan pada build 1.2.0. Tag job membuat draft GitHub Release dengan generated notes dan APK dari output build yang sama. Validator menolak build gagal, platform/profile/project/commit berbeda, list ambigu, atau commit tidak diketahui. Manual branch build menggunakan nama artifact SHA agar nama branch dengan slash tidak menjadi path artifact.

TestFlight optional (`ENABLE_TESTFLIGHT=true`) memakai build ID tepat, bukan latest; setup App Store Connect app ID/API key/credentials dan approval environment wajib. Environment rules tidak dapat disetel hanya dengan file workflow; maintainer harus mengaktifkan reviewer/no-bypass/allowed branch/tag sesuai plan GitHub. Google Play submission/public store release belum otomatis, dan perlu persetujuan terpisah.

## 13. Langkah manual tersisa

1. Tinjau diff dan laporan, buat branch rilis/PR sesuai tim; jangan publish langsung dari branch baseline existing. Semua perubahan saat ini lokal/uncommitted.
2. Isi URL HTTPS perusahaan untuk staging/production/EAS; pertahankan DEV LAN untuk perangkat fisik. Dokumentasi `README.md` section Environment/EAS menjelaskan target URL dan restart/rebuild.
3. Backend implementasikan endpoint existing, authorization/ownership, stateful GET hasil POST, transaction/idempotency/sequence/server time/geofence, dan standar errors.
4. Sepakati multi-capture policy dan endpoint verifikasi; evaluasi layanan matching/liveness, consent/enrollment/retention/deletion, binding verification ID, anti-spoofing, accessibility, serta exception HR. Jangan menyalakan policy sebelum server menegakkannya.
5. Implementasikan `/files` metadata/binary authorized. Uji download, content-type, ukuran, employee isolation, dan share/cleanup native; browser saat ini hanya membuktikan empty state.
6. Triage 23 advisori dependency dan siapkan upgrade kompatibel; production release high gate masih blocked secara desain.
7. Atur GitHub internal/production environments + reviewer/no-bypass/branch/tag restrictions dan EXPO_TOKEN. Konfirmasi EAS project access/URL environment, Android keystore, Apple provisioning/app record/App Store Connect API key, `submit.production.ios.ascAppId` sebelum mengaktifkan TestFlight.
8. Jalankan checklist perangkat fisik di README: permission deny/Settings, kamera semua langkah, lighting/expiry/cancel, GPS presisi/offline, actual backend success/failure, duplicate response loss, session restore, outside review, PDF save Android/iOS, file download, serta tema/navigation/responsiveness.
9. Setelah semua approval/checks, lakukan signed build dan acceptance, tag v1.2.0 matching version, tinjau draft release/hash/signing, lalu distribusi sesuai izin perusahaan. Audit ini tidak memberikan approval produksi.

Panduan lengkap serta JSON kontrak: [README utama](../README.md). Dokumentasi resmi yang dipakai memeriksa EAS workflow/CLI: [Build pada CI](https://docs.expo.dev/build/building-on-ci/), [EAS CLI reference](https://docs.expo.dev/eas/cli/), [TestFlight](https://docs.expo.dev/submit/testflight/). Capture Expo menghasilkan file cache; cleanup perlu diuji native: [Expo Camera](https://docs.expo.dev/versions/v58.0.0/sdk/camera/).

Catatan perubahan bersamaan: `assets/icon-aranus.webp` berubah dan `assets/icon-aranus.jpeg` ditambahkan selama sesi di luar edit agent audit; file tersebut dipertahankan dan tidak dihitung sebagai perubahan implementasi audit. Export terakhir memakai asset workspace yang tersedia. Review logo ini secara terpisah sebelum commit rilis.

Isolasi QA: percobaan reuse Metro preview pernah memakai API development alih-alih fixture sehingga dihentikan. Config akhir menjalankan server tes sendiri pada 8082 (reuse disabled), fixture 4011, terpisah dari preview development 8081. Kegagalan setup tersebut tidak dihitung sebagai tes fitur yang lulus.

Preview akhir: Chromium membuka http://localhost:8081 dengan HTTP 200, tombol Sign in terlihat, dan tidak ada pageerror. API lokal http://localhost:4000/health HTTP 200. Server preview dijalankan dalam CI mode tanpa autoreload browser; untuk pengembangan dengan watch jalankan ulang npm run web tanpa CI=1. Pengujian preview ini hanya memuat halaman login, tanpa membuat/mengubah data backend.
