import "server-only";
import { issue, rowsIn, sandboxIn, scope } from "../common";
import { verifyCs, verifyView, near, rp, sample } from "./_a";

const V = "v_omzet_harian", KOL = ["tanggal", "jumlah_struk", "omzet"];
const baca = db => rowsIn(db, `SELECT DATE_FORMAT(tanggal, '%Y-%m-%d') AS tgl, jumlah_struk AS n, omzet AS om FROM ${V} ORDER BY tgl`);

export default async function check({ db, expect }) {
  // 1) Data dasar tidak boleh diubah (menjawab dengan mengubah data = salah)
  const dasar = await verifyCs(db, expect.cs);
  if (dasar.length) return { ok: false, issues: dasar };
  // 2) VIEW ada dengan kolom yang benar
  const v = await verifyView(db, V, KOL);
  if (v.length) return { ok: false, issues: v };
  // 3) Hasil per tanggal
  const got = await baca(db), want = expect.harian, bad = [];
  const g = new Map(got.map(r => [r.tgl, r]));
  if (got.length !== want.length || g.size !== got.length) bad.push(`jumlah baris VIEW ${got.length}, seharusnya ${want.length} hari`);
  for (const [t, n, om] of want) {
    const r = g.get(t);
    if (!r) bad.push(`${t}: tidak tampil`);
    else if (Number(r.n) !== n || !near(r.om, om)) bad.push(`${t}: jumlah_struk ${r.n}, omzet ${rp(r.om)} (seharusnya ${n} struk, ${rp(om)})`);
  }
  if (bad.length) return { ok: false, issues: [issue("VIEW_RESULT", "Hasil VIEW belum sama dengan data sebenarnya", `${bad.length} masalah. Contoh: ${sample(bad, x => x)}`, "Satu struk bisa punya beberapa baris pembayaran. Apa yang terjadi pada SUM dan COUNT bila struk yang sama muncul lebih dari sekali setelah JOIN?")] };

  // 4) Uji mutasi: sisipkan struk uji, VIEW harus ikut berubah sesuai (menolak angka hard-code)
  const u = expect.uji;
  const uji = await sandboxIn(db, ["struk", "pembayaran"], async conn => {
    const lihat = async tgl => { const [r] = (await conn.query(`SELECT jumlah_struk AS n, omzet AS om FROM ${V} WHERE DATE_FORMAT(tanggal, '%Y-%m-%d') = ?`, [tgl]))[0]; return r || null; };
    const tambah = async (nomor, tgl, total, bagian) => {
      const [r] = await conn.query("INSERT INTO struk (nomor, kasir_id, metode_bayar_id, waktu, total) VALUES (?, 1, 1, ?, ?)", [nomor, `${tgl} 13:45:00`, total]);
      let sisa = total; for (let i = 0; i < bagian; i++) { const j = i === bagian - 1 ? sisa : Math.floor(total / bagian / 500) * 500; sisa -= j; await conn.query("INSERT INTO pembayaran (struk_id, metode_bayar_id, jumlah) VALUES (?, ?, ?)", [r.insertId, (i % 3) + 1, j]); }
    };
    const out = [];
    await scope(conn, async () => {
      await tambah("UJI-0001", u.tanggal_baru, u.total_baru, 2);
      const r = await lihat(u.tanggal_baru);
      if (!r || Number(r.n) !== 1 || !near(r.om, u.total_baru)) out.push(issue("VIEW_STATIC", "VIEW tidak mengikuti data baru", `Setelah sisip 1 struk (${rp(u.total_baru)}, dibayar 2 bagian) pada tanggal baru ${u.tanggal_baru}: ${r ? `jumlah_struk ${r.n}, omzet ${rp(r.om)}` : "tanggal itu tidak tampil"}; seharusnya 1 struk, ${rp(u.total_baru)}.`, "VIEW harus dihitung dari tabel, bukan angka tetap, dan tidak boleh menggandakan struk yang dibayar bertahap."));
    });
    if (out.length) return out;
    const awal = await lihat(u.tanggal_ada);
    await scope(conn, async () => {
      await tambah("UJI-0002", u.tanggal_ada, u.total_ada, 3);
      const r = await lihat(u.tanggal_ada);
      if (!awal || !r || Number(r.n) !== Number(awal.n) + 1 || !near(r.om, Number(awal.om) + u.total_ada))
        out.push(issue("VIEW_STATIC", "VIEW tidak mengikuti tambahan data pada tanggal yang ada", `Pada ${u.tanggal_ada}, sebelum ${awal?.n} struk/${rp(awal?.om)}, sesudah sisip struk ${rp(u.total_ada)} (3 bagian bayar): ${r ? `${r.n} struk/${rp(r.om)}` : "hilang"}; seharusnya ${Number(awal?.n) + 1} struk/${rp(Number(awal?.om) + u.total_ada)}.`, "Periksa lagi JOIN dan agregatnya."));
    });
    return out;
  });
  return uji.length ? { ok: false, issues: uji } : { ok: true, issues: [] };
}
