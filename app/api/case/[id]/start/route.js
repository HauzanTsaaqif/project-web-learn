import { NextResponse } from "next/server";
import { be, getToken, sameOrigin } from "@/lib/be";
import { caseById } from "@/lib/cases";

// Dipanggil saat halaman kasus dibuka: backend mencatat waktu PERTAMA kali saja (dasar durasi pengerjaan).
export async function POST(req, { params }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origin tidak valid" }, { status: 403 });
  const token = await getToken();
  if (!token) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  const { id } = await params;
  if (!caseById(id)) return NextResponse.json({ error: "Kasus tidak ditemukan" }, { status: 404 });
  const r = await be(`/cases/${Number(id)}/start`, { method: "POST", token });
  return NextResponse.json({ started: !!r.data.started }, { status: r.status === 401 ? 401 : 200 });
}
