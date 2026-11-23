// Tugas 5 (kasus 25): VIEW v_penjualan_produk salah agregat (COUNT(*) bukan SUM(qty), GROUP BY keliru, INNER JOIN
// menghilangkan produk tanpa penjualan). Produk, harga, dan transaksi bervariasi per NIM.
import { head, DDL, CATALOG, baseCs, baseInserts, inserts, genStruk, shuffle, ymd, cs, f2 } from "./_a.mjs";

const VIEW_RUSAK = "CREATE VIEW v_penjualan_produk AS SELECT MIN(p.nama) AS produk, COUNT(*) AS qty_terjual, SUM(i.harga_satuan) AS omzet FROM produk p JOIN struk_item i ON i.produk_id = p.id GROUP BY p.kategori_id";

export function build(g) {
  const { rand, randInt } = g;
  const jml = randInt(9, 11);
  const pilih = shuffle(CATALOG, rand).slice(0, jml);
  const produk = pilih.map(([nama, kat, h], i) => [i + 1, nama, h + randInt(-2, 3) * 500, randInt(20, 150), kat]);
  const belumLaku = new Set(shuffle(produk.map(p => p[0]), rand).slice(0, randInt(2, 3))); // tanpa penjualan sama sekali
  const dijual = produk.filter(p => !belumLaku.has(p[0])).map(p => ({ id: p[0], harga: p[2] }));
  const bulan = randInt(3, 6), nHari = randInt(6, 9);
  const { struk } = genStruk(g, { produk: dijual, days: Array.from({ length: nHari }, (_, i) => ymd([2026, bulan, 1], i)), perDay: [3, 7], maxQty: 5, promo: 0.15 });
  const itemRows = struk.flatMap(s => s.items.map(x => [s.id, x.produk_id, x.qty, x.harga]));
  const hasil = produk.map(p => {
    const it = itemRows.filter(r => r[1] === p[0]);
    return [p[1], it.reduce((a, r) => a + r[2], 0), it.reduce((a, r) => a + r[2] * r[3], 0)];
  }).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const sample = produk.find(p => !belumLaku.has(p[0])), kosong = produk.find(p => belumLaku.has(p[0]));
  const C = ["id", "nomor", "kasir_id", "metode_bayar_id", "waktu", "total"], PC = ["id", "nama", "harga", "stok", "kategori_id"], IC = ["struk_id", "produk_id", "qty", "harga_satuan"];
  const strukRows = struk.map(s => [s.id, s.nomor, s.kasir_id, s.metode_bayar_id, s.waktu, s.total]);
  return {
    db: "live_t05",
    statements: [
      ...head("live_t05"),
      DDL.kategori, DDL.produk(), DDL.kasir, DDL.metode_bayar, DDL.struk(), DDL.struk_item(),
      ...baseInserts(),
      ...inserts("produk", PC, produk),
      ...inserts("struk", C, strukRows),
      ...inserts("struk_item", IC, itemRows),
      VIEW_RUSAK,
    ],
    expect: {
      cs: {
        ...baseCs(),
        produk: cs("produk", PC, produk.map(p => [p[0], p[1], f2(p[2]), p[3], p[4]])),
        struk: cs("struk", C, strukRows.map(r => [...r.slice(0, 5), f2(r[5])])),
        struk_item: cs("struk_item", IC, itemRows.map(r => [r[0], r[1], r[2], f2(r[3])])),
      },
      produk: hasil,                                                       // [[nama, qty_terjual, omzet]] urut nama
      uji: { kosong_id: kosong[0], kosong_nama: kosong[1], kosong_harga: kosong[2], ada_id: sample[0], ada_nama: sample[1], ada_harga: sample[2], kategori_id: sample[4] },
    },
  };
}
