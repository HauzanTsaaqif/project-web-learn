"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Flag } from "lucide-react";

// Kartu di dashboard: muncul hanya bila ada sesi Live aktif
export default function LiveCard() {
  const [s, setS] = useState(null);
  useEffect(() => {
    let on = true;
    const f = () => fetch("/api/live/state", { cache: "no-store" }).then(r => (r.ok ? r.json() : null)).then(d => { if (on) setS(d); }).catch(() => {});
    f(); const t = setInterval(f, 15000);
    return () => { on = false; clearInterval(t); };
  }, []);
  if (!s?.phase || s.phase === "selesai") return null;
  return (
    <Link href="/live" className="lv-card">
      <span className="lv-card-i"><Flag size={22} /></span>
      <div><b>Live Task: Hari Peluncuran</b><small>{s.phase === "balapan" ? "Balapan sedang berlangsung" : s.phase === "lobi" ? "Sesi dibuka, ayo Gabung" : "Lihat sesi Live"}</small></div>
      <span className="go">Buka <ArrowRight size={16} /></span>
    </Link>
  );
}
