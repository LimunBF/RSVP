# Technical Requirements Document (TRD)

## 1. Arsitektur Sistem

Sistem ini menggunakan arsitektur *Client-Server* monolitik untuk backend demi kecepatan pengembangan MVP, dengan pemisahan pada sisi presentasi (*Single Page Application*).

* **Frontend:** React 19 dengan Vite dan TypeScript. Data fetching memakai `fetch` melalui wrapper bertipe di `src/api.ts` dengan header Authorization skema Bearer (Axios terpasang tetapi tidak dipakai). Tailwind v4 terpasang tetapi UI memakai CSS kustom; utility class belum digunakan secara nyata.
* **Backend:** Go 1.22+ menggunakan *framework* Gin untuk *routing* berkinerja tinggi.
* **Database:** PostgreSQL 16 yang diakses via GORM.
* **Deployment:** Docker Compose untuk orkestrasi *container* lokal (Database, Backend, Frontend).

## 2. Log Keputusan Teknis (Decision Log)

* **Mengapa Gin (Go) dan bukan Echo/Fiber?** Gin memiliki ekosistem *middleware* yang stabil dan sangat ringan, cocok untuk alokasi waktu 8 jam di mana dokumentasi `binding` dan validasi langsung terintegrasi dengan baik.
* **Mengapa GORM?** Menghemat waktu dalam penulisan kueri repetitif (CRUD) dan fitur `AutoMigrate` sangat mempercepat iterasi skema database di fase MVP.
* **Otentikasi Stateless (JWT) vs Stateful (Session):** JWT dipilih untuk menghindari setup *storage* sesi terpisah (seperti Redis) atau kompleksitas tabel sesi di PostgreSQL. Ini memastikan backend sepenuhnya *stateless*.
* **Rate Limiting In-Memory:** *In-memory mutex map* per *route* dengan batas berbeda: RSVP publik 5/menit per IP, auth 10/menit, pencarian & check-in 60/menit (satu tamu memakai dua request, jadi batas 5/menit memblokir meja tamu normal). Respons 429 menyertakan `Retry-After`. Map dibersihkan saat melewati 2048 IP.
* **JWT Absensi Terpisah:** QR absensi membawa token *purpose-scoped* (`purpose: "check-in"`, `wid`) yang kedaluwarsa 14 hari, bukan JWT organizer. Token organizer di tolak untuk endpoint check-in dan sebaliknya.

## 3. Skema & Konstrain Database Detail

* **Tabel `users`:**
* `id` (UUID/Serial, PK), `email` (VARCHAR, UNIQUE, INDEX), `password_hash` (VARCHAR), `name` (VARCHAR), `created_at` (TIMESTAMP).


* **Tabel `weddings`:**
* `id` (UUID/Serial, PK), `organizer_id` (FK to users.id), `slug` (VARCHAR, **UNIQUE, INDEX**), `bride`, `groom`, `event_date`, `deadline` (TIMESTAMP, **NULLABLE**), `location`, `story`, `cover_url`, `created_at`.
* Setiap wedding baru otomatis dibuatkan satu sesi default ("Resepsi Pernikahan") supaya RSVP `yes` tidak pernah buntu.


* **Tabel `wedding_sessions`:**
* `id` (UUID/Serial, PK), `wedding_id` (FK to weddings.id, ON DELETE CASCADE), `label`, `start_time`, `end_time`, `sort_order` (INT).


* **Tabel `rsvps`:**
* `id` (UUID/Serial, PK), `wedding_id` (FK to weddings.id), `session_id` (FK to wedding_sessions.id, **NULLABLE**), `name`, `attendance` (ENUM/VARCHAR CHECK: 'yes','no','maybe'), `guests_count` (INT, DEFAULT 0), `message` (TEXT).


* `checked_in_at` (TIMESTAMP, **NULLABLE**) untuk absensi hari acara.
* **Catatan Validasi Backend:** Saat insert ke tabel `rsvps` dengan `attendance = 'yes'`, backend wajib melakukan verifikasi *query* tunggal bahwa `session_id` benar-benar terdaftar di bawah `wedding_id` tersebut, dan `guests_count` minimal 1. Bila `deadline` sudah lewat, submission ditolak dengan HTTP 409. Sesi acara divalidasi agar waktu selesai setelah waktu mulai dan tidak bertumpuk dengan sesi lain; menghapus sesi yang masih dipakai RSVP ditolak dengan HTTP 409.

## 4. Alur Request Kunci (Data Flow)

**Alur Submit RSVP:**

1. Klien mengirim `POST /w/:slug/rsvp` dengan *payload* JSON.
2. *Middleware* Rate Limiter mengecek `c.ClientIP()`. Jika >5 *request*/menit, kembalikan HTTP 429.
3. *Controller* melakukan verifikasi *binding* (struktur data, *required fields*).
4. Jika `attendance == "yes"`, periksa apakah `session_id` diberikan. Ambil data *wedding* berdasarkan *slug*.
5. Verifikasi apakah `session_id` valid dan dimiliki oleh *wedding* tersebut, dan `guests_count >= 1`.
6. Tolak dengan HTTP 409 bila `deadline` sudah lewat.
7. Simpan rekaman RSVP ke PostgreSQL. Kembalikan HTTP 201. Kegagalan tulis mengembalikan 500, bukan 201.

**Alur Check-in Tamu:**

1. Petugas membuka QR poster → `/w/:slug/check-in?t=<token>`.
2. Klien memanggil `GET /w/:slug/check-in/search?q=..&t=..`. Backend menolak (403) bila token tidak valid atau milik wedding lain.
3. Hasil dibatasi 5, hanya RSVP `yes`, dan tidak memuat pesan maupun kontak.
4. `POST /w/:slug/check-in` dengan `rsvp_id` + `token` mengisi `checked_in_at` hanya bila masih `NULL`; request kedua mengembalikan 409.

## 5. Security & Risk Register

* **Risiko: Limitasi Rate Terbagi Rata (False Positive).**
* **Mitigasi:** Backend berjalan dalam Docker, sehingga Gin akan membaca IP Gateway Docker. Konfigurasi `engine.SetTrustedProxies(nil)` atau tentukan IP subnet internal secara eksplisit jika menggunakan *reverse proxy* di *production*.


* **Risiko: Input Spam / XSS pada Ucapan Tamu.**
* **Mitigasi:** Validasi batas maksimum karakter di Go (maks 500 karakter untuk `message`). React secara otomatis melakukan *escaping* pada saat *render*, sehingga mencegah injeksi skrip di dasbor Organizer.


* **Risiko: Organizer Lain Mengakses Data Undangan (IDOR).**
* **Mitigasi:** Setiap *endpoint* terlindungi `/weddings/:id/*` wajib mencocokkan `organizer_id` di database dengan `user_id` yang terdapat pada klaim JWT.