# Engineering release report · Aranus Attendance 1.1.0

Tanggal: 4 Oktober 2026. Target: preview presentasi dan integrasi API, dengan pekerjaan produksi yang masih membutuhkan backend/signing/perangkat fisik dicatat terpisah.

## 1. Ringkasan perubahan

Aplikasi tetap menggunakan Expo React Native, React Navigation, SecureStore, dan client API yang sudah ada. Perubahan menghubungkan seluruh data utama ke server, menyederhanakan lima tab, menambah tema/notifikasi/statistik, dan menyatukan absensi kamera + GPS. Dummy admin satu halaman dan REST API berada pada folder saudara `AranusAdminDummy`, sehingga source APK tetap terpisah.

## 2. Baseline dan versi

- Baseline aplikasi: commit `c50b6e4`, ditandai `baseline/attendance-1.0.0` sebelum perubahan.
- Baseline workspace induk: `eaab336`, ditandai `baseline/workspace-eaab336`.
- Versi aplikasi/package/server baru: **1.1.0**, branch `release/attendance-1.1.0`.
- Perubahan aplikasi: 50 file, sekitar +1.538 / -2.225 baris termasuk modul baru/dokumentasi; net sekitar -687 baris. Lockfile dependency menyumbang sebagian besar perubahan non-runtime. Source dummy/workspace dihitung terpisah pada commit induk.
- Identitas package Android/iOS dan project EAS dipertahankan. APK lokal memakai signing debug template untuk preview, bukan keystore distribusi perusahaan.

Artefak lokal `../../artifacts/AranusAttendance-1.1.0-preview.apk`: 64.846.057 bytes, SHA-256 `9b6ed3502fca9ec55e7137ab9ea86b978c5dcabad3499458b2383876df491113`. `apksigner verify --print-certs` berhasil dan menunjukkan certificate Android Debug. Hasil build, PDF sampel, screenshot dan log tidak masuk Git.

## 3. Akar masalah dan perbaikannya

| Mekanisme masalah | Solusi dan dampak |
|---|---|
| Fallback login/data SQLite demo dapat menghasilkan state yang berbeda dari web | Hilangkan fallback runtime; API menjadi sumber data authoritative. Login offline demo sengaja tidak tersedia lagi. |
| Kamera dan GPS merupakan langkah terpisah; foto tidak benar-benar dibandingkan dengan identitas | Satu alur capture dengan challenge, dua sampel GPS, foto aktual, dan SFace di server. Tidak memakai flag client sebagai bukti verifikasi. |
| 401 dari login salah dapat diperlakukan sebagai sesi kedaluwarsa; respons lama berpotensi menghapus sesi baru | Handler unauthorized hanya berlaku untuk request authenticated dengan token yang masih sama. Generation guards mencegah profil/data lama mengembalikan state setelah logout. Tes khusus ditambahkan. |
| Async face verification selama transaksi SQLite membuka peluang read/write lain masuk ke transaksi yang belum selesai | Persiapan face dilakukan sebelum transaksi; mutation diserialisasi, transaksi hanya menjalankan operasi sinkron. |
| Request sukses di server tetapi respons hilang dapat digandakan saat retry | Stable Idempotency-Key + fingerprint + hasil tersimpan di SQLite; retry identik mengembalikan hasil pertama. |
| Refresh lama yang sedang berjalan bisa menampilkan profil lama setelah save | Forced refresh menunggu request lama selesai, kemudian mengambil state sesudah mutation. |
| Label cuti berubah mengikuti bahasa dan tanggal awal tetap memakai tanggal lama | Enum bisnis stabil; label diterjemahkan terpisah. Tanggal awal berasal dari waktu saat ini dan validasi rentang tetap deterministik. |
| Kamera web menyatakan siap sebelum frame video dapat difoto | Tunggu frame dengan dimensi valid sebelum mengaktifkan shutter; ada batas waktu dan pembatalan. |
| Print web tidak menggunakan HTML slip khusus | Frame cetak hanya berisi HTML slip, sehingga UI aplikasi tidak ikut tercetak. |
| PDF native Android menggantung pada offscreen WebView | Patch terisolasi mempertahankan render task sampai callback selesai; Android membangun `expo-print` dari source. [Panduan lifecycle Android](https://developer.android.com/training/printing/html-docs) menjelaskan kebutuhan mempertahankan WebView. |
| Gambar HR tampil sebagai inisial pada loader Image Android | Foto protected diambil menggunakan fetch authenticated yang sama dengan API, kemudian diberikan sebagai data URI native; web memakai blob URL dengan cleanup. |
| Admin pada HTTP LAN tidak selalu memiliki crypto.randomUUID | Fallback identifier idempotency untuk browser HTTP; identifier ini tidak dipakai sebagai token keamanan. |

## 4. Fitur yang diimplementasikan

- Navbar Home, Leave, Attendance di tengah, Payroll, Profile; swipe horizontal dengan arah/ambang yang menjaga scroll vertikal.
- Toolbar theme kiri, ID/EN dan notifikasi kanan. Tema mengikuti sistem pada awalnya dan pilihan manual tersimpan.
- Home: jam WIB, foto HR, check-in/out, work hours berjalan, hari hadir dan jam bulanan, shortcut, payroll, lembur.
- Notifikasi lembur dan hasil keputusan cuti dari server; read status disimpan. Sinkronisasi foreground setiap 3 detik dan saat resume.
- Profil: hanya nama/nomor HP dapat diedit; ID, email, role, division, dan foto identitas tetap dikelola HR/server.
- Absensi: permission, front camera, GPS, nonce 90 detik, face matching, sequence check, retry tanpa duplikasi, pembatalan dan error yang dapat dipulihkan.
- Cuti: form responsif, validasi, penyimpanan server, approval/rejection admin, riwayat tersinkron.
- Payroll: nilai API, pilihan periode jika lebih dari satu, HTML bilingual yang escaped, file PDF native, simpan folder Android dan share/Save to Files iOS.
- Dummy admin: login, employee summary, attendance, leave approval, overtime assignment, payroll, notifications, SQLite persistent.

## 5. Lokasi kode penting

Line berikut mengacu pada source rilis ini; gunakan nama fungsi sebagai anchor bila source berubah.

| Lokasi | Aturan/fitur |
|---|---|
| `src/services/api.ts:146` | Request client, timeout, Bearer, JSON errors, unauthorized/idempotency |
| `src/context/AuthContext.tsx:10` | Lifecycle sesi dan stale operation guards |
| `src/context/DataContext.tsx:7` | Shared dashboard, single-flight poll, forced synchronization |
| `src/context/ThemeContext.tsx:9` | Persisted theme |
| `src/navigation/AppNavigator.tsx:20` | Swipe; navbar pada baris 34 |
| `src/components/Toolbar.tsx:10` | Theme, bahasa, badge dan modal notifikasi |
| `src/components/EmployeeAvatar.tsx:15` | Authenticated fetch dan image lifecycle |
| `src/screens/AttendanceScreen.tsx:21` | GPS precheck; state machine pada baris 28 |
| `src/services/attendanceSummary.ts:5` | Kalkulasi hari/bulan dan durasi |
| `src/screens/ProfileScreen.tsx:18` | Save whitelist dan dirty form |
| `src/screens/PayrollScreen.tsx:38` | Generate/save/share PDF |
| `src/services/payslip.ts:4` | Escaped printable slip |
| `scripts/fix-expo-print.cjs:1` | Android printing compatibility adapter |
| `app.config.js:1` | Production HTTPS guard dan iOS network policy |
| `../AranusAdminDummy/server.mjs:21` | GPS validation; mutation pada baris 74; attendance route pada baris 167 |
| `../AranusAdminDummy/face_verify.py:7` | Single-face detection dan embedding matching |

## 6. Kode original yang dimodifikasi

`App.tsx` menambah provider; navigator membatasi route menjadi lima; Home/Attendance/Profile disesuaikan kebutuhan baru. Leave/Login/Payroll, header, section title, kamus bahasa, dan API diperluas menggunakan infrastruktur existing. Konfigurasi app/EAS/env dan dependency disejajarkan dengan SDK yang sudah dipakai. README dan kontrak API lama diperbarui karena Postman/mock sudah tidak menjadi jalur kerja.

Logo, utility theme dasar, SecureStore token utility, identitas app, React Navigation, dan bagian repository yang tidak berhubungan tetap dipertahankan. Perubahan sebelum sesi yang berupa dua ZIP terhapus pada workspace induk tidak dimasukkan ke commit pekerjaan ini.

## 7. Kode original yang dihapus

Penghapusan berikut eksplisit diminta oleh objective:

- `src/screens/SharedDriveScreen.tsx` dan `assets/Shared-Drive-Icon.jpeg`: fitur Shared Drive dan route/data/API terkait.
- `src/screens/OvertimeScreen.tsx` dan `assets/Overtime-Icon.jpeg`: halaman tersendiri dihapus; DTO/data lembur tetap dipakai Home/notifikasi.
- `src/data/database.ts`: demo login, seeded mock rows, local file operations dan SQLite runtime mock. Dependency `expo-sqlite`, plugin, dan document picker tidak lagi dibutuhkan.
- `.postman/` dan `postman/`: collection, environment, metadata, globals beserta dokumentasi referensinya.
- Cache `.expo` pada index workspace induk dibersihkan dari tracking; hasil build/model/database/cache tidak masuk source release.

Tidak ada destructive database migration pada perangkat atau server. File SQLite lama di perangkat tidak dihapus secara otomatis.

## 8. Kode baru

Provider Data/Theme; Toolbar, EmployeeAvatar, AttendanceSummaryCard; summary/clock/payslip/web-print utilities; tes summary, escaping, dan regresi auth; config plugin network dan printing compatibility script; dokumentasi developer/device/release. Seluruh `AranusAdminDummy` merupakan penambahan baru. Foto referensi user yang sebelumnya untracked disertakan sesuai instruksi objective tanpa mengubah isi fotonya.

## 9. Backward compatibility

Read DTO employee baru memakai field phone/photo optional; allowance payroll tetap optional. Challenge, dashboard revision dan attendance payload merupakan kontrak baru yang wajib dipenuhi backend. Client lama tanpa foto/challenge tidak boleh dianggap lolos verifikasi; rollout backend perlu version gate/adaptor bila masih melayani client lama. Data lokal demo tidak diimpor menjadi attendance verified. ID/EN tidak mengubah kode bisnis cuti. Database dummy dan hasil idempotency bertahan setelah restart.

## 10. Performa

Satu dashboard request in-flight; poll foreground 3 detik, callback/timer dibersihkan pada logout/unmount. Revision mengurangi rerender data; durasi memakai timer lokal 1 detik. Camera/photo hanya diproses selama absensi; capture dibatasi ukuran, worker face mempunyai timeout 25 detik, dan raw foto tidak dipersist. Model face sekitar 39 MB berada pada server, bukan APK. Import Ionicons langsung mengurangi font/asset yang ikut bundle. Worker Python per absensi dan state SQLite tunggal sesuai skala dummy; backend produksi membutuhkan worker pool, pagination dan storage sesuai jumlah karyawan.

## 11. Risiko regresi

Perubahan navigasi menghapus dua route; deep link lama menuju route tersebut harus diperbarui. API-only login membutuhkan konektivitas. Server payroll/schema/revision harus sesuai kontrak. Permission/camera/GPS/native save dialog memiliki variasi antarversi OS. Printing adapter harus direview saat upgrade Expo. Kebijakan shift lintas tengah malam belum ditentukan; kalkulasi saat ini berbasis hari WIB. HTTP development dibatasi untuk preview; produksi memerlukan HTTPS.

## 12. QA / STQA

**Verified melalui eksekusi:**

| Pemeriksaan | Hasil |
|---|---|
| TypeScript strict `npm run typecheck` | Lulus |
| Mobile Vitest | 13/13 lulus: error/401/session race, WIB duration, invalid/duplicate records, HTML escaping |
| Dummy API system tests | 8/8 lulus: role, profile whitelist, sequence/replay/idempotency/concurrent submits, GPS failures, face failures/unavailability, admin round trip, persistence restart, malformed input |
| Playwright system suite | 3/3 lulus: alur karyawan/admin, light/dark, ID/EN, avatar loaded, profile/cuti/lembur/notifikasi, payroll web, actual swipe, mobile/desktop overflow, HTTP UUID fallback; real biometric API; camera+GPS out-of-area recovery |
| Real face engine | Model SHA-256 cocok; foto referensi self-match diterima dan gambar tanpa wajah ditolak |
| Expo export all | Android, iOS, web bundle berhasil |
| Environment config guards | Production URL kosong/HTTP/placeholder ditolak; HTTPS config diset; tidak memanggil backend produksi |
| Native Android Gradle | APK release preview berhasil, arm64-v8a dan x86_64 |
| Android emulator UI | Install/launch standalone, wrong/valid login, session/theme restore, lima tab, dark/ID, HR photo, horizontal swipe, camera denial/retry, GPS timeout recovery, dan camera Cancel: lulus; tidak ada attendance palsu disimpan |
| Android PDF file | Lulus: pilih Documents/Allow, UI mengonfirmasi tersimpan; file 41.874 bytes, valid PDF satu halaman. Parser membaca nama, ID, periode 2026-10, gaji/potongan/net Rp 7.875.000 yang sesuai API. |

**Structurally validated:** imports/removed-route cleanup, cleanup listener/timer, native permission/config, enum/DTO compatibility, serialized transaction and stale-state guards, escaped HTML, git diff whitespace and deletion review.

**Inferred, bukan device-verified:** implementasi iOS camera/location/SecureStore/print/share menggunakan modul Expo dan safe areas bersama; bundle iOS berhasil, namun ini bukan pengujian runtime iOS.

**Not fully testable di host ini:** live selfie karyawan di kantor dengan HP fisik, variasi GPS/provider Android fisik, hardware iOS, keystore perusahaan, provisioning Apple, push saat aplikasi tertutup, endpoint backend asli. Gunakan [checklist perangkat fisik](../README.md) untuk acceptance terpisah.

Dependency audit mobile mencatat 24 advisories inherited/transitive (8 moderate, 16 high) pada toolchain/dependency tree. Audit tidak dinyatakan bersih. Tidak menjalankan `npm audit fix --force` yang menyarankan downgrade besar SDK/RN; perlu mitigasi/upgrade terencana bersama audit reachability sebelum produksi. Dependency dummy admin saat pemeriksaan memiliki 0 advisories.

## 13. Batasan dan persiapan presentasi

Tidak ada klaim kebal fake GPS atau foto replay. GPS client tetap dapat dipalsukan pada perangkat/API yang dimodifikasi; matching SFace belum mempunyai liveness maupun Play Integrity/App Attest. Ambang face 0.45 memerlukan kalibrasi dengan foto karyawan nyata. Dummy satu akun, satu halaman, dan satu database lokal; bukan portal HR produksi. Notifikasi otomatis bekerja selama app aktif/resume; APNs/FCM ketika tertutup belum diintegrasikan.

Jalankan server `AranusAdminDummy` pada port 4000; APK standalone tidak membutuhkan Metro. APK preview menanam URL development laptop saat build; periksa IP Wi-Fi dan pastikan ponsel berada pada jaringan yang dapat menjangkau server. Untuk demo absensi di venue selain kantor, konfigurasi geofence ke koordinat venue yang sebenarnya pada `.env` server dan restart server. Akun: `employee@aranus.co` / `aranus123`; password admin ada di `.env` lokal, tidak di Git. Jangan menyimpan API secret pada EXPO_PUBLIC variables.

Produksi belum dapat diluncurkan hanya dengan dummy: diperlukan backend asli sesuai kontrak, URL HTTPS, kalibrasi/liveness/attestation sesuai kebutuhan perusahaan, signing Android dan provisioning Apple, serta acceptance perangkat fisik. Commit lokal disediakan; push/publish tidak dijalankan. Repository induk tidak mempunyai remote, sehingga dummy tidak otomatis berada pada origin repository aplikasi.
