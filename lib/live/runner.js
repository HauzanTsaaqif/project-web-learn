import "server-only";
import fs from "node:fs";
import path from "node:path";
import { getPool, dbName } from "./db";
import { issue } from "./common";

// Kasus live 21..30 -> tugas "01".."10"
export const LIVE_FIRST = 21, LIVE_LAST = 30;
export const isLiveId = id => Number.isInteger(Number(id)) && Number(id) >= LIVE_FIRST && Number(id) <= LIVE_LAST;
export const nnOf = id => String(Number(id) - LIVE_FIRST + 1).padStart(2, "0");

const ENV_CODES = new Set(["ECONNREFUSED", "ER_ACCESS_DENIED_ERROR", "ER_BAD_DB_ERROR", "ETIMEDOUT", "PROTOCOL_CONNECTION_LOST", "ENOTFOUND", "EHOSTUNREACH", "ECONNRESET"]);
const TIMEOUT_MS = 20000;

export const statePath = () => path.join(process.cwd(), ".live-state.json");
export function readState() {
  try { return JSON.parse(fs.readFileSync(statePath(), "utf8")); } catch { return null; }
}

const env = (code, title, detail, hint) => ({ outcome: "env", issues: [issue(code, title, detail, hint)], data: null });

/**
 * Jalankan checker satu tugas live.
 * Mengembalikan { outcome: 'lolos'|'salah'|'env', issues, data }.
 *  - env   : masalah lingkungan (MySQL mati, DB belum disiapkan, NIM tidak cocok, .live-state.json hilang) -> TIDAK membekukan
 *  - salah : database terbaca tetapi syarat belum terpenuhi (termasuk kueri mahasiswa yang melewati batas waktu) -> freeze
 */
export async function runLive(id, { nim, origin } = {}) {
  const nn = nnOf(id), db = dbName(Number(nn));
  if (!process.env.DB_HOST && !process.env.DB_USER && !process.env.DB_NAME && !fs.existsSync(path.join(process.cwd(), ".env.local")))
    return env("CONNECTION", "Konfigurasi MySQL belum diisi", ".env.local tidak ditemukan.", "Salin .env.example menjadi .env.local lalu build ulang.");
  const st = readState();
  if (!st?.tasks?.[nn]) return env("LIVE_NOT_PREPARED", "Tugas belum disiapkan di laptopmu", "Berkas .live-state.json tidak ditemukan atau belum memuat tugas ini.", "Jalankan: npm run live:siapkan");
  if (String(st.nim) !== String(nim)) return env("NIM_MISMATCH", "NIM persiapan tidak sama dengan akun yang login", `Persiapan dibuat untuk NIM ${st.nim}, akun login memakai NIM ${nim}.`, "Jalankan ulang: npm run live:siapkan (isi NIM akunmu sendiri).");
  try {
    const [[ok]] = await getPool().query("SELECT COUNT(*) n FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?", [db]);
    if (!Number(ok.n)) return env("LIVE_NOT_PREPARED", `Database ${db} belum ada`, "Persiapan tugas belum dijalankan atau database terhapus.", "Jalankan: npm run live:siapkan");
    const mod = await import(`./checks/t${nn}.js`);
    let timer;
    const res = await Promise.race([
      mod.default({ db, n: Number(nn), nim, expect: st.tasks[nn].expect, origin }),
      new Promise((_, rej) => { timer = setTimeout(() => rej(Object.assign(new Error("Pengecekan melewati batas waktu 20 detik"), { code: "LIVE_TIMEOUT" })), TIMEOUT_MS); }),
    ]).finally(() => clearTimeout(timer));
    return res.ok ? { outcome: "lolos", issues: [], data: res.data ?? null } : { outcome: "salah", issues: res.issues || [], data: null };
  } catch (e) {
    if (e.code === "LIVE_TIMEOUT") return { outcome: "salah", issues: [issue("QUERY_TIMEOUT", "Pengecekan terlalu lama", "Kueri atau objek buatanmu (VIEW/prosedur/index) berjalan lebih dari 20 detik.", "Periksa join yang tidak terbatas atau kueri tanpa index.")], data: null };
    if (ENV_CODES.has(e.code)) {
      const m = e.code === "ECONNREFUSED" ? "MySQL tidak menyala (cek XAMPP/Laragon)" : e.code === "ER_ACCESS_DENIED_ERROR" ? "User/password MySQL salah" : "Tidak dapat terhubung ke MySQL";
      return env("CONNECTION", m, `${e.code}: ${e.message}`, "Periksa DB_HOST, DB_PORT, DB_USER, DB_PASSWORD di .env.local.");
    }
    return { outcome: "salah", issues: [issue("QUERY_ERROR", "Pengecekan gagal dijalankan", `${e.code || "ERROR"}: ${e.sqlMessage || e.message}`)], data: null };
  }
}
