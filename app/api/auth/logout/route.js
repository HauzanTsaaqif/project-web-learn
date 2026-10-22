import { NextResponse } from "next/server";
import { COOKIE, sameOrigin } from "@/lib/be";

export async function POST(req) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origin tidak valid" }, { status: 403 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
