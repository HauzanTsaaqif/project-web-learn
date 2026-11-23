import "server-only";
import { getPool, qi } from "./db";

// Bentuk issue sama dengan lib/checker.js agar tampilan hasil di CaseClient bisa dipakai ulang
export const issue = (code, title, detail, hint) => ({ code, title, detail, hint });
export const errTxt = e => `${e.code || "ERROR"} (${e.errno || "?"}): ${e.sqlMessage || e.message}`;

// Jalankan fn(conn) pada koneksi yang sudah `USE db`
export async function withConn(db, fn) {
  const conn = await getPool().getConnection();
  try { await conn.query(`USE ${qi(db)}`); return await fn(conn); }
  finally { conn.release(); }
}
// Query sekali jalan di database tertentu: rows
export const rowsIn = (db, sql, params) => withConn(db, async c => (await c.query(sql, params))[0]);

// Hasil { r } atau { e } tanpa melempar (untuk menguji INSERT/UPDATE yang seharusnya ditolak)
export const attempt = (conn, sql, p) => conn.query(sql, p).then(r => ({ r: r[0] }), e => ({ e }));

// Semua perubahan di dalam fn dibatalkan lewat SAVEPOINT (dipakai di dalam sandboxIn)
export async function scope(conn, fn) {
  await conn.query("SAVEPOINT uji");
  try { return await fn(); } finally { await conn.query("ROLLBACK TO SAVEPOINT uji").catch(() => {}); }
}

// Transaksi uji yang SELALU di-ROLLBACK. Tabel harus InnoDB (bukan VIEW). fn(conn) mengembalikan array issue.
export async function sandboxIn(db, tables, fn) {
  const conn = await getPool().getConnection();
  let broken = false;
  try {
    await conn.query(`USE ${qi(db)}`);
    const [eng] = await conn.query("SELECT LOWER(TABLE_NAME) t, TABLE_TYPE tt, ENGINE e FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND LOWER(TABLE_NAME) IN (?)", [db, tables]);
    const bad = tables.filter(t => { const x = eng.find(r => r.t === t); return !x || x.tt === "VIEW" || String(x.e).toLowerCase() !== "innodb"; });
    if (bad.length) return bad.map(t => issue("ENGINE_MISMATCH", `Uji perilaku ditolak: tabel '${t}' tidak ditemukan atau bukan InnoDB`, `Engine ${eng.find(r => r.t === t)?.e || "?"}. Uji butuh transaksi (ROLLBACK) agar datamu aman.`, `ALTER TABLE ${t} ENGINE=InnoDB;`));
    await conn.query("SET SESSION sql_mode=CONCAT(@@sql_mode, ',STRICT_ALL_TABLES'), innodb_lock_wait_timeout=3");
    await conn.query("START TRANSACTION");
    return await fn(conn);
  } finally {
    try { await conn.query("ROLLBACK"); await conn.query("SET SESSION sql_mode=DEFAULT, innodb_lock_wait_timeout=DEFAULT"); } catch { broken = true; }
    if (broken) conn.destroy(); else conn.release();
  }
}

// Sidik data sederhana: { n, c } = jumlah baris dan jumlah CRC32 baris. cols = daftar kolom (urut tetap).
export async function checksum(db, table, cols, where = "1=1") {
  const expr = cols.map(c => `IFNULL(CAST(${qi(c)} AS CHAR),'~')`).join(",'|',");
  const [r] = await rowsIn(db, `SELECT COUNT(*) n, IFNULL(SUM(CRC32(CONCAT(${expr}))),0) c FROM ${qi(table)} WHERE ${where}`);
  return { n: Number(r.n), c: String(r.c) };
}
