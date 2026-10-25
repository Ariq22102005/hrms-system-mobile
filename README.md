# PTI Attendance App — 1.2.0

Panduan utama pengembangan aplikasi absensi Perseverance Technology Indonesia (PTI) untuk Android/iOS dengan pratinjau web. Sasaran proyek adalah integrasi perusahaan yang andal, aman, mudah dipelihara, dan dapat didistribusikan melalui EAS. Backend menjadi sumber kebenaran. Keberhasilan capture atau respons mock tidak membuktikan identitas, liveness, maupun penyimpanan pada database perusahaan.

Baseline: commit `6624f6a` ditambah perubahan lokal 1.2.0 yang belum dirilis. Iterasi ini diberi versi APK tes 1.0.0 sesuai permintaan, dengan Android versionCode 10001. Identitas package, data server, dan navigasi lima tab dipertahankan. Lihat [laporan rilis tes](docs/RELEASE-TEST-1.0.0.md) untuk perubahan dan QA terbaru.

Panduan hosting dan data geofence untuk tim web: [HOSTING-HANDOFF.md](docs/HOSTING-HANDOFF.md).

## Teknologi dan arsitektur

Expo SDK 57, React 19, React Native 0.86, TypeScript strict, React Navigation 7, Expo Camera/Location/SecureStore/FileSystem/Print/Sharing, Vitest, ESLint, Playwright, GitHub Actions, dan Expo EAS. Versi persis berada di `package.json` dan `package-lock.json`; gunakan `npm ci` untuk reproduksi.

```text
Expo Android/iOS ── HTTPS REST API ── Backend ── Database perusahaan
Web Admin        ── HTTPS REST API ── Backend yang sama ── Database yang sama
```

Mobile hanya membaca melalui GET, mengirim command melalui POST, menangkap foto/lokasi, melakukan pemeriksaan input untuk usability, serta menampilkan keputusan server. Server wajib melakukan autentikasi, ownership/role, validasi payload, aturan check-in/out, geofence, face matching/liveness, waktu server, transaksi database, idempotency, dan audit. Web Admin mengelola akun, kebijakan, tinjauan/pengecualian, dan data yang sama melalui API. APK tidak membuka MySQL/database perusahaan secara langsung.

`src/services/dashboardCache.ts` mempertahankan nama fungsi lama, tetapi snapshot sensitif kini hanya berada dalam memori proses. Saat startup, aplikasi mencoba mengosongkan tabel cache dashboard SQLite lama dengan secure delete/checkpoint/VACUUM. `expo-sqlite` dipertahankan untuk cleanup tersebut; database absensi backend tidak disentuh. Tidak ada antrean absensi offline, login mock otomatis, atau impor attendance lokal menjadi hasil resmi. Data terakhir dapat tampil saat jaringan gagal dalam sesi yang sama, dengan pesan sinkronisasi; restart perlu koneksi. Penghapusan cache bukan jaminan forensic erasure pada media flash/backup lama.

## Struktur proyek

```text
App.tsx                       Provider bahasa, tema, autentikasi, dan data
src/navigation/               Lima tab dan gesture navigasi
src/screens/                  Login, Home, Attendance, Leave, Payroll, Profile
src/components/               Header, toolbar, avatar, ringkasan, Shared Drive
src/context/                  AuthContext, DataContext, ThemeContext, LanguageContext
src/services/api.ts           Transport GET/POST dan kontrak DTO
src/services/apiValidation.ts Validasi JSON runtime sebelum digunakan UI
src/services/apiConfiguration.ts Environment dan URL file/foto
src/services/faceCapture.ts   Batas capture, kelengkapan, cleanup foto
src/services/tokenStorage.ts SecureStore native; token web di memori
src/services/*.test.ts       Unit, regresi, dan integrasi HTTP stateful
test/browser/                Skenario Playwright
test/support/                Fixture API khusus tes, di luar bundle aplikasi
postman/                     Collection dan environment tanpa kredensial
plugins/                     Konfigurasi jaringan native development
scripts/                     Adapter print Android dan validasi artefak/release
.github/workflows/           Validation dan release EAS dengan approval
app.json, app.config.js      Identitas aplikasi, permission, network policy
eas.json                     Profil APK internal, AAB/IPA produksi
docs/                        Laporan historis dan audit; panduan utama di README
```

Backend demo `../AranusAdminDummy` adalah proyek saudara dalam workspace, bukan bagian bundle mobile. Clone repository aplikasi saja tidak menyediakan proyek saudara. Repository aplikasi dan repository workspace induk mempunyai history masing-masing; jangan mengubah gitlink sebelum source aplikasi ditinjau dan dipublikasikan sesuai prosedur tim.

## Instalasi dan pengembangan lokal

Gunakan Node.js 22.13 atau lebih baru; CI memakai Node 24. Windows dapat memakai `npm.cmd`/`npx.cmd` tanpa mengubah execution policy. Android lokal memerlukan JDK 17 dan Android SDK; iOS lokal memerlukan macOS, Xcode, dan provisioning. EAS dapat membangun iOS dari host Windows dengan akun/kredensial yang benar.

```powershell
cd 'D:\capston Aranus\AranusAttendanceApp'
npm.cmd ci
Copy-Item .env.example .env
# Sesuaikan URL API pada .env sebelum menjalankan aplikasi.
npm.cmd start
# Web pada port tetap untuk QA:
npm.cmd run web -- --port 8081
```

Pada macOS/Linux gunakan `npm`, `npx`, dan `cp .env.example .env`. `npm ci` menjalankan adapter `scripts/fix-expo-print.cjs`; adapter mempertahankan WebView/task render Android sampai callback PDF selesai. `expo-print` dibangun dari source pada Android supaya patch terpakai. Jika source upstream berubah, adapter harus direview, bukan dilewati. Expo Go memakai modul native bawaannya sendiri; validasi PDF Android memakai build standalone. Lihat [lifecycle printing Android](https://developer.android.com/training/printing/html-docs).

```powershell
# Android/iOS dengan Metro melalui Expo Go: gunakan tombol a/i atau QR sesuai runtime.
npm.cmd run android
# macOS saja untuk build native lokal iOS:
npm run ios
```

Build Android lokal setelah menyiapkan JDK/SDK:

```powershell
npx.cmd expo prebuild --platform android --no-install
cd android
.\gradlew.bat :app:assembleRelease
```

Generated folder Android/iOS diabaikan Git. Pertahankan konfigurasi permanen dalam config/plugin. Keystore debug template tidak boleh dipakai distribusi resmi. Jangan menimpa APK known-good; simpan baseline dengan versi, build ID, hash, dan sertifikat signing. Windows dengan path panjang dapat membutuhkan checkout/build path yang lebih pendek; jangan memindahkan atau menghapus source otomatis.

## Environment

| APP_ENV | Variabel URL | Tujuan |
|---|---|---|
| `mock` | `EXPO_PUBLIC_API_BASE_URL_MOCK` | Fixture/API tes terpisah, bukan absensi resmi |
| `development` | `EXPO_PUBLIC_API_BASE_URL_DEV` | API demo LAN atau backend development |
| `staging` | `EXPO_PUBLIC_API_BASE_URL_STAGING` | Backend staging HTTPS |
| `production` | `EXPO_PUBLIC_API_BASE_URL_PROD` | Backend perusahaan HTTPS |

`EXPO_PUBLIC_API_BASE_URL` masih didukung sebagai fallback legacy. Lebih baik isi URL khusus tiap environment. Environment tidak dikenal ditolak. URL staging/production kosong, HTTP, localhost, IP privat umum, placeholder example.com/test/org, embedded credentials, query, atau fragment ditolak. DNS/private routing lain tetap perlu kebijakan backend/network; pemeriksaan ini bukan pengganti review deployment.

Semua `EXPO_PUBLIC_*` masuk bundle dan bukan tempat menyimpan password, token, signing key, atau rahasia. Jangan commit `.env`; hanya `.env.example` masuk source. API root boleh berupa origin atau diakhiri `/api/v1`; service tidak menggandakan prefix itu.

| Target development | Contoh URL |
|---|---|
| Browser / iOS simulator | `http://localhost:4000` |
| Android emulator | `http://10.0.2.2:4000` |
| Android/iOS fisik | `http://<IPv4-LAN-laptop>:4000` |

Pada perangkat fisik, localhost berarti perangkat sendiri. Periksa `ipconfig`, jaringan Wi-Fi, port, dan firewall. HTTP hanya untuk development/mock di jaringan tes. Ganti env lalu restart Metro (`npx expo start --clear`); APK perlu dibuild ulang karena URL ditanam saat bundling. Environment EAS harus diisi sendiri; file `.env` lokal bukan konfigurasi cloud.

## API dan autentikasi

Semua request data menggunakan JSON. Mobile hanya GET/POST. Binary foto/file menggunakan GET authenticated dan response binary; JSON envelope berlaku untuk metadata/data. Token diberikan `POST /api/v1/auth/login`, dikirim sebagai Bearer, dan disimpan di SecureStore dengan `WHEN_UNLOCKED_THIS_DEVICE_ONLY` pada Android/iOS. Token web hanya dalam memori; reload browser meminta login kembali. Preference tema web boleh di localStorage; token/password/payroll tidak boleh.

```json
{ "success": true, "message": "Operation successful", "data": {} }
```

```json
{ "success": false, "message": "Validation failed", "errors": { "field": ["Required"] } }
```

`success` wajib boolean, `message` wajib string, `data` wajib untuk sukses dan bentuknya divalidasi per endpoint. `errors` opsional dengan nilai string/string[]. HTTP 200/201 diterima setelah validasi; 400/401/403/404/409/422/429/500 ditampilkan sebagai error. 401 authenticated membuang sesi yang cocok, tanpa menghapus token sesi baru akibat respons lama. Login salah tidak memicu expired-session handler.

Timeout per percobaan 35 detik. GET network/timeout/500/502/503/504 boleh diulang satu kali setelah 300 ms; 429 menunggu retry pengguna, tanpa loop agresif. POST tidak diulang otomatis. POST identik yang masih berjalan digabung; key sama dengan payload berbeda ditolak. Attendance/cuti/clarification menggunakan UUID idempotency stabil untuk retry payload identik. Backend wajib menyimpan fingerprint dan hasil secara atomik, scoped per user/endpoint, serta mengembalikan hasil yang sama setelah respons hilang. Jangan menyimpan token/foto/payload sensitif pada log.

| Method | Endpoint `/api/v1` | Keterangan |
|---|---|---|
| POST | `/auth/login` | `{email,password}` → `{token}` |
| POST | `/auth/logout` | Cabut sesi server; logout lokal tetap selesai saat offline |
| GET | `/employee` | Profil akun yang authenticated |
| POST | `/employee` | Command edit `{name,phone}`; jabatan/divisi/foto dikelola HR |
| GET | `/employee/photo` | Binary JPEG/PNG/WebP dengan Bearer |
| GET | `/dashboard` | Snapshot employee/office/attendance/leaves/overtime/payroll/notifications + revision |
| POST | `/attendance/challenge` | Nonce terikat sesi, expiry, office, optional face capture policy |
| GET/POST | `/attendance` | History / submission legacy + optional verification ID negotiated |
| POST | `/attendance/clarification` | `{attendance_id,explanation}`; balasan permintaan HR |
| GET/POST | `/leave-requests` | History / `{leave_type,start_date,end_date,reason}` |
| GET | `/overtime` | Penugasan; tetap tampil pada Home/notifikasi |
| GET | `/payroll` | Nilai resmi yang dihitung server |
| GET | `/files` | `[{id,name,url}]` untuk Shared Drive; backend demo belum menyediakan |
| POST | `/notifications/read` | `{id}` menandai notifikasi terbaca |
| POST | `/attendance/face-verification` | Kontrak tambahan; hanya dipanggil bila challenge mengiklankan policy v1 |

Update/cancellation yang baru perlu command POST yang disepakati backend. Jangan menambah PUT/PATCH/DELETE mobile atau menghapus endpoint lama diam-diam. Optional field lama tetap diperbolehkan; tambahan field server tidak ditolak. Backend dengan struktur yang salah menghasilkan error yang dapat ditinjau, bukan state UI palsu.

Contoh cuti:

```http
POST /api/v1/leave-requests
Authorization: Bearer <access_token>
Content-Type: application/json
Idempotency-Key: <uuid-stabil-pada-retry>

{"leave_type":"annual","start_date":"2026-10-20","end_date":"2026-10-21","reason":"Keperluan keluarga"}
```

Jenis cuti `annual|sick|important` tidak berubah saat bahasa diganti. Tanggal cuti YYYY-MM-DD; timestamp capture/record ISO 8601 UTC dengan suffix Z atau offset eksplisit. GPS timestamp mengikuti epoch millisecond Expo. Server menentukan `recorded_at` resmi. Kalender kantor memakai `office.time_zone` (default UI Asia/Jakarta), bukan timezone ponsel. Shift lintas tengah malam membutuhkan aturan HR/backend tersendiri.

Dashboard dipoll tiap 3 detik saat foreground, satu request in-flight maksimum; resume dan mutation memicu GET. Forced refresh menunggu request lama lalu mengambil snapshot baru. Respons dengan revision menurun tidak menimpa snapshot baru; snapshot identik tidak mengubah state data. Revision server harus monoton dan naik saat data berubah. Polling ini perlu diganti/paginasi/push bila skala karyawan meningkat; app tertutup belum mempunyai APNs/FCM.

## Attendance dan verifikasi wajah

1. Pengguna membaca penggunaan biometrik/lokasi, menyetujui capture, atau memilih bantuan HR tanpa bypass.
2. Aplikasi meminta kamera dan lokasi foreground presisi. Server memberi nonce dan geofence policy. GPS client hanya memberi feedback awal; bukan bukti resmi.
3. Kamera depan memandu foto frontal, pelepasan kacamata bila dipakai, putaran kiri, lalu kanan. Bingkai/teks membantu posisi/cahaya; tidak ada deteksi kualitas, wajah, kacamata, pose, atau liveness otomatis pada client.
4. Foto maksimal 2 MiB decoded per capture, sampai empat foto. File cache yang dibuat Expo Camera dihapus setelah capture; base64 sementara dilepas setelah selesai/cancel/blur/session change, atau expiry retention UI 120 detik. Payload attendance yang hasilnya ambigu dapat bertahan sebentar untuk retry dengan key sama. Tidak ada penyimpanan foto permanen, logging, atau offline queue.
5. Jika backend hanya punya kontrak lama, aplikasi mengirim foto frontal ke POST attendance yang sama. Foto gerakan tidak dikirim; UI menjelaskan bahwa server hanya memverifikasi frontal. Matching YuNet/SFace pada backend demo bukan layanan liveness produksi.
6. Jika server mengiklankan policy tambahan, foto yang diperlukan dikirim ke endpoint verifikasi. Hanya respons `verified` dengan ID/expiry server dapat diteruskan ke POST attendance. Verified di sini belum berarti attendance tersimpan.
7. Dua sampel GPS segar dibaca setelah capture/verifikasi. POST attendance tetap menunggu keputusan dan record server. Pending/unavailable/rejected/invalid response tidak menghasilkan klaim resmi berhasil.
8. Setelah POST, GET/dashboard membaca hasil server. Outside-office memerlukan konfirmasi dan review HR; pending tidak dihitung hadir. Tidak ada approval exception otomatis pada client.

Payload attendance lama tetap:

```json
{
  "type": "check-in",
  "challenge_id": "nonce-from-server",
  "location_samples": [
    { "latitude": -3.8, "longitude": 102.2, "accuracy": 5, "timestamp": 1791766800000, "mocked": false },
    { "latitude": -3.8, "longitude": 102.2, "accuracy": 5, "timestamp": 1791766801000, "mocked": false }
  ],
  "photo_base64": "<raw-JPEG-base64>",
  "captured_at": "2026-10-12T01:00:00.000Z",
  "outside_office_confirmed": false
}
```

Nilai contoh bukan sampel nyata. Dummy memerlukan challenge 90 detik, freshness GPS/capture 45 detik, accuracy positif sesuai policy, dan menolak mock/inconsistent GPS. Guided capture yang terlalu lama perlu diulang. Backend perusahaan perlu menetapkan waktu challenge yang sesuai dan mengevaluasi usability/liveness sebelum aktivasi multi-foto.

Kontrak tambahan yang **masih perlu disetujui/diimplementasikan backend perusahaan**:

```json
{
  "id": "nonce-from-server", "expires_at": "2026-10-12T01:03:00Z",
  "office": { "latitude": -3.8, "longitude": 102.2, "radius_meters": 50, "max_accuracy_meters": 50, "time_zone": "Asia/Jakarta" },
  "face_capture_policy": { "version": 1, "require_without_glasses": true, "verification_endpoint": "/attendance/face-verification" }
}
```

```http
POST /api/v1/attendance/face-verification
Authorization: Bearer <access_token>
Idempotency-Key: <uuid>
Content-Type: application/json

{
  "challenge_id": "nonce-from-server", "consent_version": "1",
  "captures": [
    { "pose": "front", "photo_base64": "<raw-JPEG-base64>", "captured_at": "2026-10-12T01:00:00Z" },
    { "pose": "without_glasses", "photo_base64": "<raw-JPEG-base64>", "captured_at": "2026-10-12T01:00:05Z" },
    { "pose": "left", "photo_base64": "<raw-JPEG-base64>", "captured_at": "2026-10-12T01:00:10Z" },
    { "pose": "right", "photo_base64": "<raw-JPEG-base64>", "captured_at": "2026-10-12T01:00:15Z" }
  ]
}
```

Respons `data`: `{status,message,verification_id?,expires_at?}`. Status sah `verified|rejected|retry_required|pending|unavailable`; verified wajib ID non-kosong dan timestamp expiry. `without_glasses` wajib bila policy menyatakan demikian; jika tidak, pengguna tanpa kacamata dapat melanjutkan tanpa capture tambahan. Aplikasi tidak menebak policy atau melakukan fallback ke success saat endpoint 404/503.

POST attendance sesudah verifikasi menambahkan `face_verification_id` hanya untuk policy tersebut; field lama tetap dikirim. Backend wajib memvalidasi ID sekali pakai yang terikat account/session/challenge/enrollment revision, expiry, hasil layanan biometrik yang telah dievaluasi, dan transaksi attendance. Keputusan tidak boleh berasal dari flag client, pose label, atau urutan capture saja. Server perlu menetapkan keseluruhan upload limit, rate limiting, TLS, consent record, kontrol akses, retensi/deletion, audit, fairness/accessibility, dan anti-spoofing. Foto gerakan saja tidak membuktikan liveness atau mencegah replay.

Jika gerakan tidak dapat dilakukan atau persetujuan ditolak, capture dibatalkan dan pengguna diarahkan ke HR. Tim perusahaan harus menyediakan channel bantuan serta workflow exception server yang diaudit; tombol bantuan saat ini berupa instruksi, belum ticket otomatis.

## Payroll, file, dan integrasi Web Admin

Payroll berasal dari server; PDF hanya memformat nilainya, dengan escaping HTML. Android menyimpan melalui pemilih folder; iOS melalui share/Save to Files, dan fallback print. File PDF sementara di cache dihapus setelah proses; file yang sengaja disimpan pengguna tetap menjadi tanggung jawab pengguna/company device policy. Web memakai frame cetak slip, bukan halaman aplikasi.

Shared Drive berada di Home sebagai modal agar lima tab/gesture tetap sama. GET `/files` mengembalikan metadata, GET binary membawa Bearer tanpa token pada URL. URL file/foto wajib origin API yang sama; scheme berbahaya/protocol-relative cross-origin dan credential URL ditolak. Download dibatasi 10 MiB melalui streaming browser serta Content-Length bila tersedia; native tanpa stream memakai pemeriksaan setelah pembacaan, sehingga backend wajib menegakkan batas aktual untuk mencegah alokasi berlebihan bila panjang tidak tersedia. Native memakai share file cache lalu cleanup, web memakai unduhan blob. 404 ditampilkan sebagai belum tersedia, bukan daftar palsu. Dummy saat ini belum mempunyai `/files`; produksi perlu authorization/ownership serta endpoint binary.

Web Admin memakai backend yang sama, tetapi token/role admin terpisah. Backend wajib menjaga ownership employee pada semua endpoint, menonaktifkan akun tanpa menghapus history, dan memisahkan whitelist edit profil mobile dengan pengelolaan HR. Password enrollment/akun tidak pernah dibaca kembali. Detail command admin legacy dipertahankan pada lampiran kontrak di bawah.

Untuk demo lokal gunakan README proyek saudara, `.env` server, password seed/admin tes yang kuat, Node/Python/venv dan model face yang disiapkan di server. Tidak ada password production dalam APK. Jangan membuka akun default demo ke Internet atau memakai data demo sebagai dasar payroll perusahaan.

Hosting demo memerlukan Node/Python, izin spawn worker, persistent volume untuk SQLite/model, dan HTTPS reverse proxy; hosting PHP/statis saja tidak memadai. Database/.env tidak boleh berada di document root. Admin boleh dilayani satu origin dengan API, atau host statis terpisah dengan `window.PTI_CONFIG.apiBaseUrl` origin API dan ALLOWED_ORIGINS eksplisit tanpa `*`. Konfigurasi hosting ini adalah panduan, bukan deployment yang telah dijalankan. [Kebutuhan hosting proyek saudara](../AranusAdminDummy/docs/HOSTING-REQUIREMENTS.md).

## Mock, Postman, dan pengujian

Tidak ada fallback data mock pada aplikasi. `test/support/stateful-api.mjs` adalah fixture HTTP di memori khusus tes; menghasilkan attendance pending, bukan biometrik sukses. Fixture mempunyai akun tes khusus `qa@example.test` dengan password fixture-only yang hanya berlaku pada test server. Ia tidak boleh dipasang sebagai backend produksi. Tests unit/contract dapat menggunakan respons success/failure yang ditentukan tes untuk memeriksa UI/parser; hasil tersebut bukan pengujian recognition.

Collection [Postman](postman/Aranus.postman_collection.json) memakai variabel baseUrl/email/password/token dan key UUID per command. Token login hanya disimpan ke environment lokal Postman. Jangan export environment terisi atau mengirim foto karyawan nyata pada collection publik. API mock stateless Postman tidak menjamin POST dapat di-GET; gunakan stateful fixture/dummy/backend staging dan bandingkan ID record serta jumlah baris.

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npx.cmd expo install --check
npx.cmd expo export --platform all --output-dir dist/qa-1.2.0
npx.cmd playwright install chromium
npm.cmd run test:browser
npm.cmd audit
```

Playwright memulai Expo web terpisah pada 8082 dengan environment mock eksplisit, dan fixture pada 4011. Server preview development 8081 dapat tetap berjalan. Suite tidak menggunakan kembali server pada 8082; tutup proses tes lama di port tersebut agar tidak memakai bundle/API yang salah. Kamera/lokasi browser memakai perangkat/sampel simulasi; tes tersebut membuktikan alur UI dan penanganan kontrak, bukan perangkat nyata, liveness, atau database perusahaan. Untuk menjalankan tes backend saudara: `cd ../AranusAdminDummy; npm test`. Setup recognizer/Python dan tes biometrik aktual terpisah diperlukan jika memakai suite sibling.

QA perangkat: catat model/OS/build ID/API/timezone/tanggal/outcome sebenarnya, lalu jalankan:

| Jalur | Langkah dan hasil yang harus diperiksa |
|---|---|
| Login/logout | Kosong/salah/benar, revoke token, relaunch native, offline logout, perubahan akun cepat; tidak ada sesi/data lama kembali |
| Home/navigation | Semua lima tab, swipe vs scroll, nama panjang, 360 px dan tablet, ID/EN, light/dark setelah relaunch |
| Permissions | Tolak kamera/GPS sekali/permanen, precise/reduced, Settings recovery; tidak ada attendance palsu |
| Capture | Consent/cancel/HR, depan, kacamata opsional/wajib policy, kiri/kanan, camera mount failure, lighting buruk, keluar tab saat capture, expiry; tidak ada file foto yang tertinggal |
| Verification | Backend verified/rejected/retry_required/pending/unavailable/404/503; forged/malformed response; tidak ada official completion sebelum record server |
| Attendance | In-office/outside confirmation cancel/accept, review pending/approved/rejected, klarifikasi HR, check-in/out sequence, server time, GET record yang sama |
| Retry/duplikasi | Tekan cepat, putus jaringan setelah database save, ulang key/payload yang sama, restart aplikasi dan cek GET dahulu; tidak ada record ganda |
| Offline/timeout | Matikan API/jaringan, tunggu timeout, error tampil tanpa blocking navigation, pulihkan dan data tersinkron |
| Cuti | Tanggal invalid/reversed, ID/EN enum stabil, submit, GET ID sama, admin approve/reject terlihat |
| Lembur/payroll | Nilai sama dengan admin/API, notifikasi read, PDF valid dan readable, folder cancel, Save to Files iOS |
| Shared Drive | Empty/404/403, file authorized, URL cross-origin ditolak, file >10 MiB, cancel share, cleanup temporary file |
| Keamanan akun | Dua employee tidak dapat membaca record/file/photo satu sama lain; admin token tidak dipakai mobile; revoke/deactivate sesi |
| Native acceptance | Signed APK/AAB/IPA install/launch, camera/GPS hardware, SecureStore/permission/platform share, background/resume; web export bukan bukti kelulusan native |

## Git dan CI/CD

Gunakan `main`/`master` sebagai baseline release, `develop`/`development` untuk integrasi, `feature/*` untuk fitur, `fix/*` untuk perbaikan, `release/*` untuk stabilisasi. PR harus ditinjau dan lulus Validation. Jangan reset/rewrite history, memindahkan baseline, atau menghapus saved data untuk mempercepat rilis. Source 1.2.0 belum di-commit/push oleh iterasi audit ini.

`.github/workflows/ci.yml` berjalan pada PR dan push branch utama/development; melakukan npm ci, typecheck, lint, Vitest, Expo compatibility/export Android/iOS/web, dan Playwright. Laporan audit/artifact QA disimpan. Dependency report tidak menyembunyikan status release gate: workflow produksi menjalankan audit high/critical yang memblokir distribusi.

`.github/workflows/release.yml` dipicu tag `vX.Y.Z` atau manual dispatch. Validation wajib sukses terlebih dahulu. Internal build manual memakai environment `internal`; produksi memakai environment `production`, pengecekan required reviewer, dan audit dependency. Tag wajib cocok dengan `package.json` dan `app.json`. Release berbasis tag menghasilkan AAB, APK produksi internal, dan IPA store; APK diunduh hanya dari JSON hasil build tersebut yang harus cocok status FINISHED, project ID, commit SHA, platform, dan profile. Tidak memakai `build:list --latest` atau submit latest.

GitHub Release dibuat sebagai **draft** dengan generated release notes dan APK; reviewer memeriksa hash/signing/QA sebelum publication. Tag saja belum menjadi persetujuan produksi: environment harus protected dan reviewer harus mengizinkan job. Feature branch push tidak memicu produksi. Manual internal build dapat memakai branch tes; manual produksi perlu review environment dan tim harus membatasi allowed deployment branches/tags.

Setup wajib oleh maintainer sebelum mengaktifkan:

1. Hubungkan repository remote yang benar dengan EAS project existing; pastikan akun tim memiliki akses. Jangan mengganti project ID/package identifier tanpa migration plan.
2. GitHub Settings → Environments: buat `internal` dan `production`. Pada production aktifkan Required reviewers, Prevent self-review bila didukung, larang bypass admin, dan batasi deployment ke branch/tag release yang disetujui. Job production gagal jika API GitHub tidak mengembalikan reviewer rule; pastikan plan/permissions mendukungnya.
3. Simpan `EXPO_TOKEN` sebagai GitHub Secret per environment dengan hak minimum. Kredensial signing Android dan Apple dikelola EAS Credentials; jangan commit keystore/p12/p8/mobileprovision.
4. Isi environment EAS `development`, `preview`, `production` dengan URL publik yang sesuai. `preview` memakai APP_ENV staging serta `EXPO_PUBLIC_API_BASE_URL_STAGING` HTTPS; development memakai DEV, production memakai PROD.
5. Jalankan setup EAS/signing pertama secara interaktif oleh pemilik akun; non-interactive CI tidak membuat kredensial fiktif. Periksa Play/App Store agreements dan account access.
6. Isi `submit.production.ios.ascAppId` (App Store Connect numeric app ID) di eas.json sesuai akun. Siapkan App Store Connect API key via EAS credentials atau secure environment sesuai EAS. Secret file p8 tidak boleh masuk repo/log.
7. Set GitHub variable `ENABLE_TESTFLIGHT=true` hanya sesudah setup iOS siap; default tidak submit. Submission memakai ID IPA dari job yang sama dan approval production yang sama.
8. Selesaikan advisori dependency high, contract/QA staging, uji hardware, dan persetujuan HR/security. Upgrade mayor harus release terencana dengan regresi, bukan audit fix force.
9. Setelah approval tim, commit/PR, merge, buat tag matching version, periksa draft release, lalu publikasi secara manual sesuai izin. Tidak ada push, tag, merge, build cloud, atau deployment yang dilakukan otomatis oleh audit lokal ini.

## EAS dan distribusi

| Profile | Environment | Android | iOS |
|---|---|---|---|
| development | development / DEV | APK internal untuk demo LAN | Internal, memerlukan provisioning/device |
| preview | preview / STAGING | APK internal, API HTTPS staging | Internal ad hoc, bukan TestFlight |
| production | production / PROD | AAB store, auto increment | IPA store/TestFlight, auto increment |
| production-apk | production / PROD | APK internal dengan konfigurasi produksi | Tidak digunakan oleh workflow |

```powershell
npx.cmd eas-cli@24.7.0 login
npx.cmd eas-cli@24.7.0 credentials --platform android
npx.cmd eas-cli@24.7.0 credentials --platform ios
npx.cmd eas-cli@24.7.0 build --platform android --profile development
npx.cmd eas-cli@24.7.0 build --platform android --profile preview
# Hanya setelah izin distribusi:
npx.cmd eas-cli@24.7.0 build --platform android --profile production
npx.cmd eas-cli@24.7.0 build --platform ios --profile production
npx.cmd eas-cli@24.7.0 submit --platform ios --profile production --id <build-id-yang-disetujui>
```

APK untuk instalasi langsung internal; AAB diunggah ke Google Play melalui prosedur approval perusahaan. Workflow belum melakukan upload Play otomatis. IPA internal perlu perangkat terdaftar; IPA store dikirim ke App Store Connect dan diproses untuk TestFlight. App Store/public release tetap membutuhkan proses review/persetujuan tambahan. Lihat [CI EAS resmi](https://docs.expo.dev/build/building-on-ci/), [EAS CLI](https://docs.expo.dev/eas/cli/), dan [TestFlight](https://docs.expo.dev/submit/testflight/).

## Security dan batasan produksi

Hardening client tidak menggantikan backend security. Residual: GPS/timestamp/client dapat dimodifikasi; face matching demo belum liveness/anti-spoofing/attestation; tidak ada refresh token contract; server logout offline belum langsung mencabut sesi; capture consent belum menggantikan kebijakan perusahaan yang sah; data export pengguna perlu device policy; pagination/push belum tersedia. URL file/foto menolak redirect pada fetch; perilaku native redirect tetap perlu hardware QA.

Dependency audit masih mempunyai temuan transitive Expo/RN setelah update patch yang kompatibel. Jangan mengklaim aplikasi sepenuhnya aman atau audit bersih. Gate produksi akan memblokir advisori high/critical; tim perlu review reachability/advisory/upstream upgrade terencana. CI/frontend fixtures tidak menguji authorization/transaction database perusahaan, multi-user security nyata, atau recognition hardware.

Tidak ada rahasia produksi ditemukan pada source mobile yang diaudit; `.env` lokal tidak dicetak atau di-commit. Asset foto referensi existing digunakan backend demo dan merupakan data pribadi: pertahankan akses repository terbatas dan gunakan enrollment fixture sintetis/berizin saat berbagi source. Tidak dimasukkan sebagai hasil capture pengguna. LICENSE 0BSD serta laporan historis dipertahankan.

## Troubleshooting

- `ERR_CONNECTION_REFUSED` pada localhost:8081: pastikan Metro berjalan dengan `npm run web -- --port 8081`; cek `Test-NetConnection localhost -Port 8081`. Jika Metro menawarkan port lain, buka URL itu dan sesuaikan ALLOWED_ORIGINS backend. Standalone APK tidak memerlukan Metro, tetapi API harus tetap tersedia.
- Server web terbuka tetapi login gagal: periksa URL bundle/environment, API listener/health, CORS origin exact, dan credential backend. URL admin statis belum tentu melayani REST API.
- Production/preview config gagal: isi variabel URL sesuai profile dan HTTPS origin nyata; preview sekarang staging, bukan DEV LAN.
- Playwright executable belum ada: `npx playwright install chromium`. Pastikan port tes 8082/4011 tidak dipakai proses lama, lalu ulang suite; jangan menilai tes gagal startup sebagai regresi aplikasi.
- GPS gagal: aktifkan precise foreground location, tunggu accuracy, area terbuka; jangan spoof GPS. Server tetap menentukan geofence dan acceptance.
- Capture expiry/face error: ulang capture dengan pencahayaan dan foto referensi yang benar. Setup model server jika memakai dummy; reference self-match bukan akurasi populasi/liveness.
- Foto HR tidak tampil: cek GET authenticated/content-type/URL origin/version dan ukuran; initials fallback tetap tersedia.
- Cache lama gagal dihapus: jangan gunakan perangkat bersama sampai IT memeriksa cleanup/clear app data. Tidak ada cache sensitif baru ditulis.
- PDF Android gagal: pastikan postinstall print adapter berjalan dan native build dibangun ulang; iOS share cancelled berarti file belum tentu disimpan. Jangan klaim save selesai dari generation saja.
- Build/cloud ditolak: konfirmasi Expo project access, signing/provisioning, EAS env, Apple app record, GitHub environment reviewers, serta audit high. Jangan mengarang credentials.

## Pekerjaan tim yang masih wajib

Sediakan backend HTTPS perusahaan dengan kontrak existing, GET hasil POST yang konsisten, ownership/role, sequence/idempotency atomik, waktu server, geofence policy, dan audit. Sepakati/implementasikan multi-capture policy/verification ID, evaluated matching/liveness/anti-spoofing, privacy/retention/enrollment, dan exception HR. Implementasikan `/files` metadata/binary yang authorized. Selesaikan dependency advisory, signing/EAS/GitHub setup, dan acceptance Android/iOS fisik sebelum distribusi perusahaan. README ini adalah persiapan source dan proses; bukan bukti build store atau production deployment berhasil.

## Lampiran kontrak backend existing

Detail kontrak admin, payroll, outside-office review, dan DTO legacy di bawah berasal dari panduan API sebelumnya dan dipertahankan untuk koordinasi tim. Ketentuan cache, environment, workflow wajah, dan CI versi 1.2.0 di atas menggantikan uraian lama.
### Bentuk DTO existing

```json
{
  "employee": {
    "id": "EMP-001", "name": "Muhammad Arya Nugraha", "phone": "0812345678",
    "email": "employee@aranus.co", "role": "Software Developer", "division": "Technology",
    "photo_url": "/api/v1/employee/photo", "photo_version": 1
  },
  "office": {
    "latitude": -3.8128574177386616, "longitude": 102.28760625655097,
    "radius_meters": 50, "max_accuracy_meters": 50, "time_zone": "Asia/Jakarta"
  }
}
```

Employee fields baru `phone`, `photo_url`, `photo_version` optional pada DTO untuk toleransi respons lama. Backend baru wajib menyediakan foto yang benar untuk enrollment dan endpoint challenge.

Dashboard:
```json
{
  "revision": 1,
  "employee": {},
  "office": {},
  "attendance": [],
  "leaves": [],
  "overtime": [],
  "payroll": [],
  "notifications": []
}
```
`employee` dan `office` harus diisi seperti contoh types di atas. Revision harus naik setelah setiap perubahan data yang relevan. Mobile menggunakan satu request setiap 3 detik saat aktif, dengan satu request in-flight maksimum, stale-session guard, dan refresh setelah mutation. Backend asli dapat mengganti transport sinkronisasi dengan push/SSE, tetapi bentuk state dan otorisasi harus konsisten.

Attendance record:
```json
{
  "id": "record-id", "type": "check-in", "recorded_at": "2026-10-04T01:00:00.000Z",
  "latitude": -3.81285, "longitude": 102.28760,
  "location_status": "verified", "review_status": null,
  "face_status": "matched", "face_score": 0.78, "location_accuracy": 5, "photo_version": 1
}
```

Leave record memiliki `id,leave_type,start_date,end_date,reason,status,created_at`. Jenis cuti berupa kode stabil `annual|sick|important`, bukan label terjemahan. Status `pending|approved|rejected`. Tanggal `YYYY-MM-DD`.

Overtime record memiliki `id,date,start_time,end_time,description,status`. Jam `HH:mm`; dummy menerima rentang dalam tanggal yang sama. Payroll record memiliki `id,period,basic_salary,allowance?,deductions,net_salary,status`; nilai rupiah harus number finite, bukan string terformat. Notification memiliki `id,type,title,message,created_at,read`.


### Administrasi multi-karyawan existing

`Authorization: Bearer <access_token>` wajib untuk endpoint private. `POST /auth/login` menerbitkan token acak khusus sesi; token berlaku 12 jam dan disimpan di sisi server sebagai hash. Aplikasi Android menyimpan token di secure storage, bukan source code atau SQLite dashboard. Login admin terpisah dan hanya dipakai browser admin. Jangan membuat satu API key statis di APK: semua pengguna dapat mengekstraknya.

Response JSON sukses memakai envelope:

```json
{ "success": true, "message": "OK", "data": { } }
```

Error API memakai HTTP error status dan `{ "success": false, "message": "Alasan" }`. `GET /health` publik untuk health check. `GET /api/v1/employee/photo` mengembalikan byte JPEG/PNG, bukan envelope JSON; semua endpoint data di bawah menggunakan JSON.

| Method | Path | Token | Input utama / output |
|---|---|---|---|
| POST | `/api/v1/admin/login` | Tidak | `{password}` → `{token}` admin |
| GET | `/api/v1/admin/employees` | Admin | Daftar profil karyawan, termasuk status `active`; tidak mengembalikan password/hash |
| GET | `/api/v1/admin/dashboard?employee_id=EMP-...` | Admin | Dashboard karyawan yang dipilih + array `employees` |
| GET | `/api/v1/admin/attendance` | Admin | Satu array absensi gabungan semua karyawan; setiap record memuat `employee:{id,name,email}` |
| GET | `/api/v1/admin/employee/photo?employee_id=EMP-...` | Admin | Foto referensi sebagai binary image |
| POST | `/api/v1/admin/employees` | Admin | Buat profil dan login karyawan; perlu `Idempotency-Key` |
| POST | `/api/v1/admin/employees/update` | Admin | Ubah profil/akun atau aktif/nonaktifkan akun |
| POST | `/api/v1/admin/employees/photo` | Admin | Simpan foto referensi tervalidasi; perlu `Idempotency-Key` |
| POST | `/api/v1/admin/payroll/preview` | Admin | Hitung gaji tanpa menyimpan |
| POST | `/api/v1/admin/payroll` | Admin | Simpan/update slip periode untuk karyawan; perlu `Idempotency-Key` |
| POST | `/api/v1/admin/attendance/review` | Admin | Minta keterangan/tandai ditinjau/setujui absensi luar kantor; perlu `Idempotency-Key` |
| POST | `/api/v1/admin/leave-requests` | Admin | Terima `{id,status:"approved"|"rejected"}` |
| POST | `/api/v1/admin/overtime` | Admin | Kirim penugasan lembur; perlu `Idempotency-Key` |
| POST | `/api/v1/attendance/clarification` | Employee | Balas permintaan HR; perlu `Idempotency-Key` |

Employee create body (ID karyawan dibuat server):

```json
{
  "name": "Budi Contoh",
  "email": "budi@example.test",
  "password": "password-unik-untuk-tes",
  "phone": "081234567890",
  "role": "Staff",
  "division": "Operasional",
  "employment_start_date": "2026-10-01",
  "active": true
}
```

Saat update, body wajib menyertakan `employee_id`; field `password` opsional dan tidak pernah dibaca kembali dari API. Password harus dikirim hanya melalui HTTPS. Menghapus akun dari dummy berarti mengirim `{ "employee_id":"EMP-...", "active":false }` ke endpoint update. Ini soft-delete: sesi dicabut dan login dinonaktifkan, tetapi absensi, cuti, dan slip gaji tetap dipertahankan untuk audit. Admin dapat mengaktifkan akun kembali.

### Gaji per karyawan

Admin mengirim konfigurasi terpisah untuk employee dan periode yang dipilih. `work_days` menggunakan JavaScript weekday (`0=Minggu` sampai `6=Sabtu`); `holiday_dates` merupakan array tanggal ISO. Hari sebelum tanggal mulai kerja, hari libur, cuti `approved`, dan hari setelah/tidak termasuk cutoff tidak dikenai potongan ketidakhadiran. Check-in luar kantor berstatus pending/tidak disetujui tidak dihitung hadir; persetujuan admin atau check-in ulang di kantor diperlukan. Nilai gaji adalah integer rupiah, tidak berupa string berformat.

```json
{
  "employee_id": "EMP-A1B2C3",
  "period": "2026-10",
  "cutoff_date": "2026-10-04",
  "basic_salary": 8500000,
  "allowance": 500000,
  "other_deductions": 100000,
  "daily_absence_deduction": 250000,
  "work_days": [1, 2, 3, 4, 5],
  "holiday_dates": ["2026-10-12"]
}
```

Contoh hasil `POST /admin/payroll/preview` / penyimpanan:

```json
{
  "period": "2026-10",
  "basic_salary": 8500000,
  "allowance": 500000,
  "other_deductions": 100000,
  "daily_absence_deduction": 250000,
  "cutoff_date": "2026-10-04",
  "scheduled_days": 2,
  "exempt_leave_days": 0,
  "absent_days": 1,
  "absent_dates": ["2026-10-02"],
  "absence_deduction": 250000,
  "deductions": 350000,
  "net_salary": 8650000,
  "status": "processed"
}
```

Nilai hitung aktual mengikuti tanggal server, data absensi/cuti server, tanggal mulai kerja, hari yang dipilih, dan hari libur; contoh di atas hanya menjelaskan bentuk JSON.

### Tinjauan absensi luar kantor dan jawaban karyawan

Record luar kantor menyimpan koordinat sampel terakhir, `office_distance_meters`, snapshot konfigurasi geofence, waktu server, `location_note`, `outside_office_confirmed:true`, dan `review_status:"pending"`. Admin melihat lokasi/peta di halaman admin dan meminta keterangan dengan:

```json
{
  "employee_id": "EMP-A1B2C3",
  "id": "attendance-record-id",
  "review_status": "clarification_requested",
  "review_note": "Mohon jelaskan alasan bekerja di lokasi ini."
}
```

Notifikasi dan catatan permintaan tampil pada aplikasi. Balasan karyawan:

```json
{
  "attendance_id": "attendance-record-id",
  "explanation": "Saya ditugaskan ke lokasi pelanggan."
}
```

Setelah balasan diterima, record mengembalikan `review_status:"clarification_received"` dan memuat `employee_note` serta waktu balasan. Field tersebut ikut pada dashboard GET berikutnya. Status `reviewed` berarti admin selesai meninjau, bukan persetujuan otomatis atas klaim lokasi.

Persetujuan eksplisit admin menggunakan bentuk POST berikut (field `review_note` opsional):

```json
{
  "employee_id": "EMP-A1B2C3",
  "id": "attendance-record-id",
  "review_status": "approved",
  "review_note": "Disetujui berdasarkan penugasan lapangan."
}
```

Daftar gabungan `GET /api/v1/admin/attendance`:

```json
{
  "success": true,
  "message": "OK",
  "data": [{
    "id": "attendance-record-id",
    "employee_id": "EMP-A1B2C3",
    "type": "check-in",
    "recorded_at": "2026-10-04T01:00:00.000Z",
    "latitude": -3.81085,
    "longitude": 102.28760,
    "location_accuracy": 5,
    "office_distance_meters": 222,
    "location_status": "outside_office",
    "face_status": "matched",
    "review_status": "pending",
    "employee": {"id": "EMP-A1B2C3", "name": "Budi Contoh", "email": "budi@example.test"}
  }]
}
```

### Contoh permintaan baca/tulis dari APK

Membaca dashboard karyawan yang sedang masuk:

```http
GET /api/v1/dashboard
Authorization: Bearer <access_token>
Accept: application/json
```

Mengirim pengajuan cuti:

```http
POST /api/v1/leave-requests
Authorization: Bearer <access_token>
Content-Type: application/json
Idempotency-Key: <uuid-yang-dipertahankan-pada-retry>

{
  "leave_type": "annual",
  "start_date": "2026-10-20",
  "end_date": "2026-10-21",
  "reason": "Keperluan keluarga"
}
```

Semua mutasi APK menggunakan hanya `POST` (login/logout, edit profil, absensi, cuti, tandai notifikasi, dan balasan keterangan); pembacaan memakai `GET`. Perubahan pada client bukan master: server yang menetapkan pemilik akun, waktu dan status absensi, status persetujuan, serta hasil payroll. Versi 1.2.0 memakai snapshot dashboard di memori; cache SQLite lama dibersihkan, tanpa penulisan data sensitif baru. Lihat langkah pengalihan URL/build pada [konfigurasi environment](#environment) dan daftar yang perlu dikonfirmasi kepada perusahaan pada [kebutuhan hosting](../AranusAdminDummy/docs/HOSTING-REQUIREMENTS.md).
