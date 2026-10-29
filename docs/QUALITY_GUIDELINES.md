# Quality & Design Document: Wedding RSVP System (Revisi)

## 1. Design Tokens & Theming (Tailwind CSS v4)

Pendekatan desain bertransisi ke *Modern Heritage* yang memadukan estetika tradisional Jawa dengan fungsionalitas antarmuka modern yang bersih. Motif Batik Truntum (melambangkan cinta yang tumbuh bersemi) digunakan secara strategis tanpa mendominasi layar.

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

### Layout & Motif Truntum

* **`HeritageLayout`:** Latar belakang solid `--color-cream`. Motif Batik Truntum diimplementasikan maksimal 20–30% dari area layar sebagai elemen SVG.
* **`BatikDivider`:** Garis pemisah horizontal yang menggunakan pola Truntum emas tipis untuk memisahkan bagian cerita, detail sesi, dan form RSVP.
* **`TruntumCard`:** Kontainer form dengan latar belakang putih solid. Ornamen motif Truntum diletakkan eksklusif di sudut luar kartu (*corner stamps*) agar tidak mengganggu keterbacaan teks.

### Form & Interaksi UI

* **`TouchInput` & `TouchSelect`:** Field form didesain minimalis dengan *border* bawah (*underline*) atau kotak tipis `--color-sogan`, tinggi minimal 48px untuk *tap area* yang nyaman di perangkat seluler.
* **`ActionBtn`:** Tombol utama berukuran besar (tinggi 56px) membentang penuh (*full-width*) di layar *mobile*. Menggunakan warna solid `--color-sogan` dengan teks Serif krem.
* **`LanguageToggle`:** *Switch* kecil di sudut kanan atas layar publik untuk mengganti sapaan (ID / JV).

## 3. Spesifikasi Form RSVP & Lokalisasi

Pengalaman pengisian data mempertahankan struktur yang lugas dengan dukungan dwibahasa untuk menghormati tata krama tamu.

* **Field Wajib Form:** Nama Lengkap, Status Kehadiran (Radio: Hadir / Tidak), Jumlah Tamu (Otomatis 0 jika tidak hadir), Pesan/Doa, dan tampilan *Deadline* Konfirmasi dengan teks tebal `--color-sogan`.
* **Dukungan Krama Inggil (Jawa Halus):**
* *Sapaan Pembuka:* "Katur dhumateng Bapak/Ibu/Sedherek..." (Kepada Yth.)
* *Teks Undangan:* "Kanthi asor ing manah, kula ngaturaken pawartos duka ugi nyuwun donga pangestu..." (Dengan kerendahan hati...)
* *Status Kehadiran:* "Badhe Rawuh" (Akan Hadir) / "Mboten Saged Rawuh" (Tidak Bisa Hadir).
* *Catatan Aksesibilitas:* Label form teknis (seperti *placeholder* input nama dan jumlah tamu) tetap menggunakan bahasa yang jelas dan universal agar tidak terjadi kesalahan input.



## 4. Aksesibilitas & Tata Letak (Mobile-First)

* **Zero Low-Contrast Text:** Tidak ada teks, baik *heading* maupun paragraf, yang dirender di atas tekstur motif batik. Semua area teks wajib memiliki latar belakang solid `--color-cream` atau putih.
* **Hierarki Form:** *Deadline* RSVP diposisikan di atas form dengan warna `--color-gold` dan *font* Serif italic agar langsung menjadi pusat perhatian sebelum pengguna memilih status kehadiran.