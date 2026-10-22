import { NextResponse } from "next/server";
import { be, COOKIE, cookieOpts, sameOrigin } from "@/lib/be";

export async function POST(req) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origin tidak valid" }, { status: 403 });
  const { nim, password } = await req.json().catch(() => ({}));
  const r = await be("/login", { method: "POST", body: { nim: String(nim || ""), password: String(password || "") } });
  if (!r.ok) return NextResponse.json({ error: r.data.error || "Login gagal" }, { status: r.status });
  const res = NextResponse.json({ player: r.data.player });
  res.cookies.set(COOKIE, r.data.token, cookieOpts);
  return res;
}
