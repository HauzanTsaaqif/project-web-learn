"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, Database, Lightbulb, Play, RefreshCw, TriangleAlert, XCircle } from "lucide-react";
import { caseById, CASES } from "@/lib/cases";
import { Shell, useProgress, ICONS } from "./Dashboard";
import { ResultView } from "./views";
import { useToast } from "./ui";

function Erd({ tables }) {
  return (
    <div className="erd">{tables.map((t, i) => (
      <div className="erd-w" key={t.name}>
        {i > 0 && <div className="rel"><span>1</span><i /><span>N</span></div>}
        <div className="erd-t"><header><Database size={14} />{t.name}</header>
          {t.cols ? t.cols.map(([c, ty, n]) => <div key={c} className="erd-c"><b>{c}</b><em>{ty}</em>{n && <small>{n}</small>}</div>) : <div className="erd-c mut"><small>kolom: tentukan sendiri</small></div>}</div>
      </div>))}</div>
  );
}

function Scan() {
  return <div className="scan"><div className="scan-b"><i /><i /><i /><i /></div><p>Memeriksa skema dan data di MySQL lokal...</p></div>;
}

function burst(host) {
  if (!host) return;
  for (let n = 0; n < 36; n++) {
    const d = document.createElement("i"); d.className = "cf";
    d.style.cssText = `left:${50 + (Math.random() - .5) * 20}%;background:${["#10B981", "#FBBF24", "#F26BA5", "#6F8FE6", "#8457E6"][n % 5]};--x:${(Math.random() - .5) * 520}px;--y:${-120 - Math.random() * 260}px;--r:${Math.random() * 720}deg;animation-delay:${Math.random() * .15}s`;
    host.append(d); setTimeout(() => d.remove(), 1600);
  }
}

export default function CaseClient({ id }) {
  const c = caseById(id), I = ICONS[c.icon], router = useRouter(), toast = useToast();
  const [st, , setSt] = useProgress();
  const [state, setState] = useState({ s: "idle" }), [copied, setCopied] = useState(false), host = useRef();
  const done = (st.completed || []).includes(id);
  const next = CASES.find(x => x.id === id + 1);

  const run = async () => {
    setState({ s: "loading" });
    const [r] = await Promise.all([fetch(`/api/case/${id}`, { method: "POST" }), new Promise(res => setTimeout(res, 900))]);
    if (r.status === 401) return router.replace("/login");
    const d = await r.json().catch(() => ({ error: "Respons tidak valid" }));
    if (!r.ok) { setState({ s: "fail", issues: [{ code: "SERVER", title: d.error || "Terjadi kesalahan", detail: `HTTP ${r.status}` }] }); return; }
    if (!d.ok) { setState({ s: "fail", issues: d.issues }); return; }
    setState({ s: "ok", data: d.data });
    burst(host.current);
    const k = d.claim;
    if (k.status === "awarded") { toast({ tone: "ok", title: `+${k.points} poin!`, text: `Kasus ${id} selesai. Total poinmu ${k.poin}.`, ms: 6500 }); setSt(s => ({ ...s, poin: k.poin, completed: [...(s.completed || []), id] })); }
    else if (k.status === "already") { toast({ tone: "warn", title: "Poin sudah pernah didapat", text: "Kasus ini sudah kamu selesaikan sebelumnya, poin tidak ditambah lagi.", ms: 6500 }); setSt(s => ({ ...s, poin: k.poin, completed: (s.completed || []).includes(id) ? s.completed : [...(s.completed || []), id] })); }
    else toast({ tone: "err", title: "Poin belum tersimpan", text: k.message });
  };
  const copy = () => { navigator.clipboard?.writeText(c.starter).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }); };

  return (
    <Shell player={st.player} poin={st.poin}>
      <main className="page case-page">
        <Link href="/dashboard" className="back"><ArrowLeft size={16} />Semua kasus</Link>
        <div className="case-grid">
          <aside className="brief">
            <div className="brief-h"><span className="ci lg"><I size={26} /></span><div><small className="lv">Level {c.id} • {c.level} • +{c.points} poin</small><h1>{c.title}</h1></div>{done && <span className="okb"><Check size={14} />Selesai</span>}</div>
            <p className="story">{c.story}</p>
            <h3>Yang harus ada</h3>
            <ul className="reqs">{c.reqs.map(r => <li key={r}><CheckCircle2 size={17} />{r}</li>)}</ul>
            {c.erd && <><h3>{c.hints === "full" ? "Gambaran ERD" : "Sketsa relasi"}</h3><Erd tables={c.erd} /></>}
            {c.starter && <div className="code"><div className="code-h"><b>SQL awal (phpMyAdmin / tab SQL)</b><button onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Tersalin" : "Salin"}</button></div><pre>{c.starter}</pre></div>}
            {c.tips.length > 0 && <><h3>Tips &amp; trik</h3><ul className="tips">{c.tips.map(t => <li key={t}><Lightbulb size={16} />{t}</li>)}</ul></>}
            {c.hints === "none" && <div className="callout"><TriangleAlert size={18} />Tanpa petunjuk: gunakan semua yang sudah kamu pelajari. Baca pesan error dengan teliti.</div>}
          </aside>

          <section className="result" ref={host}>
            <div className="result-h"><b>Pengecekan database</b>
              <button className="btn" onClick={run} disabled={state.s === "loading"}>{state.s === "idle" ? <Play size={17} /> : <RefreshCw size={17} className={state.s === "loading" ? "rot" : ""} />}{state.s === "idle" ? "Jalankan pengecekan" : "Cek ulang"}</button></div>
            {state.s === "idle" && <div className="empty-r"><Database size={40} /><h3>Belum ada pengecekan</h3><p>Siapkan database lokalmu, lalu tekan tombol di atas. Aplikasi akan membaca skema dan datanya langsung dari MySQL.</p></div>}
            {state.s === "loading" && <Scan />}
            {state.s === "fail" && (
              <div className="errs"><div className="errs-h"><XCircle size={20} /><div><b>{state.issues.length} masalah ditemukan</b><small>Perbaiki satu per satu, lalu cek ulang.</small></div></div>
                {state.issues.map((x, i) => (
                  <article key={i} className="err" style={{ "--i": i }}><header><code>{x.code}</code><b>{x.title}</b></header><pre>{x.detail}</pre>{x.hint && <p><Lightbulb size={15} />{x.hint}</p>}</article>))}
                {state.issues.some(x => x.code === "CONNECTION") && <div className="callout"><TriangleAlert size={18} />Nyalakan Apache + MySQL di XAMPP, atau Start All di Laragon. Pastikan <code>.env.local</code> terisi, lalu jalankan ulang <code>npm run build</code> dan <code>npm start</code>.</div>}</div>)}
            {state.s === "ok" && (
              <div className="okv"><div className="ok-h"><CheckCircle2 size={22} /><div><b>Database lolos pengecekan</b><small>Tampilan di bawah dirender dari data MySQL milikmu.</small></div></div>
                <ResultView id={id} data={state.data} />
                <div className="ok-f">{next ? <Link className="btn" href={`/case/${next.id}`}>Lanjut ke kasus {next.id}<ArrowRight size={17} /></Link> : <Link className="btn" href="/dashboard">Selesai, kembali ke dashboard</Link>}</div></div>)}
          </section>
        </div>
      </main>
    </Shell>
  );
}
