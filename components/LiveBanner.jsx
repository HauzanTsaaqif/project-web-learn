"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, Snowflake, Timer, Trophy } from "lucide-react";

export const PHASE_LABEL = { lobi: "Lobi: menunggu dosen memulai", balapan: "Balapan berlangsung", podium: "Balapan selesai: podium", kesan: "Sesi kesan", selesai: "Sesi selesai" };

// 1:05:09 / 05:09
export const clock = sec => {
  const s = Math.max(0, Math.floor(sec)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  return `${h ? h + ":" : ""}${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export function burst(host, n = 36) {
  if (!host) return;
  for (let k = 0; k < n; k++) {
    const d = document.createElement("i"); d.className = "cf";
    d.style.cssText = `left:${50 + (Math.random() - .5) * 20}%;background:${["#10B981", "#FBBF24", "#F26BA5", "#6F8FE6", "#8457E6"][k % 5]};--x:${(Math.random() - .5) * 520}px;--y:${-120 - Math.random() * 260}px;--r:${Math.random() * 720}deg;animation-delay:${Math.random() * .15}s`;
    host.append(d); setTimeout(() => d.remove(), 1600);
  }
}

/** Status Live dari server (polling 5 dtk). Waktu dihitung dari server_now + offset; sumber kebenaran freeze tetap be. */
export function useLive() {
  const router = useRouter();
  const [st, setSt] = useState(null), [err, setErr] = useState(null), [off, setOff] = useState(0), [, setTick] = useState(0);
  const alive = useRef(true);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/live/state", { cache: "no-store" });
      if (r.status === 401) { router.replace("/login"); return null; }
      const d = await r.json().catch(() => ({}));
      if (!alive.current) return null;
      if (!r.ok) { setErr(d.error || "Gagal memuat status Live"); return null; }
      setErr(null); setSt(d);
      if (d.server_now) setOff(Date.parse(d.server_now) - Date.now());
      return d;
    } catch { if (alive.current) setErr("Tidak dapat menghubungi server aplikasi."); return null; }
  }, [router]);
  useEffect(() => {
    alive.current = true; load();
    const a = setInterval(load, 5000), b = setInterval(() => setTick(t => t + 1), 500);
    return () => { alive.current = false; clearInterval(a); clearInterval(b); };
  }, [load]);
  const now = Date.now() + off;
  const patch = useCallback(p => setSt(s => ({ ...(s || {}), ...p })), []);
  const ms = iso => (iso ? Date.parse(iso) : null);
  const left = st?.ends_at ? Math.max(0, (ms(st.ends_at) - now) / 1000) : null;
  const frozenLeft = st?.frozen_until ? Math.max(0, Math.ceil((ms(st.frozen_until) - now) / 1000)) : 0;
  const racing = st?.phase === "balapan" && st?.joined;
  const done = id => (st?.tasks_done || []).includes(id);
  return { st, err, now, load, patch, left, frozenLeft, racing, done };
}

export function LiveBanner({ live }) {
  const { st, err, left, frozenLeft } = live;
  if (!st) return <div className="lv-banner lv-wait"><span>{err || "Memuat status Live..."}</span></div>;
  const phase = st.phase, total = st.total_points ?? 1000, n = (st.tasks_done || []).length;
  const low = phase === "balapan" && left != null && left <= 300;
  return (
    <div className={`lv-banner ${frozenLeft > 0 ? "frz" : ""} ${low ? "low" : ""}`} role="status">
      <div className="lv-b1"><span className="lv-ph"><Flag size={15} />{phase ? PHASE_LABEL[phase] : "Belum ada sesi Live"}</span>
        {phase === "balapan" && left != null && <span className="lv-time"><Timer size={22} />{clock(left)}</span>}
        {err && <small className="lv-err">{err}</small>}</div>
      {st.joined && <div className="lv-b2">
        <span className="lv-stat"><Trophy size={16} /><b>{st.points ?? 0}</b> / {total} poin</span>
        <span className="lv-stat"><b>{n}</b> / 10 tugas</span>
        {st.finished && <span className="lv-stat fin"><Flag size={16} />Finish{st.finish_rank ? ` #${st.finish_rank}` : ""}</span>}
        {frozenLeft > 0 && <span className="lv-stat ice"><Snowflake size={16} />Dibekukan <b>{clock(frozenLeft)}</b></span>}
      </div>}
    </div>
  );
}

/** Overlay selamat saat 10 tugas selesai (~6 dtk), lalu otomatis ke form kesan. */
export function Celebrate({ rank, onGo }) {
  const host = useRef(), went = useRef(false);
  const go = useCallback(() => { if (went.current) return; went.current = true; onGo(); }, [onGo]);
  useEffect(() => {
    burst(host.current, 60);
    const iv = setInterval(() => burst(host.current, 40), 900);
    const t = setTimeout(go, 6000);
    return () => { clearInterval(iv); clearTimeout(t); };
  }, [go]);
  return (
    <div className="lv-cel" ref={host} role="dialog" aria-label="Selamat">
      <div className="lv-cel-b">
        <Trophy size={64} />
        <h2>Selamat! Kamu menyelesaikan 10 tugas</h2>
        {rank ? <p className="lv-rank">Urutan finish ke-<b>{rank}</b></p> : null}
        <p>Sebentar lagi kamu diarahkan ke form kesan.</p>
        <button className="btn" onClick={go}>Lanjut ke kesan</button>
      </div>
    </div>
  );
}

// Pindah ke form kesan di FE lewat tiket dari be
export async function openKesan(toast) {
  try {
    const r = await fetch("/api/live/kesan", { method: "POST" });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.url) { window.location.href = d.url; return true; }
    toast?.({ tone: "err", title: "Form kesan belum bisa dibuka", text: d.error || `HTTP ${r.status}` });
  } catch { toast?.({ tone: "err", title: "Form kesan belum bisa dibuka", text: "Server tidak terjangkau." }); }
  return false;
}
