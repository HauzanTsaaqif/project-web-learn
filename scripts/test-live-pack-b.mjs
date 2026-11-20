// Uji murni (tanpa DB) paket data soal 6-10:  node scripts/test-live-pack-b.mjs
// Dengan MySQL/MariaDB lokal (opsional, menjalankan persiapan lalu mencocokkan expect dengan DB):
//   TEST_DB_PORT=3399 [TEST_DB_USER=root TEST_DB_PASSWORD=] node scripts/test-live-pack-b.mjs --db
import assert from "node:assert/strict";
import { buildOne } from "../lib/live/pack/index.mjs";

const NN = ["06", "07", "08", "09", "10"], NIMS = ["2501195", "2501001", "2502345", "2503999", "2504100", "2505555", "2506060", "2507777"];
let ok = 0;
const t = (nama, fn) => Promise.resolve().then(fn).then(() => { ok++; console.log("  ok  ", nama); }, e => { console.error("  GAGAL", nama, "\n       ", e.message); process.exitCode = 1; });

// buang isi string/komentar agar ';' di dalamnya tidak dihitung
const strip = s => s.replace(/'(?:[^'\\]|\\.|'')*'/g, "''").replace(/--[^\n]*/g, " ");
const KW = /^(DROP DATABASE IF EXISTS|CREATE DATABASE|USE|CREATE TABLE|CREATE PROCEDURE|INSERT INTO|DROP TABLE|DROP USER IF EXISTS|CREATE USER|GRANT)\b/i;

const built = {};
for (const nn of NN) built[nn] = await buildOne(NIMS[0], nn);

console.log("Paket soal 6-10");
for (const nn of NN) {
  const b = built[nn];
  await t(`t${nn}: bentuk dasar`, () => {
    assert.ok(b, "build null"); assert.equal(b.db, `live_t${nn}`);
    assert.ok(Array.isArray(b.statements) && b.statements.length > 3 && b.statements.length <= 30, `jumlah statement ${b.statements.length}`);
    assert.equal(b.statements[0], `DROP DATABASE IF EXISTS live_t${nn}`);
    assert.match(b.statements[1], new RegExp(`^CREATE DATABASE live_t${nn} .*utf8mb4_unicode_ci$`));
    assert.equal(b.statements[2], `USE live_t${nn}`);
    assert.equal(typeof b.expect, "object");
  });
  await t(`t${nn}: determinisme`, async () => assert.deepEqual(await buildOne(NIMS[0], nn), b));
  await t(`t${nn}: statement tunggal dan sintaks dasar`, () => {
    for (const s of b.statements) {
      assert.ok(typeof s === "string" && s.trim() && s === s.trim(), "kosong atau berspasi tepi");
      assert.match(s, KW, `awalan tak dikenal: ${s.slice(0, 40)}`);
      assert.ok(!/DELIMITER/i.test(s));
      const c = strip(s);
      assert.equal((c.match(/\(/g) || []).length, (c.match(/\)/g) || []).length, `kurung tidak seimbang: ${s.slice(0, 50)}`);
      assert.equal((s.replace(/''/g, "").match(/'/g) || []).length % 2, 0, `kutip ganjil: ${s.slice(0, 50)}`);
      if (/^CREATE PROCEDURE/i.test(s)) { assert.match(s, /\bBEGIN\b[\s\S]*\bEND$/i); assert.ok(!/DELIMITER/i.test(s)); }
      else assert.ok(!c.includes(";"), `titik koma di tengah: ${s.slice(0, 60)}`);
      if (/^CREATE TABLE/i.test(s)) assert.match(s, /ENGINE=InnoDB/i, "tabel bukan InnoDB");
    }
  });
}

await t("t06: sp_checkout rusak, signature 4 IN, tanpa validasi", () => {
  const p = built["06"].statements.find(s => /^CREATE PROCEDURE sp_checkout/.test(s));
  assert.ok(p && /IN p_kasir_id INT, IN p_metode_id INT, IN p_produk_id INT, IN p_qty INT/.test(p));
  assert.ok(!/SIGNAL|COMMIT|START TRANSACTION/i.test(p.slice(p.indexOf("\nBEGIN"))), "badan rutin rusak tidak boleh punya SIGNAL/COMMIT");
  assert.ok(p.indexOf("INSERT INTO struk ") < p.indexOf("UPDATE produk"), "struk harus ditulis sebelum stok dipotong");
  assert.equal(built["06"].expect.produk.length, 8);
});

await t("t07: route rentan memakai string-concat ke live_t07", () => {
  const f = built["07"].files; assert.equal(f.length, 1); assert.equal(f[0].path, "app/api/latihan/live/cari/route.js");
  assert.match(f[0].content, /LIKE '%" \+ q \+ "%'/); assert.match(f[0].content, /database: "live_t07"/);
  assert.match(f[0].content, /\{ items: rows, total: rows\.length \}/);
  assert.ok(!/\bimport .*@\/|require\(/.test(f[0].content), "route harus mandiri");
  assert.ok(built["07"].expect.produk.some(r => r[1].includes("'")), "perlu nama berapostrof");
  assert.ok(built["07"].statements.some(s => s.includes("O''Brien")), "apostrof harus di-escape");
  // route stub di repo harus aman
});

await t("t08: akun untuk localhost dan 127.0.0.1 dengan ALL ON *.*", () => {
  const S = built["08"].statements.join("\n");
  for (const h of ["localhost", "127.0.0.1"]) {
    assert.ok(S.includes(`DROP USER IF EXISTS 'kasir_live'@'${h}'`));
    assert.ok(S.includes(`CREATE USER 'kasir_live'@'${h}' IDENTIFIED BY 'live123'`));
    assert.ok(S.includes(`GRANT ALL PRIVILEGES ON *.* TO 'kasir_live'@'${h}'`));
  }
  assert.deepEqual(built["08"].expect.hak, ["INSERT", "SELECT", "UPDATE"]);
});

await t("t09: 50.000 baris lewat satu INSERT...SELECT, variasi per NIM", async () => {
  const b = built["09"], ins = b.statements.filter(s => /^INSERT INTO struk /.test(s));
  assert.equal(ins.length, 1); assert.ok(b.statements.length <= 14); assert.equal(b.expect.n, 50000);
  assert.ok(["kasir_id", "cabang_id"].includes(b.expect.kolom));
  assert.ok(b.expect.sum > 0 && b.expect.sql.includes(`${b.expect.kolom} = ${b.expect.nilai}`));
  const kol = new Set(), isi = new Set();
  for (const n of NIMS) { const x = (await buildOne(n, "09")); kol.add(x.expect.kolom); isi.add(JSON.stringify([x.expect.nilai, x.expect.dari, x.statements.find(s => /^INSERT INTO struk /.test(s))])); }
  assert.equal(kol.size, 2, `kolom kesamaan harus bervariasi antar NIM: ${[...kol]}`);
  assert.ok(isi.size >= NIMS.length - 1, "isi/nilai laporan harus bervariasi antar NIM");
  const ukuran = Math.max(...b.statements.map(s => s.length)); assert.ok(ukuran < 4000);
});

await t("t10: dump memuat INSERT sesuai expect, deterministik, FK/PK/InnoDB", () => {
  const b = built["10"], f = b.files; assert.equal(f.length, 1); assert.equal(f[0].path, "data/live/t10_backup.sql");
  const d = f[0].content, cnt = tbl => { const m = d.split(new RegExp("INSERT INTO `" + tbl + "`"))[1] ? d.split(new RegExp("INSERT INTO `" + tbl + "` [^;]*;", "g")) : null; void m; return (d.match(new RegExp("INSERT INTO `" + tbl + "`[^;]*;", "g")) || []).join("\n").split("\n").filter(l => /^\(/.test(l)).length; };
  assert.equal(cnt("struk"), b.expect.tabel.struk.n); assert.equal(cnt("struk_item"), b.expect.tabel.struk_item.n);
  assert.ok(/CREATE TABLE `struk` /.test(d) && /CREATE TABLE `struk_item` /.test(d));
  assert.ok(d.indexOf("CREATE TABLE `struk` ") < d.indexOf("CREATE TABLE `struk_item`"));
  assert.equal((d.match(/ENGINE=InnoDB/g) || []).length, 2); assert.equal((d.match(/FOREIGN KEY/g) || []).length, 4); assert.equal((d.match(/PRIMARY KEY/g) || []).length, 2);
  assert.ok(!/DROP TABLE|CREATE DATABASE|^USE /mi.test(d), "dump harus bisa diimpor ke database terpilih");
  assert.ok(!b.statements.some(s => /struk/.test(s)), "struk/struk_item tidak boleh ada di kondisi awal");
  assert.ok(b.expect.tabel.struk.n >= 120 && b.expect.tabel.struk_item.n >= b.expect.tabel.struk.n);
});

// ---- opsional: uji terhadap server MySQL/MariaDB sungguhan ----
if (process.argv.includes("--db")) {
  const mysql = (await import("mysql2/promise")).default;
  const cfg = { host: "127.0.0.1", port: Number(process.env.TEST_DB_PORT || 3306), user: process.env.TEST_DB_USER || "root", password: process.env.TEST_DB_PASSWORD || "", decimalNumbers: true };
  const c = await mysql.createConnection(cfg);
  console.log("Persiapan ke DB sungguhan");
  for (const nn of NN) {
    const b = await buildOne(NIMS[0], nn), t0 = Date.now();
    await t(`t${nn}: persiapan dijalankan (${b.statements.length} statement)`, async () => { for (const s of b.statements) await c.query(s); console.log(`         ${Date.now() - t0} ms`); });
  }
  await t("t09: jumlah dan SUM(total) = expect; sebaran kolom", async () => {
    const e = built["09"].expect, [[r]] = await c.query("SELECT COUNT(*) n, SUM(total) s, MIN(waktu) a, MAX(waktu) z, COUNT(DISTINCT kasir_id) k, COUNT(DISTINCT cabang_id) cb FROM live_t09.struk");
    assert.equal(Number(r.n), e.n); assert.equal(Number(r.s), e.sum);
    const [[w]] = await c.query(`SELECT COUNT(*) n FROM live_t09.struk WHERE ${e.kolom} = ? AND waktu BETWEEN ? AND ?`, [e.nilai, e.dari, e.sampai]);
    console.log("         ", JSON.stringify(r), "baris dalam jendela laporan:", w.n);
    assert.ok(Number(w.n) > 0, "jendela laporan kosong");
  });
  await t("t10: checksum JS = checksum SQL (rumus common.checksum), impor dump berhasil", async () => {
    const fs = await import("node:fs"); void fs;
    const b = built["10"], conn = await mysql.createConnection({ ...cfg, database: "live_t10", multipleStatements: true });
    await conn.query(b.files[0].content);
    for (const [tbl, d] of Object.entries(b.expect.tabel)) {
      const expr = d.cols.map(x => `IFNULL(CAST(\`${x}\` AS CHAR),'~')`).join(",'|',");
      const [[r]] = await conn.query(`SELECT COUNT(*) n, IFNULL(SUM(CRC32(CONCAT(${expr}))),0) c FROM \`${tbl}\``);
      assert.equal(Number(r.n), d.n, `${tbl} n`); assert.equal(String(r.c), d.c, `${tbl} checksum`);
    }
    await conn.end();
  });
  await c.end();
}

console.log(process.exitCode ? "\nADA YANG GAGAL" : `\nSemua uji lolos (${ok})`);
