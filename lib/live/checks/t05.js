import "server-only";
import { issue, rowsIn, sandboxIn, scope } from "../common";
import { verifyCs, verifyView, near, rp, sample } from "./_a";

const V = "v_penjualan_produk", KOL = ["produk", "qty_terjual", "omzet"];

export default async function check({ db, expect }) {
  const dasar = await verifyCs(db, expect.cs);
  if (dasar.length) return { ok: false, issues: dasar };
  const v = await verifyView(db, V, KOL);
  if (v.length) return { ok: false, issues: v };

  const got = await rowsIn(db, `SELECT produk AS p, qty_terjual AS q, omzet AS o FROM ${V}`);
  const g = new Map(); for (const r of got) g.set(String(r.p), [...(g.get(String(r.p)) || []), r]);
  const bad = [], want = expect.produk;
  if (got.length !== want.length) bad.push(`jumlah baris VIEW ${got.length}, seharusnya ${want.length} produk`);
  for (const [nama, q, o] of want) {
    const rs = g.get(nama);
    if (!rs) { bad.push(`${nama}: tidak tampil`); continue; }
    const r = rs[0];
    if (rs.length > 1) bad.push(`${nama}: muncul ${rs.length}×`);
    else if (r.q == null || r.o == null) bad.push(`${nama}: qty/omzet NULL (seharusnya 0 bila tidak terjual)`);
    else if (Number(r.q) !== q || !near(r.o, o)) bad.push(`${nama}: qty_terjual ${r.q}, omzet ${rp(r.o)} (seharusnya ${q}, ${rp(o)})`);
  }
  if (bad.length) return { ok: false, issues: [issue("VIEW_RESULT", "Hasil VIEW belum sama dengan penjualan sebenarnya", `${bad.length} masalah. Contoh: ${sample(bad, x => x)}`, "Periksa tiga hal: apa yang dihitung (jumlah baris atau jumlah qty), dikelompokkan per apa, dan jenis JOIN agar produk tanpa penjualan tetap tampil dengan 0.")] };

  // Uji mutasi
  const u = expect.uji;
  const uji = await sandboxIn(db, ["produk", "struk", "struk_item"], async conn => {
    const out = [];
    const lihat = async nama => (await conn.query(`SELECT qty_terjual AS q, omzet AS o FROM ${V} WHERE produk = ?`, [nama]))[0][0] || null;
    const jual = async (nomor, pid, qty, harga) => {
      const [r] = await conn.query("INSERT INTO struk (nomor, kasir_id, metode_bayar_id, waktu, total) VALUES (?, 1, 1, '2031-01-01 10:00:00', ?)", [nomor, qty * harga]);
      await conn.query("INSERT INTO struk_item (struk_id, produk_id, qty, harga_satuan) VALUES (?, ?, ?, ?)", [r.insertId, pid, qty, harga]);
    };
    const cek = (judul, nama, r, q, o) => {
      if (!r || Number(r.q) !== q || !near(r.o, o)) out.push(issue("VIEW_STATIC", judul, `${nama}: ${r ? `qty_terjual ${r.q}, omzet ${rp(r.o)}` : "tidak tampil"}; seharusnya ${q}, ${rp(o)}.`, "VIEW harus dihitung dari tabel, bukan angka tetap."));
    };
    await scope(conn, async () => {
      await jual("UJI-0001", u.kosong_id, 3, 1500);
      cek("VIEW tidak mengikuti penjualan baru (produk yang belum pernah terjual)", u.kosong_nama, await lihat(u.kosong_nama), 3, 4500);
    });
    await scope(conn, async () => {
      const awal = await lihat(u.ada_nama);
      await jual("UJI-0002", u.ada_id, 2, 1000);
      cek("VIEW tidak mengikuti penjualan baru (produk yang sudah terjual)", u.ada_nama, await lihat(u.ada_nama), Number(awal.q) + 2, Number(awal.o) + 2000);
    });
    await scope(conn, async () => {
      await conn.query("INSERT INTO produk (nama, harga, stok, kategori_id) VALUES ('Produk Uji Baru', 1000, 5, ?)", [u.kategori_id]);
      cek("Produk baru tanpa penjualan tidak tampil dengan 0", "Produk Uji Baru", await lihat("Produk Uji Baru"), 0, 0);
    });
    return out;
  });
  return uji.length ? { ok: false, issues: uji } : { ok: true, issues: [] };
}
