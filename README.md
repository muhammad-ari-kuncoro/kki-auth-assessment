\# Fullstack Authentication System (Go \& PostgreSQL)



Aplikasi autentikasi berbasis web dengan backend Go, frontend React TypeScript, dan basis data PostgreSQL yang diorkestrasi menggunakan Docker Compose\[cite: 1]. Sistem ini dilengkapi pembatasan maksimal 2 sesi aktif per akun dan fitur kontrol sesi oleh admin\[cite: 1].



\---



\## 1. Gambaran Singkat \& Fitur



Aplikasi ini dibangun untuk kebutuhan autentikasi tim internal dengan pemisahan peran antara `user` dan `admin`\[cite: 1].



\### Fitur Utama:

\- \*\*Pendaftaran Akun:\*\* Registrasi menggunakan username, email, dan password terenkripsi\[cite: 1].

\- \*\*Autentikasi Fleksibel:\*\* Login menggunakan identifier (bisa email atau username) beserta kata sandi\[cite: 1].

\- \*\*Profil Pengguna:\*\* Proteksi akses halaman profil sesuai data sesi akun yang aktif\[cite: 1].

\- \*\*Dashboard Admin:\*\* Menampilkan daftar seluruh pengguna beserta jumlah sesi aktif\[cite: 1].

\- \*\*Manajemen Sesi Otomatis (Maksimal 2 Sesi):\*\* Setiap akun dibatasi maksimal 2 sesi aktif secara bersamaan; login ke-3 secara otomatis menonaktifkan sesi paling lama\[cite: 1].

\- \*\*Force Logout oleh Admin:\*\* Admin dapat mematikan seluruh sesi aktif milik pengguna lain secara instan\[cite: 1].

\- \*\*Fitur Tambahan:\*\* Status indikator sesi aktif secara real-time pada tabel dashboard admin, sanitasi input, dan penanganan status kedaluwarsa token\[cite: 1, 2].



\---



\## 2. Cara Menjalankan Aplikasi \& Masuk sebagai Admin Pertama



Aplikasi dijalankan sepenuhnya menggunakan Docker Compose tanpa langkah inisialisasi manual\[cite: 1, 2]:



```bash

git clone <tautan-repositori-anda>

cd <nama-repositori>

cp .env.example .env

docker compose up -d --build

```\[cite: 1]



\- \*\*Frontend:\*\* http://localhost:3000\[cite: 1]

\- \*\*Backend:\*\* http://localhost:8080\[cite: 1]



\### Kredensial Admin Pertama:

\- \*\*Username / Identifier:\*\* `admin`\[cite: 1, 2]

\- \*\*Password:\*\* `adminpassword`\[cite: 2]



> Migrasi tabel basis data dan akun admin pertama otomatis terpasang saat kontainer database PostgreSQL dijalankan via script di folder `migrations/`\[cite: 1, 2].



\---



\## 3. Daftar Endpoint



| Method | Endpoint | Akses | Deskripsi |

|---|---|---|---|

| GET | `/api/health` | Publik | Cek status server |

| POST | `/api/register` | Publik | Pendaftaran akun baru (`username`, `email`, `password`)\[cite: 1] |

| POST | `/api/login` | Publik | Masuk dengan email/username dan kata sandi\[cite: 1] |

| GET | `/api/profile` | Terautentikasi | Mengambil profil user yang sedang login\[cite: 1] |

| POST | `/api/logout` | Terautentikasi | Mengakhiri sesi pengguna saat ini\[cite: 1] |

| GET | `/api/admin/users` | Admin | Menampilkan daftar seluruh pengguna dan jumlah sesi\[cite: 1] |

| POST | `/api/admin/users/{id}/force-logout` | Admin | Mencabut seluruh sesi aktif user target\[cite: 1] |



\---



\## 4. Keputusan Teknis Penting



\- \*\*Stateful Session di Basis Data:\*\* Sesi tidak disimpan murni sebagai \*stateless\* JWT tanpa jejak, melainkan dipertahankan di tabel `sessions`. Keputusan ini diambil agar sistem dapat memantau jumlah perangkat aktif secara presisi, membatalkan sesi tertua, dan mendukung pencabutan token instan (\*force logout\*) oleh admin\[cite: 1].

\- \*\*Router Chi \& Native DB Driver:\*\* Menggunakan `go-chi/chi` karena performanya yang ringan, idiomatik, dan ramah \*standard library\* `net/http`, serta driver `lib/pq` untuk interaksi langsung dengan SQL tanpa beban overhead ORM.

\- \*\*Single Page Application (Vite + React TS):\*\* Memisahkan UI ke dalam arsitektur SPA yang di-\*serve\* lewat Nginx container di port 3000 agar build image ringan dan waktu deployment singkat\[cite: 1].



\---



\## 5. Penggunaan AI



\- \*\*Tools yang Digunakan:\*\* Gemini\[cite: 2]

\- \*\*Cakupan Penggunaan:\*\* 

&#x20; - Konsultasi perancangan skema relasional tabel database (`users` dan `sessions`)\[cite: 1].

&#x20; - Penyusunan \*boilerplate\* konfigurasi Docker Compose dan Dockerfile untuk multi-stage build Go dan Vite\[cite: 1].

&#x20; - Asistensi penulisan query SQL untuk penegakan batas 2 sesi aktif dan fungsi \*force logout\*\[cite: 1].



\---



\## 6. Jawaban Catatan Implementasi



1\. \*\*Bagaimana kata sandi disimpan dalam sistem Anda, dan mengapa Anda memilih cara tersebut?\*\*  

&#x20;  Kata sandi disimpan dalam bentuk nilai hash satu arah menggunakan algoritma Bcrypt (`golang.org/x/crypto/bcrypt`) dengan \*default cost\* 10 sebelum disimpan ke kolom `password\_hash`. Cara ini dipilih karena Bcrypt secara otomatis menyertakan \*salt\* acak untuk mencegah serangan \*rainbow table\* serta bersifat \*computationally expensive\* (memiliki \*work factor\*) yang dapat ditingkatkan secara fleksibel untuk memperlambat serangan \*brute force\*.\[cite: 2]



2\. \*\*Bagaimana sistem Anda mendefinisikan sebuah "sesi", dan pada berkas atau fungsi mana batas 2 sesi ditegakkan?\*\*  

&#x20;  Sebuah sesi didefinisikan sebagai satu rekaman data pada tabel `sessions` yang memiliki token kriptografi acak (32 bytes hex), metadata perangkat (`user\_agent`, `ip\_address`), waktu kedaluwarsa (`expires\_at`), serta status validitas (`is\_revoked`). Batas 2 sesi ditegakkan pada berkas `backend/main.go` di dalam fungsi `handleLogin`; fungsi tersebut mengambil seluruh sesi aktif milik pengguna secara urut waktu (`ORDER BY created\_at ASC`), dan jika jumlahnya mencapai 2 atau lebih, sesi tertua langsung diubah statusnya menjadi `is\_revoked = TRUE` sebelum token baru disimpan.\[cite: 1, 2]



3\. \*\*Apabila token atau sesi seorang pengguna dicuri, apa yang terjadi pada sistem Anda dan apa yang dapat dilakukan admin?\*\*  

&#x20;  Apabila token dicuri, penyerang dapat mengakses rute terproteksi selama token tersebut belum kedaluwarsa atau belum dicabut. Namun, karena setiap permintaan melewati middleware `authMiddleware` yang memverifikasi kolom `is\_revoked` langsung ke basis data, admin dapat segera melakukan \*force logout\* melalui endpoint `POST /api/admin/users/{id}/force-logout`, yang seketika mengubah seluruh sesi aktif pengguna tersebut menjadi `is\_revoked = TRUE`, sehingga token yang dicuri langsung tidak dapat digunakan lagi.\[cite: 1, 2]



4\. \*\*Sebutkan dua kekurangan atau celah yang Anda sadari masih terdapat pada hasil kerja Anda.\*\*  

&#x20;  Pertama, belum adanya mekanisme \*rate limiting\* pada endpoint `/api/login` dan `/api/register`, sehingga sistem masih rentan terhadap percobaan \*brute force\* atau \*denial-of-service\* (DoS). Kedua, penanganan pembersihan sesi usang (\*garbage collection\*) di basis data belum berjalan otomatis secara terjadwal (background worker), sehingga baris data sesi yang sudah \*expired\* atau \*revoked\* akan terus menumpuk di tabel `sessions`.\[cite: 2]



5\. \*\*Apabila diminta menambahkan fitur "pengguna dapat keluar dari seluruh perangkat sekaligus", bagian kode mana yang akan Anda ubah?\*\*  

&#x20;  Bagian kode yang akan diubah adalah menambahkan endpoint baru `POST /api/logout-all` atau memodifikasi fungsi `handleLogout` pada berkas `backend/main.go`. Query SQL pembatalan sesi akan diperbarui dari yang semula hanya mencabut token saat ini (`WHERE token = $1`) menjadi mencabut seluruh sesi milik pengguna yang sedang terautentikasi: `UPDATE sessions SET is\_revoked = TRUE WHERE user\_id = $1 AND is\_revoked = FALSE`.\[cite: 2]

