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

async function introspect(db) {
  const q = sql => getPool().query(sql, [db]).then(r => r[0]);
  const [cols, fks, stats, tabs, rules, trigs] = await Promise.all([
    q("SELECT LOWER(TABLE_NAME) t, COLUMN_NAME c, DATA_TYPE d, EXTRA e FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=?"),
    q("SELECT LOWER(TABLE_NAME) t, CONSTRAINT_NAME cn, COLUMN_NAME c, LOWER(REFERENCED_TABLE_NAME) rt, REFERENCED_COLUMN_NAME rc FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND REFERENCED_TABLE_NAME IS NOT NULL"),
    q("SELECT LOWER(TABLE_NAME) t, INDEX_NAME i, COLUMN_NAME c, NON_UNIQUE nu, SEQ_IN_INDEX s FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? ORDER BY INDEX_NAME, SEQ_IN_INDEX"),
    q("SELECT LOWER(TABLE_NAME) t, TABLE_TYPE tt, ENGINE e FROM information_schema.TABLES WHERE TABLE_SCHEMA=?"),
    q("SELECT LOWER(TABLE_NAME) t, CONSTRAINT_NAME cn, UPPER(DELETE_RULE) r FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=?"),
    q("SELECT LOWER(EVENT_OBJECT_TABLE) t, TRIGGER_NAME n, UPPER(ACTION_TIMING) a, UPPER(EVENT_MANIPULATION) e FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=?"),
  ]);
  return { cols, fks, stats, tabs, rules, trigs };
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
