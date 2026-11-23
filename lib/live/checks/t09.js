import { issue, rowsIn } from "../common";
import { qi } from "../db";

// Live 29 / tugas 09: index komposit untuk laporan WHERE <kolom> = ? AND waktu BETWEEN ? AND ?
// Lolos: EXPLAIN bukan ALL, memakai index komposit (kolom kesamaan di depan, waktu kedua), baris diperiksa sedikit.
export default async function check({ db, expect }) {
  const kol = expect.kolom;
  if (!["kasir_id", "cabang_id"].includes(kol)) throw new Error("expect.kolom tidak valid");
  const [t] = await rowsIn(db, "SELECT COUNT(*) n, IFNULL(SUM(total),0) s FROM struk");
  if (Number(t.n) !== expect.n || Math.abs(Number(t.s) - expect.sum) > 0.01)
    return { ok: false, issues: [issue("DATA_CHANGED", "Isi tabel struk berubah", `Ditemukan ${Number(t.n).toLocaleString("id-ID")} baris (seharusnya ${expect.n.toLocaleString("id-ID")}) dan jumlah total yang berbeda. Soal ini hanya tentang index; data tidak boleh dikurangi.`, "Jalankan ulang npm run live:siapkan untuk membuat ulang datanya.")] };

  await rowsIn(db, "ANALYZE TABLE struk").catch(() => {});
  const SQL = `SELECT COUNT(*) AS jumlah, SUM(total) AS omzet FROM struk WHERE ${qi(kol)} = ? AND waktu BETWEEN ? AND ?`, par = [expect.nilai, expect.dari, expect.sampai];
  const [ex] = await rowsIn(db, "EXPLAIN " + SQL, par);
  const idx = ex.key ? (await rowsIn(db, "SELECT COLUMN_NAME c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME='struk' AND INDEX_NAME=? ORDER BY SEQ_IN_INDEX", [db, ex.key])).map(r => String(r.c).toLowerCase()) : [];
  const rows = Number(ex.rows || 0), info = `type=${ex.type}, key=${ex.key || "NULL"}, rows≈${rows.toLocaleString("id-ID")} dari ${Number(t.n).toLocaleString("id-ID")}`;
  let ms = Infinity, hasil;
  for (let i = 0; i < 3; i++) { const t0 = performance.now(); [hasil] = await rowsIn(db, SQL, par); ms = Math.min(ms, performance.now() - t0); }

  const bad = [], tgt = `laporanmu (lihat tabel laporan_lambat) memakai ${kol} dan waktu`;
  if (ex.type === "ALL" || !ex.key) bad.push(issue("INDEX_FULLSCAN", "EXPLAIN masih type = ALL (full table scan)", `${info}. MySQL membaca seluruh tabel untuk satu ${kol.replace("_id", "")} pada satu minggu. Kueri ${tgt}.`, "Index harus mencakup kolom yang dipakai di WHERE, sesuai kueri laporanmu."));
  else if (idx.length < 2) bad.push(issue("INDEX_COMPOSITE", "Index yang dipakai belum komposit", `${info}. Index '${ex.key}' hanya berisi (${idx.join(", ")}). Kondisi sama-dengan DAN rentang waktu perlu index dua kolom.`, "Gabungkan kedua kolom dalam satu index."));
  else if (idx[0] !== kol || idx[1] !== "waktu") bad.push(issue("INDEX_ORDER", "Urutan kolom index belum tepat", `${info}; urutan kolom (${idx.join(", ")}). Kolom yang diuji dengan sama-dengan harus di depan, kolom rentang (waktu) sesudahnya.`, `Kolom kesamaan di laporanmu: ${kol}.`));
  else if (rows > Number(t.n) * 0.02) bad.push(issue("INDEX_WEAK", "Index dipakai tetapi masih banyak baris diperiksa", `${info}. Kueri seharusnya hanya memeriksa sebagian kecil tabel (<2%).`, "Jalankan ANALYZE TABLE struk lalu coba lagi."));
  return { ok: !bad.length, issues: bad, data: { explain: { type: ex.type, key: ex.key, rows }, kolom: idx, ms: Math.round(ms * 10) / 10, hasil: { jumlah: Number(hasil.jumlah), omzet: Number(hasil.omzet) } } };
}
