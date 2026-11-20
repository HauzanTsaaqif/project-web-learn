// Uji murni (tanpa DB) paket soal 1-5: node scripts/test-live-pack.mjs
// Memeriksa: determinisme, variasi per NIM, satu pernyataan per entri, InnoDB, dan expect == hitung ulang dari SQL yang dibangkitkan.
import { buildOne } from "../lib/live/pack/index.mjs";
import { sumCs, f2 } from "../lib/live/pack/_a.mjs";

let gagal = 0, lulus = 0;
const ok = (kondisi, pesan) => { if (kondisi) lulus++; else { gagal++; console.error("GAGAL:", pesan); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- pembaca pernyataan ----
function tunggal(sql) { // tak boleh ada ';' di luar tanda kutip
  let q = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (q) { if (c === "\\") i++; else if (c === "'") { if (sql[i + 1] === "'") i++; else q = false; } }
    else if (c === "'") q = true;
    else if (c === ";") return false;
  }
  return !q;
}
function parseInsert(sql) {
  const m = /^INSERT INTO (\w+) \(([^)]*)\) VALUES /.exec(sql);
  if (!m) return null;
  let i = m[0].length; const rows = [];
  while (i < sql.length) {
    if (sql[i] !== "(") throw new Error("diharapkan ( di " + i);
    i++; const vals = [];
    for (;;) {
      let v;
      if (sql[i] === "'") { i++; v = ""; for (;;) { if (sql[i] === "\\") { v += sql[i + 1]; i += 2; } else if (sql[i] === "'") { if (sql[i + 1] === "'") { v += "'"; i += 2; } else { i++; break; } } else v += sql[i++]; } }
      else if (sql.startsWith("NULL", i)) { v = null; i += 4; }
      else { const n = /^-?\d+(\.\d+)?/.exec(sql.slice(i)); if (!n) throw new Error("nilai tak dikenal: " + sql.slice(i, i + 20)); v = Number(n[0]); i += n[0].length; }
      vals.push(v);
      if (sql[i] === ",") { i++; if (sql[i] === " ") i++; continue; }
      if (sql[i] === ")") { i++; break; }
      throw new Error("karakter tak terduga: " + sql[i]);
    }
    rows.push(vals);
    if (sql[i] === ",") { i++; if (sql[i] === " ") i++; }
  }
  return { table: m[1], cols: m[2].split(", "), rows };
}
const DEC = new Set(["harga", "harga_satuan", "total", "jumlah"]);
function tabel(statements) {
  const t = {};
  for (const s of statements) { const p = parseInsert(s); if (p) { const x = (t[p.table] ||= { cols: p.cols, rows: [] }); x.rows.push(...p.rows.map(r => Object.fromEntries(p.cols.map((c, i) => [c, r[i]])))); } }
  return t;
}
const val = (r, c) => (r[c] == null ? null : DEC.has(c) ? f2(r[c]) : r[c]);
const rekomp = (t, e, filter = () => true) => sumCs((t[e.table]?.rows || []).filter(filter).map(r => e.cols.map(c => val(r, c))));
const ymdOf = w => w.slice(0, 10);

function cekUmum(nn, b, label) {
  ok(b && b.db === `live_t${nn}`, `${label}: db harus live_t${nn}`);
  ok(Array.isArray(b.statements) && b.statements.length > 5, `${label}: statements kosong`);
  ok(b.statements.every(tunggal), `${label}: ada ';' di tengah pernyataan`);
  ok(b.statements.slice(0, 3).join("|").startsWith(`DROP DATABASE IF EXISTS \`live_t${nn}\`|CREATE DATABASE \`live_t${nn}\``) && /utf8mb4_unicode_ci/.test(b.statements[1]) && b.statements[2] === `USE \`live_t${nn}\``, `${label}: tiga pernyataan awal salah`);
  ok(b.statements.filter(s => s.startsWith("CREATE TABLE")).every(s => /ENGINE=InnoDB$/.test(s)), `${label}: semua tabel harus InnoDB`);
  ok(b.statements.every(s => !/DELIMITER|COMMIT/i.test(s)), `${label}: DELIMITER/COMMIT tidak boleh`);
  ok(same(JSON.parse(JSON.stringify(b.expect)), b.expect), `${label}: expect harus JSON-murni`);
}

const NIMS = ["2501195", "2501196", "2501203"];
for (const nn of ["01", "02", "03", "04", "05"]) {
  const per = [];
  for (const nim of NIMS) {
    const a = await buildOne(nim, nn), b = await buildOne(nim, nn);
    ok(a !== null, `t${nn}: modul tidak ditemukan`);
    ok(same(a, b), `t${nn} NIM ${nim}: build tidak deterministik`);
    cekUmum(nn, a, `t${nn}/${nim}`);
    per.push(a);
    const t = tabel(a.statements), L = `t${nn}/${nim}`;
    // expect.cs cocok dengan data sumber (dihitung ulang dari INSERT)
    for (const [k, e] of Object.entries(a.expect.cs || {})) {
      let filter = () => true;
      if (e.where) { const ids = new Set(/IN \(([\d,]+)\)/.exec(e.where)[1].split(",").map(Number)); filter = r => ids.has(r.id); }
      if (nn === "02" && e.table === "struk_item") { const s = new Set(t.struk.rows.map(r => r.id)), p = new Set(t.produk.rows.map(r => r.id)); filter = r => s.has(r.struk_id) && p.has(r.produk_id); }
      ok(same(rekomp(t, e, filter), { n: e.n, c: e.c }), `${L}: expect.cs.${k} tidak cocok dengan data`);
    }
    if (nn === "01") {
      ok(Math.abs(t.produk.rows.reduce((x, r) => x + r.harga, 0) - a.expect.sum_harga) < 1e-6, `${L}: sum_harga`);
      ok(Math.abs(t.struk_item.rows.reduce((x, r) => x + r.harga_satuan, 0) - a.expect.sum_harga_satuan) < 1e-6, `${L}: sum_harga_satuan`);
      ok(a.statements.some(s => /harga FLOAT NOT NULL/.test(s)) && a.statements.some(s => /harga_satuan DOUBLE NOT NULL/.test(s)), `${L}: kondisi awal harus FLOAT/DOUBLE`);
      ok([...t.produk.rows, ...t.struk_item.rows].every(r => { const x = r.harga ?? r.harga_satuan; return x < 100000 && Math.abs(x * 4 - Math.round(x * 4)) < 1e-9; }), `${L}: harga harus < 100000 dan kelipatan 0,25`);
      ok(t.produk.rows.some(r => r.harga % 1 !== 0), `${L}: perlu ada harga berpecahan agar skala 2 bermakna`);
    }
    if (nn === "02") {
      const s = new Set(t.struk.rows.map(r => r.id)), p = new Set(t.produk.rows.map(r => r.id));
      const yatim = t.struk_item.rows.filter(r => !s.has(r.struk_id) || !p.has(r.produk_id));
      ok(yatim.length === a.expect.orphan_awal && yatim.length >= 5, `${L}: jumlah yatim`);
      ok(t.struk_item.rows.length - yatim.length === a.expect.item_valid, `${L}: item_valid`);
      ok(new Set(t.struk_item.rows.map(r => `${r.struk_id}|${r.produk_id}`)).size === t.struk_item.rows.length, `${L}: PK struk_item bentrok`);
      ok(!a.statements.some(s2 => /CREATE TABLE struk_item.*FOREIGN KEY/.test(s2)), `${L}: struk_item tidak boleh punya FK`);
    }
    if (nn === "03") {
      const P = t.pelanggan.rows, key = r => r.email.toLowerCase();
      ok(new Set(P.map(key)).size === a.expect.unik && P.length === a.expect.awal && P.length > a.expect.unik, `${L}: unik/awal`);
      ok(P.some(r => r.email !== r.email.toLowerCase()) && P.some((r, i) => P.some((q, j) => i !== j && q.email === r.email)), `${L}: perlu kembar huruf-beda dan kembar persis`);
      const pakai = [...new Set(t.struk.rows.map(r => r.pelanggan_id).filter(x => x != null))].sort((x, y) => x - y);
      ok(same(pakai, a.expect.dipakai), `${L}: dipakai`);
      const grp = {}; for (const r of P) (grp[key(r)] ||= []).push(r.id);
      ok(Object.values(grp).every(ids => ids.filter(i => pakai.includes(i)).length <= 1), `${L}: satu grup dipakai >1 anggota`);
      ok(Object.values(grp).some(ids => ids.length > 1 && ids.some(i => pakai.includes(i))) && Object.values(grp).some(ids => ids.length > 1 && !ids.some(i => pakai.includes(i))), `${L}: perlu grup kembar dipakai dan tidak dipakai`);
      ok(Object.values(grp).some(ids => ids.length > 1 && pakai.includes(ids[ids.length - 1])), `${L}: perlu grup yang kembar terakhirnya dipakai (jebakan MIN(id))`);
      ok(!a.statements.some(s2 => /UNIQUE KEY.*email|CREATE TABLE pelanggan.*UNIQUE/.test(s2)), `${L}: email belum boleh unik`);
      const surv = new Set(P.map(key)); let c = 0; for (const e of surv) c += (await import("../lib/live/pack/_a.mjs")).crc32(e);
      ok(String(c) === a.expect.lower_c, `${L}: lower_c`);
    }
    if (nn === "04") {
      const per2 = {}; for (const s of t.struk.rows) { const d = ymdOf(s.waktu), x = (per2[d] ||= [0, 0]); x[0]++; x[1] += s.total; }
      const har = Object.keys(per2).sort().map(d => [d, per2[d][0], per2[d][1]]);
      ok(same(har, a.expect.harian), `${L}: harian`);
      const nb = {}, sb = {}; for (const p of t.pembayaran.rows) { nb[p.struk_id] = (nb[p.struk_id] || 0) + 1; sb[p.struk_id] = (sb[p.struk_id] || 0) + p.jumlah; }
      ok(t.struk.rows.every(s => nb[s.id] >= 1 && sb[s.id] === s.total), `${L}: pembayaran harus >=1 per struk dan jumlahnya = total`);
      ok(Object.values(nb).some(x => x >= 2), `${L}: perlu struk dengan pembayaran terpisah`);
      // simulasi VIEW rusak (JOIN pembayaran): harus berbeda dari harapan
      const rusak = {}; for (const s of t.struk.rows) { const d = ymdOf(s.waktu), x = (rusak[d] ||= [0, 0]); x[0] += nb[s.id]; x[1] += s.total * nb[s.id]; }
      ok(Object.keys(rusak).some(d => rusak[d][0] !== per2[d][0] && rusak[d][1] !== per2[d][1]), `${L}: VIEW rusak harus beda dari harapan`);
      const u = a.expect.uji; ok(!per2[u.tanggal_baru] && !!per2[u.tanggal_ada], `${L}: tanggal uji`);
      ok(a.statements[a.statements.length - 1].startsWith("CREATE VIEW v_omzet_harian"), `${L}: VIEW di akhir`);
      ok(har.length >= 9, `${L}: hari terlalu sedikit`);
    }
    if (nn === "05") {
      const nm = t.produk.rows.map(r => r.nama);
      ok(new Set(nm).size === nm.length, `${L}: nama produk harus unik`);
      const hasil = t.produk.rows.map(p => { const it = t.struk_item.rows.filter(r => r.produk_id === p.id); return [p.nama, it.reduce((x, r) => x + r.qty, 0), it.reduce((x, r) => x + r.qty * r.harga_satuan, 0)]; }).sort((x, y) => (x[0] < y[0] ? -1 : 1));
      ok(same(hasil, a.expect.produk), `${L}: hasil per produk`);
      ok(hasil.some(h => h[1] === 0) && hasil.some(h => h[1] > 0), `${L}: perlu produk tanpa penjualan dan yang terjual`);
      const cnt = {}; for (const r of t.struk_item.rows) cnt[r.produk_id] = (cnt[r.produk_id] || 0) + 1;
      ok(t.produk.rows.some(p => cnt[p.id] && cnt[p.id] !== hasil.find(h => h[0] === p.nama)[1]), `${L}: COUNT(*) harus beda dari SUM(qty) di minimal satu produk`);
      ok(t.struk_item.rows.some(r => { const p = t.produk.rows.find(x => x.id === r.produk_id); return p.harga !== r.harga_satuan; }), `${L}: perlu harga_satuan yang beda dari harga produk`);
      const u = a.expect.uji; ok(!cnt[u.kosong_id] && !!cnt[u.ada_id], `${L}: produk uji`);
      ok(new Set(t.produk.rows.map(r => r.kategori_id)).size > 1 && t.struk.rows.every(s => s.total === t.struk_item.rows.filter(i => i.struk_id === s.id).reduce((x, i) => x + i.qty * i.harga_satuan, 0)), `${L}: kategori/total struk`);
      ok(a.statements[a.statements.length - 1].startsWith("CREATE VIEW v_penjualan_produk"), `${L}: VIEW di akhir`);
    }
  }
  if (nn === "04" || nn === "05") ok(!same(per[0].statements, per[1].statements) && !same(per[0].expect, per[1].expect) && !same(per[1].statements, per[2].statements), `t${nn}: data harus berbeda antar NIM`);
}

console.log(`${lulus} pemeriksaan lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
