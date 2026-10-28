import { NextResponse } from "next/server";
import { be, getToken } from "@/lib/be";

export async function GET() {
  const token = await getToken();
  if (!token) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  const [me, cases] = await Promise.all([be("/me", { token }), be("/me/cases", { token })]);
  if (me.status === 401 || cases.status === 401) return NextResponse.json({ error: "Sesi berakhir" }, { status: 401 });
  if (!me.ok || !cases.ok) return NextResponse.json({ error: me.data.error || cases.data.error || "Gagal memuat" }, { status: 502 });
  // BE lama belum punya field "cases"/"perWeek": semua kasus dianggap terbuka
  const open = Object.fromEntries((cases.data.cases || []).map(c => [c.id, c.is_open !== false]));
  return NextResponse.json({ player: me.data, completed: cases.data.completed.map(c => c.case_id), poin: cases.data.poin, open, perWeek: cases.data.perWeek || null });
}
