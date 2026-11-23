// Tugas 4 (kasus 24): VIEW v_omzet_harian menjumlah setelah JOIN ke pembayaran (pembayaran terpisah per struk) -> total dobel.
// Data transaksi bervariasi per NIM.
import { head, DDL, baseCs, baseInserts, inserts, ymd, hms, cs, f2 } from "./_a.mjs";

const PEMBAYARAN = "CREATE TABLE pembayaran (id INT NOT NULL AUTO_INCREMENT, struk_id INT NOT NULL, metode_bayar_id INT NOT NULL, jumlah DECIMAL(12,2) NOT NULL, PRIMARY KEY (id), CONSTRAINT fk_bayar_struk FOREIGN KEY (struk_id) REFERENCES struk (id), CONSTRAINT fk_bayar_metode FOREIGN KEY (metode_bayar_id) REFERENCES metode_bayar (id)) ENGINE=InnoDB";
const VIEW_RUSAK = "CREATE VIEW v_omzet_harian AS SELECT DATE(s.waktu) AS tanggal, COUNT(*) AS jumlah_struk, SUM(s.total) AS omzet FROM struk s JOIN pembayaran p ON p.struk_id = s.id GROUP BY DATE(s.waktu)";

export function build({ rand, randInt }) {
  const mulai = [2026, randInt(3, 6), randInt(1, 20)], nHari = randInt(9, 14);
  const struk = [], bayar = [];
  let id = 1, off = 0;
  for (let d = 0; d < nHari; d++, off += rand() < 0.25 ? 2 : 1) { // sesekali ada hari kosong
    const day = ymd(mulai, off);
    for (let i = 0, n = randInt(3, 8); i < n; i++, id++) {
      const unit = randInt(30, 240), total = unit * 500;
      struk.push([id, `KK-${String(id).padStart(4, "0")}`, randInt(1, 4), randInt(1, 3), `${day} ${hms(randInt(8, 23), randInt(0, 59), randInt(0, 59))}`, total]);
      // pembayaran: 1 (65%), 2 atau 3 bagian (dibayar terpisah)
      const r = rand(), k = r < 0.65 ? 1 : r < 0.92 ? 2 : 3;
      let sisa = unit;
      for (let j = 0; j < k; j++) {
        const u = j === k - 1 ? sisa : randInt(1, sisa - (k - 1 - j));
        sisa -= u;
        bayar.push([struk[struk.length - 1][0], randInt(1, 3), u * 500]);
      }
    }
  }
  const per = new Map();
  for (const s of struk) { const t = s[4].slice(0, 10), x = per.get(t) || [0, 0]; x[0]++; x[1] += s[5]; per.set(t, x); }
  const harian = [...per].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([t, x]) => [t, x[0], x[1]]);
  const tanggalAda = harian[randInt(0, harian.length - 1)][0];
  const C = ["id", "nomor", "kasir_id", "metode_bayar_id", "waktu", "total"], BC = ["id", "struk_id", "metode_bayar_id", "jumlah"];
  const bayarRows = bayar.map((b, i) => [i + 1, ...b]);
  return {
    db: "live_t04",
    statements: [
      ...head("live_t04"),
      DDL.kasir, DDL.metode_bayar, DDL.struk(), PEMBAYARAN,
      ...baseInserts().filter(s => !s.startsWith("INSERT INTO kategori")),
      ...inserts("struk", C, struk),
      ...inserts("pembayaran", BC, bayarRows),
      VIEW_RUSAK,
    ],
    expect: {
      cs: {
        kasir: baseCs().kasir, metode_bayar: baseCs().metode_bayar,
        struk: cs("struk", C, struk.map(s => [...s.slice(0, 5), f2(s[5])])),
        pembayaran: cs("pembayaran", BC, bayarRows.map(r => [r[0], r[1], r[2], f2(r[3])])),
      },
      harian,                                                         // [[tanggal, jumlah_struk, omzet]]
      uji: { tanggal_baru: ymd([2031, randInt(1, 12), 1], randInt(0, 25)), total_baru: randInt(40, 200) * 500, tanggal_ada: tanggalAda, total_ada: randInt(40, 200) * 500 },
    },
  };
}
