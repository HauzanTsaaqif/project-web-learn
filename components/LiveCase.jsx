"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CheckCircle2, Database, Lightbulb, Lock, Play, RefreshCw, Snowflake, TriangleAlert, XCircle } from "lucide-react";
import { liveCaseById, LIVE_CASES } from "@/lib/live-cases";
import { Shell, useProgress, ICONS } from "./Dashboard";
import { useToast } from "./ui";
import { burst, Celebrate, clock, LiveBanner, openKesan, useLive } from "./LiveBanner";

function Scan() {
  return <div className="scan"><div className="scan-b"><i /><i /><i /><i /></div><p>Memeriksa database di MySQL lokal...</p></div>;
}

export default function LiveCase({ id }) {
  const c = liveCaseById(id), I = ICONS[c.icon], router = useRouter(), toast = useToast();
  const [pr] = useProgress(), live = useLive(), host = useRef();
  const { st, frozenLeft, racing, done: isDone } = live;
  const [state, setState] = useState({ s: "idle" }), [cel, setCel] = useState(null);
  const done = isDone(id), finished = !!st?.finished;
  const idx = (st?.urutan || []).indexOf(c.n);
  const nextC = st?.urutan ? LIVE_CASES.find(x => x.n === st.urutan[(idx + 1) % 10] && !isDone(x.id) && x.id !== id) : null;

  const reason = !st ? "Memuat status Live..." : !st.phase ? "Belum ada sesi Live." : !st.joined ? "Kamu belum bergabung. Buka halaman Live dan tekan Gabung." : st.phase !== "balapan" ? "Balapan belum dimulai atau sudah berakhir. Soal hanya bisa dibaca." : finished ? "Semua tugas sudah selesai." : done ? "Tugas ini sudah selesai." : frozenLeft > 0 ? `Dibekukan ${clock(frozenLeft)}` : null;
  const busy = state.s === "loading";

  const run = async () => {
    setState({ s: "loading" });
    const [r] = await Promise.all([fetch(`/api/live/check/${id}`, { method: "POST" }), new Promise(res => setTimeout(res, 700))]);
    if (r.status === 401) return router.replace("/login");
    const d = await r.json().catch(() => ({ error: "Respons tidak valid" }));
    if (r.status === 423) { live.patch({ frozen_until: d.frozen_until }); setState({ s: "frozen" }); live.load(); return; }
    if (!r.ok) {
      setState({ s: "err", status: r.status, code: d.code, msg: d.error || `HTTP ${r.status}` });
      if (r.status === 409 || r.status === 403) live.load();
      return;
    }
    const res = d.result || {};
    if (d.outcome === "lolos") {
      setState({ s: "ok" }); burst(host.current);
      live.patch({ points: res.points, tasks_done: [...new Set([...(st?.tasks_done || []), id])], frozen_until: res.frozen_until ?? null, finished: !!res.finished, finish_rank: res.finish_rank ?? null });
      toast({ tone: "ok", title: res.awarded === false ? "Tugas sudah tercatat" : `+${c.points} poin!`, text: `Poin game: ${res.points ?? "-"}.`, ms: 5500 });
      if (res.finished) setCel({ rank: res.finish_rank });
    } else if (d.outcome === "salah") {
      setState({ s: "fail", issues: d.issues || [] });
      live.patch({ frozen_until: res.frozen_until ?? st?.frozen_until ?? null });
    } else {
      setState({ s: "env", issues: d.issues || [] });
    }
    live.load();
  };

  return (
    <Shell player={pr.player} poin={pr.poin}>
      <LiveBanner live={live} />
      {cel && <Celebrate rank={cel.rank} onGo={async () => { const ok = await openKesan(toast); if (!ok) setCel(null); }} />}
      <main className="page case-page">
        <Link href="/live" className="back"><ArrowLeft size={16} />Semua tugas Live</Link>
        <div className="case-grid">
          <aside className="brief">
            <div className="brief-h"><span className="ci lg"><I size={26} /></span><div><small className="lv">Live • Tugas {idx >= 0 ? idx + 1 : c.n} • +{c.points} poin</small><h1>{c.title}</h1></div>{done && <span className="okb"><Check size={14} />Selesai</span>}</div>
            {!racing && !done && <div className="callout"><Lock size={18} />Pengecekan aktif hanya saat balapan berlangsung dan kamu sudah bergabung. Kamu tetap bisa membaca soal.</div>}
            <p className="story">{c.story}</p>
            <p className="mut lv-db">Database tugas: <code>live_t{String(c.n).padStart(2, "0")}</code></p>
            <h3>Yang harus ada</h3>
            <ul className="reqs">{c.reqs.map(r => <li key={r}><CheckCircle2 size={17} />{r}</li>)}</ul>
            <h3>Tips &amp; trik</h3>
            <ul className="tips">{c.tips.map(t => <li key={t}><Lightbulb size={16} />{t}</li>)}</ul>
            <div className="callout"><TriangleAlert size={18} />Jawaban yang salah membekukan semua tombol Cek di semua tugas. Periksa dulu sebelum menekan Cek.</div>
          </aside>

          <section className="result" ref={host}>
            <div className="result-h"><b>Pengecekan database</b>
              <button className="btn" onClick={run} disabled={busy || !!reason}>{state.s === "idle" ? <Play size={17} /> : <RefreshCw size={17} className={busy ? "rot" : ""} />}{frozenLeft > 0 ? `Beku ${clock(frozenLeft)}` : state.s === "idle" ? "Cek" : "Cek lagi"}</button></div>
            {reason && !busy && <p className="lv-reason">{frozenLeft > 0 ? <Snowflake size={16} /> : null}{reason}</p>}
            {state.s === "idle" && <div className="empty-r"><Database size={40} /><h3>Belum ada pengecekan</h3><p>Kerjakan di MySQL lokalmu, lalu tekan Cek. Jawaban salah membekukan tombol Cek untuk beberapa saat.</p></div>}
            {busy && <Scan />}
            {state.s === "ok" && <div className="okv"><div className="ok-h"><CheckCircle2 size={22} /><div><b>Tugas lolos!</b><small>Poin game sudah dicatat.</small></div></div>
              <div className="ok-f">{finished || nextC === null ? <Link className="btn" href="/live">Kembali ke daftar tugas</Link> : <Link className="btn" href={`/live/${nextC.id}`}>Tugas berikutnya</Link>}</div></div>}
            {state.s === "fail" && (
              <div className="errs"><div className="errs-h"><XCircle size={20} /><div><b>{state.issues.length} masalah ditemukan</b><small>{frozenLeft > 0 ? `Semua tombol Cek dibekukan ${clock(frozenLeft)}. Pakai waktu ini untuk memperbaiki.` : "Perbaiki lalu cek lagi."}</small></div></div>
                {state.issues.map((x, i) => <article key={i} className="err" style={{ "--i": i }}><header><code>{x.code}</code><b>{x.title}</b></header><pre>{x.detail}</pre>{x.hint && <p><Lightbulb size={15} />{x.hint}</p>}</article>)}</div>)}
            {state.s === "env" && (
              <div className="errs"><div className="errs-h lv-env"><TriangleAlert size={20} /><div><b>Masalah lingkungan, bukan jawabanmu</b><small>Kamu tidak dibekukan. Perbaiki lalu tekan Cek lagi.</small></div></div>
                {state.issues.map((x, i) => <article key={i} className="err" style={{ "--i": i }}><header><code>{x.code}</code><b>{x.title}</b></header><pre>{x.detail}</pre>{x.hint && <p><Lightbulb size={15} />{x.hint}</p>}</article>)}</div>)}
            {state.s === "frozen" && <div className="errs"><div className="errs-h lv-ice"><Snowflake size={20} /><div><b>Masih dibekukan</b><small>{frozenLeft > 0 ? `Tunggu ${clock(frozenLeft)} lagi.` : "Pembekuan sudah berakhir, tekan Cek lagi."}</small></div></div></div>}
            {state.s === "err" && <div className="errs"><div className="errs-h"><XCircle size={20} /><div><b>{state.code === "busy" ? "Pengecekan lain sedang berjalan" : state.code === "backend" ? "Backend tidak terjangkau" : "Pengecekan tidak dijalankan"}</b><small>{state.msg}{state.code === "busy" ? " Tunggu sebentar lalu coba lagi." : ""}</small></div></div></div>}
          </section>
        </div>
      </main>
    </Shell>
  );
}
