# Technical Requirements Document (TRD)

## 1. Arsitektur Sistem

Sistem ini menggunakan arsitektur *Client-Server* monolitik untuk backend demi kecepatan pengembangan MVP, dengan pemisahan pada sisi presentasi (*Single Page Application*).

* **Frontend:** React 19 dengan Vite, diimplementasikan menggunakan TypeScript dan Tailwind CSS v4. Data fetching menggunakan Axios dengan pencegatan (*interceptor*) JWT.
* **Backend:** Go 1.22+ menggunakan *framework* Gin untuk *routing* berkinerja tinggi.
* **Database:** PostgreSQL 16 yang diakses via GORM.
* **Deployment:** Docker Compose untuk orkestrasi *container* lokal (Database, Backend, Frontend).

## 2. Log Keputusan Teknis (Decision Log)

* **Mengapa Gin (Go) dan bukan Echo/Fiber?** Gin memiliki ekosistem *middleware* yang stabil dan sangat ringan, cocok untuk alokasi waktu 8 jam di mana dokumentasi `binding` dan validasi langsung terintegrasi dengan baik.
* **Mengapa GORM?** Menghemat waktu dalam penulisan kueri repetitif (CRUD) dan fitur `AutoMigrate` sangat mempercepat iterasi skema database di fase MVP.
* **Otentikasi Stateless (JWT) vs Stateful (Session):** JWT dipilih untuk menghindari setup *storage* sesi terpisah (seperti Redis) atau kompleksitas tabel sesi di PostgreSQL. Ini memastikan backend sepenuhnya *stateless*.
* **Rate Limiting In-Memory:** Mengingat ini adalah MVP hari pertama, *in-memory mutex map* digunakan untuk membatasi *request* ke *endpoint* RSVP publik demi mencegah *spam*, menghilangkan kebutuhan *setup* dependensi eksternal.

## 3. Skema & Konstrain Database Detail

* **Tabel `users`:**
* `id` (UUID/Serial, PK), `email` (VARCHAR, UNIQUE, INDEX), `password_hash` (VARCHAR), `name` (VARCHAR), `created_at` (TIMESTAMP).


* **Tabel `weddings`:**
* `id` (UUID/Serial, PK), `organizer_id` (FK to users.id), `slug` (VARCHAR, **UNIQUE, INDEX**), `bride`, `groom`, `event_date`, `location`, `story`, `cover_url`, `created_at`.


* **Tabel `wedding_sessions`:**
* `id` (UUID/Serial, PK), `wedding_id` (FK to weddings.id, ON DELETE CASCADE), `label`, `start_time`, `end_time`, `sort_order` (INT).


* **Tabel `rsvps`:**
* `id` (UUID/Serial, PK), `wedding_id` (FK to weddings.id), `session_id` (FK to wedding_sessions.id, **NULLABLE**), `name`, `attendance` (ENUM/VARCHAR CHECK: 'yes','no','maybe'), `guests_count` (INT, DEFAULT 0), `message` (TEXT).


* **Catatan Validasi Backend:** Saat insert ke tabel `rsvps` dengan `attendance = 'yes'`, backend wajib melakukan verifikasi *query* tunggal bahwa `session_id` benar-benar terdaftar di bawah `wedding_id` tersebut.

## 4. Alur Request Kunci (Data Flow)

**Alur Submit RSVP:**

1. Klien mengirim `POST /w/:slug/rsvp` dengan *payload* JSON.
2. *Middleware* Rate Limiter mengecek `c.ClientIP()`. Jika >5 *request*/menit, kembalikan HTTP 429.
3. *Controller* melakukan verifikasi *binding* (struktur data, *required fields*).
4. Jika `attendance == "yes"`, periksa apakah `session_id` diberikan. Ambil data *wedding* berdasarkan *slug*.
5. Verifikasi apakah `session_id` valid dan dimiliki oleh *wedding* tersebut.
6. Simpan rekaman RSVP ke PostgreSQL. Kembalikan HTTP 201.

## 5. Security & Risk Register

* **Risiko: Limitasi Rate Terbagi Rata (False Positive).**
* **Mitigasi:** Backend berjalan dalam Docker, sehingga Gin akan membaca IP Gateway Docker. Konfigurasi `engine.SetTrustedProxies(nil)` atau tentukan IP subnet internal secara eksplisit jika menggunakan *reverse proxy* di *production*.


* **Risiko: Input Spam / XSS pada Ucapan Tamu.**
* **Mitigasi:** Validasi batas maksimum karakter di Go (maks 500 karakter untuk `message`). React secara otomatis melakukan *escaping* pada saat *render*, sehingga mencegah injeksi skrip di dasbor Organizer.


* **Risiko: Organizer Lain Mengakses Data Undangan (IDOR).**
* **Mitigasi:** Setiap *endpoint* terlindungi `/weddings/:id/*` wajib mencocokkan `organizer_id` di database dengan `user_id` yang terdapat pada klaim JWT.