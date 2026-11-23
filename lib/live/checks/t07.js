import { issue, rowsIn } from "../common";
import { callJson } from "./_b";

// Live 27 / tugas 07: route /api/latihan/live/cari harus memakai query berparameter.
// Dipanggil lewat HTTP ke origin sendiri. Perubahan route butuh `npm run build` ulang kecuali memakai `npm run dev`.
const PATH = "/api/latihan/live/cari";
const NORMAL = ["kopi", "O'Brien", "o'brien", "D'Lite", "teh", "zzzz-tidak-ada"];
const PAYLOAD = [
  "' OR 1=1 -- ",
  "' OR '1'='1",
  "' OR 1=1 #",
  "'/**/OR/**/1=1#",
  "\\' OR 1=1 -- ",
  "' UNION SELECT id, nama, harga, stok FROM produk -- ",
  "%' AND 1=0 UNION SELECT 1, user(), 1, 1 -- ",
  "\"; DROP TABLE produk; -- ",
  "\" OR \"\"=\"",
];

export default async function check({ db, expect, origin }) {
  // env=true: bukan salah mahasiswa (route belum disiapkan / build lama). Runner yang menentukan hasil akhir.
  const envIssue = (code, title, detail, hint) => ({ ok: false, env: true, issues: [issue(code, title, detail, hint)] });
  if (!origin) return envIssue("API_UNREACHABLE", "Alamat aplikasi tidak diketahui", "Origin request tidak tersedia.");
  const call = (q, ms) => callJson(origin, `${PATH}?q=${encodeURIComponent(q)}`, ms);

  const first = await call("kopi", 15000); // route pertama kali dibuka di mode dev bisa lambat
  if (first.error) return envIssue("API_UNREACHABLE", "Route pencarian tidak bisa dipanggil", String(first.error), "Pastikan aplikasi berjalan, lalu coba lagi.");
  if (first.status === 501 || first.status === 404)
    return envIssue("LIVE_NOT_PREPARED", `Route pencarian belum siap (HTTP ${first.status})`, "route.js masih berupa stub, atau aplikasi masih menjalankan build lama.", "Jalankan npm run live:siapkan, lalu npm run build && npm start (atau pakai npm run dev).");

  const bad = [], tests = [];
  const sorted = r => (r.json && Array.isArray(r.json.items) ? r.json.items.map(x => Number(x.id)).sort((a, b) => a - b) : null);

  // 1) pencarian normal: hasil sama dengan LIKE berparameter, termasuk nama ber-apostrof
  for (const q of NORMAL) {
    const want = (await rowsIn(db, "SELECT id FROM produk WHERE nama LIKE ? ORDER BY id", [`%${q}%`])).map(r => Number(r.id));
    const r = q === "kopi" ? first : await call(q), got = sorted(r);
    if (r.status !== 200 || !got || !Number.isFinite(Number(r.json.total))) {
      bad.push(issue("API_NORMAL", `Pencarian normal q='${q}' gagal`, `HTTP ${r.status ?? r.error}; diharapkan 200 dan JSON { items: [...], total }. Diterima: ${(r.text || "").slice(0, 120)}`, q.includes("'") ? "Nama berapostrof (O'Brien) harus tetap bisa dicari. Menghapus tanda kutip dari input bukan perbaikan." : undefined));
      break;
    }
    if (got.join() !== want.join() || Number(r.json.total) !== want.length) {
      bad.push(issue("API_NORMAL", `Pencarian normal q='${q}' salah`, `Seharusnya id [${want.join(", ") || "-"}] dengan total ${want.length}; diterima id [${got.join(", ") || "-"}] dengan total ${r.json.total}.`, q.includes("'") ? "Nama berapostrof (O'Brien) harus tetap bisa dicari. Menghapus atau mengganti tanda kutip bukan perbaikan." : undefined));
      break;
    }
    tests.push({ q, hasil: got.length });
  }

  // 2) payload jahat: tidak ada produk yang namanya seperti payload, jadi hasil yang sah selalu kosong
  let inj = false;
  for (const pl of PAYLOAD) {
    const r = await call(pl), got = sorted(r);
    if (r.error) { bad.push(issue("API_INJECTION", "Route tidak menjawab saat diberi input jahat", `q=${pl.trim()} → ${r.error}`)); inj = true; break; }
    if (r.status >= 500) { bad.push(issue("API_INJECTION", "Input jahat membuat server error", `q=${pl.trim()} → HTTP ${r.status}. Error SQL pada input seperti ini menandakan query dirangkai dari teks.`, "Kirim nilai lewat placeholder (?), bukan disambung ke string SQL.")); inj = true; break; }
    if (/ER_[A-Z_]+|SQL syntax|sqlMessage|root@|@localhost/i.test(r.text || "")) { bad.push(issue("API_LEAK", "Respons membocorkan detail database", `q=${pl.trim()} → ${(r.text || "").slice(0, 140)}`)); inj = true; break; }
    if (r.status === 200 && ((got && got.length) || Number(r.json?.total) > 0)) {
      bad.push(issue("API_INJECTION", "Rentan SQL injection!", `q=${pl.trim()} mengembalikan ${got ? got.length : r.json?.total} baris padahal tidak ada produk dengan nama seperti itu.`, "Payload ini mengubah arti query. Pisahkan perintah SQL dari data: pakai query berparameter."));
      inj = true; break;
    }
    tests.push({ payload: pl, aman: true });
  }

  // 3) tabel utuh
  let utuh = true;
  try {
    const rows = (await rowsIn(db, "SELECT id, nama, harga, stok FROM produk ORDER BY id")).map(r => [Number(r.id), r.nama, Number(r.harga), Number(r.stok)]);
    utuh = JSON.stringify(rows) === JSON.stringify(expect.produk);
  } catch { utuh = false; }
  if (!utuh) bad.push(issue("DATA_CHANGED", "Isi tabel produk berubah", "Tabel produk tidak sama dengan data awal (hilang, berubah, atau bertambah) setelah pengujian.", "Jalankan ulang npm run live:siapkan untuk memulihkan data, lalu perbaiki route."));
  return { ok: !bad.length, issues: bad, data: { tests } };
}
