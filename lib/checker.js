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
const ROLE = [...STR, "enum"];
T.kasir = { cols: { id: INT, username: STR, nama: STR, role: ROLE, aktif: INT, dibuat_pada: DT }, pk: ["id"], unique: [["username"]] };
T.metode = { cols: { id: INT, nama: STR }, pk: ["id"], unique: [["nama"]] };
T.struk = { cols: { id: INT, nomor: STR, kasir_id: INT, metode_bayar_id: INT, waktu: DT, total: NUM }, pk: ["id"], unique: [["nomor"]], fks: [["kasir_id", "kasir", "id"], ["metode_bayar_id", "metode_bayar", "id"]] };
T.item = { cols: { struk_id: INT, produk_id: INT, qty: INT, harga_satuan: NUM }, pk: ["struk_id", "produk_id"], fks: [["struk_id", "struk", "id"], ["produk_id", "produk", "id"]] };
T.mutasi = { cols: { id: INT, produk_id: INT, perubahan: INT, jenis: STR, ref_struk_id: INT, waktu: DT }, pk: ["id"], fks: [["produk_id", "produk", "id"], ["ref_struk_id", "struk", "id"]] };
const W2 = { kategori: T.kategori, produk: T.produk2, kasir: T.kasir, metode_bayar: T.metode, struk: T.struk, struk_item: T.item };
const SPEC = {
  1: { tables: { produk: T.produk } },
  2: { tables: { kategori: T.kategori, produk: T.produk2 } },
  3: { tables: { pelanggan: T.pelanggan, transaksi: T.transaksi } },
  4: { tables: { pelanggan: T.pelanggan, produk: T.produk, pesanan: T.pesanan, detail_pesanan: T.detail } },
  5: { tables: { kategori: T.kategori, produk: T.produk2, pelanggan: T.pelanggan, pesanan: T.pesanan, detail_pesanan: T.detail },
    indexes: [["pesanan", "tanggal"]], innodb: true,
    view: { name: "v_laporan_penjualan", cols: { bulan: [...STR, ...DT], kategori: STR, jumlah_pesanan: NUM, total_penjualan: NUM } } },
  6: { tables: { kasir: T.kasir }, innodb: true },
  7: { tables: W2, innodb: true },
  8: { tables: W2, innodb: true, rules: [
    { t: "struk_item", c: "struk_id", rt: "struk", want: ["CASCADE"], add: "ON DELETE CASCADE" },
    { t: "struk", c: "kasir_id", rt: "kasir", want: ["RESTRICT", "NO ACTION"], add: "ON DELETE RESTRICT" }] },
  9: { tables: { ...W2, stok_mutasi: T.mutasi }, innodb: true },
  10: { tables: { ...W2, stok_mutasi: T.mutasi }, innodb: true, indexes: [["struk", "waktu"]],
    trigger: { table: "struk_item", timing: "AFTER", event: "INSERT" },
    view: { name: "v_rekap_kasir_harian", cols: { tanggal: DT, kasir: STR, jumlah_struk: NUM, omzet: NUM } } },
};

// ---------- Minggu 3 ----------
T.pengguna = { cols: { id: INT, username: STR, nama: STR, password_hash: STR, dibuat_pada: DT }, pk: ["id"], unique: [["username"]] };
T.produk3 = { cols: { id: INT, nama: STR, harga: NUM, stok: INT, dibuat_pada: DT, diubah_pada: DT, dihapus_pada: DT }, pk: ["id"] };
T.peran = { cols: { id: INT, nama: STR }, pk: ["id"], unique: [["nama"]] };
T.izin = { cols: { id: INT, kode: STR }, pk: ["id"], unique: [["kode"]] };
T.peranIzin = { cols: { peran_id: INT, izin_id: INT }, pk: ["peran_id", "izin_id"], fks: [["peran_id", "peran", "id"], ["izin_id", "izin", "id"]] };
T.pengguna2 = { ...T.pengguna, cols: { ...T.pengguna.cols, peran_id: INT }, fks: [["peran_id", "peran", "id"]] };
const W3 = { ...W2, stok_mutasi: T.mutasi };
Object.assign(SPEC, {
  11: { tables: { pengguna: T.pengguna }, innodb: true, minLen: [["pengguna", "password_hash", 60]] },
  12: { tables: { produk: T.produk3 }, innodb: true, extra: [{ t: "produk", c: "diubah_pada", has: "on update", title: "diubah_pada belum ON UPDATE CURRENT_TIMESTAMP", add: "ALTER TABLE produk MODIFY diubah_pada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;" }],
    defaults: [["produk", "dibuat_pada"]], nullable: [["produk", "dihapus_pada"]],
    view: { name: "v_produk_aktif", cols: { id: INT, nama: STR, harga: NUM, stok: INT } } },
  13: { tables: { peran: T.peran, izin: T.izin, peran_izin: T.peranIzin, pengguna: T.pengguna2 }, innodb: true },
  14: { tables: { produk: T.produk } },
  15: { tables: W3, innodb: true, routine: { name: "sp_checkout", modes: ["IN", "IN", "IN", "IN", "OUT"] } },
});

async function introspect(db, spec = {}) {
  const q = sql => getPool().query(sql, [db]).then(r => r[0]);
  const [cols, fks, stats, tabs, rules, trigs] = await Promise.all([
    q("SELECT LOWER(TABLE_NAME) t, COLUMN_NAME c, DATA_TYPE d, EXTRA e, COLUMN_DEFAULT cd, IS_NULLABLE nl, CHARACTER_MAXIMUM_LENGTH ml FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=?"),
    q("SELECT LOWER(TABLE_NAME) t, CONSTRAINT_NAME cn, COLUMN_NAME c, LOWER(REFERENCED_TABLE_NAME) rt, REFERENCED_COLUMN_NAME rc FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND REFERENCED_TABLE_NAME IS NOT NULL"),
    q("SELECT LOWER(TABLE_NAME) t, INDEX_NAME i, COLUMN_NAME c, NON_UNIQUE nu, SEQ_IN_INDEX s FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? ORDER BY INDEX_NAME, SEQ_IN_INDEX"),
    q("SELECT LOWER(TABLE_NAME) t, TABLE_TYPE tt, ENGINE e FROM information_schema.TABLES WHERE TABLE_SCHEMA=?"),
    q("SELECT LOWER(TABLE_NAME) t, CONSTRAINT_NAME cn, UPPER(DELETE_RULE) r FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=?"),
    q("SELECT LOWER(EVENT_OBJECT_TABLE) t, TRIGGER_NAME n, UPPER(ACTION_TIMING) a, UPPER(EVENT_MANIPULATION) e FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=?"),
  ]);
  const routs = spec.routine ? await q("SELECT LOWER(ROUTINE_NAME) n, ROUTINE_TYPE t, ROUTINE_DEFINITION d FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=?") : [];
  const params = spec.routine ? await q("SELECT LOWER(SPECIFIC_NAME) n, ORDINAL_POSITION o, UPPER(PARAMETER_MODE) m, DATA_TYPE d FROM information_schema.PARAMETERS WHERE SPECIFIC_SCHEMA=? AND ROUTINE_TYPE='PROCEDURE' ORDER BY SPECIFIC_NAME, ORDINAL_POSITION") : [];
  return { cols, fks, stats, tabs, rules, trigs, routs, params };
}

const issue = (code, title, detail, hint) => ({ code, title, detail, hint });

function validate(spec, meta, hints) {
  const out = [], { cols, fks, stats, tabs, rules, trigs } = meta;
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
    if (spec.innodb && tb.e && tb.e.toLowerCase() !== "innodb") out.push(issue("ENGINE_MISMATCH", `Tabel '${t}' memakai engine ${tb.e}`, "Gunakan InnoDB agar mendukung FOREIGN KEY & transaksi", H(`ALTER TABLE ${t} ENGINE=InnoDB;`, `ALTER TABLE ${t} ENGINE=InnoDB;`)));
  }
  for (const r of spec.rules || []) {
    const f = fks.find(x => x.t === r.t && x.c.toLowerCase() === r.c && x.rt === r.rt);
    if (!f) continue; // FK_MISSING sudah dilaporkan di atas
    const got = rules.find(x => x.t === r.t && x.cn === f.cn)?.r;
    if (got && !r.want.includes(got)) out.push(issue("FK_RULE", `Aturan ON DELETE ${r.t}.${r.c} → ${r.rt} salah`, `DELETE_RULE ditemukan: ${got}; diharapkan: ${r.want.join(" / ")} (constraint ${f.cn})`,
      H(`ALTER TABLE ${r.t} DROP FOREIGN KEY ${f.cn}, ADD FOREIGN KEY (${r.c}) REFERENCES ${r.rt}(id) ${r.add};`, `Ubah aturan FK ${f.cn} menjadi ${r.add}.`)));
  }
  for (const [t, c, n] of spec.minLen || []) {
    const col = cols.find(x => x.t === t && x.c.toLowerCase() === c);
    if (col && col.ml != null && Number(col.ml) < n) out.push(issue("TYPE_MISMATCH", `Kolom '${t}.${c}' terlalu pendek`, `Panjang maksimum ${col.ml}, dibutuhkan minimal ${n} (hash bcrypt = 60 karakter; terlalu pendek akan terpotong diam-diam)`, H(`ALTER TABLE ${t} MODIFY ${c} VARCHAR(255) NOT NULL;`, undefined)));
  }
  for (const x of spec.extra || []) {
    const col = cols.find(y => y.t === x.t && y.c.toLowerCase() === x.c);
    if (col && !String(col.e || "").toLowerCase().includes(x.has)) out.push(issue("DEFAULT_MISSING", x.title, `EXTRA kolom ${x.t}.${x.c}: '${col.e || ""}' (tidak memuat '${x.has}')`, H(x.add, undefined)));
  }
  for (const [t, c] of spec.defaults || []) {
    const col = cols.find(y => y.t === t && y.c.toLowerCase() === c);
    if (col && !/current_timestamp|now\(/i.test(String(col.cd ?? ""))) out.push(issue("DEFAULT_MISSING", `${t}.${c} belum DEFAULT CURRENT_TIMESTAMP`, `COLUMN_DEFAULT: ${col.cd ?? "NULL"}`, H(`ALTER TABLE ${t} MODIFY ${c} DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;`, undefined)));
  }
  for (const [t, c] of spec.nullable || []) {
    const col = cols.find(y => y.t === t && y.c.toLowerCase() === c);
    if (col && col.nl !== "YES") out.push(issue("TYPE_MISMATCH", `${t}.${c} harus boleh NULL`, "NULL berarti 'belum dihapus'. Kolom NOT NULL tidak bisa menandai produk yang masih aktif.", H(`ALTER TABLE ${t} MODIFY ${c} DATETIME NULL DEFAULT NULL;`, undefined)));
  }
  if (spec.routine) {
    const r = spec.routine, p = meta.routs.find(x => x.n === r.name && String(x.t).toUpperCase() === "PROCEDURE");
    if (!p) out.push(issue("ROUTINE_MISSING", `PROCEDURE ${r.name} belum dibuat`, `Tidak ada stored procedure bernama ${r.name} di database '${process.env.DB_NAME}'`, undefined));
    else {
      const ps = meta.params.filter(x => x.n === r.name).sort((a, b) => a.o - b.o);
      if (ps.length !== r.modes.length || !ps.every((x, i) => x.m === r.modes[i] && INT.includes(String(x.d).toLowerCase())))
        out.push(issue("ROUTINE_SIGNATURE", `Parameter ${r.name} tidak sesuai`, `Ditemukan: (${ps.map(x => `${x.m} ${x.d}`).join(", ") || "tanpa parameter"}); diharapkan: (${r.modes.map(m => `${m} INT`).join(", ")}) berurutan kasir, metode_bayar, produk, qty, struk_id.`, undefined));
      const body = String(p.d || "");
      if (/\bCOMMIT\b|\bSTART\s+TRANSACTION\b|\bBEGIN\s+WORK\b/i.test(body)) out.push(issue("ROUTINE_TXN", `${r.name} mengatur transaksi sendiri`, "Ditemukan COMMIT / START TRANSACTION di dalam prosedur. COMMIT di dalam prosedur akan menyimpan permanen semua yang sudah dilakukan pemanggil.", "Hapus COMMIT / START TRANSACTION. Biarkan pemanggil (aplikasi) yang memulai dan mengakhiri transaksi."));
      if (!/SIGNAL\s+SQLSTATE\s+'45000'/i.test(body)) out.push(issue("ROUTINE_SIGNAL", `${r.name} belum memakai SIGNAL SQLSTATE '45000'`, "Penolakan penjualan harus berupa error eksplisit agar aplikasi tahu penyebabnya.", undefined));
    }
  }
  if (spec.trigger) {
    const g = spec.trigger;
    if (tabs.some(x => x.t === g.table) && !trigs.some(x => x.t === g.table && x.a === g.timing && x.e === g.event))
      out.push(issue("TRIGGER_MISSING", `TRIGGER ${g.timing} ${g.event} pada ${g.table} belum ada`, `Tidak ada trigger ${g.timing} ${g.event} di tabel ${g.table}${trigs.some(x => x.t === g.table) ? ` (ditemukan: ${trigs.filter(x => x.t === g.table).map(x => `${x.n} ${x.a} ${x.e}`).join(", ")})` : ""}`, undefined));
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

// ---------- Minggu 2: uji perilaku ----------
// Semua uji berjalan di koneksi khusus: START TRANSACTION ... selalu ROLLBACK, tanpa DDL dan tanpa COMMIT.
// Sebelum menyentuh data, semua tabel terkait wajib InnoDB; jika tidak, uji ditolak agar data mahasiswa tidak pernah berubah.
const errTxt = e => `${e.code || "ERROR"} (${e.errno || "?"}): ${e.sqlMessage || e.message}`;
const HH = hints => (full, short) => (hints === "full" ? full : hints === "short" ? short : undefined);
const attempt = (conn, sql, p) => conn.query(sql, p).then(r => ({ r: r[0] }), e => ({ e }));
async function scope(conn, fn) { // semua perubahan di dalam fn dibatalkan lewat SAVEPOINT
  await conn.query("SAVEPOINT uji");
  try { return await fn(); } finally { await conn.query("ROLLBACK TO SAVEPOINT uji").catch(() => {}); }
}

async function sandbox(tables, fn) {
  const conn = await getPool().getConnection();
  let broken = false;
  try {
    const [eng] = await conn.query("SELECT LOWER(TABLE_NAME) t, TABLE_TYPE tt, ENGINE e FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND LOWER(TABLE_NAME) IN (?)", [process.env.DB_NAME, tables]);
    const bad = tables.filter(t => { const x = eng.find(r => r.t === t); return !x || x.tt === "VIEW" || String(x.e).toLowerCase() !== "innodb"; });
    if (bad.length) return bad.map(t => issue("ENGINE_MISMATCH", `Uji perilaku ditolak: tabel '${t}' bukan InnoDB`, `Engine ${eng.find(r => r.t === t)?.e || "?"}. Uji butuh transaksi (ROLLBACK) agar datamu aman.`, `ALTER TABLE ${t} ENGINE=InnoDB;`));
    await conn.query("SET SESSION sql_mode=CONCAT(@@sql_mode, ',STRICT_ALL_TABLES'), innodb_lock_wait_timeout=3");
    await conn.query("START TRANSACTION");
    return await fn(conn);
  } finally {
    try { await conn.query("ROLLBACK"); await conn.query("SET SESSION sql_mode=DEFAULT, innodb_lock_wait_timeout=DEFAULT"); } catch { broken = true; }
    if (broken) conn.destroy(); else conn.release();
  }
}

const W2_TABLES = ["kasir", "metode_bayar", "struk", "struk_item", "produk"];
const behave6 = (H, out) => async conn => {
  const u = "uji_" + Date.now().toString(36);
  const ins = (username, role) => attempt(conn, "INSERT INTO kasir (username, nama, role) VALUES (?, ?, ?)", [username, "Uji Kasir", role]);
  const bad = await scope(conn, () => ins(u + "_r", "x"));
  if (!bad.e) out.push(issue("CHECK_MISSING", "Kolom role belum dibatasi", "INSERT dengan role 'x' berhasil. Seharusnya ditolak (ER_CONSTRAINT_FAILED / ER_WRONG_VALUE_FOR_TYPE).", H("Tambahkan: ALTER TABLE kasir ADD CONSTRAINT chk_role CHECK (role IN ('admin','kasir')); atau ubah tipe menjadi ENUM('admin','kasir').", "Batasi role hanya 'admin' dan 'kasir'.")));
  await scope(conn, async () => {
    const ok = await ins(u, "kasir");
    if (ok.e) { out.push(issue("INSERT_FAILED", "INSERT kasir uji gagal", `${errTxt(ok.e)}. Baris dengan (username, nama, role) saja harus bisa dimasukkan.`, H("Beri DEFAULT pada kolom lain (aktif, dibuat_pada) dan AUTO_INCREMENT pada id.", undefined))); return; }
    const [[row]] = await conn.query("SELECT aktif, dibuat_pada FROM kasir WHERE username=?", [u]);
    if (row.dibuat_pada == null) out.push(issue("DEFAULT_MISSING", "dibuat_pada tidak terisi otomatis", "Baris baru tanpa dibuat_pada menghasilkan NULL.", H("ALTER TABLE kasir MODIFY dibuat_pada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;", undefined)));
    if (Number(row.aktif) !== 1) out.push(issue("DEFAULT_MISSING", "aktif belum bernilai 1 secara default", `Baris baru mendapat aktif = ${row.aktif}.`, H("ALTER TABLE kasir MODIFY aktif TINYINT(1) NOT NULL DEFAULT 1;", undefined)));
    const dup = await ins(u, "kasir");
    if (!dup.e) out.push(issue("UNIQUE_MISSING", "username kembar masih bisa masuk", "INSERT username yang sama dua kali berhasil.", H("ALTER TABLE kasir ADD UNIQUE (username);", undefined)));
  });
};

const behave8 = (H, out) => async conn => {
  const [[s]] = await conn.query("SELECT s.id, s.kasir_id, i.produk_id FROM struk s JOIN struk_item i ON i.struk_id = s.id ORDER BY s.id, i.produk_id LIMIT 1");
  await scope(conn, async () => { // hapus struk -> item ikut terhapus
    const d = await attempt(conn, "DELETE FROM struk WHERE id=?", [s.id]);
    if (d.e) {
      if (d.e.errno === 1451 && !/`struk_item`/.test(d.e.sqlMessage || "")) return; // diblokir tabel lain (mis. stok_mutasi), tak relevan di sini
      out.push(issue("CASCADE_FAILED", "Menghapus struk beserta item gagal", errTxt(d.e), H("Ubah FK struk_item.struk_id menjadi ON DELETE CASCADE.", undefined))); return;
    }
    const [[{ n }]] = await conn.query("SELECT COUNT(*) n FROM struk_item WHERE struk_id=?", [s.id]);
    if (n > 0) out.push(issue("CASCADE_FAILED", "Item struk tidak ikut terhapus", `${n} item masih ada setelah struk dihapus.`));
  });
  await scope(conn, async () => { // kasir yang punya struk tidak boleh dihapus
    const d = await attempt(conn, "DELETE FROM kasir WHERE id=?", [s.kasir_id]);
    if (!d.e) out.push(issue("RESTRICT_FAILED", "Kasir yang punya struk bisa terhapus", "DELETE kasir berhasil padahal masih punya struk. Seharusnya ER_ROW_IS_REFERENCED_2 (1451).", H("Ubah FK struk.kasir_id menjadi ON DELETE RESTRICT.", undefined)));
    else if (d.e.errno !== 1451) out.push(issue("RESTRICT_FAILED", "DELETE kasir gagal dengan error tak terduga", errTxt(d.e)));
  });
  const chk = async (sql, p, title, detail, hint) => {
    const r = await scope(conn, () => attempt(conn, sql, p));
    if (!r.e) out.push(issue("CHECK_MISSING", title, detail, hint));
  };
  await chk("UPDATE struk_item SET qty=0 WHERE struk_id=? AND produk_id=?", [s.id, s.produk_id], "CHECK qty > 0 belum aktif", "UPDATE struk_item SET qty = 0 berhasil. Seharusnya ditolak (MySQL 3819 / MariaDB 4025 ER_CONSTRAINT_FAILED).", H("ALTER TABLE struk_item ADD CONSTRAINT chk_qty CHECK (qty > 0);", "Tambahkan CHECK pada struk_item.qty. MySQL < 8.0.16 mengabaikan CHECK."));
  await chk("UPDATE produk SET stok=-1 WHERE id=?", [s.produk_id], "CHECK stok >= 0 belum aktif", "UPDATE produk SET stok = -1 berhasil. Seharusnya ditolak (MySQL 3819 / MariaDB 4025 ER_CONSTRAINT_FAILED).", H("ALTER TABLE produk ADD CONSTRAINT chk_stok CHECK (stok >= 0);", "Tambahkan CHECK pada produk.stok."));
};

const behave10 = (out, uji) => async conn => {
  const [[pick]] = await conn.query("SELECT s.id sid, pr.id pid, pr.nama, pr.stok FROM struk s JOIN produk pr ON pr.stok >= 1 AND NOT EXISTS (SELECT 1 FROM struk_item x WHERE x.struk_id = s.id AND x.produk_id = pr.id) ORDER BY s.id, pr.id LIMIT 1");
  if (!pick) { out.push(issue("EMPTY_DATA", "Uji trigger butuh data", "Harus ada produk dengan stok >= 1 yang belum ada di salah satu struk. Tambah produk atau stoknya.")); return; }
  const qty = pick.stok >= 2 ? 2 : 1;
  await scope(conn, async () => {
    const [[{ m }]] = await conn.query("SELECT COALESCE(MAX(id), 0) m FROM stok_mutasi");
    const ins = await attempt(conn, "INSERT INTO struk_item (struk_id, produk_id, qty, harga_satuan) VALUES (?, ?, ?, 1000)", [pick.sid, pick.pid, qty]);
    if (ins.e) { out.push(issue("TRIGGER_ERROR", "INSERT struk_item uji gagal", `${errTxt(ins.e)}. Periksa isi trigger (nama kolom, tabel, tipe data).`)); return; }
    const [[{ stok }]] = await conn.query("SELECT stok FROM produk WHERE id=?", [pick.pid]);
    const [mut] = await conn.query("SELECT perubahan, jenis, ref_struk_id FROM stok_mutasi WHERE id > ? AND produk_id=?", [m, pick.pid]);
    uji.push({ produk: pick.nama, qty, sebelum: pick.stok, sesudah: stok, mutasi: mut.length });
    if (stok !== pick.stok - qty) out.push(issue("TRIGGER_STOK", "Trigger tidak mengurangi stok dengan benar", `Stok produk uji: ${pick.stok} → ${stok} setelah INSERT item qty ${qty}; seharusnya ${pick.stok - qty} (stok = stok - NEW.qty).`));
    if (mut.length !== 1) out.push(issue("TRIGGER_MUTASI", "Trigger tidak mencatat tepat 1 baris stok_mutasi", `Baris mutasi baru: ${mut.length}, seharusnya 1.`));
    else if (mut[0].jenis !== "jual" || Number(mut[0].perubahan) !== -qty || Number(mut[0].ref_struk_id) !== pick.sid)
      out.push(issue("TRIGGER_MUTASI", "Isi baris stok_mutasi dari trigger salah", `Ditemukan jenis='${mut[0].jenis}', perubahan=${mut[0].perubahan}, ref_struk_id=${mut[0].ref_struk_id}; diharapkan 'jual', ${-qty}, ${pick.sid}.`));
  });
};

const DTF = c => `DATE_FORMAT(${c}, '%Y-%m-%d %H:%i')`;
const sample = (rows, f) => rows.slice(0, 5).map(f).join("; ") + (rows.length > 5 ? `; +${rows.length - 5} lagi` : "");
const strukRows = () => rowsOf(`SELECT s.id, s.nomor, ${DTF("s.waktu")} waktu, k.nama kasir, m.nama metode, s.total, pr.nama produk, i.qty, i.harga_satuan
  FROM struk s JOIN kasir k ON k.id = s.kasir_id JOIN metode_bayar m ON m.id = s.metode_bayar_id LEFT JOIN struk_item i ON i.struk_id = s.id LEFT JOIN produk pr ON pr.id = i.produk_id ORDER BY s.waktu, s.id, pr.nama`)
  .then(rows => Object.values(rows.reduce((m, r) => { const o = (m[r.id] ||= { id: r.id, nomor: r.nomor, waktu: r.waktu, kasir: r.kasir, metode: r.metode, total: Number(r.total), items: [] }); if (r.produk) o.items.push({ produk: r.produk, qty: r.qty, harga_satuan: Number(r.harga_satuan) }); return m; }, {})));

Object.assign(FETCH, {
  6: async () => {
    const rows = await rowsOf(`SELECT id, username, nama, role, aktif, ${DTF("dibuat_pada")} dibuat_pada FROM kasir ORDER BY id`), bad = [];
    if (rows.length < 3) bad.push(...empty("Data kasir kurang", `Ditemukan ${rows.length} akun, minimal 3.`));
    if (!rows.some(r => r.role === "admin")) bad.push(...empty("Belum ada admin", "Minimal 1 akun dengan role 'admin'."));
    if (rows.filter(r => r.role === "kasir").length < 2) bad.push(...empty("Kasir kurang", "Minimal 2 akun dengan role 'kasir'."));
    if (rows.some(r => !["admin", "kasir"].includes(r.role))) bad.push(...empty("Ada role tidak valid", "role hanya boleh 'admin' atau 'kasir'."));
    if (rows.some(r => !String(r.username || "").trim() || !String(r.nama || "").trim())) bad.push(...empty("Data kasir tidak valid", "username dan nama tidak boleh kosong."));
    if (!bad.length) { const out = []; bad.push(...await sandbox(["kasir"], async conn => { await behave6(HH(caseById(6).hints), out)(conn); return out; })); }
    return { bad, data: { kasir: rows } };
  },
  7: async () => {
    const struk = await strukRows(), [{ n }] = await rowsOf("SELECT COUNT(*) n FROM metode_bayar"), bad = [];
    if (n < 2) bad.push(...empty("Metode bayar kurang", `Ditemukan ${n}, minimal 2 (mis. Tunai dan QRIS).`));
    if (struk.length < 3) bad.push(...empty("Data struk kurang", `Ditemukan ${struk.length} struk, minimal 3.`));
    if (!struk.some(s => s.items.length >= 2)) bad.push(...empty("Belum ada struk dengan 2 item", "Minimal 1 struk harus memiliki 2 baris struk_item atau lebih."));
    if (struk.some(s => s.items.some(i => !(i.qty > 0) || !(i.harga_satuan > 0)))) bad.push(...empty("Item struk tidak valid", "qty dan harga_satuan harus > 0."));
    return { bad, data: { struk } };
  },
  8: async () => {
    const struk = await strukRows(), bad = [], out = [];
    if (!struk.some(s => s.items.length)) bad.push(...empty("Belum ada struk berisi item", "Selesaikan kasus 7 dulu: uji aturan butuh minimal 1 struk dengan item."));
    if (!bad.length) bad.push(...await sandbox(W2_TABLES, async conn => { await behave8(HH(caseById(8).hints), out)(conn); return out; }));
    const rules = [
      { aturan: "Hapus struk → item ikut terhapus", detail: "struk_item.struk_id ON DELETE CASCADE" },
      { aturan: "Kasir ber-struk tidak bisa dihapus", detail: "struk.kasir_id ON DELETE RESTRICT" },
      { aturan: "Qty item harus positif", detail: "CHECK (qty > 0)" },
      { aturan: "Stok tidak boleh minus", detail: "CHECK (stok >= 0)" },
    ];
    return { bad, data: { rules, struk: struk.length, item: struk.reduce((a, s) => a + s.items.length, 0) } };
  },
  9: async () => {
    const bad = [];
    const tot = await rowsOf("SELECT s.nomor, s.total, COALESCE(SUM(i.qty * i.harga_satuan), 0) hitung FROM struk s LEFT JOIN struk_item i ON i.struk_id = s.id GROUP BY s.id, s.nomor, s.total HAVING ABS(s.total - COALESCE(SUM(i.qty * i.harga_satuan), 0)) > 0.01");
    if (tot.length) bad.push(issue("DATA_MISMATCH", "struk.total tidak sama dengan jumlah item", sample(tot, r => `${r.nomor}: total ${Number(r.total)} vs item ${Number(r.hitung)}`) + ". Hitung ulang: total = SUM(qty * harga_satuan)."));
    const per = await rowsOf("SELECT p.nama, COALESCE(-SUM(CASE WHEN m.jenis = 'jual' THEN m.perubahan END), 0) mutasi, (SELECT COALESCE(SUM(qty), 0) FROM struk_item WHERE produk_id = p.id) terjual FROM produk p LEFT JOIN stok_mutasi m ON m.produk_id = p.id GROUP BY p.id, p.nama HAVING mutasi <> terjual");
    if (per.length) bad.push(issue("DATA_MISMATCH", "Mutasi stok tidak cocok dengan penjualan", sample(per, r => `${r.nama}: mutasi jual ${Number(r.mutasi)} vs terjual ${Number(r.terjual)}`) + ". Setiap struk_item harus punya baris stok_mutasi 'jual' (perubahan negatif)."));
    const [{ n, orphan, pos }] = await rowsOf("SELECT COUNT(*) n, SUM(ref_struk_id IS NULL) orphan, SUM(perubahan > 0) pos FROM stok_mutasi WHERE jenis = 'jual'");
    if (!n) bad.push(...empty("Belum ada mutasi 'jual'", "Catat checkout ke stok_mutasi dengan jenis 'jual'."));
    if (Number(orphan) > 0) bad.push(issue("DATA_MISMATCH", "Mutasi 'jual' tanpa ref_struk_id", `${orphan} baris jenis 'jual' belum menunjuk ke struk.`));
    if (Number(pos) > 0) bad.push(issue("DATA_MISMATCH", "Mutasi 'jual' bernilai positif", `${pos} baris punya perubahan > 0; penjualan harus mengurangi stok (negatif).`));
    const mutasi = await rowsOf(`SELECT m.id, ${DTF("m.waktu")} waktu, p.nama produk, m.perubahan, m.jenis, s.nomor ref FROM stok_mutasi m JOIN produk p ON p.id = m.produk_id LEFT JOIN struk s ON s.id = m.ref_struk_id ORDER BY m.id`);
    const stok = await rowsOf("SELECT nama, stok FROM produk ORDER BY nama");
    return { bad, data: { mutasi: mutasi.map(r => ({ ...r, perubahan: Number(r.perubahan) })), stok } };
  },
  10: async () => {
    const bad = [], uji = [];
    const rows = await rowsOf(`SELECT DATE_FORMAT(tanggal, '%Y-%m-%d') tanggal, kasir, jumlah_struk, omzet FROM v_rekap_kasir_harian ORDER BY tanggal, kasir`);
    const [{ t, n }] = await rowsOf("SELECT COALESCE(SUM(total), 0) t, COUNT(*) n FROM struk");
    const sum = rows.reduce((a, r) => a + Number(r.omzet), 0), cnt = rows.reduce((a, r) => a + Number(r.jumlah_struk), 0);
    if (!rows.length) bad.push(...empty("VIEW belum menghasilkan data", "v_rekap_kasir_harian kosong. Pastikan JOIN ke kasir dan GROUP BY DATE(waktu), kasir."));
    else {
      if (Math.abs(sum - Number(t)) > 0.01) bad.push(issue("DATA_MISMATCH", "Omzet VIEW tidak cocok dengan tabel dasar", `SUM(omzet) VIEW = ${sum}, SUM(struk.total) = ${Number(t)}. Periksa JOIN dan agregasi.`));
      if (cnt !== Number(n)) bad.push(issue("DATA_MISMATCH", "jumlah_struk VIEW tidak cocok", `Total jumlah_struk VIEW = ${cnt}, jumlah baris struk = ${n}. Gunakan COUNT(DISTINCT s.id) bila ada JOIN ke struk_item.`));
    }
    if (!bad.length) bad.push(...await sandbox([...W2_TABLES, "stok_mutasi"], async conn => { const out = []; await behave10(out, uji)(conn); return out; }));
    return { bad, data: { rows: rows.map(r => ({ ...r, jumlah_struk: Number(r.jumlah_struk), omzet: Number(r.omzet) })), total: sum, uji: uji[0] || null } };
  },
});

// ---------- Minggu 3: keamanan aplikasi <-> database ----------
const BCRYPT = /^\$2[aby]\$(\d{2})\$[./A-Za-z0-9]{53}$/;

// Uji ON UPDATE CURRENT_TIMESTAMP: mundurkan diubah_pada, UPDATE kolom lain, pastikan waktunya maju. Selalu di-ROLLBACK.
const behave12 = (H, out, uji) => async conn => {
  const [[p]] = await conn.query("SELECT id FROM produk ORDER BY id LIMIT 1");
  if (!p) { out.push(issue("EMPTY_DATA", "Uji audit butuh data", "Tabel produk kosong.")); return; }
  await scope(conn, async () => {
    const a = await attempt(conn, "UPDATE produk SET diubah_pada='2000-01-01 00:00:00' WHERE id=?", [p.id]);
    if (a.e) { out.push(issue("QUERY_ERROR", "Uji audit gagal disiapkan", errTxt(a.e))); return; }
    const b = await attempt(conn, "UPDATE produk SET stok = stok + 1 WHERE id=?", [p.id]);
    if (b.e) { out.push(issue("QUERY_ERROR", "UPDATE uji pada produk gagal", errTxt(b.e))); return; }
    const [[r]] = await conn.query("SELECT diubah_pada >= '2020-01-01' ok FROM produk WHERE id=?", [p.id]);
    uji.push({ produk: p.id, otomatis: Number(r.ok) === 1 });
    if (Number(r.ok) !== 1) out.push(issue("DEFAULT_MISSING", "diubah_pada tidak ikut berubah saat UPDATE", "Setelah UPDATE stok, diubah_pada masih bernilai lama. Seharusnya terisi otomatis oleh database.", H("ALTER TABLE produk MODIFY diubah_pada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;", undefined)));
  });
};

// Uji prosedur checkout: panggil di dalam transaksi, lalu semua dibatalkan oleh sandbox().
const behave15 = (out, uji) => async conn => {
  const [[k]] = await conn.query("SELECT id FROM kasir ORDER BY id LIMIT 1");
  const [[m]] = await conn.query("SELECT id FROM metode_bayar ORDER BY id LIMIT 1");
  const [[pr]] = await conn.query("SELECT id, nama, harga, stok FROM produk WHERE stok >= 2 ORDER BY id LIMIT 1");
  if (!k || !m || !pr) { out.push(issue("EMPTY_DATA", "Uji prosedur butuh data", "Harus ada minimal 1 kasir, 1 metode_bayar, dan 1 produk dengan stok >= 2.")); return; }
  const snap = async () => {
    const [[a]] = await conn.query("SELECT (SELECT COUNT(*) FROM struk) s, (SELECT COUNT(*) FROM struk_item) i, (SELECT COUNT(*) FROM stok_mutasi) m, (SELECT stok FROM produk WHERE id=?) stok", [pr.id]);
    return { s: Number(a.s), i: Number(a.i), m: Number(a.m), stok: Number(a.stok) };
  };
  const qty = 2, h = Number(pr.harga);
  const before = await snap(), log = { produk: pr.nama, qty, harga: h, stokAwal: before.stok };
  await scope(conn, async () => {
    const c = await attempt(conn, "CALL sp_checkout(?, ?, ?, ?, @sid)", [k.id, m.id, pr.id, qty]);
    if (c.e) { out.push(issue("PROC_ERROR", "CALL sp_checkout gagal untuk data yang valid", `${errTxt(c.e)}. Pemanggilan: CALL sp_checkout(${k.id}, ${m.id}, ${pr.id}, ${qty}, @sid)`)); return; }
    const [[{ sid }]] = await conn.query("SELECT @sid sid");
    if (sid == null) { out.push(issue("PROC_OUT", "Parameter OUT p_struk_id tidak terisi", "Setelah CALL, @sid masih NULL. Isi dengan SET p_struk_id = LAST_INSERT_ID(); setelah INSERT ke struk.")); return; }
    const [[s]] = await conn.query("SELECT kasir_id, metode_bayar_id, total FROM struk WHERE id=?", [sid]);
    const [items] = await conn.query("SELECT produk_id, qty, harga_satuan FROM struk_item WHERE struk_id=?", [sid]);
    const after = await snap();
    const [mut] = await conn.query("SELECT perubahan, jenis, ref_struk_id FROM stok_mutasi WHERE ref_struk_id=?", [sid]);
    log.sid = sid; log.total = s ? Number(s.total) : null; log.stokAkhir = after.stok; log.mutasi = mut.length;
    if (!s) { out.push(issue("PROC_DATA", "Struk dari OUT parameter tidak ditemukan", `@sid = ${sid}, tetapi tidak ada baris struk dengan id tersebut.`)); return; }
    if (Number(s.kasir_id) !== k.id || Number(s.metode_bayar_id) !== m.id) out.push(issue("PROC_DATA", "kasir_id / metode_bayar_id pada struk salah", `Diharapkan kasir ${k.id}, metode ${m.id}; ditemukan ${s.kasir_id}, ${s.metode_bayar_id}.`));
    if (Math.abs(Number(s.total) - qty * h) > 0.01) out.push(issue("PROC_DATA", "struk.total salah", `total = ${Number(s.total)}, diharapkan qty x harga = ${qty} x ${h} = ${qty * h}.`));
    if (items.length !== 1 || Number(items[0].qty) !== qty || Math.abs(Number(items[0].harga_satuan) - h) > 0.01) out.push(issue("PROC_DATA", "struk_item tidak sesuai", `Diharapkan 1 item (produk ${pr.id}, qty ${qty}, harga_satuan ${h}); ditemukan ${items.length} item${items[0] ? `: qty ${items[0].qty}, harga_satuan ${items[0].harga_satuan}` : ""}.`));
    if (after.stok !== before.stok - qty) out.push(issue("PROC_STOK", "Stok berkurang tidak tepat sebesar qty", `Stok ${before.stok} → ${after.stok}; seharusnya ${before.stok - qty}. Jika berkurang ${2 * qty}, trigger kasus 10 dan prosedurmu sama-sama mengurangi stok.`));
    if (mut.length !== 1) out.push(issue("PROC_MUTASI", "Harus ada tepat 1 catatan stok_mutasi untuk struk ini", `Ditemukan ${mut.length} baris. Jika 2, trigger kasus 10 dan prosedurmu sama-sama mencatat mutasi.`));
    else if (mut[0].jenis !== "jual" || Number(mut[0].perubahan) !== -qty) out.push(issue("PROC_MUTASI", "Isi stok_mutasi salah", `Ditemukan jenis='${mut[0].jenis}', perubahan=${mut[0].perubahan}; diharapkan 'jual', ${-qty}.`));
  });
  // penolakan: stok kurang dan qty tidak valid harus berupa SIGNAL (errno 1644) tanpa meninggalkan data
  const reject = async (label, q, wantText) => {
    const b = await snap();
    const r = await scope(conn, async () => { const c = await attempt(conn, "CALL sp_checkout(?, ?, ?, ?, @sid2)", [k.id, m.id, pr.id, q]); return { c, a: await snap() }; });
    if (!r.c.e) { out.push(issue("PROC_REJECT", `${label} tidak ditolak`, `CALL dengan qty ${q} (stok ${b.stok}) berhasil. Seharusnya SIGNAL SQLSTATE '45000'.`)); return null; }
    if (r.c.e.errno !== 1644) { out.push(issue("PROC_REJECT", `${label} ditolak dengan error yang salah`, `${errTxt(r.c.e)}. Gunakan SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '...' (errno 1644).`)); return null; }
    if (r.a.s !== b.s || r.a.i !== b.i || r.a.m !== b.m || r.a.stok !== b.stok) out.push(issue("PROC_PARTIAL", `${label}: ada data setengah jadi`, `Setelah ditolak: struk ${b.s}→${r.a.s}, struk_item ${b.i}→${r.a.i}, stok_mutasi ${b.m}→${r.a.m}, stok ${b.stok}→${r.a.stok}. Cek stok SEBELUM INSERT apa pun; error di tengah prosedur tidak membatalkan langkah sebelumnya.`));
    return r.c.e.sqlMessage || wantText;
  };
  log.tolakStok = await reject("Penjualan dengan stok kurang", before.stok + 1, "");
  log.tolakQty = await reject("Qty tidak valid (0)", 0, "");
  uji.push(log);
};

Object.assign(FETCH, {
  11: async () => {
    const rows = await rowsOf(`SELECT id, username, nama, password_hash, ${DTF("dibuat_pada")} dibuat_pada FROM pengguna ORDER BY id`), bad = [];
    if (rows.length < 3) bad.push(...empty("Data pengguna kurang", `Ditemukan ${rows.length} akun, minimal 3.`));
    if (rows.some(r => !String(r.username || "").trim() || !String(r.nama || "").trim())) bad.push(...empty("Data pengguna tidak valid", "username dan nama tidak boleh kosong."));
    const plain = rows.filter(r => !BCRYPT.test(String(r.password_hash || "")));
    if (plain.length) bad.push(issue("HASH_FORMAT", "Ada password_hash yang bukan hash bcrypt", sample(plain, r => `${r.username}: ${String(r.password_hash || "").length === 0 ? "(kosong)" : String(r.password_hash).length === 60 ? "60 karakter tetapi bukan format $2b$..." : `panjang ${String(r.password_hash).length} karakter, bukan 60`}`) + ". Buat lewat halaman Generator hash dan salin seluruh 60 karakternya."));
    const cost = rows.filter(r => BCRYPT.test(String(r.password_hash))).map(r => ({ r, c: Number(String(r.password_hash).slice(4, 6)) }));
    const weak = cost.filter(x => x.c < 10);
    if (weak.length) bad.push(issue("HASH_COST", "Cost bcrypt terlalu rendah", sample(weak, x => `${x.r.username}: cost ${x.c}`) + ". Gunakan cost minimal 10 (bawaan generator)."));
    const hs = rows.map(r => r.password_hash), dup = rows.filter(r => hs.filter(h => h === r.password_hash).length > 1);
    if (dup.length) bad.push(issue("HASH_DUPLICATE", "Ada hash yang sama persis", sample(dup, r => r.username) + ". Hash dibuat acak setiap kali (salt). Hash kembar berarti disalin dari baris lain; buat hash baru untuk tiap akun."));
    const same = rows.filter(r => [r.username, r.nama].some(x => x && String(x).toLowerCase() === String(r.password_hash).toLowerCase()));
    if (same.length) bad.push(issue("HASH_PLAIN", "password_hash berisi teks biasa", sample(same, r => r.username)));
    return { bad, data: { rows: rows.map(r => ({ id: r.id, username: r.username, nama: r.nama, dibuat_pada: r.dibuat_pada, cost: Number(String(r.password_hash).slice(4, 6)), pre: String(r.password_hash).slice(0, 7), salt: String(r.password_hash).slice(7, 29), len: String(r.password_hash).length })) } };
  },
  12: async () => {
    const bad = [], uji = [];
    const rows = await rowsOf(`SELECT id, nama, harga, stok, ${DTF("dibuat_pada")} dibuat_pada, ${DTF("diubah_pada")} diubah_pada, ${DTF("dihapus_pada")} dihapus_pada FROM produk ORDER BY id`);
    const aktif = rows.filter(r => r.dihapus_pada == null), hapus = rows.filter(r => r.dihapus_pada != null);
    if (rows.length < 3) bad.push(...empty("Data produk kurang", `Ditemukan ${rows.length} produk, minimal 3.`));
    if (!hapus.length) bad.push(...empty("Belum ada produk yang di-soft delete", "Isi dihapus_pada untuk minimal 1 produk: UPDATE produk SET dihapus_pada = NOW() WHERE id = ...;"));
    if (rows.some(r => r.dibuat_pada == null)) bad.push(...empty("dibuat_pada ada yang kosong", "Semua produk harus punya dibuat_pada."));
    const view = await rowsOf("SELECT id, nama, harga, stok FROM v_produk_aktif ORDER BY id");
    const vi = view.map(r => Number(r.id)), ai = aktif.map(r => Number(r.id));
    const leak = hapus.filter(r => vi.includes(Number(r.id))), miss = aktif.filter(r => !vi.includes(Number(r.id)));
    if (leak.length) bad.push(issue("DATA_MISMATCH", "VIEW masih menampilkan produk yang sudah dihapus", sample(leak, r => `#${r.id} ${r.nama}`) + ". Tambahkan WHERE dihapus_pada IS NULL pada VIEW."));
    if (miss.length) bad.push(issue("DATA_MISMATCH", "VIEW kehilangan produk aktif", sample(miss, r => `#${r.id} ${r.nama}`) + ". VIEW harus memuat semua produk yang dihapus_pada-nya NULL."));
    if (!bad.length) bad.push(...await sandbox(["produk"], async conn => { const out = []; await behave12(HH(caseById(12).hints), out, uji)(conn); return out; }));
    return { bad, data: { rows: rows.map(r => ({ ...r, harga: Number(r.harga), stok: Number(r.stok) })), aktif: view.length, dihapus: hapus.length, uji: uji[0] || null } };
  },
  13: async () => {
    const bad = [];
    const peran = await rowsOf("SELECT id, nama FROM peran ORDER BY id"), izin = await rowsOf("SELECT id, kode FROM izin ORDER BY kode");
    const map = await rowsOf("SELECT peran_id, izin_id FROM peran_izin");
    const users = await rowsOf("SELECT u.id, u.username, u.nama, pr.nama AS peran FROM pengguna u LEFT JOIN peran pr ON pr.id = u.peran_id ORDER BY u.id");
    const nm = s => String(s || "").toLowerCase(), has = (pn, kode) => { const p = peran.find(x => nm(x.nama) === pn), i = izin.find(x => nm(x.kode) === kode); return !!(p && i && map.some(m => m.peran_id === p.id && m.izin_id === i.id)); };
    if (!peran.some(x => nm(x.nama) === "admin") || !peran.some(x => nm(x.nama) === "kasir")) bad.push(...empty("Peran admin / kasir belum ada", `Ditemukan peran: ${peran.map(x => x.nama).join(", ") || "(kosong)"}.`));
    if (izin.length < 4) bad.push(...empty("Izin kurang", `Ditemukan ${izin.length}, minimal 4 (mis. produk.lihat, produk.hapus, struk.buat, laporan.lihat).`));
    if (!izin.some(x => nm(x.kode) === "produk.hapus")) bad.push(...empty("Izin 'produk.hapus' belum ada", "Tambahkan izin dengan kode produk.hapus."));
    else {
      if (!has("admin", "produk.hapus")) bad.push(issue("RBAC_RULE", "Admin belum memegang izin produk.hapus", "Tambahkan baris peran_izin yang menghubungkan peran admin dengan izin produk.hapus."));
      if (has("kasir", "produk.hapus")) bad.push(issue("RBAC_RULE", "Kasir masih boleh menghapus produk", "Hapus baris peran_izin antara peran kasir dan izin produk.hapus. Inilah inti kasus ini: kasir tidak boleh menghapus."));
    }
    const kp = peran.find(x => nm(x.nama) === "kasir");
    if (kp && !map.some(m => m.peran_id === kp.id)) bad.push(...empty("Kasir belum punya izin apa pun", "Beri kasir minimal 1 izin, mis. struk.buat."));
    const noRole = users.filter(u => !u.peran);
    if (noRole.length) bad.push(issue("RBAC_RULE", "Ada pengguna tanpa peran", sample(noRole, u => u.username) + ". Isi pengguna.peran_id untuk semua pengguna."));
    if (!users.some(u => nm(u.peran) === "admin")) bad.push(...empty("Belum ada pengguna admin", "Minimal 1 pengguna ber-peran admin."));
    if (!users.some(u => nm(u.peran) === "kasir")) bad.push(...empty("Belum ada pengguna kasir", "Minimal 1 pengguna ber-peran kasir."));
    return { bad, data: { peran, izin, grid: peran.map(p => ({ peran: p.nama, izin: izin.map(i => map.some(m => m.peran_id === p.id && m.izin_id === i.id)) })), users } };
  },
  14: async ({ origin } = {}) => {
    const bad = [], tests = [];
    if (!origin) return { bad: [issue("QUERY_ERROR", "Alamat aplikasi tidak diketahui", "Origin request tidak tersedia.")], data: {} };
    const cols = await rowsOf("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND LOWER(TABLE_NAME)='produk'", [process.env.DB_NAME]);
    const soft = cols.some(c => String(c.c).toLowerCase() === "dihapus_pada"), WH = soft ? " WHERE dihapus_pada IS NULL" : "";
    const all = await rowsOf(`SELECT id, nama FROM produk${WH} ORDER BY id`);
    if (all.length < 3) return { bad: empty("Data produk kurang", `Ditemukan ${all.length} produk (aktif), minimal 3 agar pagination bisa diuji.`), data: {} };
    const total = all.length, ids = all.map(r => Number(r.id));
    const [{ n: n0 }] = await rowsOf("SELECT COUNT(*) n FROM produk");
    const call = async (qs, ms = 4000) => {
      try {
        const r = await fetch(`${origin}/api/latihan/produk${qs ? "?" + qs : ""}`, { cache: "no-store", signal: AbortSignal.timeout(ms) });
        const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* bukan JSON */ }
        return { status: r.status, json, text };
      } catch (e) { return { error: e.name === "TimeoutError" ? "Tidak menjawab dalam 4 detik" : e.message }; }
    };
    const fail = (code, title, detail, hint) => { bad.push(issue(code, title, detail, hint)); };
    const pass = (nama, detail) => tests.push({ nama, detail });
    const shape = r => r.json && Array.isArray(r.json.data) && Number.isFinite(Number(r.json.total)) && Number.isFinite(Number(r.json.page)) && Number.isFinite(Number(r.json.limit));

    const r1 = await call("");
    if (r1.error) return { bad: [issue("API_UNREACHABLE", "Endpoint /api/latihan/produk tidak bisa dipanggil", r1.error, "Pastikan file app/api/latihan/produk/route.js ada, lalu jalankan ulang npm run build dan npm start.")], data: {} };
    if (r1.status === 501 || r1.status === 404) return { bad: [issue("API_NOT_IMPLEMENTED", `Endpoint masih belum jadi (HTTP ${r1.status})`, "route.js masih berisi kerangka atau belum ter-build.", "Lengkapi handler GET, lalu npm run build dan npm start (atau gunakan npm run dev).")], data: {} };
    if (r1.status !== 200 || !shape(r1)) return { bad: [issue("API_SHAPE", "Format respons salah", `HTTP ${r1.status}; diharapkan JSON { data: [], page, limit, total }. Diterima: ${r1.text.slice(0, 160)}`)], data: {} };
    if (Number(r1.json.total) !== total) fail("API_TOTAL", "total tidak sama dengan jumlah produk", `Respons total = ${r1.json.total}, jumlah produk di database = ${total}${soft ? " (hanya yang dihapus_pada IS NULL)" : ""}.`);
    else pass("Bentuk respons & total", `total = ${total}`);
    if (r1.json.data.length > 10 || Number(r1.json.limit) !== 10 || Number(r1.json.page) !== 1) fail("API_DEFAULT", "Nilai bawaan page/limit salah", `Tanpa parameter diharapkan page=1, limit=10, maksimal 10 baris. Diterima: page=${r1.json.page}, limit=${r1.json.limit}, ${r1.json.data.length} baris.`);
    else pass("Nilai bawaan", "page 1, limit 10");

    // pagination: telusuri semua halaman, setiap produk harus muncul tepat sekali
    const seen = [], per = 2, pages = Math.min(Math.ceil(total / per) + 1, 40);
    let okPage = true;
    for (let p = 1; p <= pages; p++) {
      const r = await call(`page=${p}&limit=${per}`);
      if (r.status !== 200 || !shape(r)) { fail("API_SHAPE", `Halaman ${p} gagal diambil`, `HTTP ${r.status ?? r.error}: ${(r.text || "").slice(0, 140)}`); okPage = false; break; }
      if (r.json.data.length > per) { fail("API_LIMIT", "limit tidak dihormati", `limit=${per} tetapi menerima ${r.json.data.length} baris.`); okPage = false; break; }
      seen.push(...r.json.data.map(x => Number(x.id)));
    }
    if (okPage) {
      const dup = seen.filter((x, i) => seen.indexOf(x) !== i), miss = ids.filter(x => !seen.includes(x));
      if (dup.length || miss.length || seen.length !== total) fail("API_PAGINATION", "Pagination tidak konsisten", `Menelusuri semua halaman (limit ${per}) mengumpulkan ${seen.length} baris dari ${total} produk${dup.length ? `; duplikat id: ${[...new Set(dup)].join(", ")}` : ""}${miss.length ? `; tidak pernah muncul id: ${miss.join(", ")}` : ""}. Periksa rumus OFFSET = (page - 1) x limit dan ORDER BY yang stabil.`);
      else pass("Pagination", `${Math.ceil(total / per)} halaman, ${total} produk tanpa duplikat`);
    }

    // pencarian: q = 3 huruf pertama nama (tidak peka huruf besar/kecil)
    const word = String(all[0].nama).slice(0, 3), want = (await rowsOf(`SELECT id FROM produk${WH ? WH + " AND" : " WHERE"} nama LIKE ? ORDER BY id`, [`%${word}%`])).map(x => Number(x.id));
    for (const q of [word.toLowerCase(), word.toUpperCase()]) {
      const r = await call(`q=${encodeURIComponent(q)}&limit=100`);
      const got = r.json && Array.isArray(r.json.data) ? r.json.data.map(x => Number(x.id)).sort((a, b) => a - b) : null;
      if (r.status !== 200 || !got || got.join() !== want.join() || Number(r.json.total) !== want.length) { fail("API_SEARCH", "Pencarian q salah", `q='${q}' seharusnya menghasilkan id [${want.join(", ")}] dengan total ${want.length}; menerima ${got ? `[${got.join(", ")}] total ${r.json.total}` : `HTTP ${r.status}`}. Gunakan LIKE dengan parameter dan hitung total dengan WHERE yang sama.`); break; }
    }
    if (!bad.some(b => b.code === "API_SEARCH")) pass("Pencarian", `q='${word}' → ${want.length} hasil`);

    // input tidak valid: jangan 500, limit dibatasi
    const odd = ["page=abc", "page=-5", "page=0", "limit=0", "limit=abc", "limit=100000", "limit=-1", "page=1e9&limit=5"];
    for (const qs of odd) {
      const r = await call(qs);
      if (r.status >= 500 || r.error) { fail("API_VALIDATION", `Input '${qs}' membuat server error`, `HTTP ${r.status ?? r.error}. Validasi dan beri nilai bawaan, atau balas 400. Jangan biarkan input aneh sampai ke query.`); break; }
      if (r.status === 200 && r.json && (Array.isArray(r.json.data) && r.json.data.length > 100 || Number(r.json.limit) > 100)) { fail("API_LIMIT", "limit tidak dibatasi", `'${qs}' menghasilkan limit=${r.json.limit} (${(r.json.data || []).length} baris); batas maksimum seharusnya 100. Tanpa batas, satu permintaan bisa menarik seluruh tabel.`); break; }
    }
    if (!bad.some(b => b.code === "API_VALIDATION" || b.code === "API_LIMIT")) pass("Validasi input", `${odd.length} input aneh ditangani`);

    // SQL injection
    const payloads = ["' OR 1=1 -- ", "%' OR '1'='1' -- ", "x' UNION SELECT id, username, password_hash, 1 FROM pengguna -- ", "'; DROP TABLE produk; -- ", "\" OR \"\"=\""];
    let inj = true;
    for (const pl of payloads) {
      const r = await call(`q=${encodeURIComponent(pl)}`);
      const leakTxt = /password_hash|\$2[aby]\$|ER_[A-Z_]+|SQL syntax|sqlMessage|mysql/i.test(r.text || "");
      if (r.status >= 500 || r.error) { fail("API_INJECTION", "Input jahat membuat server error", `q=${pl.trim()} → HTTP ${r.status ?? r.error}. Pesan error database tidak boleh sampai ke pengguna, dan ini tanda query dirangkai dari teks.`); inj = false; break; }
      if (leakTxt) { fail("API_LEAK", "Respons membocorkan detail database", `q=${pl.trim()} → ${(r.text || "").slice(0, 160)}`); inj = false; break; }
      if (r.status === 200 && r.json && Array.isArray(r.json.data) && r.json.data.length > 0) { fail("API_INJECTION", "Rentan SQL injection!", `q=${pl.trim()} mengembalikan ${r.json.data.length} baris padahal tidak ada produk yang namanya seperti itu. Query dirangkai dari input pengguna.`, undefined); inj = false; break; }
    }
    const [{ n }] = await rowsOf("SELECT COUNT(*) n FROM produk");
    if (Number(n) !== Number(n0)) fail("API_INJECTION", "Isi tabel produk berubah setelah uji injection", `Jumlah baris produk ${n0} → ${n}.`);
    if (inj && !bad.some(b => b.code === "API_INJECTION")) pass("SQL injection", `${payloads.length} payload ditolak, tabel utuh`);
    const sampleRes = r1.json.data.slice(0, 2);
    return { bad, data: { tests, sample: { data: sampleRes, page: r1.json.page, limit: r1.json.limit, total: r1.json.total }, payloads } };
  },
  15: async () => {
    const bad = [], uji = [];
    const [{ n }] = await rowsOf("SELECT COUNT(*) n FROM produk WHERE stok >= 2");
    if (!Number(n)) bad.push(...empty("Uji prosedur butuh produk berstok", "Minimal 1 produk dengan stok >= 2."));
    if (!bad.length) bad.push(...await sandbox([...W2_TABLES, "stok_mutasi"], async conn => { const out = []; await behave15(out, uji)(conn); return out; }));
    return { bad, data: { uji: uji[0] || null } };
  },
});

export async function runCase(id, ctx = {}) {
  const c = caseById(id), spec = SPEC[id];
  if (!process.env.DB_NAME) return { ok: false, issues: [issue("CONNECTION", "DB_NAME belum diisi", "Isi DB_NAME di .env.local lalu restart (npm run build && npm start).", "Salin .env.example menjadi .env.local.")] };
  let meta;
  try { meta = await introspect(process.env.DB_NAME, spec); }
  catch (e) {
    const m = e.code === "ER_BAD_DB_ERROR" ? `Database '${process.env.DB_NAME}' belum dibuat` : e.code === "ECONNREFUSED" ? "MySQL tidak menyala (cek XAMPP/Laragon)" : e.code === "ER_ACCESS_DENIED_ERROR" ? "User/password MySQL salah" : "Tidak dapat terhubung ke MySQL";
    return { ok: false, issues: [issue("CONNECTION", m, `${e.code || "ERROR"}: ${e.message}`, "Periksa DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME di .env.local.")] };
  }
  const issues = validate(spec, meta, c.hints);
  if (issues.length) return { ok: false, issues };
  try {
    const { bad, data } = await FETCH[id](ctx);
    return bad.length ? { ok: false, issues: bad } : { ok: true, issues: [], data };
  } catch (e) {
    return { ok: false, issues: [issue("QUERY_ERROR", "Query gagal dijalankan", `${e.code || "ERROR"}: ${e.sqlMessage || e.message}`)] };
  }
}
