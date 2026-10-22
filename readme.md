# project-web-learn (DataQuest Lab)

Aplikasi latihan database berbasis **Next.js**. Mahasiswa membangun skema **MySQL lokal** (XAMPP atau Laragon) untuk menyelesaikan 5 kasus bertingkat. Aplikasi membaca skema dan data dari MySQL tersebut, menampilkan error yang nyata jika ada yang salah, dan menampilkan antarmuka "dunia kerja" saat kasus lolos. Setiap kasus yang lolos menambah poin ke leaderboard (`be-web-learn`), **sekali saja per kasus**.

## Daftar isi
1. [Prasyarat](#prasyarat)
2. [Quick start](#quick-start)
3. [Konfigurasi `.env.local`](#konfigurasi-envlocal)
4. [Mencari nilai koneksi MySQL](#mencari-nilai-koneksi-mysql)
5. [Membuat database & menyalin nama](#membuat-database--menyalin-nama)
6. [Menjalankan aplikasi](#menjalankan-aplikasi)
7. [Alur penggunaan](#alur-penggunaan)
8. [Daftar kasus](#daftar-kasus)
9. [Arsitektur & keamanan](#arsitektur--keamanan)
10. [Troubleshooting](#troubleshooting)
11. [Struktur proyek](#struktur-proyek)

## Prasyarat

| Kebutuhan | Versi / keterangan |
|---|---|
| Node.js | 20.9 atau lebih baru (disarankan LTS terbaru) |
| Git | untuk `git clone` |
| MySQL lokal | XAMPP atau Laragon, service MySQL **berjalan** |
| Backend leaderboard | alamat `BE_API_URL` dan `SERVICE_KEY` dari pemateri |

## Quick start

```bash
git clone https://github.com/HauzanTsaaqif/project-web-learn.git
cd project-web-learn

# Windows (CMD/PowerShell)
copy .env.example .env.local
# macOS / Linux
# cp .env.example .env.local

# isi .env.local (lihat bagian berikutnya), lalu:
npm install
npm run build
npm start        # http://localhost:3001
```

| Perintah | Fungsi |
|---|---|
| `npm install` | Mengunduh dependensi sesuai `package.json` ke `node_modules`. |
| `npm run build` | Mengompilasi dan mengoptimalkan aplikasi untuk produksi; kesalahan konfigurasi biasanya ketahuan di sini. |
| `npm start` | Menjalankan server produksi di port **3001** (port 3000 dipakai backend). |
| `npm run dev` | Mode pengembangan dengan hot reload (port 3001). |

> Setiap kali `.env.local` diubah, hentikan server (`Ctrl+C`) lalu jalankan ulang `npm run build` dan `npm start`. Nilai environment dibaca saat build/start.

## Konfigurasi `.env.local`

```dotenv
# --- MySQL lokal ---
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=latihan_retail

# --- Backend leaderboard (diberikan pemateri) ---
BE_API_URL=http://localhost:3000/api
SERVICE_KEY=isi-sesuai-backend
```

| Variabel | Wajib | Keterangan | Nilai umum |
|---|---|---|---|
| `DB_HOST` | ya | Alamat server MySQL | `127.0.0.1` (gunakan IP ini, bukan `localhost`, untuk menghindari masalah IPv6) |
| `DB_PORT` | ya | Port MySQL | `3306` (XAMPP & Laragon) |
| `DB_USER` | ya | User MySQL | `root` |
| `DB_PASSWORD` | tidak | Password user | kosong pada instalasi bawaan |
| `DB_NAME` | ya | Nama database yang kamu buat | mis. `latihan_retail` |
| `BE_API_URL` | ya | URL API backend, **diakhiri `/api`** | dari pemateri |
| `SERVICE_KEY` | ya | Kunci rahasia klaim poin; harus identik dengan yang ada di backend | dari pemateri |

Catatan penulisan:
- Tidak perlu tanda kutip. Jika password mengandung `#` atau spasi, bungkus dengan tanda kutip ganda: `DB_PASSWORD="pa ss#word"`.
- `.env.local` sudah masuk `.gitignore`. **Jangan** membagikan atau meng-commit file ini.

## Mencari nilai koneksi MySQL

### XAMPP

1. Buka **XAMPP Control Panel**, klik **Start** pada modul **MySQL** hingga berwarna hijau.
2. **Port (`DB_PORT`)**: lihat kolom **Port(s)** pada baris MySQL (bawaan `3306`). Alternatif: klik **Config → my.ini** dan cari `port=3306` pada bagian `[mysqld]`. File ada di `C:\xampp\mysql\bin\my.ini`.
3. **User & password (`DB_USER`, `DB_PASSWORD`)**: bawaan XAMPP adalah user `root` dengan password **kosong**. Untuk memastikan, buka `http://localhost/phpmyadmin` (modul Apache harus Start) → tab **User accounts**; kolom *Password* bernilai **No** berarti kosong. Konfigurasi phpMyAdmin juga ada di `C:\xampp\phpMyAdmin\config.inc.php` (`$cfg['Servers'][$i]['user']` dan `['password']`).
4. **Host (`DB_HOST`)**: `127.0.0.1`.

### Laragon

1. Buka **Laragon**, klik **Start All**; pastikan MySQL aktif.
2. **Port (`DB_PORT`)**: klik ikon roda gigi (**Preferences**) → tab **Services & Ports** → bagian MySQL (bawaan `3306`). Alternatif: klik kanan ikon Laragon di system tray → **MySQL → my.ini** (file berada di `C:\laragon\bin\mysql\mysql-x.x\my.ini`).
3. **Host, user, password**: klik tombol **Database** (membuka **HeidiSQL**). Jendela **Session manager** menampilkan **Hostname / IP**, **User**, **Password**, dan **Port** dari koneksi bawaan, umumnya `127.0.0.1`, `root`, kosong, `3306`.

### Verifikasi lewat terminal (opsional)

```bash
mysql -h 127.0.0.1 -P 3306 -u root -p
```
```sql
SELECT @@port AS port, CURRENT_USER() AS user;
SHOW DATABASES;
```

> Jika XAMPP dan Laragon aktif bersamaan, salah satunya dapat memakai port berbeda (mis. `3307`). Selalu gunakan nilai yang tampil di aplikasinya.

## Membuat database & menyalin nama

Cukup membuat **database kosong**; semua tabel kamu buat sendiri saat mengerjakan kasus.

**phpMyAdmin (XAMPP)**
1. Buka `http://localhost/phpmyadmin`.
2. Klik **New** di sidebar kiri.
3. Isi *Database name* (mis. `latihan_retail`), pilih collation `utf8mb4_unicode_ci`, klik **Create**.
4. Salin nama yang muncul di sidebar kiri **persis** ke `DB_NAME`.

**HeidiSQL (Laragon)**
1. Klik **Database** di Laragon, lalu **Open** sesi bawaan.
2. Klik kanan nama koneksi → **Create new → Database**.
3. Isi *Name* dan *Collation* `utf8mb4_unicode_ci`, klik **OK**. Salin namanya ke `DB_NAME`.

**Lewat SQL (klien apa pun)**
```sql
CREATE DATABASE latihan_retail
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Gunakan huruf kecil dan `snake_case`. Nama database bersifat *case-sensitive* di Linux/macOS.

## Menjalankan aplikasi

Setelah `npm start` berjalan, buka **http://localhost:3001**. Biarkan terminal tetap terbuka selama mengerjakan.

## Alur penggunaan

1. Buka **/register**, cari **nama atau NIM** pada dropdown (daftar berasal dari master data backend), buat password (min. 8 karakter) dan konfirmasinya. Akun dibuat dengan **0 poin** dan kamu langsung masuk.
2. Dari **Dashboard**, buka Kasus 1 lalu tekan **Jalankan pengecekan**.
3. Baca daftar masalah yang tampil (tabel/kolom hilang, tipe data salah, relasi kurang, dsb.), perbaiki di phpMyAdmin/HeidiSQL, lalu **Cek ulang**.
4. Jika lolos, antarmuka hasil muncul dan poin ditambahkan otomatis. Mengulang kasus yang sudah selesai **tidak** menambah poin (ditampilkan lewat notifikasi).

## Daftar kasus

| # | Level | Poin | Fokus | Petunjuk |
|---|---|---|---|---|
| 1 | Pemula | 100 | Satu tabel `produk` | ERD + SQL awal |
| 2 | Dasar | 150 | Relasi 1-N `kategori` → `produk` (FOREIGN KEY) | ERD |
| 3 | Menengah | 200 | `pelanggan` & `transaksi`, UNIQUE, LEFT JOIN | sketsa relasi |
| 4 | Lanjutan | 250 | Relasi N-M `detail_pesanan`, composite PRIMARY KEY | tips singkat |
| 5 | Mahir | 300 | VIEW `v_laporan_penjualan`, INDEX, konsistensi data | tanpa petunjuk |

Total maksimum: **1000 poin**. Masing-masing kasus memvalidasi nama tabel/kolom, tipe data, PRIMARY/FOREIGN KEY, UNIQUE, INDEX, serta kelayakan data.

## Arsitektur & keamanan

```
Browser ──► Next.js (route handlers) ──► MySQL lokal (verifikasi skema & data)
                    │
                    └──► be-web-learn (auth, leaderboard, klaim poin)
```

- **Verifikasi di server**: pengecekan dilakukan oleh route handler Next.js terhadap MySQL lokal; browser tidak pernah mengirim "hasil lolos".
- **Klaim poin server-ke-server**: poin hanya dapat ditambah lewat `POST /api/cases/:id/claim` di backend dengan header `x-service-key` (`SERVICE_KEY`) **dan** token pemain. Browser tidak memiliki kunci tersebut.
- **Anti poin ganda**: backend menyimpan `UNIQUE(player_id, case_id)` dalam transaksi database sehingga klik ganda atau request paralel tetap hanya memberi poin sekali.
- **Sesi**: token disimpan di cookie `httpOnly` (tidak dapat dibaca JavaScript).
- **Proteksi tambahan**: validasi `Origin` untuk aksi yang mengubah state dan pembatasan 1 pengecekan per 1,2 detik per pengguna.

Batasan: karena pengecekan memakai database di laptop masing-masing, sistem ini mencegah penambahan poin sembarangan tetapi tidak dirancang menghadapi peserta yang sengaja memodifikasi kode aplikasi.

## Troubleshooting

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| `CONNECTION: MySQL tidak menyala` (`ECONNREFUSED`) | MySQL belum Start, atau port salah | Start MySQL di XAMPP/Laragon; cocokkan `DB_PORT`. |
| `ER_ACCESS_DENIED_ERROR` | User/password salah | Cek User accounts (phpMyAdmin) atau Session manager (HeidiSQL); isi `DB_PASSWORD` bila ada. |
| `ER_BAD_DB_ERROR` / "Database belum dibuat" | `DB_NAME` tidak cocok atau database belum ada | Buat database dan salin namanya persis. |
| `DB_NAME belum diisi` | `.env.local` belum dibuat/terisi | Salin `.env.example` → `.env.local`, isi, lalu build ulang. |
| Perubahan `.env.local` tidak terbaca | Nilai env dibaca saat build/start | `Ctrl+C`, `npm run build`, `npm start`. |
| Dropdown nama kosong / "Gagal memuat mahasiswa" | `BE_API_URL` salah atau backend tidak terjangkau | Pastikan URL diakhiri `/api` dan dapat dibuka dari browser. |
| Notifikasi "Poin belum tersimpan" (403) | `SERVICE_KEY` tidak sama dengan backend | Gunakan kunci yang diberikan pemateri. |
| `EADDRINUSE` port 3001 | Port dipakai proses lain | Hentikan proses tersebut atau ubah port pada script `start` di `package.json`. |
| Sudah login tetapi kembali ke halaman login | Sesi berakhir | Login ulang dengan NIM dan password. |

## Struktur proyek

```
app/                  halaman (login, register, dashboard, case/[id]) + route handlers (/api/*)
components/           komponen UI (Combobox, Toast, AuthForm, CaseClient, views hasil)
lib/cases.js          metadata & brief kasus (aman dipakai di client)
lib/checker.js        validator skema + pengambil data per kasus (server only)
lib/be.js             klien API backend + helper cookie/Origin (server only)
.env.example          templat konfigurasi
```
