import { NextResponse } from "next/server";
import { getPool } from "@/lib/latihan-db";

// KASUS 14: lengkapi handler ini. Aplikasi akan memanggil GET /api/latihan/produk?q=&page=&limit=
// lalu menguji pagination, pencarian, validasi input, dan serangan SQL injection.
// Setelah mengubah file ini jalankan ulang: npm run build && npm start  (atau pakai npm run dev).
export const dynamic = "force-dynamic";

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") || "").trim();
  // TODO 1: ubah page & limit menjadi angka, beri nilai bawaan (page 1, limit 10) dan batasi limit 1..100
  // TODO 2: SELECT id, nama, harga, stok FROM produk WHERE nama LIKE ? ... ORDER BY id LIMIT ? OFFSET ?   (pakai placeholder)
  // TODO 3: SELECT COUNT(*) dengan WHERE yang sama untuk total
  // TODO 4: bungkus try/catch: kalau error, balas { error: "Terjadi kesalahan" } status 500 tanpa membocorkan pesan database
  void q; void getPool;
  return NextResponse.json({ error: "Belum diimplementasi" }, { status: 501 });
}
