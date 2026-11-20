// Tugas 1 (kasus 21): tipe uang salah. produk.harga FLOAT, struk_item.harga_satuan DOUBLE.
// Nilai hanya kelipatan 0,25 (≤ 5 digit bulat) agar tepat di biner: konversi ke DECIMAL(12,2) deterministik.
import { head, DDL, CATALOG, baseCs, baseInserts, inserts, genStruk, fixedRng, ymd, cs, f2 } from "./_a.mjs";

export function build() {
  const g = fixedRng(101), { randInt } = g;
  const frac = [0, 0.5, 0.25, 0, 0.75];
  const produk = CATALOG.map(([nama, kat, h], i) => [i + 1, nama, h + frac[i % 5], randInt(20, 150), kat]);
  const { struk } = genStruk(g, { produk: produk.map(p => ({ id: p[0], harga: p[2] })), days: Array.from({ length: 12 }, (_, i) => ymd([2026, 3, 2], i)), perDay: [4, 7] });
  const strukRows = struk.map(s => [s.id, s.nomor, s.kasir_id, s.metode_bayar_id, s.waktu, f2(s.total)]);
  const itemRows = struk.flatMap(s => s.items.map(x => [s.id, x.produk_id, x.qty, x.harga]));
  const C = ["id", "nomor", "kasir_id", "metode_bayar_id", "waktu", "total"];
  return {
    db: "live_t01",
    statements: [
      ...head("live_t01"),
      DDL.kategori, DDL.produk("FLOAT"), DDL.kasir, DDL.metode_bayar, DDL.struk(), DDL.struk_item({ harga: "DOUBLE" }),
      ...baseInserts(),
      ...inserts("produk", ["id", "nama", "harga", "stok", "kategori_id"], produk),
      ...inserts("struk", C, struk.map(s => [s.id, s.nomor, s.kasir_id, s.metode_bayar_id, s.waktu, s.total])),
      ...inserts("struk_item", ["struk_id", "produk_id", "qty", "harga_satuan"], itemRows),
    ],
    expect: {
      cs: {
        ...baseCs(),
        produk: cs("produk", ["id", "nama", "stok", "kategori_id"], produk.map(p => [p[0], p[1], p[3], p[4]])),
        struk: cs("struk", C, strukRows),
        struk_item: cs("struk_item", ["struk_id", "produk_id", "qty"], itemRows.map(r => r.slice(0, 3))),
        produk_harga: cs("produk", ["id", "harga"], produk.map(p => [p[0], f2(p[2])])),
        item_harga: cs("struk_item", ["struk_id", "produk_id", "harga_satuan"], itemRows.map(r => [r[0], r[1], f2(r[3])])),
      },
      sum_harga: produk.reduce((a, p) => a + p[2], 0),
      sum_harga_satuan: itemRows.reduce((a, r) => a + r[3], 0),
    },
  };
}
