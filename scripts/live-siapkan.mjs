// Persiapan Live Task: membuat database tugas (live_t01..t10) dengan data khusus NIM, menulis berkas bantu,
// menyimpan .live-state.json, lalu memberi tahu be bahwa laptop ini siap.
//   npm run live:siapkan                  (menanyakan NIM)
//   npm run live:siapkan -- --nim=2501195
//   npm run live:siapkan -- --nim=2501195 --only=01,02     (uji sebagian tugas)
// Aman diulang: database tugas dibangun ulang.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import mysql from "mysql2/promise";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATE = path.join(ROOT, ".live-state.json");

// muat .env.local (tanpa menimpa variabel yang sudah ada)
function loadEnv() {
  const f = path.join(ROOT, ".env.local");
  if (!fs.existsSync(f)) return false;
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    let v = m[2];
    if (/^(".*"|'.*')$/.test(v)) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
  return true;
}

const arg = name => { const a = process.argv.find(x => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : null; };
const sec = t0 => ((Date.now() - t0) / 1000).toFixed(1);
const die = msg => { console.error(`\n✗ ${msg}`); process.exit(1); };

function explain(e) {
  switch (e.code) {
    case "ECONNREFUSED": return "MySQL tidak menyala atau port salah. Nyalakan MySQL di XAMPP/Laragon dan periksa DB_HOST/DB_PORT di .env.local.";
    case "ER_ACCESS_DENIED_ERROR": return "User/password MySQL ditolak. Periksa DB_USER dan DB_PASSWORD di .env.local.";
    case "ER_DBACCESS_DENIED_ERROR": case "ER_SPECIFIC_ACCESS_DENIED_ERROR": case "ER_TABLEACCESS_DENIED_ERROR":
      return "Akun MySQL tidak punya hak yang cukup (butuh CREATE DATABASE, CREATE USER, GRANT). Pakai akun root di DB_USER.";
    case "ENOTFOUND": case "ETIMEDOUT": case "EHOSTUNREACH": return "Host MySQL tidak terjangkau. Periksa DB_HOST dan DB_PORT.";
    case "PROTOCOL_CONNECTION_LOST": case "ECONNRESET": return "Koneksi ke MySQL terputus. Pastikan MySQL tidak restart; ulangi perintah ini.";
    default: return null;
  }
}

async function main() {
  console.log("DataQuest Live Task: persiapan tugas\n");
  const hasEnv = loadEnv();
  if (!hasEnv) console.warn("⚠ .env.local tidak ditemukan; memakai nilai bawaan (root tanpa password di 127.0.0.1:3306).");

  let nim = arg("nim");
  if (!nim) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    nim = (await rl.question("Masukkan NIM akunmu: ")).trim();
    rl.close();
  }
  if (!/^[A-Za-z0-9]{4,20}$/.test(nim || "")) die("NIM tidak valid (hanya huruf/angka, 4-20 karakter).");

  const only = (arg("only") || "").split(",").map(s => s.trim()).filter(Boolean).map(s => s.padStart(2, "0"));
  const { NN, buildOne } = await import(pathToFileURL(path.join(ROOT, "lib/live/pack/index.mjs")).href);
  const list = only.length ? NN.filter(n => only.includes(n)) : NN.slice();
  if (!list.length) die(`--only tidak cocok dengan tugas manapun (01-10): ${only.join(",")}`);
  if (list.includes("09")) list.push(list.splice(list.indexOf("09"), 1)[0]); // soal 9 (data besar) paling akhir

  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || "127.0.0.1", port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root", password: process.env.DB_PASSWORD || "",
      multipleStatements: false, connectTimeout: 5000,
    });
  } catch (e) { die(`Tidak dapat terhubung ke MySQL: ${e.code || ""} ${e.message}\n  ${explain(e) || "Periksa pengaturan DB_* di .env.local."}`); }

  // gabungkan dengan state lama bila NIM sama (untuk --only)
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(STATE, "utf8")); } catch {}
  const tasks = prev && String(prev.nim) === nim && only.length ? { ...(prev.tasks || {}) } : {};
  const t00 = Date.now(), failed = [], skipped = [];

  for (const nn of list) {
    const t0 = Date.now();
    process.stdout.write(`  Tugas ${nn} ... `);
    let pack;
    try { pack = await buildOne(nim, nn); }
    catch (e) { console.log(`✗ (paket gagal dibangun: ${e.message})`); failed.push(nn); continue; }
    if (!pack) { console.log("- dilewati (paket belum tersedia)"); skipped.push(nn); delete tasks[nn]; continue; }
    try {
      for (const stmt of pack.statements || []) await conn.query(stmt);
      for (const f of pack.files || []) {
        const dest = path.resolve(ROOT, f.path);
        if (dest !== ROOT && !dest.startsWith(ROOT + path.sep)) throw new Error(`Path berkas keluar dari folder project: ${f.path}`);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, f.content, "utf8");
      }
      tasks[nn] = { db: pack.db, expect: pack.expect };
      console.log(`✓ ${pack.db} (${sec(t0)} dtk)`);
    } catch (e) {
      delete tasks[nn];
      console.log(`✗ (${sec(t0)} dtk)`);
      console.error(`      ${e.code || "ERROR"}: ${e.sqlMessage || e.message}`);
      const hint = explain(e); if (hint) console.error(`      → ${hint}`);
      failed.push(nn);
    }
  }
  await conn.end().catch(() => {});

  if (Object.keys(tasks).length) {
    fs.writeFileSync(STATE, JSON.stringify({ nim, prepared_at: new Date().toISOString(), tasks }, null, 2), "utf8");
  }

  // beri tahu be (hanya service key); kegagalan jaringan hanya peringatan
  const base = process.env.BE_API_URL || "http://195.88.211.226:4001/api";
  if (Object.keys(tasks).length) {
    try {
      const r = await fetch(`${base}/live/prepared`, {
        method: "POST", headers: { "content-type": "application/json", "x-service-key": process.env.SERVICE_KEY || "" },
        body: JSON.stringify({ nim }), signal: AbortSignal.timeout(8000),
      });
      if (r.ok) console.log("\n✓ be diberi tahu: laptopmu siap.");
      else console.warn(`\n⚠ be menolak penandaan siap (HTTP ${r.status}). Tidak apa-apa: halaman Live akan mencoba lagi otomatis setelah kamu Gabung.`);
    } catch (e) { console.warn(`\n⚠ be tidak terjangkau (${e.cause?.code || e.message}). Tidak apa-apa: halaman Live akan memberi tahu be otomatis nanti.`); }
  }

  const ok = Object.keys(tasks).length;
  console.log(`\nRingkasan: ${list.length - failed.length - skipped.length} tugas siap, ${failed.length} gagal, ${skipped.length} dilewati, total ${sec(t00)} dtk.`);
  if (failed.length) { console.error(`Gagal: tugas ${failed.join(", ")}. Perbaiki penyebabnya lalu jalankan ulang (aman diulang).`); process.exit(1); }
  if (!ok) die("Tidak ada tugas yang disiapkan.");
  console.log("Selesai. Buka http://localhost:3001/live setelah balapan dimulai.");
}

main().catch(e => die(e.message));
