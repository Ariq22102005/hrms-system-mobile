# Hosting dan integrasi APK tes 1.0.0

## Rekomendasi

Untuk backend Node/Python yang ada di workspace, gunakan **Render Web Service berbayar, region Singapore, Docker, satu instance, persistent disk**. Node menangani API dan Python/OpenCV menangani verifikasi wajah; container memudahkan kedua runtime dipasang bersama. Render mendukung [Docker](https://render.com/docs/docker), [Singapore](https://render.com/docs/regions), dan [disk persisten pada layanan berbayar](https://render.com/docs/disks). Alternatif: [Railway Singapore](https://docs.railway.com/deployments/regions) dengan [volume persisten](https://docs.railway.com/volumes/reference), atau VPS yang dikelola tim IT.

Ini rekomendasi staging untuk implementasi yang ada, bukan kewajiban mengganti backend tim web. Jika backend tim web memakai Laravel/PHP, pilih hosting PHP yang mendukung framework/database mereka dan implementasikan kontrak REST pada README. APK tidak bergantung pada bahasa backend.

## Setting untuk backend demo saat ini

| Setting | Nilai/kebijakan |
| --- | --- |
| Runtime | Node 24 LTS; Python 3.11+ dengan dependency `requirements.txt` |
| Start | `node server.mjs`, working directory proyek admin |
| Bind | `HOST=0.0.0.0`; gunakan `PORT` dari platform |
| Database | `DATABASE_PATH=/var/data/aranus.sqlite`; mount disk di `/var/data` |
| Instance | Satu instance untuk SQLite; jangan aktifkan horizontal scaling |
| Python | `PYTHON_PATH` harus menunjuk interpreter tempat OpenCV dipasang |
| Model | Siapkan YuNet/SFace melalui setup proyek saat build; jangan unduh per request |
| Health check | `/health` |
| Secret | `ADMIN_PASSWORD` dan `EMPLOYEE_PASSWORD` dibuat sendiri lewat secret manager |
| Domain | HTTPS untuk API dan admin; contoh subdomain `api.<domain-perusahaan>` |
| CORS | `ALLOWED_ORIGINS` berisi origin admin yang tepat, tanpa wildcard |
| Geofence | `OFFICE_LATITUDE`, `OFFICE_LONGITUDE`, `OFFICE_RADIUS_METERS`, `MAX_GPS_ACCURACY_METERS` |
| Backup | Backup SQLite yang konsisten, termasuk WAL; uji restore sebelum memakai data riil |

Admin dapat dilayani bersama API dari folder `public/`, sehingga `apiBaseUrl` di `public/config.js` tetap kosong. Jika admin dipisah, set `apiBaseUrl` ke origin API dan masukkan origin admin ke CORS. Folder database, `.env`, dan foto tidak boleh berada di document root publik. Backend demo belum menjadi sistem payroll/biometrik produksi; gunakan akun/data uji.

## Kontrak geofence

`GET /api/v1/dashboard` harus mengembalikan objek berikut di `data.office`; `GET /api/v1/attendance/challenge` juga mengembalikan kebijakan kantor terbaru:

```json
{
  "latitude": -3.812857,
  "longitude": 102.287606,
  "radius_meters": 100,
  "max_accuracy_meters": 50,
  "time_zone": "Asia/Jakarta"
}
```

Koordinat di atas hanya contoh. Peta menggambar lingkaran dari koordinat/radius server. Polygon atau banyak kantor belum termasuk kontrak ini. UI GPS adalah pratinjau, bukan bukti hadir. Server tetap memvalidasi dua sampel baru, umur/akurasi GPS, challenge, foto, idempotency, sesi karyawan, serta persetujuan luar kantor. Ubah `revision` ketika data dashboard berubah. Jangan menyatakan wajah terverifikasi jika mesin verifikasi belum siap.

## URL APK

Untuk build staging online, set `EXPO_PUBLIC_APP_ENV=staging` dan `EXPO_PUBLIC_API_BASE_URL_STAGING=https://<host-api-asli>` pada environment EAS preview. URL menunjuk origin tanpa menggandakan `/api/v1`; aplikasi menambahkan prefix itu. Jangan memasukkan password/database secret ke variabel `EXPO_PUBLIC_*`.

Build tes LAN memakai konfigurasi development yang sudah tersedia. URL ditanam saat build: setelah tim web memberikan HTTPS API, rebuild APK diperlukan. Tidak ada fallback diam-diam ke data mock di APK.

## Handover dari tim web

1. URL HTTPS API dan admin yang aktif; uji `/health` dari internet.
2. Akun tes dan enrollment foto diserahkan melalui kanal internal, bukan GitHub.
3. Uji login, dashboard, izin kamera/lokasi, GPS dalam/luar area, akurasi buruk, konfirmasi luar kantor, review HR, cuti, payroll, dan logout.
4. Pastikan API mengembalikan status/error sesuai README, token expiry, dan idempotency tanpa data karyawan tertukar.
5. Uji restart/redeploy dan restore backup; data tersimpan harus tetap tersedia.

Peta menggunakan Leaflet 1.9.4 yang dibundel dan tile OpenStreetMap melalui HTTPS. Untuk pemakaian besar, pilih penyedia tile berkapasitas sesuai kebutuhan; patuhi [kebijakan tile OSM](https://operations.osmfoundation.org/policies/tiles/). Tile tetap membutuhkan internet, sedangkan geometri kantor dapat digambar tanpa CDN. Uji GPS asli pada perangkat fisik sebelum penerimaan.
