import { NextResponse } from "next/server";

// STUB AMAN (di-commit). Versi rentan untuk Live 27 ditulis oleh `npm run live:siapkan` dan tidak ikut di-commit.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ error: "Tugas belum disiapkan. Jalankan: npm run live:siapkan" }, { status: 501 });
}
