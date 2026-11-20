import "server-only";
import { issue, rowsIn } from "../common";
import { verifyCs, columnsOf, near } from "./_a";

// Kolom lain yang tidak boleh berubah tipenya (nama -> [tipe, nullable])
const LAIN = {
  produk: { id: ["int", false], nama: ["varchar", false], stok: ["int", false], kategori_id: ["int", true] },
  struk_item: { struk_id: ["int", false], produk_id: ["int", false], qty: ["int", false] },
};
const TARGET = [["produk", "harga", "sum_harga"], ["struk_item", "harga_satuan", "sum_harga_satuan"]];

export default async function check({ db, expect }) {
  const out = [];
  // 1) Tipe kolom uang
  for (const [t, c] of TARGET) {
    const cols = await columnsOf(db, t), k = cols[c];
    if (!k) { out.push(issue("COLUMN_MISSING", `Kolom ${t}.${c} hilang`, "Kolom ini tidak boleh dihapus atau diganti nama.", `Gunakan MODIFY (bukan DROP/CHANGE) pada ${t}.${c}.`)); continue; }
    if (k.type !== "decimal")
      out.push(issue("TYPE_WRONG", `${t}.${c} masih bertipe ${k.type.toUpperCase()}`, `Tipe bilangan pecahan biner (FLOAT/DOUBLE) menyimpan uang dengan galat pembulatan. Ditemukan: ${k.type}.`, "Uang disimpan dengan tipe desimal tepat: DECIMAL(presisi, skala). Gunakan 2 angka di belakang koma."));
    else {
      if (k.scale !== 2) out.push(issue("SCALE_WRONG", `${t}.${c}: skala DECIMAL harus 2`, `Ditemukan DECIMAL(${k.prec},${k.scale}); butuh 2 angka di belakang koma.`, "Contoh bentuk: DECIMAL(12,2)."));
      if (k.prec < 10) out.push(issue("PRECISION_LOW", `${t}.${c}: presisi DECIMAL terlalu kecil`, `Ditemukan DECIMAL(${k.prec},${k.scale}); minimal presisi 10 agar nilai besar muat.`, "Naikkan angka pertama (jumlah digit total)."));
      if (k.nullable) out.push(issue("NULLABLE", `${t}.${c} boleh NULL`, "Kolom aslinya NOT NULL; MODIFY tanpa NOT NULL menghapus batasan itu.", "Tulis ulang definisi kolom lengkap: tipe baru + NOT NULL."));
    }
  }
  // 2) Kolom lain tidak berubah
  for (const [t, def] of Object.entries(LAIN)) {
    const cols = await columnsOf(db, t);
    for (const [c, [ty, nul]] of Object.entries(def)) {
      const k = cols[c];
      if (!k) out.push(issue("COLUMN_CHANGED", `Kolom ${t}.${c} hilang`, "Kolom lain tidak boleh diubah.", "Kembalikan kolom itu seperti semula."));
      else if (k.type !== ty || k.nullable !== nul) out.push(issue("COLUMN_CHANGED", `Kolom ${t}.${c} ikut berubah`, `Ditemukan ${k.type}${k.nullable ? " NULL" : " NOT NULL"}; semula ${ty}${nul ? " NULL" : " NOT NULL"}.`, "Hanya dua kolom uang yang boleh diubah."));
    }
    const extra = Object.keys(cols).filter(c => !(c in def) && !TARGET.some(([tt, cc]) => tt === t && cc === c));
    if (extra.length) out.push(issue("COLUMN_CHANGED", `Tabel ${t} punya kolom tambahan`, `Kolom tidak dikenal: ${extra.join(", ")}.`, "Jangan menambah kolom."));
  }
  if (out.length) return { ok: false, issues: out };

  // 3) Data utuh: jumlah baris, kolom lain, dan nilai uang (dua desimal)
  out.push(...await verifyCs(db, expect.cs));
  // 4) Jumlah per kolom (toleransi 0,005)
  for (const [t, c, key] of TARGET) {
    const [{ s }] = await rowsIn(db, `SELECT IFNULL(SUM(\`${c}\`),0) AS s FROM \`${t}\``);
    if (!near(s, expect[key])) out.push(issue("SUM_MISMATCH", `Jumlah ${t}.${c} tidak sama dengan semula`, `Total sekarang ${Number(s).toFixed(2)}, seharusnya ${Number(expect[key]).toFixed(2)}. Nilai berubah dari semula.`, "Ubah tipe dengan ALTER TABLE ... MODIFY; jangan buat ulang tabel atau mengisi nilai manual."));
  }
  return out.length ? { ok: false, issues: out } : { ok: true, issues: [] };
}
