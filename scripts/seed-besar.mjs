// Mengisi tabel struk dengan ±50.000 baris data uji untuk latihan index (kasus 18).
//   npm run seed:besar            -> isi bila belum ada (aman dijalankan ulang)
//   npm run seed:besar -- --ulang -> hapus data seed lama lalu isi ulang
// Hanya menyentuh baris bernomor BSR-xxxxxx; data buatanmu sendiri tidak diubah.
import mysql from "mysql2/promise";

const TARGET = 50000, BATCH = 1000, HARI = 120, ulang = process.argv.includes("--ulang");
if (!process.env.DB_NAME) { console.error("DB_NAME belum diisi. Jalankan lewat npm run seed:besar (membaca .env.local)."); process.exit(1); }

const db = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1", port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root", password: process.env.DB_PASSWORD || "", database: process.env.DB_NAME,
}).catch(e => { console.error(`Tidak bisa terhubung ke MySQL: ${e.code || ""} ${e.message}`); process.exit(1); });

try {
  const [[{ n: kasir }]] = await db.query("SELECT COUNT(*) n FROM kasir").catch(() => { throw new Error("Tabel kasir belum ada. Selesaikan kasus 6-7 dulu."); });
  const [[{ n: metode }]] = await db.query("SELECT COUNT(*) n FROM metode_bayar").catch(() => { throw new Error("Tabel metode_bayar belum ada. Selesaikan kasus 7 dulu."); });
  await db.query("SELECT 1 FROM struk LIMIT 1").catch(() => { throw new Error("Tabel struk belum ada. Selesaikan kasus 7 dulu."); });
  if (!kasir || !metode) throw new Error("Tabel kasir dan metode_bayar harus punya minimal 1 baris.");

  const [[{ n: ada }]] = await db.query("SELECT COUNT(*) n FROM struk WHERE nomor LIKE 'BSR-%'");
  if (ada >= TARGET && !ulang) { console.log(`Sudah ada ${ada.toLocaleString("id-ID")} baris seed (BSR-). Tidak ada yang diubah. Pakai --ulang untuk mengisi ulang.`); process.exit(0); }
  if (ada) { await db.query("DELETE FROM struk WHERE nomor LIKE 'BSR-%'"); console.log(`Menghapus ${ada} baris seed lama...`); }

  const [ks] = await db.query("SELECT id FROM kasir ORDER BY id"), [ms] = await db.query("SELECT id FROM metode_bayar ORDER BY id");
  let s = 20260115; // pseudo-random tetap: hasil sama di semua laptop
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const p2 = n => String(n).padStart(2, "0"), hari0 = new Date(); hari0.setHours(0, 0, 0, 0);
  const t0 = Date.now();
  for (let i = 0; i < TARGET; i += BATCH) {
    const rows = [];
    for (let j = i; j < Math.min(i + BATCH, TARGET); j++) {
      const d = new Date(hari0); d.setDate(d.getDate() - Math.floor(rnd() * HARI));
      const w = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(7 + Math.floor(rnd() * 15))}:${p2(Math.floor(rnd() * 60))}:${p2(Math.floor(rnd() * 60))}`;
      rows.push([`BSR-${String(j + 1).padStart(6, "0")}`, ks[Math.floor(rnd() * ks.length)].id, ms[Math.floor(rnd() * ms.length)].id, w, (15 + Math.floor(rnd() * 486)) * 1000]);
    }
    await db.query("INSERT INTO struk (nomor, kasir_id, metode_bayar_id, waktu, total) VALUES ?", [rows]);
    process.stdout.write(`\r${Math.min(i + BATCH, TARGET).toLocaleString("id-ID")} / ${TARGET.toLocaleString("id-ID")} struk`);
  }
  const [[{ n: total }]] = await db.query("SELECT COUNT(*) n FROM struk");
  console.log(`\nSelesai dalam ${((Date.now() - t0) / 1000).toFixed(1)} detik. Total baris struk sekarang: ${total.toLocaleString("id-ID")}.`);
} catch (e) {
  console.error("\nGagal: " + (e.sqlMessage || e.message));
  process.exitCode = 1;
} finally {
  await db.end();
}
