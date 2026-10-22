// Metadata kasus (aman dipakai di client & server; tidak ada rahasia di sini)
export const CASES = [
  {
    id: 1, level: "Pemula", points: 100, title: "Katalog Produk", icon: "package",
    story: "Toko online baru butuh halaman katalog. Tim frontend sudah siap, tetapi tabel produk belum ada di database lokal. Buat tabelnya agar katalog tampil.",
    reqs: ["Database lokal (XAMPP / Laragon) sudah menyala dan terhubung lewat .env.local", "Tabel produk dengan kolom id, nama, harga, stok", "Minimal 3 baris data produk dengan harga > 0"],
    tips: ["Buka phpMyAdmin, buat database (nama sesuai DB_NAME di .env.local).", "Gunakan id sebagai PRIMARY KEY AUTO_INCREMENT.", "Simpan harga sebagai DECIMAL agar presisi, bukan FLOAT atau teks."],
    erd: [{ name: "produk", cols: [["id", "INT", "PK, AUTO_INCREMENT"], ["nama", "VARCHAR(100)", ""], ["harga", "DECIMAL(12,2)", ""], ["stok", "INT", ""]] }],
    starter: "CREATE TABLE produk (\n  id    INT PRIMARY KEY AUTO_INCREMENT,\n  nama  VARCHAR(100) NOT NULL,\n  harga DECIMAL(12,2) NOT NULL,\n  stok  INT NOT NULL DEFAULT 0\n);\n\nINSERT INTO produk (nama, harga, stok) VALUES\n  ('Kopi Arabika 250g', 85000, 40),\n  ('Teh Melati 100g', 32000, 75),\n  ('Gula Aren 500g', 28000, 60);",
    hints: "full",
  },
  {
    id: 2, level: "Dasar", points: 150, title: "Kategori & Produk", icon: "layers",
    story: "Katalog kini harus dikelompokkan per kategori. Satu kategori memiliki banyak produk (relasi 1-N). Hubungkan kedua tabel dengan benar.",
    reqs: ["Tabel kategori (id, nama)", "Tabel produk ditambah kolom kategori_id sebagai FOREIGN KEY ke kategori.id", "Minimal 2 kategori dan 4 produk, semua produk punya kategori"],
    tips: ["Buat kategori dulu, baru produk, agar FOREIGN KEY bisa dibuat.", "Gunakan engine InnoDB (bawaan) supaya FOREIGN KEY didukung."],
    erd: [{ name: "kategori", cols: [["id", "INT", "PK"], ["nama", "VARCHAR", ""]] }, { name: "produk", cols: [["id", "INT", "PK"], ["nama", "VARCHAR", ""], ["harga", "DECIMAL", ""], ["stok", "INT", ""], ["kategori_id", "INT", "FK → kategori.id"]] }],
    hints: "full",
  },
  {
    id: 3, level: "Menengah", points: 200, title: "Pelanggan & Transaksi", icon: "users",
    story: "Tim marketing ingin tahu siapa pelanggan paling aktif dan siapa yang belum pernah belanja. Kamu perlu membangun data pelanggan dan transaksinya.",
    reqs: ["Tabel pelanggan (id, nama, email unik)", "Tabel transaksi (id, pelanggan_id, total, dibuat_pada) dengan FOREIGN KEY", "Minimal 3 pelanggan dan 3 transaksi, ada pelanggan yang belum pernah bertransaksi"],
    tips: ["Email pelanggan tidak boleh kembar.", "Pelanggan tanpa transaksi akan terlihat jelas dengan LEFT JOIN."],
    erd: [{ name: "pelanggan", cols: null }, { name: "transaksi", cols: null }],
    hints: "short",
  },
  {
    id: 4, level: "Lanjutan", points: 250, title: "Detail Pesanan", icon: "receipt",
    story: "Sebuah pesanan bisa berisi banyak produk, dan produk bisa muncul di banyak pesanan (N-M). Rancang tabel penghubungnya agar faktur dapat dicetak.",
    reqs: ["Tabel pelanggan dan produk sudah ada", "Tabel pesanan (id, pelanggan_id, tanggal, status)", "Tabel penghubung detail_pesanan (pesanan_id, produk_id, qty, harga_satuan) dengan PRIMARY KEY gabungan", "Minimal 1 pesanan dengan 2 item atau lebih"],
    tips: ["Tabel penghubung biasanya memakai composite primary key.", "Simpan harga_satuan saat transaksi: harga produk bisa berubah di masa depan."],
    hints: "short",
  },
  {
    id: 5, level: "Mahir", points: 300, title: "Laporan Penjualan", icon: "chart",
    story: "Direksi meminta dashboard penjualan bulanan per kategori. Di industri, laporan seperti ini dibuat lewat VIEW agar query rumit tersimpan rapi dan cepat dipakai ulang.",
    reqs: ["Seluruh tabel dari kasus 1-4 (termasuk kategori) lengkap dan berelasi", "INDEX pada pesanan.tanggal untuk mempercepat filter periode", "VIEW v_laporan_penjualan dengan kolom: bulan, kategori, jumlah_pesanan, total_penjualan", "Angka di VIEW harus cocok dengan perhitungan dari tabel dasar"],
    tips: [],
    hints: "none",
  },
];
export const caseById = id => CASES.find(c => c.id === Number(id));
