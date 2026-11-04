import { NextResponse } from "next/server";
import { be, getToken } from "@/lib/be";

// Riwayat poin masuk milik mahasiswa yang login (kasus, poin, durasi, jumlah percobaan)
export async function GET() {
  const token = await getToken();
  if (!token) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  const r = await be("/me/history", { token });
  if (r.status === 401) return NextResponse.json({ error: "Sesi berakhir" }, { status: 401 });
  return r.ok ? NextResponse.json(r.data) : NextResponse.json({ rows: [], total: 0, unavailable: true });
}
