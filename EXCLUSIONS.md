# Out-of-Scope & Technical Constraints Document: Wedding RSVP System

Dokumen ini mendefinisikan secara tegas batasan proyek dan pembatasan penggunaan *library* (dependensi) untuk memastikan MVP Wedding RSVP System dapat diselesaikan dalam target waktu 8 jam efektif tanpa *over-engineering*.

## 1. Fitur Out-of-Scope (Tidak Dibangun pada Fase MVP)

Fitur-fitur berikut secara eksplisit dikeluarkan dari cakupan pengerjaan hari pertama untuk menjaga fokus pada alur utama pendaftaran dan konfirmasi kehadiran.

* **Global Admin Panel / Superadmin:** Tidak ada dasbor utama untuk mengelola semua akun *organizer*. Manajemen murni dilakukan oleh masing-masing *organizer* di *dashboard* mereka sendiri.
* **SaaS Tiering & Pembayaran:** Tidak ada sistem langganan (*subscription*), pembatasan fitur berbayar, atau integrasi *payment gateway* (Midtrans, Stripe, dll).
* **Notifikasi Otomatis (Email / WhatsApp):** Tidak ada pengiriman tiket, pengingat, atau konfirmasi otomatis via WhatsApp API (seperti Fonnte/Watzap) maupun SMTP Email (SendGrid/Mailgun).
* **Edit RSVP oleh Tamu:** Setelah tamu menekan tombol *submit*, data bersifat final. Tamu tidak disediakan tautan unik atau mekanisme untuk mengubah status kehadiran mereka di kemudian hari.
* **Manajemen Kapasitas Sesi (*Quota*):** Tidak ada pembatasan jumlah kursi per sesi (misalnya, sesi Akad maksimal 50 orang). Sistem hanya mencatat dan menjumlahkan, tanpa mencegah tamu mendaftar jika jumlah sudah banyak.
* **Upload File Media:** Sistem tidak menangani *upload* gambar/foto ke *server* lokal atau S3 (AWS/Cloudinary). Gambar profil acara atau *cover* undangan hanya menggunakan *input link URL* publik.
* **Tema Kustom Dinamis:** *Organizer* tidak bisa memilih warna atau tata letak. Semua undangan publik akan menggunakan pakem tema tunggal **Modern Heritage (Batik Truntum)**.

## 2. Infrastruktur Out-of-Scope

* **Server-Side Rendering (SSR) / SEO Optimization:** Tidak menggunakan Next.js atau Nuxt. Aplikasi publik murni merender di sisi klien (Client-Side Rendering) menggunakan React + Vite. SEO dan *metadata crawler* (OpenGraph) diabaikan pada fase MVP.
* **Realtime Updates:** Dasbor *organizer* tidak menggunakan WebSocket atau *Server-Sent Events (SSE)* untuk pembaruan data RSVP otomatis. *Organizer* harus memuat ulang (*refresh*) halaman untuk melihat data terbaru.
* **External Caching / In-Memory Store:** Tidak menggunakan Redis atau Memcached untuk *rate limiting* maupun *caching query* database. Semua di-handel secara *in-memory* di dalam aplikasi Go.

## 3. Batasan Library & Tech Stack (Frontend)

Untuk menjaga *bundle size* tetap kecil dan kecepatan pengembangan maksimal, *frontend* dibatasi pada daftar dependensi berikut. Dilarang keras menambahkan dependensi di luar daftar izin ini tanpa persetujuan eksplisit.

**Library yang Diizinkan (Whitelist):**

* `react` & `react-dom` (v19)
* `vite` (Build tool & dev server)
* `tailwindcss` & `@tailwindcss/vite` (v4 - tanpa file config terpisah)
* `react-router` (v7 - untuk *routing* halaman)
* `axios` (HTTP client untuk memanggil API)
* `react-hook-form` (Manajemen *state* form publik & *organizer*)
* `lucide-react` (Aset ikon SVG yang ringan)
* `qrcode.react` (Generator QR Code di sisi klien)
* `framer-motion` (Animasi transisi undangan, scroll reveal, lightbox, dan umpan balik UI; wajib menghormati `prefers-reduced-motion`)

**Library yang DILARANG (Blacklist):**

* **State Management Eksternal:** Redux, Zustand, MobX. (Gunakan React `useState` atau `Context` murni).
* **UI Component Frameworks:** Material UI (MUI), Ant Design, Chakra UI, Bootstrap. (Semua komponen UI wajib dibangun dari awal menggunakan *utility classes* Tailwind).
* **Animation Libraries:** GSAP dan Lottie. Framer Motion dikecualikan dan diizinkan sesuai whitelist; gunakan hanya untuk motion yang bermakna, bukan dekorasi berlebihan.
* **Date Pickers Kompleks:** React Datepicker, MUI DatePicker. (Wajib menggunakan elemen *native* `<input type="date">`).

## 4. Batasan Library & Tech Stack (Backend)

Backend difokuskan pada pengolahan API yang secepat mungkin dengan utilitas bawaan *framework* untuk menghindari konflik versi dan kompleksitas instalasi.

**Library yang Diizinkan (Whitelist):**

* `[github.com/gin-gonic/gin](https://github.com/gin-gonic/gin)` (Web framework)
* `gorm.io/gorm` & `gorm.io/driver/postgres` (ORM & Database Driver)
* `[github.com/golang-jwt/jwt/v5](https://github.com/golang-jwt/jwt/v5)` (Pembuatan & verifikasi token)
* `golang.org/x/crypto/bcrypt` (Enkripsi *password*)
* `[github.com/joho/godotenv](https://github.com/joho/godotenv)` (Manajemen *environment variables*)
* `[github.com/gin-contrib/cors](https://github.com/gin-contrib/cors)` (Middleware CORS spesifik Gin)

**Library yang DILARANG (Blacklist):**

* **Alternatif Web Framework:** Echo, Fiber, Mux (Tetap gunakan Gin).
* **Alternatif ORM / Query Builder:** SQLX, Ent, Prisma Go (Tetap gunakan GORM dengan fitur `AutoMigrate`).
* **Validation Libraries Eksternal:** Go-playground validator mandiri atau library lain (Gunakan sepenuhnya `binding` tags yang sudah menyatu secara internal di dalam Gin).
* **UUID Generators Eksternal (Opsional):** Hindari jika memungkinkan. Manfaatkan ekstensi bawaan PostgreSQL `uuid-ossp` atau `pgcrypto` saat auto-migrate GORM, atau gunakan Auto-Increment Serial jika UUID dirasa terlalu lambat di-setup.