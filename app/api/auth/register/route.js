import { NextResponse } from "next/server";
import { be, COOKIE, cookieOpts, sameOrigin } from "@/lib/be";

export async function POST(req) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origin tidak valid" }, { status: 403 });
  const { nim, password, confirm } = await req.json().catch(() => ({}));
  if (!nim || typeof password !== "string") return NextResponse.json({ error: "Pilih nama/NIM dan isi password" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password minimal 8 karakter" }, { status: 400 });
  if (password !== confirm) return NextResponse.json({ error: "Konfirmasi password tidak sama" }, { status: 400 });
  const r = await be("/register", { method: "POST", body: { nim: String(nim), password } });
  if (!r.ok) return NextResponse.json({ error: r.data.error || "Registrasi gagal" }, { status: r.status });
  const res = NextResponse.json({ player: r.data.player }, { status: 201 });
  res.cookies.set(COOKIE, r.data.token, cookieOpts); // httpOnly: tidak bisa dibaca JavaScript di browser
  return res;
}
