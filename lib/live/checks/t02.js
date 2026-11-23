import "server-only";
import { issue, rowsIn, sandboxIn, scope, attempt, errTxt } from "../common";
import { verifyCs } from "./_a";

const FK = [["struk_id", "struk", "id"], ["produk_id", "produk", "id"]];

export default async function check({ db, expect }) {
  const out = [];
  // 1) FK di struk_item (satu kolom, ke kolom id induk)
  const kcu = await rowsIn(db, "SELECT CONSTRAINT_NAME AS cn, COLUMN_NAME AS col, REFERENCED_TABLE_NAME AS rt, REFERENCED_COLUMN_NAME AS rc FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND TABLE_NAME='struk_item' AND REFERENCED_TABLE_NAME IS NOT NULL", [db]);
  const perFk = {}; for (const r of kcu) (perFk[r.cn] ||= []).push(r);
  const fks = Object.values(perFk).filter(a => a.length === 1).map(a => a[0]);
  let fkOk = true;
  for (const [col, rt, rc] of FK) {
    if (!fks.some(f => String(f.col).toLowerCase() === col && String(f.rt).toLowerCase() === rt && String(f.rc).toLowerCase() === rc)) {
      fkOk = false;
      out.push(issue("FK_MISSING", `Foreign key struk_item.${col} → ${rt}.${rc} belum ada`, "Tanpa FK, baris item bisa menunjuk induk yang tidak ada.", `ALTER TABLE ... ADD FOREIGN KEY. Bila gagal (error 1452), berarti masih ada baris yatim di struk_item.`));
    }
  }
  // 2) Baris yatim
  const [y] = await rowsIn(db, "SELECT SUM(NOT EXISTS (SELECT 1 FROM struk s WHERE s.id = i.struk_id)) AS ys, SUM(NOT EXISTS (SELECT 1 FROM produk p WHERE p.id = i.produk_id)) AS yp, COUNT(*) AS n FROM struk_item i");
  const ys = Number(y.ys || 0), yp = Number(y.yp || 0);
  if (ys || yp) out.push(issue("ORPHANS", "Masih ada baris yatim di struk_item", `${ys} baris menunjuk struk yang tidak ada, ${yp} baris menunjuk produk yang tidak ada.`, "Cari dengan LEFT JOIN ... WHERE induk.id IS NULL (atau NOT EXISTS), lalu hapus barisnya."));
  // 3) Data dasar: induk tidak boleh ditambah/dikurangi, baris valid utuh
  const dasar = await verifyCs(db, expect.cs);
  for (const d of dasar) {
    if (/'(struk|produk)'/.test(d.title) && d.code === "DATA_CHANGED") d.hint = "Jangan menambah induk palsu (struk/produk) agar baris yatim terlihat valid; hapus baris yatimnya.";
    if (/'struk_item'/.test(d.title)) d.hint = "Yang dihapus hanya baris yatim; baris valid (induknya ada) harus tetap utuh.";
  }
  out.push(...dasar);
  if (out.length || !fkOk) return { ok: false, issues: out };

  // 4) Uji perilaku: INSERT yatim harus ditolak (ROLLBACK)
  const uji = await sandboxIn(db, ["struk_item", "struk", "produk"], async conn => {
    const bad = [];
    const [[s]] = await conn.query("SELECT id FROM struk ORDER BY id LIMIT 1"), [[p]] = await conn.query("SELECT id FROM produk ORDER BY id LIMIT 1");
    for (const [label, args] of [["struk yang tidak ada", [987654, p.id]], ["produk yang tidak ada", [s.id, 987654]]]) {
      await scope(conn, async () => {
        const r = await attempt(conn, "INSERT INTO struk_item (struk_id, produk_id, qty, harga_satuan) VALUES (?, ?, 1, 1000)", args);
        if (!r.e) bad.push(issue("ORPHAN_ACCEPTED", `INSERT item untuk ${label} berhasil`, "Seharusnya ditolak oleh foreign key (error 1452).", "Periksa bahwa FK benar-benar terpasang pada tabel InnoDB."));
        else if (r.e.errno !== 1452 && r.e.errno !== 1216) bad.push(issue("UNEXPECTED_ERROR", `INSERT uji ditolak dengan error lain`, errTxt(r.e)));
      });
    }
    return bad;
  });
  return uji.length ? { ok: false, issues: uji } : { ok: true, issues: [] };
}
