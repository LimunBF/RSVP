# Architecture Decision Records (ADR) & Decision Log: Wedding RSVP System

Dokumen ini mencatat keputusan arsitektur dan teknis utama untuk pengembangan MVP sistem RSVP Pernikahan dalam tenggat waktu 8 jam.

## 1. Pemilihan Stack & Framework Utama

**Konteks:** MVP harus dibangun dan di-deploy secepat mungkin tanpa mengorbankan keamanan dasar dan performa.
**Keputusan:**

* Backend menggunakan **Go 1.22+ dengan Gin** dan **GORM**.
* Frontend menggunakan **React 19 (Vite)** dan **TailwindCSS v4**.
**Rasionalisasi:**
Gin sangat ringan, memiliki kapabilitas *routing* cepat, dan fitur `binding` bawaan yang mempercepat proses validasi *payload* dibandingkan framework lain. GORM dipilih karena fitur `AutoMigrate` sangat menghemat waktu iterasi skema di awal pengembangan. Pada sisi *frontend*, Vite dan Tailwind v4 (pendekatan *CSS-first* tanpa `tailwind.config.js`) memangkas waktu setup *boilerplate* secara signifikan. Next.js/SSR dihindari karena *overhead* konfigurasi yang tidak diperlukan untuk aplikasi form sederhana.

## 2. Strategi Otentikasi: JWT vs Session

**Konteks:** Organizer membutuhkan akses aman ke *dashboard* untuk mengelola undangan.
**Keputusan:** Menggunakan **Stateless JWT** yang ditandatangani dengan algoritma HS256, dikembalikan via respons JSON, dan disimpan oleh *frontend* (Local/Session Storage).
**Rasionalisasi:**
Menggunakan *stateful session* akan memaksa kita mengelola penyimpanan *session* di database atau menyiapkan *service* eksternal seperti Redis. JWT menjaga *backend* tetap *stateless*, menurunkan beban infrastruktur Docker lokal, dan cukup aman untuk *use-case* MVP jika diterapkan dengan kedaluwarsa (TTL) yang wajar (misal: 24 jam).

## 3. Pencegahan Spam (Rate Limiting): In-Memory vs Redis

**Konteks:** Endpoint publik `POST /w/:slug/rsvp` sangat rentan terhadap serangan *spam* atau *script bot*.
**Keputusan:** Mengimplementasikan **In-Memory Rate Limiter** menggunakan `sync.Mutex` dan Go `map` (5 request / menit per IP).
**Rasionalisasi:**
Meskipun Redis adalah standar industri untuk *rate limiting*, menambahkannya ke dalam `docker-compose.yml` untuk MVP 8 jam adalah *over-engineering* yang memakan waktu *setup* dan *debugging*. Implementasi *in-memory* dengan *middleware* kustom di Gin sudah cukup menahan *spam* level dasar pada hari pertama. Konfigurasi `TrustedProxies` pada Gin wajib diatur agar IP yang dibaca adalah IP klien asli, bukan IP internal Docker Gateway.

## 4. Pemodelan Data RSVP: Single-Session & Nullable

**Konteks:** Tamu harus memilih sesi kehadiran jika mereka hadir.
**Keputusan:**

* Kolom `session_id` pada tabel `rsvps` dibuat sebagai **Foreign Key yang Nullable**.
* Tamu hanya diizinkan memilih **satu sesi** (*single-session-per-RSVP*).
**Rasionalisasi:**
Jika `session_id` wajib (`NOT NULL`), sistem akan *error* ketika tamu memilih "Tidak Hadir" atau "Mungkin" karena mereka tidak memilih sesi. Dengan *nullable*, logika ini terakomodasi di level database. Pembatasan satu tamu satu sesi (radio button, bukan checkbox) menghindarkan kebutuhan tabel relasi *many-to-many* (junction table), sehingga skema basis data tetap datar (satu baris per tamu) dan rekap dasbor lebih mudah dihitung dengan query `GROUP BY`.

## 5. Implementasi Tema Wayang Theatre & Bahasa

**Konteks:** Desain memakai arah **Wayang Theatre** (kelir, gunungan, artefak wayang asli) dengan teks berbahasa Indonesia. Batik Sidomukti hanya muncul sebagai ornamen kecil, bukan wallpaper.
**Keputusan:**

* Motif batik diimplementasikan eksklusif sebagai **SVG Asset murni (Corner Stamp/Divider)** dengan *coverage* maksimal 30% area, bukan sebagai gambar latar penuh.
* Seluruh teks undangan berbahasa Indonesia. Toggle ID/JV **dihapus** karena hanya menerjemahkan satu kalimat sementara sisanya tetap Indonesia — toggle parsial lebih menyesatkan daripada satu bahasa yang konsisten.
* Lokalisasi penuh (dictionary per bahasa) adalah pekerjaan tersendiri; tambahkan kembali bila seluruh alur publik sudah punya terjemahan Jawa.
**Rasionalisasi:**
Menempatkan teks di atas gambar tekstur batik berisiko gagal memenuhi standar rasio kontras aksesibilitas. Mengisolasi motif ke sudut layar memastikan *container* form tetap memiliki latar solid (Cream/Putih). Satu bahasa yang konsisten menghilangkan kebutuhan *schema* tambahan di *database* atau param bahasa di *endpoint*, menjaga *backend* tetap ramping dan spesifik pada transaksi RSVP.

## 6. Arah Visual: Wayang Theatre, Bukan Truntum

**Konteks:** Arah awal dokumen adalah *Modern Heritage* dengan Batik Truntum. Implementasi bergerak ke panggung wayang kulit: kelir, blencong, gunungan, dan foto artefak wayang asli dari Collectie Wereldmuseum serta foto pagelaran Kassian Cephas.
**Keputusan:** Dokumentasi diselaraskan ke **Wayang Theatre**; implementasi dibatasi agar pasangan tetap menjadi pusat.

* Adegan kelir penuh (kelir + blencong + grain + panggung + dua figur) hanya di opening dan hero.
* Bagian acara, galeri, dan footer memakai *silhouette frame* tipis (`.stage-accent`), bukan panggung penuh berulang.
* Aset disimpan lokal di `frontend/public/assets/wayang/`, tidak di-*hotlink*; sumber dan lisensi dicatat di `ASSETS-SOURCED.md` dan footer.
* Batik Sidomukti hanya ornamen kecil, bukan wallpaper.

**Rasionalisasi:**
Mengulang panggung penuh di lima bagian menenggelamkan pasangan, menambah biaya paint/composite, dan membuat undangan terasa seperti pameran budaya. Satu adegan kuat di pembuka, lalu aksen kecil, memberi identitas tanpa menggeser fokus.

## 7. Loop Konfirmasi & Absensi

**Konteks:** Organizer mengisi *deadline* RSVP, tetapi form publik tidak menampilkannya dan backend menerima submission setelahnya. RSVP `yes` juga buntu bila acara belum punya sesi, dan endpoint absensi publik tanpa token dapat dienumerasi.
**Keputusan:**

* *Deadline* ditampilkan di atas form; pelanggaran ditolak server dengan 409 dan form diganti status "Konfirmasi telah ditutup".
* Wedding baru otomatis mendapat satu sesi default sehingga RSVP `hadir` selalu punya pilihan sesi.
* QR absensi membawa token *purpose-scoped* 14 hari; endpoint pencarian dan check-in menolak 403 tanpa token yang sah.
* Menghapus sesi yang masih dipakai RSVP ditolak 409; waktu sesi divalidasi berurutan dan tidak bertumpuk.

**Rasionalisasi:**
Kontrak yang dijanjikan di UI organizer harus sama dengan yang ditegakkan backend. Token absensi memisahkan "tahu slug" dari "boleh mengabsen", sehingga daftar tamu tidak bocor dan absensi hari acara tetap dapat dipercaya.