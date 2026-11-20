// Pemeriksaan lingkungan sebelum Live Task: npm run live:cek
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(ROOT, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    let v = m[2]; if (/^(".*"|'.*')$/.test(v)) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
const E = process.env, BASE = E.BE_API_URL || "http://195.88.211.226:4001/api";
const rows = []; // { name, st: "ok"|"warn"|"fail", msg, fix }
const add = (name, st, msg, fix) => rows.push({ name, st, msg, fix });

// 1. Node
{
  const [maj, min] = process.versions.node.split(".").map(Number);
  add("Versi Node", maj > 20 || (maj === 20 && min >= 9) ? "ok" : "fail", `v${process.versions.node}`, "Pasang Node.js 20.9 atau lebih baru (disarankan LTS) dari nodejs.org.");
}
// 2. .env.local
{
  const has = fs.existsSync(envFile), miss = ["DB_USER", "BE_API_URL", "SERVICE_KEY"].filter(k => !E[k]);
  add(".env.local", has && !miss.length ? "ok" : "fail", !has ? "tidak ditemukan" : miss.length ? `kosong: ${miss.join(", ")}` : "terisi", "Salin .env.example menjadi .env.local lalu isi DB_* (password MySQL-mu), lalu build ulang bila memakai npm start.");
}
// 3 & 4. MySQL + hak
let conn;
try {
  conn = await mysql.createConnection({ host: E.DB_HOST || "127.0.0.1", port: Number(E.DB_PORT || 3306), user: E.DB_USER || "root", password: E.DB_PASSWORD || "", connectTimeout: 4000 });
  const [[v]] = await conn.query("SELECT VERSION() v");
  add("Koneksi MySQL", "ok", `terhubung (${v.v})`);
} catch (e) {
  const why = e.code === "ECONNREFUSED" ? "MySQL tidak menyala" : e.code === "ER_ACCESS_DENIED_ERROR" ? "user/password ditolak" : e.code || e.message;
  add("Koneksi MySQL", "fail", why, "Nyalakan MySQL (XAMPP/Laragon) dan periksa DB_HOST, DB_PORT, DB_USER, DB_PASSWORD.");
}
if (conn) {
  const id = crypto.randomBytes(4).toString("hex"), db = `live_cek_${id}`, user = `live_cek_${id}`, pw = crypto.randomBytes(8).toString("hex");
  const tryq = async sql => { try { await conn.query(sql); return null; } catch (e) { return e.code || e.message; } };
  const eDb = await tryq(`CREATE DATABASE \`${db}\``);
  const eUser = await tryq(`CREATE USER '${user}'@'localhost' IDENTIFIED BY '${pw}'`);
  const eGrant = eDb || eUser ? "dilewati" : await tryq(`GRANT SELECT, INSERT, UPDATE ON \`${db}\`.* TO '${user}'@'localhost'`);
  await tryq(`DROP USER IF EXISTS '${user}'@'localhost'`); await tryq(`DROP DATABASE IF EXISTS \`${db}\``);
  const fix = "Pakai akun root di DB_USER (butuh hak CREATE, CREATE USER, GRANT). Tugas 8 tidak bisa disiapkan tanpa ini.";
  add("Hak CREATE DATABASE", eDb ? "fail" : "ok", eDb || "bisa", fix);
  add("Hak CREATE USER", eUser ? "fail" : "ok", eUser || "bisa", fix);
  add("Hak GRANT", eGrant ? "fail" : "ok", eGrant || "bisa", fix);
  await conn.end().catch(() => {});
}
// 5. build
{
  const has = fs.existsSync(path.join(ROOT, ".next", "BUILD_ID"));
  add("Build aplikasi", has ? "ok" : "warn", has ? "ada (.next/BUILD_ID)" : "belum ada", "Jalankan npm run build lalu npm start. Cadangan: npm run dev (tidak perlu build).");
}
// 6. SERVICE_KEY
add("SERVICE_KEY", E.SERVICE_KEY ? "ok" : "fail", E.SERVICE_KEY ? "terisi" : "kosong", "Isi SERVICE_KEY di .env.local (dari dosen / .env.example), lalu build ulang.");
// 7 & 8. be + jam
{
  let health = null, t0 = Date.now();
  try {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(6000) });
    health = r;
    add("be terjangkau", r.ok ? "ok" : "fail", r.ok ? `${BASE} (HTTP ${r.status}, ${Date.now() - t0} ms)` : `HTTP ${r.status}`, "Periksa BE_API_URL di .env.local dan koneksi internet / Wi-Fi kelas.");
  } catch (e) { add("be terjangkau", "fail", e.cause?.code || e.message, "Periksa BE_API_URL di .env.local dan koneksi internet / Wi-Fi kelas."); }
  if (health) {
    let server = null;
    try { const t1 = Date.now(); const r = await fetch(`${BASE}/live`, { signal: AbortSignal.timeout(6000) }); const d = await r.json(); if (d.server_now) server = { t: Date.parse(d.server_now), mid: (t1 + Date.now()) / 2 }; } catch {}
    if (!server && health.headers.get("date")) server = { t: Date.parse(health.headers.get("date")) + 500, mid: Date.now() }; // header Date hanya teliti ±1 dtk
    if (server && !Number.isNaN(server.t)) {
      const d = Math.round((server.mid - server.t) / 100) / 10, a = Math.abs(d);
      add("Selisih jam dengan be", a > 5 ? "fail" : a > 2 ? "warn" : "ok", `${d > 0 ? "+" : ""}${d} dtk`, "Aktifkan sinkronisasi waktu otomatis di pengaturan tanggal & jam Windows/macOS (hitung mundur memakai jam be, tetapi selisih besar membingungkan).");
    } else add("Selisih jam dengan be", "warn", "tidak dapat dihitung", "Ulangi setelah be terjangkau.");
  }
}

const icon = { ok: "✓", warn: "⚠", fail: "✗" }, w = Math.max(...rows.map(r => r.name.length));
console.log("\nDataQuest Live Task: pemeriksaan lingkungan\n");
for (const r of rows) console.log(`${icon[r.st]} ${r.name.padEnd(w)}  ${r.msg}${r.st !== "ok" && r.fix ? `\n  ${" ".repeat(w)}  → ${r.fix}` : ""}`);
const bad = rows.filter(r => r.st === "fail").length, warn = rows.filter(r => r.st === "warn").length;
console.log(`\n${bad ? `✗ ${bad} masalah harus diperbaiki.` : warn ? "✓ Siap, dengan peringatan di atas." : "✓ Semua siap."}\n`);
process.exit(bad ? 1 : 0);
