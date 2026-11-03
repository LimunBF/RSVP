# Quality & Design Document: Wedding RSVP System (Revisi)

## 1. Design Tokens & Theming (Tailwind CSS v4)

Pendekatan desain adalah **Wayang Theatre**: memadukan panggung wayang kulit (kelir, blencong, gunungan) dan artefak asli museum dengan antarmuka modern yang bersih. Motif Batik Truntum (melambangkan cinta yang tumbuh bersemi) digunakan secara strategis tanpa mendominasi layar.

**Palet Warna:**

* **Primary:** `--color-sogan: #5C3A21;` (Cokelat Sogan pekat untuk tombol aksi dan teks tebal)
* **Background:** `--color-cream: #F5F0E6;` (Krem hangat untuk latar utama, memastikan kontras optimal)
* **Ink/Text:** `--color-dark-brown: #3E2723;` (Cokelat tua untuk teks paragraf dan form)
* **Accent:** `--color-gold: #D4AF37;` (Emas untuk elemen *highlight*, garis *divider*, dan teks peringatan)
* **Secondary:** `--color-indigo: #283593;` (Biru Indigo untuk status/opsi sekunder)

**Tipografi:**

* **Serif (Klasik):** *Playfair Display* atau *Merriweather*. Dikhususkan untuk nama mempelai, *heading* acara, dan sapaan pembuka.
* **Sans-Serif (Bersih):** *Inter* atau *Lato*. Digunakan untuk elemen antarmuka, navigasi form, instruksi, dan isi pesan.

## 2. Component Inventory (React)

### Layout & Motif

* **`HeritageLayout`:** Latar belakang solid `--color-cream`. Motif Sidomukti diimplementasikan maksimal 20–30% dari area layar sebagai elemen SVG.
* **`BatikDivider`:** Garis pemisah horizontal dengan ornamen Sidomukti emas tipis untuk memisahkan bagian cerita, detail sesi, dan form RSVP.
* **`TruntumCard`:** Kontainer form dengan latar belakang putih solid. Ornamen motif Sidomukti diletakkan eksklusif di sudut luar kartu (*corner stamps*) agar tidak mengganggu keterbacaan teks.

### Form & Interaksi UI

* **`TouchInput` & `TouchSelect`:** Field form didesain minimalis dengan *border* bawah (*underline*) atau kotak tipis `--color-sogan`, tinggi minimal 48px untuk *tap area* yang nyaman di perangkat seluler.
* **`ActionBtn`:** Tombol utama berukuran besar (tinggi 56px) membentang penuh (*full-width*) di layar *mobile*. Menggunakan warna solid `--color-sogan` dengan teks Serif krem.
* **Bahasa:** Undangan publik sepenuhnya berbahasa Indonesia. Tidak ada *toggle* bahasa sampai seluruh alur punya terjemahan Jawa yang lengkap.

## 3. Spesifikasi Form RSVP & Lokalisasi

Pengalaman pengisian data mempertahankan struktur yang lugas dan konsisten berbahasa Indonesia.

* **Field Wajib Form:** Nama Lengkap, Status Kehadiran (Radio: Hadir / Mungkin / Tidak Hadir), Sesi Acara (wajib bila hadir dan acara punya sesi), Jumlah Tamu (minimal 1 bila hadir, otomatis 0 bila tidak), Pesan/Doa (opsional).
* **Deadline Konfirmasi:** Ditampilkan di atas form. Bila batas sudah lewat, form diganti status "Konfirmasi telah ditutup" dan backend menolak submission dengan 409.
* **Catatan Aksesibilitas:** Label form memakai kalimat yang jelas dan universal agar tidak terjadi kesalahan input. Setiap *error* ditampilkan inline di bawah field, dan field yang gagal diberi `aria-invalid`.



## 4. Aksesibilitas & Tata Letak (Mobile-First)

* **Zero Low-Contrast Text:** Tidak ada teks, baik *heading* maupun paragraf, yang dirender di atas tekstur motif batik. Semua area teks wajib memiliki latar belakang solid `--color-cream` atau putih.
* **Hierarki Form:** *Deadline* RSVP diposisikan di atas form dengan warna `--color-gold` dan *font* Serif italic agar langsung menjadi pusat perhatian sebelum pengguna memilih status kehadiran.