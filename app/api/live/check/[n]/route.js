import { NextResponse } from "next/server";
import { be, getToken, sameOrigin } from "@/lib/be";
import { runLive, isLiveId } from "@/lib/live/runner";

export const dynamic = "force-dynamic";
const last = new Map(); // rate limit per token: 1 pengecekan / 1,2 detik
const REJECT = new Set([400, 403, 404, 409, 423]); // penolakan resmi be: balas apa adanya, checker TIDAK dijalankan
const wait = ms => new Promise(r => setTimeout(r, ms));

// Alur: sameOrigin -> token -> id live -> rate limit -> be /live/check (lease) -> checker lokal -> be /live/result (retry 3x).
// be tidak terjangkau saat check = gagal-tertutup (tidak ada pengecekan, tanpa freeze).
export async function POST(req, { params }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origin tidak valid" }, { status: 403 });
  const token = await getToken();
  if (!token) return NextResponse.json({ error: "Belum login", code: "no_session" }, { status: 401 });
  const { n } = await params;
  if (!isLiveId(n)) return NextResponse.json({ error: "Tugas live tidak ditemukan", code: "not_live" }, { status: 404 });
  const id = Number(n);
  const now = Date.now();
  if (now - (last.get(token) || 0) < 1200) return NextResponse.json({ error: "Terlalu cepat, coba lagi sebentar.", code: "rate" }, { status: 429 });
  last.set(token, now);
  if (last.size > 500) last.clear();

  const [chk, me] = await Promise.all([
    be("/live/check", { method: "POST", token, service: true, body: { case_id: id } }),
    be("/me", { token }),
  ]);
  if (chk.status === 401 || me.status === 401) return NextResponse.json({ error: "Sesi berakhir" }, { status: 401 });
  if (!chk.ok) {
    if (REJECT.has(chk.status)) return NextResponse.json({ error: chk.data.error || "Pengecekan ditolak", ...chk.data }, { status: chk.status });
    return NextResponse.json({ error: "Backend tidak terjangkau, coba lagi", code: "backend" }, { status: 503 });
  }
  const lease = chk.data.lease;
  if (!lease) return NextResponse.json({ error: "Backend tidak terjangkau, coba lagi", code: "backend" }, { status: 503 });
  const nim = me.ok ? String(me.data.nim || "") : "";

  // Kasus 14-style: route buatan mahasiswa dipanggil lewat HTTP ke server ini sendiri
  const port = (req.headers.get("host") || "").split(":")[1] || process.env.PORT || "3001";
  let res;
  try { res = await runLive(id, { nim, origin: `http://127.0.0.1:${port}` }); }
  catch (e) { res = { outcome: "env", issues: [{ code: "CHECKER", title: "Pengecekan gagal dijalankan", detail: String(e?.message || e), hint: "Bukan salahmu: tidak dibekukan. Coba lagi." }] }; }
  const issues = res.issues || [];
  const codes = issues.map(x => x.code);

  let out = null;
  for (let i = 0; i < 4; i++) {
    if (i) await wait([500, 1000, 2000][i - 1]);
    out = await be("/live/result", { method: "POST", token, service: true, body: { case_id: id, lease, outcome: res.outcome, codes } });
    if (out.ok || (out.status >= 400 && out.status < 500)) break; // 4xx = penolakan resmi, tidak diulang
  }
  if (!out.ok) {
    if (out.status === 409) return NextResponse.json({ error: "Pengecekan kedaluwarsa, tekan Cek lagi.", code: out.data.code || "no_lease" }, { status: 409 });
    if (out.status === 401) return NextResponse.json({ error: "Sesi berakhir" }, { status: 401 });
    if (out.status < 500 && out.status !== 429) return NextResponse.json({ error: out.data.error || "Hasil ditolak backend", code: out.data.code }, { status: out.status });
    return NextResponse.json({ error: "Hasil belum tersimpan, tekan Cek lagi", code: "result_failed" }, { status: 502 });
  }
  return NextResponse.json({ outcome: res.outcome, issues, result: out.data });
}
