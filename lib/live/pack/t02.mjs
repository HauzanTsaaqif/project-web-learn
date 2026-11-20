// Tugas 2 (kasus 22): struk_item tanpa FK dan berisi baris yatim (induk struk/produk tidak ada).
import { head, DDL, CATALOG, baseCs, baseInserts, inserts, genStruk, fixedRng, ymd, cs, f2 } from "./_a.mjs";

export function build() {
  const g = fixedRng(102);
  const produk = CATALOG.map(([nama, kat, h], i) => [i + 1, nama, h, g.randInt(20, 150), kat]);
  const { struk } = genStruk(g, { produk: produk.map(p => ({ id: p[0], harga: p[2] })), days: Array.from({ length: 10 }, (_, i) => ymd([2026, 3, 9], i)), perDay: [4, 6] });
  const C = ["id", "nomor", "kasir_id", "metode_bayar_id", "waktu", "total"];
  const valid = struk.flatMap(s => s.items.map(x => [s.id, x.produk_id, x.qty, x.harga]));
  // Baris yatim: struk_id tak ada (9001..9003), produk_id tak ada (9101, 9102), dan keduanya (9004, 9103)
  const orphan = [
    [9001, 2, 1, 20000], [9002, 5, 2, 25000], [9003, 11, 1, 22000],
    [struk[3].id, 9101, 1, 15000], [struk[17].id, 9102, 3, 18000], [9004, 9103, 2, 12000],
  ];
  const IC = ["struk_id", "produk_id", "qty", "harga_satuan"];
  return {
    db: "live_t02",
    statements: [
      ...head("live_t02"),
      DDL.kategori, DDL.produk(), DDL.kasir, DDL.metode_bayar, DDL.struk(), DDL.struk_item({ fk: false }),
      ...baseInserts(),
      ...inserts("produk", ["id", "nama", "harga", "stok", "kategori_id"], produk),
      ...inserts("struk", C, struk.map(s => [s.id, s.nomor, s.kasir_id, s.metode_bayar_id, s.waktu, s.total])),
      ...inserts("struk_item", IC, [...valid, ...orphan]),
    ],
    expect: {
      cs: {
        ...baseCs(),
        produk: cs("produk", ["id", "nama", "harga", "stok", "kategori_id"], produk.map(p => [p[0], p[1], f2(p[2]), p[3], p[4]])),
        struk: cs("struk", C, struk.map(s => [s.id, s.nomor, s.kasir_id, s.metode_bayar_id, s.waktu, f2(s.total)])),
        // setelah dibersihkan: hanya baris valid
        struk_item: cs("struk_item", IC, valid.map(r => [r[0], r[1], r[2], f2(r[3])])),
      },
      orphan_awal: orphan.length,
      item_valid: valid.length,
    },
  };
}
