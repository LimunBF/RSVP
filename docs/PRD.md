# Product Requirements Document (PRD)

## 1. Problem Statement

Pasangan yang akan menikah atau *wedding organizer* membutuhkan sistem yang cepat dan sederhana untuk membagikan undangan digital sekaligus melacak konfirmasi kehadiran (RSVP). Seringkali, acara dibagi ke dalam beberapa sesi (misalnya Akad dan Resepsi) untuk menghindari kerumunan, sehingga tamu harus bisa memilih sesi secara spesifik. Solusi yang ada saat ini terlalu kompleks, berbayar (SaaS besar), atau tidak menyediakan manajemen sesi yang terintegrasi langsung dengan form RSVP yang *mobile-friendly*.

## 2. Target Persona

* **Organizer (Pemilik Acara):** Membutuhkan antarmuka yang efisien untuk membuat undangan, mengatur sesi kehadiran, membagikan tautan/QR code, dan memantau rekap tamu secara real-time tanpa perlu panel admin yang rumit.
* **Tamu (Pengguna Publik):** Mengakses undangan melalui perangkat *mobile*, mencari informasi acara, dan mengisi konfirmasi kehadiran dengan cepat tanpa perlu mendaftar akun.

## 3. User Stories & Acceptance Criteria

### Manajemen Otentikasi & Akun

* **User Story:** Sebagai Organizer, saya ingin mendaftar dan masuk ke dalam sistem menggunakan email agar saya dapat mengelola undangan saya secara aman.
* **Acceptance Criteria:**
* Endpoint `/auth/register` berhasil membuat akun dengan enkripsi *password* menggunakan bcrypt.
* Endpoint `/auth/login` mengembalikan JWT token yang valid.
* Gagal login memberikan pesan *error* generik ("Kredensial tidak valid") tanpa membocorkan status email.



### Pembuatan & Manajemen Undangan

* **User Story:** Sebagai Organizer, saya ingin membuat dan mengedit detail undangan beserta sesi acara, agar tamu mendapatkan informasi yang akurat.
* **Acceptance Criteria:**
* Form pembuatan mencakup: nama mempelai, tanggal, lokasi, cerita, URL cover, dan *slug* kustom.
* *Slug* divalidasi ketersediaannya (harus unik di seluruh sistem).
* Organizer dapat menambahkan 1-3 sesi (label, waktu mulai, waktu selesai) secara *inline*.
* Menghapus undangan akan menghapus sesi dan data RSVP yang terkait (*Cascade delete* atau proteksi).



### Pengisian RSVP (Sisi Publik)

* **User Story:** Sebagai Tamu, saya ingin melihat undangan dan mengisi kehadiran saya melalui *smartphone* dengan cepat.
* **Acceptance Criteria:**
* Halaman `/w/:slug` dirender sempurna di resolusi *mobile* (Mobile-first design).
* Form RSVP mewajibkan input: Nama, Status (Hadir/Tidak/Mungkin).
* Jika status = "Hadir", opsi *radio button* untuk memilih Sesi dan input Jumlah Tamu otomatis muncul dan bersifat wajib.
* Jika status = "Tidak" atau "Mungkin", *dropdown/radio* sesi tidak wajib atau disembunyikan, dan jumlah tamu diatur secara *default*.
* Tidak ada opsi untuk mengedit RSVP yang sudah disubmit.



### Dashboard & Pelaporan

* **User Story:** Sebagai Organizer, saya ingin melihat ringkasan RSVP per sesi agar bisa mempersiapkan konsumsi dan tempat dengan tepat.
* **Acceptance Criteria:**
* Dashboard menampilkan statistik: Total Tamu Hadir, Tidak Hadir, Mungkin.
* Menampilkan *breakdown* jumlah tamu berdasarkan sesi acara.
* Menyediakan tabel daftar tamu lengkap beserta ucapan yang diberikan.
* QR Code otomatis digenerate di UI berdasarkan link publik undangan.

---