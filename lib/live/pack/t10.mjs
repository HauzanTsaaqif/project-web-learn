// Live 30 (tugas 10): pulihkan struk dan struk_item dari data/live/t10_backup.sql ke live_t10.
// live_t10 hanya berisi tabel master. expect memuat jumlah baris dan checksum tiap tabel, dihitung di JS dengan
// rumus sama seperti SUM(CRC32(CONCAT(IFNULL(CAST(kolom AS CHAR),'~') dipisah '|'))) di lib/live/common.js (checksum).
const DB = "live_t10";

const KASIR = [[1, "Rina"], [2, "Bagas"], [3, "Sari"], [4, "Dimas"]];
const METODE = [[1, "Tunai"], [2, "QRIS"], [3, "Debit"]];
const PRODUK = [
  [1, "Kopi Susu", 18000, 30], [2, "Americano", 15000, 25], [3, "Latte", 22000, 20], [4, "Teh Tarik", 14000, 30],
  [5, "Roti Bakar", 16000, 15], [6, "Croissant", 20000, 12], [7, "Es Cokelat", 19000, 18], [8, "Air Mineral", 5000, 50],
];

const TBL = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = s => { let c = -1; for (const b of Buffer.from(s, "utf8")) c = TBL[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const sig = rows => ({ n: rows.length, c: String(rows.reduce((a, r) => a + crc32(r.map(v => (v == null ? "~" : String(v))).join("|")), 0)) });
const dec = n => Number(n).toFixed(2); // CAST(DECIMAL(12,2) AS CHAR)
const pad = n => String(n).padStart(2, "0");
const dt = ms => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`; };
const q = s => `'${String(s).replace(/'/g, "''")}'`;
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

export function build({ randInt }) {
  const t0 = Date.parse("2026-01-05T08:00:00Z"), struk = [], item = [];
  const ns = randInt(120, 160);
  let t = t0;
  for (let id = 1; id <= ns; id++) {
    t += randInt(3, 90) * 60000;
    const k = randInt(1, KASIR.length), m = randInt(1, METODE.length), jml = randInt(1, 3), used = new Set();
    let total = 0;
    for (let j = 0; j < jml; j++) {
      let p; do { p = randInt(1, PRODUK.length); } while (used.has(p)); used.add(p);
      const qty = randInt(1, 4), h = PRODUK[p - 1][2];
      item.push([id, p, qty, h]); total += qty * h;
    }
    struk.push([id, k, m, dt(t), total]);
  }
  const strukS = struk.map(r => [r[0], r[1], r[2], r[3], dec(r[4])]);
  const itemS = item.map(r => [r[0], r[1], r[2], dec(r[3])]);

  const dump = [
    "-- DataQuest Live 30: backup tabel struk dan struk_item (Kedai Kopi).",
    "-- Impor ke database live_t10 (phpMyAdmin: pilih live_t10 -> Impor, atau: mysql -u root live_t10 < t10_backup.sql).",
    "SET NAMES utf8mb4;",
    "",
    "CREATE TABLE `struk` (",
    "  `id` int(11) NOT NULL AUTO_INCREMENT,",
    "  `kasir_id` int(11) NOT NULL,",
    "  `metode_bayar_id` int(11) NOT NULL,",
    "  `waktu` datetime NOT NULL,",
    "  `total` decimal(12,2) NOT NULL,",
    "  PRIMARY KEY (`id`),",
    "  KEY `fk_struk_kasir` (`kasir_id`),",
    "  KEY `fk_struk_metode` (`metode_bayar_id`),",
    "  CONSTRAINT `fk_struk_kasir` FOREIGN KEY (`kasir_id`) REFERENCES `kasir` (`id`),",
    "  CONSTRAINT `fk_struk_metode` FOREIGN KEY (`metode_bayar_id`) REFERENCES `metode_bayar` (`id`)",
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;",
    "",
    ...chunk(strukS, 50).map(c => `INSERT INTO \`struk\` (\`id\`, \`kasir_id\`, \`metode_bayar_id\`, \`waktu\`, \`total\`) VALUES\n${c.map(r => `(${r[0]}, ${r[1]}, ${r[2]}, ${q(r[3])}, ${r[4]})`).join(",\n")};`),
    "",
    "CREATE TABLE `struk_item` (",
    "  `struk_id` int(11) NOT NULL,",
    "  `produk_id` int(11) NOT NULL,",
    "  `qty` int(11) NOT NULL,",
    "  `harga_satuan` decimal(12,2) NOT NULL,",
    "  PRIMARY KEY (`struk_id`,`produk_id`),",
    "  KEY `fk_item_produk` (`produk_id`),",
    "  CONSTRAINT `fk_item_struk` FOREIGN KEY (`struk_id`) REFERENCES `struk` (`id`),",
    "  CONSTRAINT `fk_item_produk` FOREIGN KEY (`produk_id`) REFERENCES `produk` (`id`)",
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;",
    "",
    ...chunk(itemS, 100).map(c => `INSERT INTO \`struk_item\` (\`struk_id\`, \`produk_id\`, \`qty\`, \`harga_satuan\`) VALUES\n${c.map(r => `(${r[0]}, ${r[1]}, ${r[2]}, ${r[3]})`).join(",\n")};`),
    "",
  ].join("\n");

  const statements = [
    `DROP DATABASE IF EXISTS ${DB}`,
    `CREATE DATABASE ${DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    `USE ${DB}`,
    "CREATE TABLE kasir (id INT AUTO_INCREMENT PRIMARY KEY, nama VARCHAR(60) NOT NULL) ENGINE=InnoDB",
    "CREATE TABLE metode_bayar (id INT AUTO_INCREMENT PRIMARY KEY, nama VARCHAR(40) NOT NULL) ENGINE=InnoDB",
    "CREATE TABLE produk (id INT AUTO_INCREMENT PRIMARY KEY, nama VARCHAR(80) NOT NULL, harga DECIMAL(12,2) NOT NULL, stok INT NOT NULL DEFAULT 0) ENGINE=InnoDB",
    `INSERT INTO kasir (id, nama) VALUES ${KASIR.map(([i, n]) => `(${i}, ${q(n)})`).join(", ")}`,
    `INSERT INTO metode_bayar (id, nama) VALUES ${METODE.map(([i, n]) => `(${i}, ${q(n)})`).join(", ")}`,
    `INSERT INTO produk (id, nama, harga, stok) VALUES ${PRODUK.map(([i, n, h, s]) => `(${i}, ${q(n)}, ${h}, ${s})`).join(", ")}`,
  ];

  const expect = {
    // tabel: { cols (urutan checksum), n, c, pulih: perlu dipulihkan }
    tabel: {
      kasir: { cols: ["id", "nama"], ...sig(KASIR), pulih: false },
      metode_bayar: { cols: ["id", "nama"], ...sig(METODE), pulih: false },
      produk: { cols: ["id", "nama", "harga", "stok"], ...sig(PRODUK.map(([i, n, h, s]) => [i, n, dec(h), s])), pulih: false },
      struk: { cols: ["id", "kasir_id", "metode_bayar_id", "waktu", "total"], ...sig(strukS), pulih: true },
      struk_item: { cols: ["struk_id", "produk_id", "qty", "harga_satuan"], ...sig(itemS), pulih: true },
    },
    fk: [["struk", "kasir_id", "kasir"], ["struk", "metode_bayar_id", "metode_bayar"], ["struk_item", "struk_id", "struk"], ["struk_item", "produk_id", "produk"]],
  };
  return { db: DB, statements, expect, files: [{ path: "data/live/t10_backup.sql", content: dump }] };
}
