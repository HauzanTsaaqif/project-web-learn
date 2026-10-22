import "server-only";
import mysql from "mysql2/promise";
import { caseById } from "./cases";

let pool;
const getPool = () => (pool ||= mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1", port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root", password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME, connectionLimit: 4, connectTimeout: 4000, decimalNumbers: true,
}));

const INT = ["tinyint", "smallint", "mediumint", "int", "bigint"], NUM = [...INT, "decimal"], STR = ["varchar", "char"], DT = ["datetime", "timestamp", "date"];
const label = k => (k === INT ? "bilangan bulat (INT/BIGINT)" : k === NUM ? "angka (DECIMAL atau INT)" : k === STR ? "teks (VARCHAR)" : k === DT ? "tanggal/waktu (DATETIME/TIMESTAMP)" : k.join("/"));

const T = {
  kategori: { cols: { id: INT, nama: STR }, pk: ["id"] },
  produk: { cols: { id: INT, nama: STR, harga: NUM, stok: INT }, pk: ["id"] },
  produk2: { cols: { id: INT, nama: STR, harga: NUM, stok: INT, kategori_id: INT }, pk: ["id"], fks: [["kategori_id", "kategori", "id"]] },
  pelanggan: { cols: { id: INT, nama: STR, email: STR }, pk: ["id"], unique: [["email"]] },
  transaksi: { cols: { id: INT, pelanggan_id: INT, total: NUM, dibuat_pada: DT }, pk: ["id"], fks: [["pelanggan_id", "pelanggan", "id"]] },
  pesanan: { cols: { id: INT, pelanggan_id: INT, tanggal: DT, status: STR }, pk: ["id"], fks: [["pelanggan_id", "pelanggan", "id"]] },
  detail: { cols: { pesanan_id: INT, produk_id: INT, qty: INT, harga_satuan: NUM }, pk: ["pesanan_id", "produk_id"], fks: [["pesanan_id", "pesanan", "id"], ["produk_id", "produk", "id"]] },
};
const SPEC = {
  1: { tables: { produk: T.produk } },
  2: { tables: { kategori: T.kategori, produk: T.produk2 } },
  3: { tables: { pelanggan: T.pelanggan, transaksi: T.transaksi } },
  4: { tables: { pelanggan: T.pelanggan, produk: T.produk, pesanan: T.pesanan, detail_pesanan: T.detail } },
  5: { tables: { kategori: T.kategori, produk: T.produk2, pelanggan: T.pelanggan, pesanan: T.pesanan, detail_pesanan: T.detail },
    indexes: [["pesanan", "tanggal"]], innodb: true,
    view: { name: "v_laporan_penjualan", cols: { bulan: [...STR, ...DT], kategori: STR, jumlah_pesanan: NUM, total_penjualan: NUM } } },
};

async function introspect(db) {
  const q = sql => getPool().query(sql, [db]).then(r => r[0]);
  const [cols, fks, stats, tabs] = await Promise.all([
    q("SELECT LOWER(TABLE_NAME) t, COLUMN_NAME c, DATA_TYPE d, EXTRA e FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=?"),
    q("SELECT LOWER(TABLE_NAME) t, COLUMN_NAME c, LOWER(REFERENCED_TABLE_NAME) rt, REFERENCED_COLUMN_NAME rc FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND REFERENCED_TABLE_NAME IS NOT NULL"),
    q("SELECT LOWER(TABLE_NAME) t, INDEX_NAME i, COLUMN_NAME c, NON_UNIQUE nu, SEQ_IN_INDEX s FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? ORDER BY INDEX_NAME, SEQ_IN_INDEX"),
    q("SELECT LOWER(TABLE_NAME) t, TABLE_TYPE tt, ENGINE e FROM information_schema.TABLES WHERE TABLE_SCHEMA=?"),
  ]);
  return { cols, fks, stats, tabs };
}

const issue = (code, title, detail, hint) => ({ code, title, detail, hint });

function validate(spec, meta, hints) {
  const out = [], { cols, fks, stats, tabs } = meta;
  const H = (full, short) => (hints === "full" ? full : hints === "short" ? short : undefined);
  const idx = (t, name) => { const m = new Map(); stats.filter(s => s.t === t).forEach(s => { (m.get(s.i) || m.set(s.i, []).get(s.i)).push(s.c); }); return name ? m.get(name) : m; };
  for (const [t, def] of Object.entries(spec.tables)) {
    const tb = tabs.find(x => x.t === t);
    if (!tb) { out.push(issue("TABLE_MISSING", `Tabel '${t}' tidak ditemukan`, `ER_NO_SUCH_TABLE: Table '${process.env.DB_NAME}.${t}' doesn't exist`,
      H(`Buat tabel ${t} dengan kolom: ${Object.entries(def.cols).map(([c, k]) => `${c} (${label(k)})`).join(", ")}.`, `Tabel ${t} belum dibuat.`))); continue; }
    if (tb.tt === "VIEW") { out.push(issue("TABLE_MISSING", `'${t}' adalah VIEW, bukan tabel`, `Objek ${t} bertipe VIEW`, H("Buat sebagai tabel biasa (CREATE TABLE).", undefined))); continue; }
    const mine = cols.filter(c => c.t === t);
    for (const [c, kinds] of Object.entries(def.cols)) {
      const col = mine.find(x => x.c.toLowerCase() === c);
      if (!col) out.push(issue("COLUMN_MISSING", `Kolom '${c}' tidak ada di tabel '${t}'`, `ER_BAD_FIELD_ERROR: Unknown column '${t}.${c}' in 'field list'`, H(`Tambahkan kolom ${c} bertipe ${label(kinds)}: ALTER TABLE ${t} ADD COLUMN ${c} ...;`, `Periksa kolom ${c}.`)));
      else if (!kinds.includes(col.d)) out.push(issue("TYPE_MISMATCH", `Tipe kolom '${t}.${c}' salah`, `Ditemukan '${col.d}', diharapkan ${label(kinds)}`, H(`Ubah dengan ALTER TABLE ${t} MODIFY ${c} <tipe yang benar>;`, `Tipe ${c} perlu diperbaiki.`)));
    }
    const pks = idx(t, "PRIMARY");
    if (!pks || pks.length !== def.pk.length || !def.pk.every(c => pks.some(p => p.toLowerCase() === c))) out.push(issue("PK_MISSING", `PRIMARY KEY tabel '${t}' belum benar`, `Diharapkan PRIMARY KEY (${def.pk.join(", ")})${pks ? `, ditemukan (${pks.join(", ")})` : ", tidak ada"}`, H(`ALTER TABLE ${t} ADD PRIMARY KEY (${def.pk.join(", ")});`, undefined)));
    for (const [c, rt, rc] of def.fks || []) if (!fks.some(f => f.t === t && f.c.toLowerCase() === c && f.rt === rt && f.rc.toLowerCase() === rc))
      out.push(issue("FK_MISSING", `FOREIGN KEY ${t}.${c} → ${rt}.${rc} belum ada`, `ER_NO_REFERENCED_ROW: constraint relasi tidak ditemukan`, H(`ALTER TABLE ${t} ADD FOREIGN KEY (${c}) REFERENCES ${rt}(${rc});`, `Hubungkan ${t}.${c} ke ${rt}.`)));
    for (const u of def.unique || []) if (![...idx(t).entries()].some(([n, cs]) => n !== "PRIMARY" && cs.length === u.length && u.every(c => cs.some(x => x.toLowerCase() === c)) && stats.find(s => s.t === t && s.i === n).nu === 0))
      out.push(issue("UNIQUE_MISSING", `Kolom ${u.join(", ")} di '${t}' belum UNIQUE`, "Data duplikat masih mungkin masuk", H(`ALTER TABLE ${t} ADD UNIQUE (${u.join(", ")});`, undefined)));
    if (spec.innodb && tb.e && tb.e.toLowerCase() !== "innodb") out.push(issue("ENGINE_MISMATCH", `Tabel '${t}' memakai engine ${tb.e}`, "Gunakan InnoDB agar mendukung FOREIGN KEY & transaksi", undefined));
  }
  for (const [t, c] of spec.indexes || []) if (tabs.some(x => x.t === t) && ![...idx(t).entries()].some(([, cs]) => cs[0]?.toLowerCase() === c))
    out.push(issue("INDEX_MISSING", `INDEX pada ${t}.${c} belum ada`, "Filter periode akan melakukan full table scan", undefined));
  if (spec.view) {
    const v = spec.view, tb = tabs.find(x => x.t === v.name);
    if (!tb || tb.tt !== "VIEW") out.push(issue("VIEW_MISSING", `VIEW '${v.name}' belum dibuat`, `ER_NO_SUCH_TABLE: View '${process.env.DB_NAME}.${v.name}' doesn't exist`, undefined));
    else for (const [c, kinds] of Object.entries(v.cols)) {
      const col = cols.find(x => x.t === v.name && x.c.toLowerCase() === c);
      if (!col) out.push(issue("COLUMN_MISSING", `Kolom '${c}' tidak ada di VIEW '${v.name}'`, `ER_BAD_FIELD_ERROR: Unknown column '${c}' in 'field list'`, undefined));
      else if (!kinds.includes(col.d)) out.push(issue("TYPE_MISMATCH", `Tipe kolom '${v.name}.${c}' salah`, `Ditemukan '${col.d}', diharapkan ${label(kinds)}`, undefined));
    }
  }
  return out;
}

const rowsOf = (sql, p) => getPool().query(sql, p).then(r => r[0]);
const empty = (title, detail) => [issue("EMPTY_DATA", title, detail)];

const FETCH = {
  1: async () => {
    const rows = await rowsOf("SELECT id, nama, harga, stok FROM produk ORDER BY id");
    const bad = [];
    if (rows.length < 3) bad.push(...empty("Data produk kurang", `Ditemukan ${rows.length} baris, minimal 3.`));
    if (rows.some(r => !(r.harga > 0) || !String(r.nama || "").trim())) bad.push(...empty("Data produk tidak valid", "Semua produk harus punya nama dan harga > 0."));
    return { bad, data: { produk: rows } };
  },
  2: async () => {
    const rows = await rowsOf("SELECT p.id, p.nama, p.harga, p.stok, k.nama AS kategori FROM produk p JOIN kategori k ON k.id = p.kategori_id ORDER BY k.nama, p.nama");
    const [{ n }] = await rowsOf("SELECT COUNT(*) n FROM produk WHERE kategori_id IS NULL");
    const bad = [];
    if (rows.length < 4) bad.push(...empty("Data produk berkategori kurang", `Ditemukan ${rows.length} produk yang terhubung ke kategori, minimal 4.`));
    if (new Set(rows.map(r => r.kategori)).size < 2) bad.push(...empty("Kategori kurang", "Minimal 2 kategori berbeda yang dipakai produk."));
    if (n > 0) bad.push(...empty("Ada produk tanpa kategori", `${n} produk memiliki kategori_id NULL.`));
    return { bad, data: { produk: rows } };
  },
  3: async () => {
    const rows = await rowsOf("SELECT p.id, p.nama, p.email, COUNT(t.id) AS jumlah_transaksi, COALESCE(SUM(t.total),0) AS total FROM pelanggan p LEFT JOIN transaksi t ON t.pelanggan_id = p.id GROUP BY p.id, p.nama, p.email ORDER BY total DESC");
    const trx = rows.reduce((a, r) => a + Number(r.jumlah_transaksi), 0), bad = [];
    if (rows.length < 3) bad.push(...empty("Data pelanggan kurang", `Ditemukan ${rows.length}, minimal 3.`));
    if (trx < 3) bad.push(...empty("Data transaksi kurang", `Ditemukan ${trx}, minimal 3.`));
    if (!rows.some(r => Number(r.jumlah_transaksi) === 0)) bad.push(...empty("Tidak ada pelanggan tanpa transaksi", "Kasus ini butuh minimal 1 pelanggan yang belum pernah belanja."));
    if (trx && !rows.some(r => Number(r.total) > 0)) bad.push(...empty("Total transaksi bernilai 0", "Isi kolom total dengan nilai > 0."));
    return { bad, data: { pelanggan: rows } };
  },
  4: async () => {
    const rows = await rowsOf("SELECT ps.id AS pesanan_id, ps.tanggal, ps.status, pl.nama AS pelanggan, pr.nama AS produk, d.qty, d.harga_satuan, d.qty * d.harga_satuan AS subtotal FROM pesanan ps JOIN pelanggan pl ON pl.id = ps.pelanggan_id JOIN detail_pesanan d ON d.pesanan_id = ps.id JOIN produk pr ON pr.id = d.produk_id ORDER BY ps.id, pr.nama");
    const bad = [];
    const by = rows.reduce((m, r) => ((m[r.pesanan_id] ||= []).push(r), m), {});
    if (!rows.length) bad.push(...empty("Belum ada detail pesanan", "Isi pesanan dan detail_pesanan, lalu hubungkan dengan pelanggan & produk yang ada."));
    else if (!Object.values(by).some(l => l.length >= 2)) bad.push(...empty("Belum ada pesanan dengan 2 item", "Minimal 1 pesanan harus memiliki 2 baris detail atau lebih."));
    if (rows.some(r => !(r.qty > 0))) bad.push(...empty("Qty tidak valid", "qty harus > 0."));
    return { bad, data: { rows, pesanan: by } };
  },
  5: async () => {
    const rows = await rowsOf("SELECT bulan, kategori, jumlah_pesanan, total_penjualan FROM v_laporan_penjualan ORDER BY bulan, kategori");
    const [{ t }] = await rowsOf("SELECT COALESCE(SUM(d.qty * d.harga_satuan),0) t FROM detail_pesanan d JOIN pesanan ps ON ps.id = d.pesanan_id JOIN produk pr ON pr.id = d.produk_id WHERE pr.kategori_id IS NOT NULL");
    const sum = rows.reduce((a, r) => a + Number(r.total_penjualan), 0), bad = [];
    if (rows.length < 2 || new Set(rows.map(r => r.kategori)).size < 2) bad.push(...empty("VIEW belum menghasilkan data yang cukup", "Minimal 2 baris dengan 2 kategori berbeda (isi lebih banyak pesanan)."));
    if (Math.abs(sum - Number(t)) > 0.01) bad.push(issue("DATA_MISMATCH", "Angka VIEW tidak cocok dengan tabel dasar", `Total VIEW = ${sum}, total dari detail_pesanan = ${Number(t)}. Periksa JOIN dan agregasi (SUM qty * harga_satuan).`));
    return { bad, data: { rows, total: sum } };
  },
};

export async function runCase(id) {
  const c = caseById(id), spec = SPEC[id];
  if (!process.env.DB_NAME) return { ok: false, issues: [issue("CONNECTION", "DB_NAME belum diisi", "Isi DB_NAME di .env.local lalu restart (npm run build && npm start).", "Salin .env.example menjadi .env.local.")] };
  let meta;
  try { meta = await introspect(process.env.DB_NAME); }
  catch (e) {
    const m = e.code === "ER_BAD_DB_ERROR" ? `Database '${process.env.DB_NAME}' belum dibuat` : e.code === "ECONNREFUSED" ? "MySQL tidak menyala (cek XAMPP/Laragon)" : e.code === "ER_ACCESS_DENIED_ERROR" ? "User/password MySQL salah" : "Tidak dapat terhubung ke MySQL";
    return { ok: false, issues: [issue("CONNECTION", m, `${e.code || "ERROR"}: ${e.message}`, "Periksa DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME di .env.local.")] };
  }
  const issues = validate(spec, meta, c.hints);
  if (issues.length) return { ok: false, issues };
  try {
    const { bad, data } = await FETCH[id]();
    return bad.length ? { ok: false, issues: bad } : { ok: true, issues: [], data };
  } catch (e) {
    return { ok: false, issues: [issue("QUERY_ERROR", "Query gagal dijalankan", `${e.code || "ERROR"}: ${e.sqlMessage || e.message}`)] };
  }
}
