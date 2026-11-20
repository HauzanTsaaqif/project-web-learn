"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Flag, Lock, Snowflake, Terminal, TriangleAlert } from "lucide-react";
import { LIVE_CASES, LIVE_STORY } from "@/lib/live-cases";
import { Shell, useProgress, ICONS } from "./Dashboard";
import { useToast } from "./ui";
import { LiveBanner, openKesan, useLive } from "./LiveBanner";

const CMD = "npm run live:siapkan";

export default function LivePage() {
  const [pr] = useProgress(), live = useLive(), toast = useToast();
  const { st, frozenLeft, racing, done } = live;
  const [copied, setCopied] = useState(false), [busy, setBusy] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(CMD).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }); };
  const join = async () => {
    setBusy(true);
    const r = await fetch("/api/live/join", { method: "POST" }), d = await r.json().catch(() => ({}));
    if (!r.ok) toast({ tone: "err", title: "Belum bisa bergabung", text: d.error || `HTTP ${r.status}` });
    await live.load(); setBusy(false);
  };
  const kesan = async () => { setBusy(true); await openKesan(toast); setBusy(false); };

  const order = (st?.urutan || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).map(n => LIVE_CASES.find(c => c.n === n)).filter(Boolean);
  const canJoin = st && (st.phase === "lobi" || st.phase === "balapan") && !st.joined;
  const showKesan = st && (st.phase === "kesan" || st.phase === "selesai" || st.finished) && st.joined;

  return (
    <Shell player={pr.player} poin={pr.poin}>
      <LiveBanner live={live} />
      <main className="page">
        <section className="lv-hero">
          <span className="kick">Live Task</span><h1>Hari Peluncuran</h1><p>{LIVE_STORY}</p>
          <div className="lv-act">
            {canJoin && <button className="btn" onClick={join} disabled={busy}><Flag size={17} />Gabung</button>}
            {st?.joined && st.phase === "lobi" && <span className="okb"><Check size={14} />Sudah bergabung, menunggu dosen memulai</span>}
            {showKesan && <button className="btn" onClick={kesan} disabled={busy}>Tulis kesan</button>}
            {st && !st.phase && <span className="mut">Belum ada sesi. Tunggu dosen membukanya.</span>}
          </div>
        </section>

        {st && st.joined && !st.prepared && (
          <section className="lv-prep">
            <h3><Terminal size={18} />Persiapan</h3>
            {st.nim_mismatch
              ? <p className="lv-warn"><TriangleAlert size={16} />Persiapan di laptop ini dibuat untuk NIM {st.prepared_nim}, bukan NIM akunmu ({st.nim}). Jalankan ulang dengan NIM akunmu.</p>
              : <p>Tugas belum disiapkan di laptopmu. Perintah ini membuat database tiap tugas (data berbeda per NIM) dan mencatat kesiapanmu. Aman diulang, tetapi mengulang akan membangun ulang database tugas.</p>}
            <div className="code"><div className="code-h"><b>Jalankan di terminal (folder project)</b><button onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Tersalin" : "Salin"}</button></div><pre>{CMD}</pre></div>
            <p className="mut">Isi NIM akunmu saat diminta. Pastikan MySQL menyala dan <code>.env.local</code> terisi. Cek lingkungan dengan <code>npm run live:cek</code>.</p>
          </section>
        )}
        {st?.joined && st.prepared && <p className="lv-ok"><Check size={16} />Tugas sudah disiapkan di laptop ini.</p>}

        <p className="wk-t"><b>10 tugas</b> • urutan khusus untukmu{!racing && " • soal terbaca saja sampai balapan dimulai"}</p>
        <section className="cases">
          {order.map((c, i) => {
            const I = ICONS[c.icon], ok = done(c.id), lock = !racing && !ok;
            return (
              <Link key={c.id} href={`/live/${c.id}`} className={`case-card ${ok ? "done" : ""} ${lock ? "locked" : ""}`} style={{ "--i": i }}>
                <span className="no">{i + 1}</span>
                <span className="ci"><I size={24} /></span>
                <div><small className="lv">Tugas {i + 1}</small><h3>{c.title}</h3><p>{c.story}</p></div>
                <footer><span className="pts">+{c.points} poin</span>{ok ? <span className="okb"><Check size={14} />Selesai</span> : frozenLeft > 0 && racing ? <span className="lockb"><Snowflake size={14} />Beku</span> : lock ? <span className="lockb"><Lock size={14} />Terkunci</span> : <span className="go">Belum selesai</span>}</footer>
              </Link>
            );
          })}
        </section>
      </main>
    </Shell>
  );
}
