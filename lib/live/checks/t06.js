import { issue, errTxt, rowsIn, sandboxIn, scope, attempt } from "../common";
import { stripSql } from "./_b";

// Live 26 / tugas 06: sp_checkout(p_kasir_id, p_metode_id, p_produk_id, p_qty).
// Lolos: stok cukup -> struk, struk_item, stok_mutasi, stok benar; stok kurang atau qty <= 0 -> SIGNAL 45000 tanpa sisa;
// stok tidak pernah minus; rutin TIDAK mengatur transaksi sendiri (COMMIT/START TRANSACTION/ROLLBACK).
const TABEL = ["kasir", "metode_bayar", "produk", "struk", "struk_item", "stok_mutasi"];
const INTS = ["int", "bigint", "smallint", "mediumint", "tinyint"];

export default async function check({ db, expect }) {
  const bad = [];

  // 1) data dasar utuh (stok boleh berubah)
  const [{ k }] = await rowsIn(db, "SELECT COUNT(*) k FROM kasir"), [{ m }] = await rowsIn(db, "SELECT COUNT(*) m FROM metode_bayar");
  const prod = (await rowsIn(db, "SELECT id, nama, harga FROM produk ORDER BY id")).map(r => [Number(r.id), r.nama, Number(r.harga)]);
  if (Number(k) !== expect.kasir || Number(m) !== expect.metode || JSON.stringify(prod) !== JSON.stringify(expect.produk))
    return { ok: false, issues: [issue("DATA_CHANGED", "Data dasar (kasir, metode_bayar, produk) berubah", "Nama atau harga produk, atau daftar kasir/metode bayar, tidak sama dengan data awal. Soal ini hanya tentang prosedur sp_checkout.", "Kembalikan datanya, atau jalankan ulang: npm run live:siapkan")] };

  // 2) rutin harus ada dengan signature yang benar
  const [r] = await rowsIn(db, "SELECT ROUTINE_DEFINITION d FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=? AND ROUTINE_TYPE='PROCEDURE' AND LOWER(ROUTINE_NAME)='sp_checkout'", [db]);
  if (!r) return { ok: false, issues: [issue("PROC_MISSING", "Prosedur sp_checkout tidak ditemukan", `Di database ${db} tidak ada PROCEDURE bernama sp_checkout (mungkin terhapus saat DROP).`, "Buat ulang dengan nama dan parameter yang sama: sp_checkout(p_kasir_id, p_metode_id, p_produk_id, p_qty).")] };
  const par = await rowsIn(db, "SELECT PARAMETER_MODE mode, LOWER(DATA_TYPE) t FROM information_schema.PARAMETERS WHERE SPECIFIC_SCHEMA=? AND LOWER(SPECIFIC_NAME)='sp_checkout' AND ROUTINE_TYPE='PROCEDURE' ORDER BY ORDINAL_POSITION", [db]);
  if (par.length !== 4 || par.some(p => String(p.mode).toUpperCase() !== "IN" || !INTS.includes(p.t)))
    return { ok: false, issues: [issue("PROC_SIGNATURE", "Parameter sp_checkout berubah", `Ditemukan ${par.length} parameter (${par.map(p => `${p.mode} ${p.t}`).join(", ") || "-"}). Diharapkan 4 parameter IN bertipe INT: kasir_id, metode_bayar_id, produk_id, qty.`, "Pertahankan signature aslinya; yang diperbaiki hanya isi prosedur.")] };

  // 3) rutin tidak boleh mengatur transaksi: transaksi milik pemanggil (kami juga tidak menjalankan uji bila ini terjadi)
  const body = stripSql(r.d);
  const trx = /\b(COMMIT|ROLLBACK|START\s+TRANSACTION|BEGIN\s+WORK)\b|\bSET\s+(?:@@(?:session\.)?|SESSION\s+)?autocommit\b/i.exec(body);
  if (trx) return { ok: false, issues: [issue("PROC_TRANSACTION", `Prosedur mengatur transaksi sendiri (${trx[0].replace(/\s+/g, " ").toUpperCase()})`, "Transaksi diatur oleh pemanggil (aplikasi), bukan oleh prosedur. COMMIT/START TRANSACTION/ROLLBACK di dalam rutin ikut menutup atau membatalkan transaksi pemanggil. Pengujian dihentikan agar datamu aman.", "Validasi dulu (stok cukup? qty valid?) dan lakukan SIGNAL sebelum menulis apa pun; baru INSERT/UPDATE.")] };

  // 4) uji perilaku: semua dalam transaksi + SAVEPOINT yang di-ROLLBACK
  const u = expect.uji, uji = {};
  bad.push(...await sandboxIn(db, TABEL, async conn => {
    const out = [];
    const [kr] = await conn.query("SELECT id FROM kasir WHERE id=?", [u.kasir]), [mr] = await conn.query("SELECT id FROM metode_bayar WHERE id=?", [u.metode]);
    const [pr] = await conn.query("SELECT id, harga FROM produk WHERE id=?", [u.produk]);
    if (!kr[0] || !mr[0] || !pr[0]) return [issue("DATA_CHANGED", "Data uji tidak ditemukan", "Kasir 1, metode bayar 1, atau produk 1 hilang.", "Jalankan ulang: npm run live:siapkan")];
    const h = Number(pr[0].harga);
    const snap = async () => {
      const [[a]] = await conn.query("SELECT (SELECT COUNT(*) FROM struk) s, (SELECT COUNT(*) FROM struk_item) i, (SELECT COUNT(*) FROM stok_mutasi) m, (SELECT stok FROM produk WHERE id=?) stok, (SELECT IFNULL(MAX(id),0) FROM struk) mx", [u.produk]);
      return { s: Number(a.s), i: Number(a.i), m: Number(a.m), stok: Number(a.stok), mx: Number(a.mx) };
    };
    const call = q => attempt(conn, "CALL sp_checkout(?, ?, ?, ?)", [u.kasir, u.metode, u.produk, q]);
    const setStok = n => conn.query("UPDATE produk SET stok=? WHERE id=?", [n, u.produk]);

    // a) penjualan normal: stok 5, qty 2
    await scope(conn, async () => {
      await setStok(5); const b = await snap(), c = await call(2);
      if (c.e) { out.push(issue("PROC_ERROR", "CALL sp_checkout gagal untuk penjualan yang valid", `${errTxt(c.e)}. Pemanggilan: CALL sp_checkout(${u.kasir}, ${u.metode}, ${u.produk}, 2) dengan stok 5.`)); return; }
      const a = await snap();
      const [[s]] = await conn.query("SELECT kasir_id, metode_bayar_id, total FROM struk WHERE id > ? ORDER BY id LIMIT 1", [b.mx]);
      const [items] = await conn.query("SELECT produk_id, qty, harga_satuan FROM struk_item WHERE struk_id IN (SELECT id FROM struk WHERE id > ?)", [b.mx]);
      const [mut] = await conn.query("SELECT perubahan FROM stok_mutasi WHERE ref_struk_id IN (SELECT id FROM struk WHERE id > ?)", [b.mx]);
      uji.normal = { stok: [b.stok, a.stok], struk: a.s - b.s, item: a.i - b.i, mutasi: mut.length };
      if (a.s - b.s !== 1 || !s) out.push(issue("PROC_DATA", "Penjualan valid harus membuat tepat 1 struk", `Jumlah struk ${b.s} → ${a.s}.`));
      else if (Number(s.kasir_id) !== u.kasir || Number(s.metode_bayar_id) !== u.metode || Math.abs(Number(s.total) - 2 * h) > 0.01)
        out.push(issue("PROC_DATA", "Isi struk salah", `kasir_id=${s.kasir_id}, metode_bayar_id=${s.metode_bayar_id}, total=${Number(s.total)}; diharapkan ${u.kasir}, ${u.metode}, ${2 * h} (2 x ${h}).`));
      if (items.length !== 1 || Number(items[0].produk_id) !== u.produk || Number(items[0].qty) !== 2 || Math.abs(Number(items[0].harga_satuan) - h) > 0.01)
        out.push(issue("PROC_DATA", "struk_item tidak sesuai", `Diharapkan 1 item (produk ${u.produk}, qty 2, harga_satuan ${h}); ditemukan ${items.length} item.`));
      if (a.stok !== 3) out.push(issue("PROC_STOK", "Stok tidak berkurang tepat sebesar qty", `Stok 5 → ${a.stok}; seharusnya 3.`));
      if (mut.length !== 1 || Number(mut[0].perubahan) !== -2) out.push(issue("PROC_MUTASI", "stok_mutasi tidak dicatat dengan benar", `Diharapkan 1 baris dengan perubahan -2 untuk struk ini; ditemukan ${mut.length}${mut[0] ? ` (perubahan ${mut[0].perubahan})` : ""}.`));
    });
    if (out.length) return out;

    // b) batas: qty = stok persis diperbolehkan, stok jadi 0 (bukan minus)
    await scope(conn, async () => {
      await setStok(3); const c = await call(3), a = await snap();
      if (c.e) out.push(issue("PROC_BOUNDARY", "Penjualan sebanyak stok tersisa ditolak", `Stok 3, qty 3 seharusnya boleh (stok jadi 0). Error: ${errTxt(c.e)}`, "Tolak hanya bila stok KURANG dari qty (stok < qty), bukan bila sama."));
      else if (a.stok !== 0) out.push(issue("PROC_STOK", "Stok akhir salah pada penjualan habis", `Stok 3, qty 3 → ${a.stok}; seharusnya 0.`));
    });

    // c) tolak: stok kurang, qty 0, qty negatif. Harus SIGNAL 45000 dan TIDAK ada sisa apa pun.
    const reject = async (label, stok, qty) => {
      await scope(conn, async () => {
        await setStok(stok); const b = await snap(), c = await call(qty), a = await snap();
        uji[label] = { stok, qty, ditolak: !!c.e, errno: c.e?.errno ?? null };
        if (!c.e) { out.push(issue("PROC_REJECT", `${label}: tidak ditolak`, `CALL dengan stok ${stok} dan qty ${qty} berhasil (stok → ${a.stok}). Seharusnya SIGNAL SQLSTATE '45000'.`, "Periksa kondisi di awal prosedur, sebelum INSERT/UPDATE pertama.")); return; }
        if (c.e.errno !== 1644 && c.e.sqlState !== "45000") { out.push(issue("PROC_REJECT", `${label}: ditolak dengan error yang salah`, `${errTxt(c.e)}. Gunakan SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '...'.`)); return; }
        if (a.s !== b.s || a.i !== b.i || a.m !== b.m || a.stok !== b.stok)
          out.push(issue("PROC_PARTIAL", `${label}: ada data setengah jadi`, `Setelah ditolak: struk ${b.s}→${a.s}, struk_item ${b.i}→${a.i}, stok_mutasi ${b.m}→${a.m}, stok ${b.stok}→${a.stok}. Error di tengah prosedur tidak membatalkan langkah sebelumnya.`, "Validasi dulu, baru tulis: semua pengecekan harus selesai sebelum INSERT/UPDATE pertama."));
      });
    };
    await reject("Stok kurang", 5, 6);
    await reject("qty nol", 5, 0);
    await reject("qty negatif", 5, -1);

    // d) tidak ada stok minus di mana pun
    const [[neg]] = await conn.query("SELECT COUNT(*) n FROM produk WHERE stok < 0");
    if (Number(neg.n)) out.push(issue("PROC_STOK", "Ada produk dengan stok negatif", `${neg.n} produk bernilai stok < 0.`));
    return out;
  }));

  return { ok: !bad.length, issues: bad, data: { uji } };
}
