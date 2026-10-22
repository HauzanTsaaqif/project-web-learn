"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Lock, LogIn, UserPlus } from "lucide-react";
import { Combobox, Dobi, useToast } from "./ui";

export default function AuthForm({ mode }) {
  const reg = mode === "register";
  const router = useRouter(), toast = useToast();
  const [opts, setOpts] = useState([]), [loading, setLoading] = useState(reg);
  const [nim, setNim] = useState(""), [pw, setPw] = useState(""), [cf, setCf] = useState(""), [show, setShow] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState({});
  useEffect(() => {
    if (!reg) return;
    fetch("/api/master").then(r => r.json()).then(d => { if (Array.isArray(d)) setOpts(d); else toast({ tone: "err", title: "Gagal memuat mahasiswa", text: d.error }); }).catch(() => toast({ tone: "err", title: "Gagal memuat mahasiswa" })).finally(() => setLoading(false));
  }, [reg, toast]);

  const submit = async e => {
    e.preventDefault();
    const er = {};
    if (!nim) er.nim = "Pilih nama / NIM kamu";
    if (pw.length < 8) er.pw = "Minimal 8 karakter";
    if (reg && cf !== pw) er.cf = "Konfirmasi tidak sama";
    setErr(er); if (Object.keys(er).length) return;
    setBusy(true);
    const r = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nim, password: pw, confirm: cf }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast({ tone: "err", title: reg ? "Registrasi gagal" : "Login gagal", text: d.error });
    toast({ tone: "ok", title: `Selamat datang, ${d.player.nama.split(" ")[0]}!`, text: reg ? "Akun dibuat dengan 0 poin. Selamat mengerjakan." : undefined });
    router.replace("/dashboard"); router.refresh();
  };

  return (
    <main className="auth">
      <aside className="auth-art" aria-hidden="true"><div className="blob b1" /><div className="blob b2" /><Dobi className="auth-m" /><h2>Latihan database<br />rasa dunia kerja.</h2><p>Bangun skema MySQL-mu, jalankan, dan lihat aplikasinya hidup. Setiap kasus yang lolos menambah poin ke leaderboard.</p>
        <ul><li>5 kasus bertingkat</li><li>Error nyata dari database lokalmu</li><li>Poin aman, hanya sekali per kasus</li></ul></aside>
      <section className="auth-card">
        <form onSubmit={submit} noValidate>
          <h1>{reg ? "Buat akun" : "Masuk"}</h1>
          <p className="mut">{reg ? "Pilih namamu dari daftar mahasiswa, lalu buat password." : "Masuk dengan NIM dan password."}</p>
          <label className="fld"><span>{reg ? "Nama / NIM" : "NIM"}</span>
            {reg ? <Combobox options={opts} value={nim} onChange={v => { setNim(v); setErr(x => ({ ...x, nim: "" })); }} placeholder="Cari dan pilih namamu" loading={loading} error={err.nim} />
              : <input className={err.nim ? "bad" : ""} inputMode="numeric" value={nim} onChange={e => setNim(e.target.value.trim())} placeholder="contoh: 2502537" autoComplete="username" />}
            {err.nim && <em>{err.nim}</em>}</label>
          <label className="fld"><span>Password</span>
            <div className="pw"><Lock size={16} /><input className={err.pw ? "bad" : ""} type={show ? "text" : "password"} value={pw} onChange={e => setPw(e.target.value)} placeholder="Minimal 8 karakter" autoComplete={reg ? "new-password" : "current-password"} />
              <button type="button" onClick={() => setShow(s => !s)} aria-label="Tampilkan password">{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
            {err.pw && <em>{err.pw}</em>}</label>
          {reg && <label className="fld"><span>Konfirmasi password</span>
            <div className="pw"><Lock size={16} /><input className={err.cf ? "bad" : ""} type={show ? "text" : "password"} value={cf} onChange={e => setCf(e.target.value)} placeholder="Ulangi password" autoComplete="new-password" /></div>
            {err.cf && <em>{err.cf}</em>}</label>}
          <button className="btn" disabled={busy}>{busy ? <span className="spin" /> : reg ? <UserPlus size={18} /> : <LogIn size={18} />}{reg ? "Daftar & masuk" : "Masuk"}</button>
          <p className="alt">{reg ? <>Sudah punya akun? <Link href="/login">Masuk</Link></> : <>Belum punya akun? <Link href="/register">Daftar</Link></>}</p>
        </form>
      </section>
    </main>
  );
}
