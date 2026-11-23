import "server-only";
import { issue, rowsIn, sandboxIn, scope, attempt, errTxt } from "../common";
import { verifyCs, sample } from "./_a";

export default async function check({ db, expect }) {
  const out = [];
  // 1) UNIQUE satu kolom pada email
  const idx = await rowsIn(db, "SELECT INDEX_NAME AS ix, COLUMN_NAME AS col, SEQ_IN_INDEX AS sq, NON_UNIQUE AS nu, SUB_PART AS sp FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME='pelanggan'", [db]);
  const per = {}; for (const r of idx) (per[r.ix] ||= []).push(r);
  const unik = Object.values(per).some(a => a.length === 1 && Number(a[0].nu) === 0 && String(a[0].col).toLowerCase() === "email" && a[0].sp == null);
  if (!unik) out.push(issue("UNIQUE_MISSING", "Belum ada UNIQUE pada pelanggan.email", "Tidak ditemukan indeks unik satu kolom pada email (bukan gabungan, bukan prefiks).", "Setelah data bersih: ALTER TABLE ... ADD UNIQUE ... Bila gagal dengan error 1062, masih ada email kembar."));
  // 2) Tidak ada duplikat (huruf besar/kecil dianggap sama)
  const dup = await rowsIn(db, "SELECT LOWER(email) AS e, COUNT(*) AS n FROM pelanggan GROUP BY LOWER(email) HAVING COUNT(*) > 1 ORDER BY e");
  if (dup.length) out.push(issue("DUPLICATES", `Masih ada ${dup.length} email ganda`, sample(dup, d => `${d.e} (${d.n}×)`) + ". Perbedaan huruf besar/kecil tetap dihitung sama.", "Cari dengan GROUP BY LOWER(email) HAVING COUNT(*) > 1."));
  // 3) Tidak menghapus berlebihan / mengakali: jumlah dan himpunan email harus pas
  const [{ n, c }] = await rowsIn(db, "SELECT COUNT(*) AS n, IFNULL(SUM(CRC32(LOWER(email))),0) AS c FROM pelanggan");
  if (!dup.length) {
    if (Number(n) < expect.unik) out.push(issue("TOO_MANY_DELETED", "Ada pelanggan yang ikut terhapus", `Sekarang ${n} pelanggan, seharusnya ${expect.unik} (satu per email).`, "Hapus hanya baris kembaran, bukan semua pemilik email itu."));
    else if (Number(n) > expect.unik || String(c) !== expect.lower_c) out.push(issue("EMAIL_ALTERED", "Daftar email berubah dari yang seharusnya", `Sekarang ${n} pelanggan; seharusnya ${expect.unik} email berbeda, masing-masing tepat sekali.`, "Menyamarkan duplikat (mengubah isi email) bukan pembersihan; gabungkan/hapus kembarannya."));
  }
  // 4) Pelanggan yang dipakai struk tetap ada dan utuh; struk utuh
  out.push(...(await verifyCs(db, expect.cs)).map(d => d.title.includes("pelanggan") ? { ...d, title: "Pelanggan yang dipakai struk hilang atau berubah", hint: "Dari tiap kelompok kembar, pertahankan baris yang dipakai struk; hapus kembaran yang tidak dipakai." } : d));
  if (out.length) return { ok: false, issues: out };

  // 5) Uji perilaku: email yang sudah ada tidak boleh bisa dimasukkan lagi
  const uji = await sandboxIn(db, ["pelanggan"], async conn => {
    const [[p]] = await conn.query("SELECT email FROM pelanggan ORDER BY id LIMIT 1");
    return scope(conn, async () => {
      const r = await attempt(conn, "INSERT INTO pelanggan (nama, email) VALUES ('Uji Ganda', ?)", [p.email]);
      if (!r.e) return [issue("DUP_ACCEPTED", "INSERT email yang sudah ada berhasil", `Email ${p.email} bisa dimasukkan dua kali.`, "UNIQUE belum benar-benar menolak duplikat.")];
      return r.e.errno === 1062 ? [] : [issue("UNEXPECTED_ERROR", "INSERT uji ditolak dengan error lain", errTxt(r.e))];
    });
  });
  return uji.length ? { ok: false, issues: uji } : { ok: true, issues: [] };
}
