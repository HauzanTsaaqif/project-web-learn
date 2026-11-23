import { NextResponse } from "next/server";
import { be, getToken } from "@/lib/be";
import { readState } from "@/lib/live/runner";
import { orderFor } from "@/lib/live/pack/rng.mjs";

export const dynamic = "force-dynamic";

// Gabungan: status pemain dari be (/live/me) + kesiapan lokal (.live-state.json cocok dengan NIM akun) + urutan tugas pribadi.
export async function GET() {
  const token = await getToken();
  if (!token) return NextResponse.json({ error: "Belum login", code: "no_session" }, { status: 401 });
  const [me, live] = await Promise.all([be("/me", { token }), be("/live/me", { token, service: true })]);
  if (me.status === 401 || live.status === 401) return NextResponse.json({ error: "Sesi berakhir" }, { status: 401 });
  if (!live.ok) return NextResponse.json({ error: live.data.error || "Gagal memuat status Live", code: live.data.code || "backend" }, { status: live.status === 503 ? 503 : 502 });
  const nim = me.ok ? String(me.data.nim || "") : "";
  const st = readState();
  const localOk = !!(st && nim && String(st.nim) === nim && st.tasks && Object.keys(st.tasks).length);
  let prepared_be = !!live.data.prepared;
  // lokal sudah siap tetapi be belum tahu (CLI gagal menghubungi be): beri tahu be sekarang (hanya service key)
  if (localOk && live.data.joined && !prepared_be) {
    const r = await be("/live/prepared", { method: "POST", service: true, body: { nim } });
    if (r.ok) prepared_be = true;
  }
  return NextResponse.json({
    ...live.data,
    nim,
    prepared: localOk,
    prepared_be,
    nim_mismatch: !!(st && nim && String(st.nim) !== nim),
    prepared_nim: st?.nim ?? null,
    urutan: nim ? orderFor(nim) : Array.from({ length: 10 }, (_, i) => i + 1),
  });
}
