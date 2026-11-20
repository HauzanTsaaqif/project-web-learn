import "server-only";
import { rowsIn, checksum, issue, errTxt } from "../common";

// Bandingkan checksum tabel dasar dengan expect.cs ({ nama: { table, cols, where?, n, c } }).
// Mengembalikan array issue (kosong = utuh). Tabel/kolom hilang dilaporkan sebagai issue, bukan error.
export async function verifyCs(db, spec, { skip = [] } = {}) {
  const out = [];
  for (const [key, s] of Object.entries(spec || {})) {
    if (skip.includes(key)) continue;
    let got;
    try { got = await checksum(db, s.table, s.cols, s.where); }
    catch (e) {
      if (e.errno === 1146 || e.errno === 1054) { out.push(issue("TABLE_MISSING", `Tabel '${s.table}' tidak bisa dibaca`, errTxt(e), "Tabel/kolom dasar jangan dihapus atau diganti nama.")); continue; }
      throw e;
    }
    let d = null;
    if (got.n !== s.n) d = issue("DATA_CHANGED", `Jumlah baris '${s.table}' berubah`, `Seharusnya ${s.n} baris${s.where ? " (yang dipakai struk)" : ""}, sekarang ${got.n}.`, "Data yang tidak termasuk soal harus tetap utuh.");
    else if (got.c !== s.c) d = issue("DATA_CHANGED", `Isi tabel '${s.table}' berubah`, `Jumlah baris sama (${got.n}) tetapi isi kolom ${s.cols.join(", ")} tidak sama dengan kondisi awal.`, "Jangan mengubah data yang bukan bagian soal.");
    if (d && !out.some(x => x.title === d.title && x.detail === d.detail)) out.push(d); // entri cs kedua pada tabel sama tidak dilaporkan ulang
  }
  return out;
}

// Info kolom: { nama: { type, nullable, prec, scale, len } } (nama huruf kecil)
export async function columnsOf(db, table) {
  const rows = await rowsIn(db, "SELECT COLUMN_NAME AS cn, DATA_TYPE AS dt, IS_NULLABLE AS nl, NUMERIC_PRECISION AS prec, NUMERIC_SCALE AS sc, CHARACTER_MAXIMUM_LENGTH AS ln FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION", [db, table]);
  const m = {};
  for (const r of rows) m[String(r.cn).toLowerCase()] = { type: String(r.dt).toLowerCase(), nullable: r.nl === "YES", prec: r.prec == null ? null : Number(r.prec), scale: r.sc == null ? null : Number(r.sc), len: r.ln == null ? null : Number(r.ln) };
  return m;
}

// "VIEW", "BASE TABLE", atau null
export async function objectType(db, name) {
  const [r] = await rowsIn(db, "SELECT TABLE_TYPE AS tt FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?", [db, name]);
  return r ? String(r.tt).toUpperCase() : null;
}

export const near = (a, b, eps = 0.005) => Number.isFinite(Number(a)) && Math.abs(Number(a) - Number(b)) <= eps;
export const rp = x => `Rp${Number(x).toLocaleString("id-ID")}`;
export const sample = (arr, f, n = 3) => arr.slice(0, n).map(f).join("; ") + (arr.length > n ? `; … (+${arr.length - n} lagi)` : "");

// Pastikan VIEW ada dengan kolom persis `cols` (urutan bebas). Mengembalikan array issue.
export async function verifyView(db, name, cols) {
  const tt = await objectType(db, name);
  if (!tt) return [issue("VIEW_MISSING", `VIEW ${name} tidak ditemukan`, `Objek ${name} tidak ada di database ${db}.`, `Buat ulang dengan CREATE OR REPLACE VIEW ${name} AS ...`)];
  if (tt !== "VIEW") return [issue("VIEW_MISSING", `${name} bukan VIEW`, `Objek ${name} bertipe ${tt}.`, "Pakai CREATE OR REPLACE VIEW, bukan tabel biasa.")];
  const have = Object.keys(await columnsOf(db, name));
  const miss = cols.filter(c => !have.includes(c)), extra = have.filter(c => !cols.includes(c));
  if (miss.length || extra.length)
    return [issue("VIEW_COLUMNS", `Kolom VIEW ${name} tidak sesuai`, `Ditemukan: ${have.join(", ") || "(kosong)"}; seharusnya tepat: ${cols.join(", ")}.${miss.length ? ` Kurang: ${miss.join(", ")}.` : ""}${extra.length ? ` Berlebih: ${extra.join(", ")}.` : ""}`, "Beri alias (AS) pada kolom agar namanya sama persis.")];
  return [];
}
