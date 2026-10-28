import { NextResponse } from "next/server";
import { be, getToken, sameOrigin } from "@/lib/be";
import { runCase } from "@/lib/checker";
import { caseById } from "@/lib/cases";

const last = new Map(); // rate limit sederhana per token: 1 pengecekan / 1,2 detik

export async function POST(req, { params }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origin tidak valid" }, { status: 403 });
  const token = await getToken();
  if (!token) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  const { id } = await params;
  if (!caseById(id)) return NextResponse.json({ error: "Kasus tidak ditemukan" }, { status: 404 });
  const now = Date.now();
  if (now - (last.get(token) || 0) < 1200) return NextResponse.json({ error: "Terlalu cepat, coba lagi sebentar." }, { status: 429 });
  last.set(token, now);
  if (last.size > 500) last.clear();

  const result = await runCase(Number(id));
  if (!result.ok) return NextResponse.json({ ok: false, issues: result.issues });

  // Poin hanya diklaim dari server (SERVICE_KEY) setelah verifikasi lolos; backend menjamin hanya sekali per kasus.
  const claim = await be(`/cases/${Number(id)}/claim`, { method: "POST", token, service: true });
  if (claim.status === 401) return NextResponse.json({ error: "Sesi berakhir" }, { status: 401 });
  if (claim.status === 403 && /belum dibuka/i.test(claim.data.error || "")) // minggu dikunci dosen: pengecekan lolos tetapi poin belum bisa diklaim
    return NextResponse.json({ ok: true, data: result.data, claim: { status: "locked", message: claim.data.error } });
  return NextResponse.json({
    ok: true, data: result.data,
    claim: claim.ok ? { status: claim.data.awarded ? "awarded" : "already", points: claim.data.points, poin: claim.data.poin } : { status: "error", message: claim.data.error || "Gagal memperbarui poin" },
  });
}
