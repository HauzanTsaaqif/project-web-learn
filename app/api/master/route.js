import { NextResponse } from "next/server";
import { be } from "@/lib/be";

// Daftar mahasiswa yang belum terdaftar (untuk dropdown pencarian di halaman register)
export async function GET() {
  const r = await be("/master?available=1");
  if (!r.ok) return NextResponse.json({ error: r.data.error || "Gagal memuat data mahasiswa" }, { status: r.status || 502 });
  return NextResponse.json(r.data.map(({ nim, nama, kelas }) => ({ nim, nama, kelas })));
}
