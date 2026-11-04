"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, KeyRound, Lightbulb, ShieldCheck, X } from "lucide-react";
import { Shell, useProgress } from "./Dashboard";

// Generator hash bcrypt untuk kasus 11. Password diproses di server lokal (/api/hash) dan tidak disimpan.
export default function HashTool() {
  const [st] = useProgress();
  const [pw, setPw] = useState(""), [cost, setCost] = useState(10), [out, setOut] = useState(null), [busy, setBusy] = useState(false), [copied, setCopied] = useState(false);
  const [vpw, setVpw] = useState(""), [vh, setVh] = useState(""), [vr, setVr] = useState(null);

  const post = body => fetch("/api/hash", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(async r => ({ ok: r.ok, ...(await r.json().catch(() => ({}))) }));
  const make = async e => {
    e.preventDefault(); setBusy(true); setCopied(false);
    setOut(await post({ password: pw, cost })); setBusy(false);
  };
  const verify = async e => { e.preventDefault(); setVr(await post({ password: vpw, hash: vh.trim() })); };
  const copy = () => navigator.clipboard?.writeText(out.hash).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); });

  return (
    <Shell player={st.player} poin={st.poin}>
      <main className="page hash-page">
        <Link href="/case/11" className="back"><ArrowLeft size={16} />Kembali ke kasus 11</Link>
        <section className="hero2"><div><span className="kick">Alat bantu kasus 11</span><h1>Generator hash bcrypt</h1>
          <p>Ubah password menjadi hash yang aman disimpan di kolom <code>password_hash</code>. Hash dibuat di server lokalmu dan password tidak disimpan di mana pun.</p></div></section>
        <div className="hash-grid">
          <form className="panel" onSubmit={make}>
            <h4>1. Buat hash</h4>
            <label className="fld"><span>Password</span><input value={pw} onChange={e => setPw(e.target.value)} autoComplete="off" spellCheck={false} placeholder="mis. kopi-enak-123" maxLength={72} /></label>
            <label className="fld"><span>Cost (makin tinggi makin lambat dan makin aman)</span>
              <select value={cost} onChange={e => setCost(Number(e.target.value))}>{[10, 11, 12].map(c => <option key={c} value={c}>{c} ({2 ** c} putaran)</option>)}</select></label>
            <button className="btn" disabled={!pw || busy}><KeyRound size={17} />{busy ? "Membuat..." : "Buat hash"}</button>
            {out && !out.ok && <p className="err-t">{out.error || "Gagal membuat hash"}</p>}
            {out?.ok && (
              <div className="code"><div className="code-h"><b>password_hash • {out.ms} ms</b><button type="button" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Tersalin" : "Salin"}</button></div><pre>{out.hash}</pre></div>)}
            <small>Buat ulang dengan password yang sama: hasilnya akan berbeda. Itu normal, karena setiap hash memakai salt acak.</small>
          </form>
          <form className="panel" onSubmit={verify}>
            <h4>2. Periksa password terhadap hash</h4>
            <label className="fld"><span>Hash dari database</span><input value={vh} onChange={e => { setVh(e.target.value); setVr(null); }} spellCheck={false} placeholder="$2b$10$..." /></label>
            <label className="fld"><span>Password yang dicoba</span><input value={vpw} onChange={e => { setVpw(e.target.value); setVr(null); }} autoComplete="off" spellCheck={false} maxLength={72} /></label>
            <button className="btn alt" disabled={!vpw || !vh}><ShieldCheck size={17} />Periksa</button>
            {vr && <div className={`access ${vr.match ? "ok" : "no"}`}>{vr.match ? <Check size={18} /> : <X size={18} />}<span>{vr.match ? "Cocok: password benar." : "Tidak cocok. Beginilah aplikasi menolak login yang salah."}</span></div>}
            <small>Aplikasi tidak pernah membuka hash. Saat login ia menghitung hash dari password yang diketik, lalu membandingkannya.</small>
          </form>
        </div>
        <div className="callout"><Lightbulb size={18} />Jangan memakai password asli milikmu. Gunakan password contoh, lalu salin hash-nya ke perintah INSERT di kasus 11.</div>
      </main>
    </Shell>
  );
}
