import { issue, rowsIn, checksum } from "../common";

// Live 30 / tugas 10: struk dan struk_item harus pulih dari data/live/t10_backup.sql.
// Tabel hilang = salah (kondisi awal). Cek: ada, InnoDB, PK, FK, jumlah baris, checksum; baris berlebih (impor ganda) terdeteksi.
export default async function check({ db, expect }) {
  const have = new Map((await rowsIn(db, "SELECT LOWER(TABLE_NAME) t, TABLE_TYPE tt, ENGINE e FROM information_schema.TABLES WHERE TABLE_SCHEMA=?", [db])).map(r => [r.t, r]));
  const bad = [], tabel = [];
  for (const [t, def] of Object.entries(expect.tabel)) {
    const x = have.get(t);
    if (!x || x.tt === "VIEW") {
      bad.push(issue("RESTORE_TABLE", `Tabel '${t}' belum ada di ${db}`, def.pulih ? `Tabel yang ada: ${[...have.keys()].join(", ") || "(kosong)"}.` : "Tabel master ini hilang dari database.", def.pulih ? `Impor data/live/t10_backup.sql ke database ${db} (pastikan database yang dipilih saat mengimpor adalah ${db}).` : undefined));
      tabel.push({ tabel: t, baris: 0, ok: false }); continue;
    }
    const c = await checksum(db, t, def.cols), ok = c.n === def.n && c.c === def.c;
    tabel.push({ tabel: t, baris: c.n, ok });
    if (c.n > def.n) bad.push(issue("RESTORE_DUPLICATE", `Tabel '${t}' berisi baris berlebih`, `Ditemukan ${c.n} baris, seharusnya ${def.n}. File backup terimpor lebih dari sekali?`, "Hapus tabelnya (DROP TABLE), lalu impor sekali saja. Hapus struk_item lebih dulu karena merujuk ke struk."));
    else if (c.n < def.n) bad.push(issue("RESTORE_COUNT", `Jumlah baris '${t}' kurang`, `Ditemukan ${c.n} baris, seharusnya ${def.n}. Pemulihan belum lengkap (impor terhenti di tengah?).`, "Hapus tabel yang setengah jadi lalu ulangi impor sampai selesai tanpa error."));
    else if (!ok) bad.push(issue("RESTORE_DATA", `Isi tabel '${t}' berbeda dari backup`, `Jumlah baris cocok (${c.n}) tetapi checksum berbeda. Data diubah setelah dipulihkan, atau berasal dari sumber lain.`, def.pulih ? "Pulihkan dari t10_backup.sql tanpa mengubah isinya." : "Tabel master tidak boleh diubah."));
    if (def.pulih && String(x.e).toLowerCase() !== "innodb") bad.push(issue("RESTORE_ENGINE", `Tabel '${t}' bukan InnoDB`, `Engine saat ini ${x.e}. Backup memakai InnoDB agar foreign key berfungsi.`, "Impor ulang tanpa mengubah ENGINE pada file backup."));
  }
  // struktur: primary key dan foreign key
  const pk = await rowsIn(db, "SELECT LOWER(TABLE_NAME) t, COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND COLUMN_KEY='PRI' GROUP BY LOWER(TABLE_NAME)", [db]);
  for (const t of ["struk", "struk_item"]) if (have.has(t) && !pk.some(r => r.t === t)) bad.push(issue("RESTORE_PK", `Tabel '${t}' tidak punya primary key`, "Backup asli memiliki PRIMARY KEY. Tabel yang dibuat ulang manual biasanya kehilangannya.", "Pulihkan memakai CREATE TABLE dari file backup."));
  const fk = (await rowsIn(db, "SELECT LOWER(TABLE_NAME) t, LOWER(COLUMN_NAME) c, LOWER(REFERENCED_TABLE_NAME) r FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND REFERENCED_TABLE_NAME IS NOT NULL", [db])).map(r => `${r.t}.${r.c}>${r.r}`);
  const lost = expect.fk.filter(([t, c, r]) => have.has(t) && !fk.includes(`${t}.${c}>${r}`));
  if (lost.length) bad.push(issue("RESTORE_FK", "Foreign key belum pulih", `Hilang: ${lost.map(([t, c, r]) => `${t}.${c} → ${r}`).join("; ")}.`, "Backup memuat CONSTRAINT FOREIGN KEY di CREATE TABLE; pastikan seluruh isi file ikut dijalankan."));
  return { ok: !bad.length, issues: bad, data: { tabel } };
}
