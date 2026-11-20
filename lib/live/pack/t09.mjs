// Live 29 (tugas 09): laporan lambat. live_t09.struk berisi 50.000 baris (tanpa index selain PK).
// Variasi per NIM: kolom kesamaan (kasir_id atau cabang_id), isi data, nilai dan rentang waktu laporan.
// Pengisian: SATU `INSERT ... SELECT` dari tabel angka 0..9 (cross join 5 tingkat), bukan ribuan INSERT.
// Hanya memakai CRC32/MOD/CONCAT/DATE_ADD, sehingga jalan sama di MySQL 5.7+/8 dan MariaDB 10.x/11.
const DB = "live_t09", N = 50000, BASE = "2025-01-01";

const pad = n => String(n).padStart(2, "0");
const ymd = ms => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };

export function build({ rand, randInt, pick, seed }) {
  const kolom = pick(["kasir_id", "cabang_id"]);
  const K = randInt(18, 25), C = randInt(6, 10); // banyaknya kasir dan cabang
  const nilai = randInt(1, kolom === "kasir_id" ? K : C);
  const d0 = randInt(30, 650), t0 = Date.parse(BASE + "T00:00:00Z");
  const dari = `${ymd(t0 + d0 * 864e5)} 00:00:00`, sampai = `${ymd(t0 + (d0 + 6) * 864e5)} 23:59:59`;
  const jitter = randInt(2, 9); // sedikit variasi isi data
  let sum = 0; for (let n = 0; n < N; n++) sum += 10000 + ((n * 37) % 90) * 1000;

  const sqlLaporan = `SELECT COUNT(*) AS jumlah, SUM(total) AS omzet FROM struk WHERE ${kolom} = ${nilai} AND waktu BETWEEN '${dari}' AND '${sampai}'`;
  const statements = [
    `DROP DATABASE IF EXISTS ${DB}`,
    `CREATE DATABASE ${DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    `USE ${DB}`,
    "CREATE TABLE angka_tmp (d TINYINT NOT NULL PRIMARY KEY) ENGINE=InnoDB",
    "INSERT INTO angka_tmp (d) VALUES (0), (1), (2), (3), (4), (5), (6), (7), (8), (9)",
    `CREATE TABLE struk (
  id INT AUTO_INCREMENT PRIMARY KEY, nomor VARCHAR(20) NOT NULL, kasir_id INT NOT NULL, cabang_id INT NOT NULL,
  metode_bayar_id INT NOT NULL, waktu DATETIME NOT NULL, total DECIMAL(12,2) NOT NULL
) ENGINE=InnoDB`,
    // n = 0..49999 (e.d < 5). waktu menyebar ±2 tahun sejak 2025-01-01; total deterministik agar SUM bisa dihitung di JS.
    `INSERT INTO struk (nomor, kasir_id, cabang_id, metode_bayar_id, waktu, total)
SELECT CONCAT('S', LPAD(n, 6, '0')),
       1 + MOD(CRC32(CONCAT('k', n, ':', ${seed})), ${K}),
       1 + MOD(CRC32(CONCAT('c', n, ':', ${seed})), ${C}),
       1 + MOD(n, 3),
       DATE_ADD('${BASE} 07:00:00', INTERVAL (n * 1261 + MOD(n * ${jitter * 37}, 600)) SECOND),
       10000 + MOD(n * 37, 90) * 1000
FROM (SELECT a.d + b.d * 10 + c.d * 100 + d.d * 1000 + e.d * 10000 AS n
      FROM angka_tmp a, angka_tmp b, angka_tmp c, angka_tmp d, angka_tmp e WHERE e.d < 5) x
ORDER BY n`,
    "DROP TABLE angka_tmp",
    "CREATE TABLE laporan_lambat (id INT AUTO_INCREMENT PRIMARY KEY, judul VARCHAR(80) NOT NULL, sql_text TEXT NOT NULL) ENGINE=InnoDB",
    `INSERT INTO laporan_lambat (judul, sql_text) VALUES ('Laporan mingguan yang lambat', '${sqlLaporan.replace(/'/g, "''")}')`,
  ];
  return { db: DB, statements, expect: { kolom, nilai, dari, sampai, n: N, sum, sql: sqlLaporan } };
}
