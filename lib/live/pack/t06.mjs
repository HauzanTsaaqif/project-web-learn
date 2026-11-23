// Live 26 (tugas 06): sp_checkout rusak. Menulis struk lebih dulu, memotong stok tanpa validasi.
// Data tetap (tanpa variasi NIM). Signature: sp_checkout(p_kasir_id INT, p_metode_id INT, p_produk_id INT, p_qty INT).
const DB = "live_t06";

const PRODUK = [
  [1, "Kopi Susu", 18000, 30], [2, "Americano", 15000, 25], [3, "Latte", 22000, 20], [4, "Teh Tarik", 14000, 30],
  [5, "Roti Bakar", 16000, 15], [6, "Croissant", 20000, 12], [7, "Es Cokelat", 19000, 18], [8, "Air Mineral", 5000, 50],
];
const KASIR = [[1, "Rina"], [2, "Bagas"], [3, "Sari"]];
const METODE = [[1, "Tunai"], [2, "QRIS"], [3, "Debit"]];
const q = s => `'${String(s).replace(/'/g, "''")}'`;

// Prosedur RUSAK: tidak ada validasi, urutan tulis salah (struk dulu), stok bisa minus.
const PROC = `CREATE PROCEDURE sp_checkout(IN p_kasir_id INT, IN p_metode_id INT, IN p_produk_id INT, IN p_qty INT)
COMMENT 'Checkout 1 item: CALL sp_checkout(kasir_id, metode_bayar_id, produk_id, qty). Stok kurang atau qty <= 0 harus ditolak dengan SIGNAL SQLSTATE 45000 tanpa meninggalkan data apa pun.'
BEGIN
  DECLARE v_harga DECIMAL(12,2);
  DECLARE v_struk INT;
  SELECT harga INTO v_harga FROM produk WHERE id = p_produk_id;
  INSERT INTO struk (kasir_id, metode_bayar_id, waktu, total) VALUES (p_kasir_id, p_metode_id, NOW(), v_harga * p_qty);
  SET v_struk = LAST_INSERT_ID();
  INSERT INTO struk_item (struk_id, produk_id, qty, harga_satuan) VALUES (v_struk, p_produk_id, p_qty, v_harga);
  UPDATE produk SET stok = stok - p_qty WHERE id = p_produk_id;
  INSERT INTO stok_mutasi (produk_id, perubahan, jenis, ref_struk_id) VALUES (p_produk_id, -p_qty, 'jual', v_struk);
END`;

export function build() {
  const statements = [
    `DROP DATABASE IF EXISTS ${DB}`,
    `CREATE DATABASE ${DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    `USE ${DB}`,
    "CREATE TABLE kasir (id INT AUTO_INCREMENT PRIMARY KEY, nama VARCHAR(60) NOT NULL) ENGINE=InnoDB",
    "CREATE TABLE metode_bayar (id INT AUTO_INCREMENT PRIMARY KEY, nama VARCHAR(40) NOT NULL) ENGINE=InnoDB",
    "CREATE TABLE produk (id INT AUTO_INCREMENT PRIMARY KEY, nama VARCHAR(80) NOT NULL, harga DECIMAL(12,2) NOT NULL, stok INT NOT NULL DEFAULT 0) ENGINE=InnoDB",
    `CREATE TABLE struk (
  id INT AUTO_INCREMENT PRIMARY KEY, kasir_id INT NOT NULL, metode_bayar_id INT NOT NULL,
  waktu DATETIME NOT NULL, total DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_struk_kasir FOREIGN KEY (kasir_id) REFERENCES kasir (id),
  CONSTRAINT fk_struk_metode FOREIGN KEY (metode_bayar_id) REFERENCES metode_bayar (id)
) ENGINE=InnoDB`,
    `CREATE TABLE struk_item (
  id INT AUTO_INCREMENT PRIMARY KEY, struk_id INT NOT NULL, produk_id INT NOT NULL, qty INT NOT NULL, harga_satuan DECIMAL(12,2) NOT NULL,
  CONSTRAINT chk_item_qty CHECK (qty > 0),
  CONSTRAINT fk_item_struk FOREIGN KEY (struk_id) REFERENCES struk (id),
  CONSTRAINT fk_item_produk FOREIGN KEY (produk_id) REFERENCES produk (id)
) ENGINE=InnoDB`,
    `CREATE TABLE stok_mutasi (
  id INT AUTO_INCREMENT PRIMARY KEY, produk_id INT NOT NULL, perubahan INT NOT NULL, jenis VARCHAR(20) NOT NULL,
  ref_struk_id INT NULL, dicatat_pada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mutasi_produk FOREIGN KEY (produk_id) REFERENCES produk (id),
  CONSTRAINT fk_mutasi_struk FOREIGN KEY (ref_struk_id) REFERENCES struk (id)
) ENGINE=InnoDB`,
    `INSERT INTO kasir (id, nama) VALUES ${KASIR.map(([i, n]) => `(${i}, ${q(n)})`).join(", ")}`,
    `INSERT INTO metode_bayar (id, nama) VALUES ${METODE.map(([i, n]) => `(${i}, ${q(n)})`).join(", ")}`,
    `INSERT INTO produk (id, nama, harga, stok) VALUES ${PRODUK.map(([i, n, h, s]) => `(${i}, ${q(n)}, ${h}, ${s})`).join(", ")}`,
    PROC,
  ];
  // expect: data dasar yang tidak boleh berubah (stok sengaja tidak dihitung, boleh berubah lewat uji manual)
  return {
    db: DB, statements,
    expect: { kasir: KASIR.length, metode: METODE.length, produk: PRODUK.map(([i, n, h]) => [i, n, h]), uji: { kasir: 1, metode: 1, produk: 1 } },
  };
}
