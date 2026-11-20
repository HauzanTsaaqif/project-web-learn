import { NextResponse } from "next/server";
import { runLive, isLiveId, readState } from "@/lib/live/runner";

export const dynamic = "force-dynamic";

// Rute pengembang: jalankan checker satu tugas live TANPA be/lease/freeze. Hanya aktif bila LIVE_DEV=1 (selain itu 404).
// Contoh: LIVE_DEV=1 npm run dev, lalu buka /api/live/dev/1 untuk tugas 1 = kasus 21 (NIM diambil dari .live-state.json).
export async function GET(req, { params }) {
  if (process.env.LIVE_DEV !== "1") return new NextResponse("Not Found", { status: 404 });
  const { n } = await params;
  const id = 20 + Number(n); // n = nomor tugas 1..10 (kasus 21..30)
  if (!isLiveId(id)) return NextResponse.json({ error: "Tugas live tidak ditemukan" }, { status: 404 });
  const origin = new URL(req.url).origin;
  const res = await runLive(id, { nim: readState()?.nim, origin });
  return NextResponse.json(res);
}
