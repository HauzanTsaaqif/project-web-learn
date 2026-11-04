import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getToken, sameOrigin } from "@/lib/be";

// Generator hash bcrypt untuk kasus 11. Password hanya diproses di server lokalmu dan tidak disimpan/dicatat.
// bcrypt hanya membaca 72 byte pertama, jadi password lebih panjang ditolak agar tidak menimbulkan rasa aman palsu.
export async function POST(req) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origin tidak valid" }, { status: 403 });
  if (!(await getToken())) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const pw = typeof b.password === "string" ? b.password : "";
  if (!pw || Buffer.byteLength(pw) > 72) return NextResponse.json({ error: "Password wajib diisi (maksimum 72 byte)." }, { status: 400 });
  if (typeof b.hash === "string") { // mode verifikasi
    const ok = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(b.hash) ? await bcrypt.compare(pw, b.hash) : false;
    return NextResponse.json({ match: ok });
  }
  const cost = Math.min(12, Math.max(10, Number.parseInt(b.cost, 10) || 10));
  const t0 = Date.now(), hash = await bcrypt.hash(pw, cost);
  return NextResponse.json({ hash, cost, ms: Date.now() - t0 });
}
