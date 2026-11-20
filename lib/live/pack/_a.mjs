// Pembantu bersama paket soal 1-5 (Kedai Kopi). ESM murni, tanpa import Next.
import { mulberry32 } from "./rng.mjs";

// ---------- CRC32 (sama dengan CRC32() MySQL/MariaDB) ----------
const TBL = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
export function crc32(str) {
  let c = 0xffffffff; const b = new TextEncoder().encode(str);
  for (let i = 0; i < b.length; i++) c = TBL[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
// Representasi baris seperti IFNULL(CAST(kolom AS CHAR),'~') digabung '|' (lihat common.checksum)
export const rowKey = vals => vals.map(v => (v == null ? "~" : String(v))).join("|");
export const sumCs = rows => ({ n: rows.length, c: String(rows.reduce((a, r) => a + crc32(rowKey(r)), 0)) });
export const f2 = x => Number(x).toFixed(2);
// entri expect.cs: pernyataan "tabel ini harus persis sama dengan kondisi awal"
export const cs = (table, cols, rows, where) => ({ table, cols, ...(where ? { where } : {}), ...sumCs(rows) });

// ---------- Acak tetap (soal tanpa variasi NIM) ----------
export function fixedRng(seed) {
  const rand = mulberry32(seed);
  return { rand, randInt: (a, b) => a + Math.floor(rand() * (b - a + 1)), pick: arr => arr[Math.floor(rand() * arr.length)] };
}
export function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- Tanggal ----------
const p2 = n => String(n).padStart(2, "0");
export function ymd(base, k) { // base = [y, m, d]
  const d = new Date(Date.UTC(base[0], base[1] - 1, base[2] + k));
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}
export const hms = (h, m, s) => `${p2(h)}:${p2(m)}:${p2(s)}`;

// ---------- SQL ----------
export const lit = v => (v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`);
export const head = db => [
  `DROP DATABASE IF EXISTS \`${db}\``,
  `CREATE DATABASE \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `USE \`${db}\``,
];
export function inserts(table, cols, rows, size = 100) {
  const out = [];
  for (let i = 0; i < rows.length; i += size)
    out.push(`INSERT INTO ${table} (${cols.join(", ")}) VALUES ${rows.slice(i, i + size).map(r => `(${r.map(lit).join(", ")})`).join(", ")}`);
  return out;
}

export const DDL = {
  kategori: "CREATE TABLE kategori (id INT NOT NULL AUTO_INCREMENT, nama VARCHAR(60) NOT NULL, PRIMARY KEY (id)) ENGINE=InnoDB",
  produk: (harga = "DECIMAL(12,2)") => `CREATE TABLE produk (id INT NOT NULL AUTO_INCREMENT, nama VARCHAR(100) NOT NULL, harga ${harga} NOT NULL, stok INT NOT NULL DEFAULT 0, kategori_id INT NULL, PRIMARY KEY (id), CONSTRAINT fk_produk_kategori FOREIGN KEY (kategori_id) REFERENCES kategori (id)) ENGINE=InnoDB`,
  kasir: "CREATE TABLE kasir (id INT NOT NULL AUTO_INCREMENT, username VARCHAR(40) NOT NULL, nama VARCHAR(100) NOT NULL, role ENUM('admin','kasir') NOT NULL DEFAULT 'kasir', aktif TINYINT(1) NOT NULL DEFAULT 1, dibuat_pada DATETIME NOT NULL, PRIMARY KEY (id), UNIQUE KEY uq_kasir_username (username)) ENGINE=InnoDB",
  metode_bayar: "CREATE TABLE metode_bayar (id INT NOT NULL AUTO_INCREMENT, nama VARCHAR(40) NOT NULL, PRIMARY KEY (id), UNIQUE KEY uq_metode_nama (nama)) ENGINE=InnoDB",
  struk: ({ pelanggan = false } = {}) => `CREATE TABLE struk (id INT NOT NULL AUTO_INCREMENT, nomor VARCHAR(20) NOT NULL, kasir_id INT NOT NULL, metode_bayar_id INT NOT NULL, ${pelanggan ? "pelanggan_id INT NULL, " : ""}waktu DATETIME NOT NULL, total DECIMAL(12,2) NOT NULL DEFAULT 0, PRIMARY KEY (id), UNIQUE KEY uq_struk_nomor (nomor), CONSTRAINT fk_struk_kasir FOREIGN KEY (kasir_id) REFERENCES kasir (id), CONSTRAINT fk_struk_metode FOREIGN KEY (metode_bayar_id) REFERENCES metode_bayar (id)${pelanggan ? ", CONSTRAINT fk_struk_pelanggan FOREIGN KEY (pelanggan_id) REFERENCES pelanggan (id)" : ""}) ENGINE=InnoDB`,
  struk_item: ({ harga = "DECIMAL(12,2)", fk = true } = {}) => `CREATE TABLE struk_item (struk_id INT NOT NULL, produk_id INT NOT NULL, qty INT NOT NULL, harga_satuan ${harga} NOT NULL, PRIMARY KEY (struk_id, produk_id)${fk ? ", CONSTRAINT fk_item_struk FOREIGN KEY (struk_id) REFERENCES struk (id), CONSTRAINT fk_item_produk FOREIGN KEY (produk_id) REFERENCES produk (id)" : ""}) ENGINE=InnoDB`,
};

// ---------- Data dasar Kedai Kopi ----------
export const KATEGORI = [[1, "Kopi"], [2, "Non-Kopi"], [3, "Makanan"]];
export const KASIR = [
  [1, "admin", "Admin Kedai", "admin", 1, "2026-01-05 08:00:00"],
  [2, "sari", "Sari Wulandari", "kasir", 1, "2026-01-05 08:05:00"],
  [3, "budi", "Budi Santoso", "kasir", 1, "2026-01-06 09:00:00"],
  [4, "dewi", "Dewi Lestari", "kasir", 1, "2026-01-06 09:10:00"],
];
export const METODE = [[1, "Tunai"], [2, "QRIS"], [3, "Kartu Debit"]];
export const CAT_COLS = { kategori: ["id", "nama"], kasir: ["id", "username", "nama", "role", "aktif", "dibuat_pada"], metode_bayar: ["id", "nama"] };
// [nama, kategori_id, harga dasar]; nama unik
export const CATALOG = [
  ["Espresso", 1, 18000], ["Americano", 1, 20000], ["Latte", 1, 28000], ["Cappuccino", 1, 27000],
  ["Kopi Susu Gula Aren", 1, 25000], ["V60 Manual Brew", 1, 30000], ["Teh Tarik", 2, 18000], ["Matcha Latte", 2, 29000],
  ["Cokelat Panas", 2, 24000], ["Lemon Tea", 2, 16000], ["Croissant", 3, 22000], ["Roti Bakar", 3, 20000],
  ["Pisang Goreng", 3, 15000], ["Nasi Goreng Kedai", 3, 32000],
];
// cs untuk tabel kecil yang tak pernah disentuh soal
export const baseCs = () => ({
  kategori: cs("kategori", CAT_COLS.kategori, KATEGORI),
  kasir: cs("kasir", CAT_COLS.kasir, KASIR),
  metode_bayar: cs("metode_bayar", CAT_COLS.metode_bayar, METODE),
});
export const baseInserts = () => [
  ...inserts("kategori", CAT_COLS.kategori, KATEGORI),
  ...inserts("kasir", CAT_COLS.kasir, KASIR),
  ...inserts("metode_bayar", CAT_COLS.metode_bayar, METODE),
];

// Bangkitkan struk + item. produk = [{ id, harga }]; days = ['YYYY-MM-DD'].
// Mengembalikan { struk: [{ id, nomor, kasir_id, metode_bayar_id, waktu, total, items: [{ produk_id, qty, harga }] }] }
export function genStruk({ rand, randInt }, { produk, days, perDay, maxItems = 3, maxQty = 4, promo = 0.1, promoCut = 500, startId = 1, prefix = "KK" }) {
  const struk = []; let id = startId;
  for (const day of days) {
    const n = randInt(perDay[0], perDay[1]);
    for (let i = 0; i < n; i++) {
      const k = randInt(1, maxItems), items = shuffle(produk, rand).slice(0, k).map(p => ({
        produk_id: p.id, qty: randInt(1, maxQty), harga: rand() < promo ? p.harga - promoCut : p.harga,
      }));
      items.sort((a, b) => a.produk_id - b.produk_id);
      const total = items.reduce((a, x) => a + x.qty * x.harga, 0);
      struk.push({ id, nomor: `${prefix}-${String(id).padStart(4, "0")}`, kasir_id: randInt(1, 4), metode_bayar_id: randInt(1, 3), waktu: `${day} ${hms(randInt(8, 21), randInt(0, 59), randInt(0, 59))}`, total, items });
      id++;
    }
  }
  return { struk };
}
