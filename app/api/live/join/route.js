import { NextResponse } from "next/server";
import { be, getToken, sameOrigin } from "@/lib/be";

export async function POST(req) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origin tidak valid" }, { status: 403 });
  const token = await getToken();
  if (!token) return NextResponse.json({ error: "Belum login", code: "no_session" }, { status: 401 });
  const r = await be("/live/join", { method: "POST", token, service: true });
  return NextResponse.json(r.data, { status: r.status });
}
