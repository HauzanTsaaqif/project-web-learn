// Metadata 10 tugas Live (kasus 21-30). Aman dipakai di client & server; TIDAK memuat nilai harapan/jawaban.
// Sengaja tidak dimasukkan ke CASES (bukan kasus biasa). Poin AKTUAL diambil dari backend (total_points/points); `points` di sini hanya bawaan.
export const LIVE_FIRST = 21, LIVE_LAST = 30;
export const liveNn = id => String(Number(id) - LIVE_FIRST + 1).padStart(2, "0");

export const LIVE_STORY = "Kedai Kopi Nusantara membuka cabang baru besok pagi. Kamu dipanggil sebagai konsultan database: sepuluh masalah harus beres sebelum kedai buka. Tiap tugas punya database sendiri di MySQL lokalmu (dibuat oleh npm run live:siapkan).";

export const LIVE_CASES = [
  {
    id: 21, n: 1, level: "Live", points: 100, icon: "database", title: "Harga yang Meleset",
    story: "Kasir melaporkan total harian tidak pernah pas sampai ke sen. Setelah diperiksa, kolom uang di tabel transaksi memakai tipe pecahan biner sehingga hasil penjumlahan melenceng.",
    reqs: ["Kolom uang memakai tipe DECIMAL dengan 2 angka di belakang koma", "Kolom tetap NOT NULL dan kolom lain tidak berubah", "Semua baris data masih ada dan jumlah total tetap sama (toleransi pembulatan 0,005)"],
    tips: ["Tingkat 1: cari kolom bertipe FLOAT atau DOUBLE pada tabel yang dipakai untuk uang.", "Tingkat 2: ALTER TABLE ... MODIFY mengganti definisi kolom secara utuh, bukan hanya tipenya.", "Tingkat 3: tulis ulang seluruh definisi kolom, termasuk NOT NULL, agar tidak ikut hilang."],
    hints: "short",
  },
  {
    id: 22, n: 2, level: "Live", points: 100, icon: "arrows", title: "Relasi yang Putus",
    story: "Seseorang pernah menghapus foreign key demi mempercepat impor data. Sekarang ada baris item yang menunjuk ke struk atau produk yang tidak ada.",
    reqs: ["Relasi FOREIGN KEY ke tabel struk dan ke tabel produk terpasang kembali", "Tidak ada baris yatim yang tersisa", "Baris yang valid tidak boleh hilang atau berubah", "Menyisipkan baris yatim baru harus ditolak database"],
    tips: ["Tingkat 1: temukan baris yatim dengan LEFT JOIN ... WHERE induk.id IS NULL.", "Tingkat 2: bersihkan yatimnya lebih dulu, baru pasang FOREIGN KEY; urutan terbalik akan gagal.", "Tingkat 3: jangan menambah baris induk palsu untuk menyiasati; hapus yang memang yatim saja."],
    hints: "short",
  },
  {
    id: 23, n: 3, level: "Live", points: 100, icon: "users", title: "Email Kembar",
    story: "Program loyalitas mengirim email dua kali ke sebagian pelanggan. Ternyata satu orang terdaftar lebih dari sekali dan tidak ada aturan yang mencegahnya.",
    reqs: ["Kolom email pelanggan dijamin unik oleh database (UNIQUE pada satu kolom)", "Tidak ada email ganda yang tersisa, termasuk yang hanya beda huruf besar/kecil", "Pelanggan yang sudah dipakai di struk tetap ada"],
    tips: ["Tingkat 1: kelompokkan dengan LOWER(email) untuk menemukan kembarannya.", "Tingkat 2: sebelum menghapus, periksa baris mana yang dipakai oleh struk.", "Tingkat 3: pertahankan baris yang dipakai struk; hapus kembarannya yang tidak terpakai, lalu pasang UNIQUE."],
    hints: "short",
  },
  {
    id: 24, n: 4, level: "Live", points: 100, icon: "chart", title: "Omzet Dobel",
    story: "Laporan omzet harian di dashboard pemilik terlalu besar. VIEW v_omzet_harian menggandakan total pada hari yang strukturnya punya banyak item.",
    reqs: ["VIEW v_omzet_harian menampilkan omzet per hari yang benar", "Hasilnya dihitung dari data, bukan angka yang ditulis tetap", "Bila ada struk baru, hasil VIEW ikut berubah"],
    tips: ["Tingkat 1: bandingkan SUM(total) tanpa join dengan hasil VIEW pada satu hari.", "Tingkat 2: join ke tabel yang berbaris banyak per struk akan melipatgandakan baris sebelum dijumlahkan.", "Tingkat 3: jumlahkan dari tabel yang tepat, atau agregasikan dulu sebelum join."],
    hints: "short",
  },
  {
    id: 25, n: 5, level: "Live", points: 100, icon: "receipttext", title: "Laporan Produk Bolong",
    story: "VIEW v_penjualan_produk dipakai untuk menentukan menu yang dipertahankan, tetapi angkanya salah dan beberapa produk tidak muncul.",
    reqs: ["Per produk: jumlah terjual (SUM qty) dan omzet dihitung benar", "Produk yang belum pernah terjual tetap tampil dengan nilai 0", "Hasil mengikuti perubahan data (dihitung, bukan ditulis tetap)"],
    tips: ["Tingkat 1: COUNT(*) menghitung baris, bukan jumlah barang.", "Tingkat 2: INNER JOIN membuang produk tanpa penjualan.", "Tingkat 3: mulai dari tabel produk, gunakan LEFT JOIN, dan bungkus agregat dengan COALESCE."],
    hints: "short",
  },
  {
    id: 26, n: 6, level: "Live", points: 100, icon: "zap", title: "Checkout Setengah Jadi",
    story: "Prosedur sp_checkout menulis struk dan item, lalu gagal di tengah jalan saat stok tidak cukup. Hasilnya struk yatim dan stok yang tidak konsisten.",
    reqs: ["Stok cukup: struk, item, dan pengurangan stok tercatat benar", "Stok kurang: prosedur melempar SIGNAL dan tidak meninggalkan sisa apa pun", "Stok tidak pernah menjadi negatif", "Tidak ada COMMIT atau START TRANSACTION di dalam prosedur"],
    tips: ["Tingkat 1: periksa kecukupan stok sebelum menulis apa pun.", "Tingkat 2: SIGNAL SQLSTATE '45000' menghentikan prosedur dengan pesan yang jelas.", "Tingkat 3: ingat aturan kasus 15: validasi dulu, baru tulis, dan jangan mengatur transaksi sendiri di dalam prosedur."],
    hints: "short",
  },
  {
    id: 27, n: 7, level: "Live", points: 100, icon: "shield", title: "Pencarian Berbahaya",
    story: "Fitur cari menu di aplikasi kedai merangkai kueri dari teks yang diketik pengguna. Seorang tamu iseng berhasil menampilkan seluruh tabel.",
    reqs: ["Route pencarian memakai kueri berparameter", "Payload injeksi umum (kutip, komentar, UNION, perintah berbahaya) tidak berhasil", "Pencarian normal tetap benar, termasuk nama yang mengandung apostrof", "Tabel dan datanya tetap utuh"],
    tips: ["Tingkat 1: lihat berkas route pencarian yang dibuat saat persiapan di app/api/latihan/live.", "Tingkat 2: menghapus tanda kutip dari input bukan solusi; nama berapostrof akan rusak.", "Tingkat 3: pakai placeholder ? dan kirim nilainya sebagai parameter. Jalankan npm run dev, atau build ulang bila memakai npm start."],
    hints: "short",
  },
  {
    id: 28, n: 8, level: "Live", points: 100, icon: "keyround", title: "Kasir Terlalu Sakti",
    story: "Akun database kasir_live dibuat tergesa-gesa dan diberi hak penuh atas seluruh server. Padahal kasir hanya perlu membaca, menambah, dan mengubah data kedai.",
    reqs: ["kasir_live hanya memegang SELECT, INSERT, dan UPDATE", "Hak itu hanya berlaku pada database tugas ini, bukan seluruh server", "Berlaku untuk akun di localhost maupun 127.0.0.1"],
    tips: ["Tingkat 1: lihat hak saat ini dengan SHOW GRANTS FOR 'kasir_live'@'localhost'.", "Tingkat 2: REVOKE ALL PRIVILEGES, GRANT OPTION lebih dulu, baru beri hak yang diperlukan.", "Tingkat 3: periksa kedua host (localhost dan 127.0.0.1); format keluaran MySQL dan MariaDB sedikit berbeda."],
    hints: "short",
  },
  {
    id: 29, n: 9, level: "Live", points: 100, icon: "gauge", title: "Laporan yang Lambat",
    story: "Laporan bulanan memeriksa puluhan ribu baris struk dan memakan waktu lama di jam sibuk. Pemilik meminta laporan itu dipercepat.",
    reqs: ["EXPLAIN untuk kueri laporan tidak lagi memakai pemindaian penuh (type ALL)", "Index yang dipakai adalah index komposit", "Kolom untuk pembanding kesamaan berada di depan index"],
    tips: ["Tingkat 1: jalankan EXPLAIN pada kueri laporan dan lihat kolom type serta key.", "Tingkat 2: urutan kolom index penting: kondisi kesamaan (=) di depan, rentang atau urutan di belakang.", "Tingkat 3: pengisian data cukup besar, jadi beri waktu saat persiapan dan saat membuat index."],
    hints: "short",
  },
  {
    id: 30, n: 10, level: "Live", points: 100, icon: "archive", title: "Pulihkan dari Cadangan",
    story: "Tabel struk dan struk_item terhapus tak sengaja. Untungnya ada berkas cadangan SQL. Pulihkan keduanya seperti semula.",
    reqs: ["Tabel struk dan struk_item ada kembali", "Jumlah baris dan isi datanya sama dengan semua tabel lain yang masih utuh", "Relasi FOREIGN KEY dan engine tabel pulih", "Tidak ada baris ganda akibat impor berulang"],
    tips: ["Tingkat 1: cari berkas cadangan di folder data/live pada project.", "Tingkat 2: impor cadangan ke database yang tepat; jangan sampai memulihkan ke database lain.", "Tingkat 3: mengimpor dua kali menggandakan baris. Bila ragu, hapus tabel yang setengah pulih lalu impor sekali dengan bersih."],
    hints: "short",
  },
];

export const liveCaseById = id => LIVE_CASES.find(c => c.id === Number(id));
