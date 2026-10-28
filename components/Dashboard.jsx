"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, ArrowRight, BarChart3, Check, Layers, Lock, LogOut, Package, Receipt, ReceiptText, Trophy, UserCog, Users, Zap } from "lucide-react";
import { CASES, WEEKS } from "@/lib/cases";
import { Dobi, useToast } from "./ui";

export const ICONS = { package: Package, layers: Layers, users: Users, receipt: Receipt, chart: BarChart3, usercog: UserCog, receipttext: ReceiptText, lock: Lock, arrows: ArrowLeftRight, zap: Zap };

export function Shell({ player, poin, children }) {
  const router = useRouter(), toast = useToast();
  const out = async () => { await fetch("/api/auth/logout", { method: "POST" }); toast({ tone: "info", title: "Kamu sudah keluar" }); router.replace("/login"); router.refresh(); };
  return (
    <div className="shell">
      <header className="top">
        <Link href="/dashboard" className="brand"><Dobi className="brand-m" />DataQuest <b>Lab</b></Link>
        <div className="me">{player && <><span className="chip"><Trophy size={15} />{poin ?? 0} poin</span><span className="who2"><b>{player.nama.split(" ").slice(0, 2).join(" ")}</b><small>{player.nim}</small></span></>}
          <button className="icon-btn" onClick={out} aria-label="Keluar" title="Keluar"><LogOut size={18} /></button></div>
      </header>
      {children}
    </div>
  );
}

export function useProgress() {
  const router = useRouter(), [st, setSt] = useState({ loading: true });
  const load = () => fetch("/api/progress").then(async r => {
    if (r.status === 401) { router.replace("/login"); return; }
    setSt({ loading: false, ...(await r.json()) });
  }).catch(() => setSt({ loading: false, error: "Gagal memuat" }));
  useEffect(() => { load(); }, []); // eslint-disable-line
  return [st, load, setSt];
}

export default function Dashboard() {
  const [st] = useProgress(), [sel, setSel] = useState(null);
  const done = st.completed || [], open = st.open || {}, isOpen = c => open[c.id] !== false;
  // minggu awal: yang masih punya kasus terbuka & belum selesai (jika tidak ada, minggu 1)
  const week = sel ?? (WEEKS.find(w => CASES.some(c => c.week === w.week && isOpen(c) && !done.includes(c.id)))?.week || 1);
  const list = CASES.filter(c => c.week === week), total = list.reduce((a, c) => a + c.points, 0), got = list.filter(c => done.includes(c.id)).reduce((a, c) => a + c.points, 0);
  const cnt = w => CASES.filter(c => c.week === w && done.includes(c.id)).length, all = w => CASES.filter(c => c.week === w).length;
  const wk = WEEKS.find(w => w.week === week);
  return (
    <Shell player={st.player} poin={st.poin}>
      <main className="page">
        <section className="hero2">
          <div><span className="kick">Dashboard</span><h1>Halo, {st.player ? st.player.nama.split(" ")[0] : "..."}!</h1>
            <p>Kerjakan kasus secara berurutan. Setiap kasus memeriksa database MySQL lokalmu dan memberi poin sekali saja.</p>
            <div className="prog2"><i style={{ width: `${got / total * 100}%` }} /></div><small>{wk.label}: {got} dari {total} poin terkumpul • {cnt(week)}/{list.length} kasus selesai</small></div>
          <Dobi className="hero-m" />
        </section>
        <nav className="weeks" aria-label="Pilih minggu">
          {WEEKS.map(w => <button key={w.week} className={w.week === week ? "on" : ""} onClick={() => setSel(w.week)}><b>{w.label}</b><small>{st.perWeek?.[w.week] ?? cnt(w.week)}/{all(w.week)} selesai</small></button>)}
        </nav>
        <p className="wk-t"><b>{wk.label}</b> • {wk.title}</p>
        <section className="cases" key={week}>
          {list.map((c, i) => {
            const I = ICONS[c.icon], ok = done.includes(c.id), lock = !isOpen(c);
            return (
              <Link key={c.id} href={`/case/${c.id}`} className={`case-card ${ok ? "done" : ""} ${lock ? "locked" : ""}`} style={{ "--i": i }}>
                <span className="no">{c.id}</span>
                <span className="ci"><I size={24} /></span>
                <div><small className="lv">Level {c.id} • {c.level}</small><h3>{c.title}</h3><p>{c.story}</p></div>
                <footer><span className="pts">+{c.points} poin</span>{ok ? <span className="okb"><Check size={14} />Selesai</span> : lock ? <span className="lockb"><Lock size={14} />Belum dibuka</span> : <span className="go">Kerjakan <ArrowRight size={16} /></span>}</footer>
              </Link>
            );
          })}
        </section>
      </main>
    </Shell>
  );
}
