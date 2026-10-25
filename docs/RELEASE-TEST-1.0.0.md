# Laporan engineering — PTI Attendance APK tes 1.0.0

Tanggal: 12 Oktober 2026. Rilis ini untuk pengujian, bukan distribusi produksi.

## Baseline dan ruang lingkup

Baseline Git aplikasi: `6624f6a`. Workspace sudah berisi perubahan lokal 1.2.0 sebelum pekerjaan ini, termasuk API validation, token/cache, face capture, Shared Drive, CI dan QA. Perubahan tersebut dipertahankan dan diuji sebagai bagian source rilis; bukan semuanya ditulis pada iterasi ini. Snapshot sebelum perubahan baru tersimpan lokal di `../artifacts/baseline-before-test-1.0.0.zip`. Riwayat Git dan arsip baseline 1.1.0 dipertahankan.

Versi APK menjadi **1.0.0**, Android `versionCode=10001`, sesuai nama versi tes yang diminta. Package tetap `com.cliffhooper.AranusAttendanceApp`. Penomoran tampilan lebih rendah dari source lokal 1.2.0 yang belum dirilis; versionCode meningkat dari 1 agar jalur update Android tetap tersedia bila sertifikat sama. Rilis GitHub memakai prerelease terpisah, tidak mengganti rilis 1.1.0 sebelumnya.

Perbandingan source `src/` terhadap snapshot awal: sekitar **+223 / -66 baris** sebelum perapian terakhir, termasuk 28 baris test geofence baru. Source sebelumnya dominan menggunakan JSX ringkas sehingga jumlah baris bukan ukuran jumlah komponen. Diff terhadap Git lebih besar karena juga mencakup perubahan 1.2.0 yang sudah ada.

Keseluruhan source yang disiapkan untuk commit rilis: sekitar **87 file, +3.964 / -874 baris** terhadap baseline Git, termasuk lockfile, dokumentasi, QA, dan perubahan lokal sebelumnya.

## Perubahan dan akar masalah

| Area | Sebelum | Sesudah / lokasi |
| --- | --- | --- |
| Tema | Merah `#D80008`, latar putih, foreground merah redup di tema gelap | Black `#0B0B0B`, crimson `#8B0D1A`, off white `#F5F2ED`, foreground accent khusus dark; `src/theme.ts`, `src/context/ThemeContext.tsx` |
| Logo | PNG memiliki alpha, tetapi Login/Home menambahkan latar putih | Latar putih dihapus; logo asli ditint crimson/off white sesuai tema; Home tanpa logo; `src/screens/LoginScreen.tsx`, `HomeScreen.tsx` |
| Home | Logo dan judul mendominasi bagian atas | Avatar/sapaan/jam pada hero crimson, card absensi sedikit menumpuk, card statistik dan menu cepat; zona waktu mengikuti kantor dari API |
| Halaman | Form/halaman melebar di desktop | Konten maksimum 760 px, Login 520 px; header dan card konsisten di Attendance, Leave, Payroll, Profile |
| Feedback | Pesan berhasil/gagal menggunakan warna serupa | `StatusNotice.tsx`: ikon, teks, dan warna berbeda untuk berhasil, menunggu, gagal; dipakai Attendance dan Leave |
| GPS web | Expo web meneruskan `maximumAge: Infinity` sehingga refresh bisa mengembalikan cache | Pratinjau dan alur absensi meminta `maximumAge: 0` dan timeout; jalur native High Accuracy dipertahankan |
| Geofence | Tidak ada peta lokasi kantor pada Attendance | `GeofenceCard.tsx`, `GeofenceMap.tsx`, `GeofenceMap.web.tsx`, `services/geofence.ts`; lingkaran kantor, titik GPS, jarak, akurasi, batas akurasi, refresh, dan status area |
| Peta | Ketergantungan CDN akan membuat geometri hilang saat jaringan buruk | Leaflet 1.9.4 dibundel melalui `scripts/build-map-assets.cjs`; hanya tile jalan membutuhkan internet |

Asset asli `assets/Perseverance Technology Logo.png` memiliki kanal alpha dan tetap menjadi sumber. Tint mengikuti tema tanpa mengubah bentuk logo.

## Code asli dimodifikasi dan code baru

Modifikasi baru dibatasi pada tema, presentasi halaman/komponen, feedback status, opsi GPS web, konfigurasi versi, dependency peta, dan pengecualian prerelease dari job produksi. Alur autentikasi, token, payroll, idempotency, consent/capture wajah, validasi server dan data karyawan mengikuti implementasi baseline yang sudah ada.

Komponen baru: `GeofenceCard`, adapter peta native/web, `StatusNotice`. Service baru: `geofence.ts` dan test. Plugin baru: `plugins/withThemedSplashLogo.js` untuk menerapkan tint logo asli pada splash Android terang/gelap tanpa kotak putih. Gesture geser antarhalaman dinonaktifkan khusus Attendance agar tidak merebut gesture peta; navigasi tab tetap tersedia. Script baru: `build-map-assets.cjs`; dependency baru: `leaflet@1.9.4` dan versi `react-native-webview` yang dipilih Expo SDK. `npm ci` menjalankan postinstall untuk membuat modul peta; file hasil generasi tidak masuk Git.

## Penghapusan dan pembersihan

- Asset splash lama `pti-splash.png` tidak lagi dipakai; splash menggunakan PNG asli transparan.
- Delapan asset tanpa pemakai di app/admin: empat JPEG ikon tab lama, tiga PNG ikon Android template, dan `splash-icon.png`.
- Dua dokumen pointer duplikat: `docs/DEVELOPER-GUIDE.md`, `docs/DEVICE-QA.md`. Panduan aktif tetap di README; link checklist pada laporan lama diarahkan ke README.
- Screenshot/XML/log emulator, PDF QA, dan APK lama di `../artifacts` yang dapat dibuat ulang dibersihkan. Baseline ZIP tetap tersedia.
- `assets/icon-aranus.webp` sudah ditandai terhapus sebelum pekerjaan ini; bukan penghapusan baru iterasi ini.
- Test unit/integrasi/browser aktif dipertahankan karena masih dipanggil script/CI. Foto seed backend dan `icon.png` fixture test admin juga dipertahankan setelah memeriksa pemakainya.
- Tidak ada fungsi bisnis, database, akun, foto enrollment, token lokal, atau data payroll yang dihapus oleh iterasi ini.

## Kompatibilitas dan performa

Kontrak `office` tidak berubah: latitude, longitude, radius_meters, max_accuracy_meters, time_zone. Peta menggambar radius lingkaran; tidak mengarang polygon atau kantor tambahan. Data berasal dari dashboard server; alur attendance tetap mengambil challenge terbaru dan mengirim dua sampel baru. Pratinjau tidak pernah menulis absensi dan tidak dipakai sebagai bukti server. Luar area tetap memerlukan konfirmasi dan review sesuai alur yang sudah ada.

Pratinjau GPS hanya berjalan ketika pengguna menekan tombol, tanpa background tracking. Callback diabaikan setelah pindah halaman, GPS kedaluwarsa tidak ditandai valid, dan pembacaan ganda dicegah lock. HTML peta dimemo berdasarkan geometri/sample agar clock tidak memuat ulang WebView setiap detik. Leaflet menambah sekitar 160 KB JS/CSS sebelum kompresi; WebView menambah dependency native. Tile memakai cache browser/WebView, tanpa bulk download.

## QA / STQA

Hasil berikut berasal dari perintah yang benar-benar dijalankan.

- TypeScript: lulus.
- Browser: 12/12 skenario lulus (exit 0). Server Metro khusus QA dihentikan secara eksplisit setelah test selesai karena teardown proses Windows tertahan.
- ESLint: lulus.
- Kontras pasangan teks/status yang diperiksa: minimum 5,60:1, tombol crimson 8,67:1. Screenshot Login terang/gelap dan Home diperiksa; form desktop dibatasi lebarnya.
- Unit/integrasi aplikasi: 75 test lulus, 13 file.
- Backend yang sudah ada: syntax check dan 13 test lulus, termasuk isolasi karyawan, GPS, review luar kantor, idempotency dan persistensi.
- Export Expo Android/iOS/web: lulus. Ini validasi bundle, bukan pengujian perangkat iOS.
- Android release: Gradle berhasil; APK 68.737.301 byte, Android 7+ (minSdk 24), targetSdk 36, ABI ARM64 dan x86_64. `aapt` membuktikan versi 1.0.0 / 10001 dan package tetap sama. `apksigner verify` lulus, sertifikat Android Debug.
- Emulator: update dari APK 1.1.0 berhasil dengan `adb install -r`, tanpa uninstall. Cold start, restart dalam mode malam, Login terang/gelap, logo transparan dan feedback error teramati. Log AndroidRuntime/ReactNativeJS yang diperiksa tidak menunjukkan crash. Emulator sempat menampilkan ANR System UI, pulih setelah memilih Wait; ini tidak dihitung sebagai bukti stabilitas perangkat fisik.
- API LAN dapat dijangkau oleh APK; percobaan akun seed lama ditolak dengan pesan email/password salah. Login sukses, Home dan interaksi peta native belum dibuktikan dengan akun aktif pada server ini; alur tersebut lulus pada browser fixture. Tidak ada absensi baru dikirim selama smoke test native.
- Test geofence memeriksa radius dari server, stale/future/mock/accuracy tidak valid, koordinat tidak valid, serta tidak adanya POST absensi dari preview.
- Browser memakai fixture server; capture contract memakai kamera/GPS fixture yang segar. Test geofence terpisah memakai geolokasi Chromium yang berpindah. Tile publik diblokir pada pengujian otomatis; geometri lokal diuji melalui SVG Leaflet.
- `npm audit --omit=dev`: 15 high, 9 moderate pada rantai dependency Expo/React Native yang ada. Tidak menjalankan `audit fix --force` karena saran perubahan major/downgrade framework. Ini temuan terbuka, bukan audit bersih.

## Batasan dan risiko

URL HTTPS tim web belum tersedia pada saat persiapan. Konfigurasi development yang ada adalah `http://192.168.100.53:4000`; build LAN memerlukan server dan jaringan yang menjangkau alamat tersebut. APK harus dibangun ulang untuk URL hosting baru. Build test menggunakan sertifikat Android debug, bukan signing produksi; update dari APK lain hanya bisa dilakukan bila sertifikat cocok. Jangan uninstall APK pengguna untuk memaksakan update tanpa persetujuan.

GPS dan kamera perangkat fisik, akurasi lokasi di kantor, layanan wajah perusahaan, keystore produksi, penerimaan HR/Finance, dan hosting online belum dibuktikan oleh fixture/browser. Radius GPS tidak sama dengan bukti identitas. Peta jalan dapat gagal ketika jaringan/provider tile tidak tersedia; status dan geometri tetap ada. iOS native memerlukan build/perangkat Apple untuk acceptance.

Panduan hosting dan contoh JSON untuk tim web tersedia di [HOSTING-HANDOFF.md](HOSTING-HANDOFF.md).

## Artefak dan lokasi penting

Tag: `v1.0.0-test.1`, branch: `release/test-1.0.0`. APK: `PTI-Attendance-1.0.0-test.1.apk`.

SHA-256: `981277e5f5b007ef2ee4e336ef36ecda02cbf520a9c3e8f46fe9774ea262c449`.

Lokasi utama: `src/theme.ts:3`, `src/context/ThemeContext.tsx:6`, `src/screens/HomeScreen.tsx:18`, `src/screens/LoginScreen.tsx:11`, `src/screens/AttendanceScreen.tsx:231`, `src/components/GeofenceCard.tsx:12`, `src/services/geofence.ts:5`, `plugins/withThemedSplashLogo.js:7`. Dokumen ini membedakan bukti otomatis, smoke test native, dan acceptance yang belum dijalankan.

Untuk reproduksi lokal: gunakan Node 24, JDK 17, Android SDK 36; `npm ci`, set environment development dan URL API, lalu `npx expo prebuild --platform android --no-install`. Dari folder `android`, jalankan `gradlew.bat :app:assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64`. Plugin splash berjalan setelah mod Expo lainnya; hasil native generated tidak disimpan di Git. Untuk staging HTTPS gunakan environment pada panduan hosting.
