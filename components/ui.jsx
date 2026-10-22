"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Info, Search, TriangleAlert, X } from "lucide-react";

/* ---------- Maskot Dobi ---------- */
export function Dobi({ className, sleepy }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="dg" gradientUnits="userSpaceOnUse" cx="64" cy="48" r="200"><stop offset="0" stopColor="#6EE7B7" /><stop offset=".5" stopColor="#10B981" /><stop offset="1" stopColor="#047857" /></radialGradient>
        <radialGradient id="dc" gradientUnits="userSpaceOnUse" cx="64" cy="48" r="200"><stop offset="0" stopColor="#FB7185" /><stop offset=".5" stopColor="#E11D48" /><stop offset="1" stopColor="#881337" /></radialGradient>
      </defs>
      <path d="M52 66C30 104 28 150 40 184L160 184C172 150 170 104 148 66Z" fill="url(#dc)" />
      <path d="M40 54C40 38 66 28 100 28s60 10 60 26v92c0 16-26 26-60 26s-60-10-60-26z" fill="url(#dg)" />
      <ellipse cx="100" cy="54" rx="60" ry="24" fill="#A7F3D0" opacity=".9" /><ellipse cx="100" cy="52" rx="44" ry="13" fill="#fff" opacity=".4" />
      <rect x="46" y="84" width="108" height="36" rx="18" fill="#0F172A" />
      <ellipse cx="78" cy="102" rx="12" ry={sleepy ? 2 : 9} fill="#67E8F9" /><ellipse cx="122" cy="102" rx="12" ry={sleepy ? 2 : 9} fill="#67E8F9" />
      <path d="M88 138q12 8 24 0" fill="none" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" />
      <path d="M104 148l-10 14h8l-4 12 14-16h-8z" fill="#FDE047" />
    </svg>
  );
}

/* ---------- Toast ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const push = useCallback((t) => {
    const id = Math.random().toString(36).slice(2);
    setList(l => [...l, { id, tone: "info", ...t }]);
    setTimeout(() => setList(l => l.filter(x => x.id !== id)), t.ms || 5000);
  }, []);
  const icon = { ok: <Check size={18} />, warn: <TriangleAlert size={18} />, info: <Info size={18} />, err: <TriangleAlert size={18} /> };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {list.map(t => (
          <div key={t.id} className={`toast ${t.tone}`}><span className="ti">{icon[t.tone]}</span><div><b>{t.title}</b>{t.text && <p>{t.text}</p>}</div>
            <button onClick={() => setList(l => l.filter(x => x.id !== t.id))} aria-label="Tutup"><X size={16} /></button></div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Combobox dengan pencarian ---------- */
export function Combobox({ options, value, onChange, placeholder, loading, error }) {
  const [open, setOpen] = useState(false), [q, setQ] = useState(""), [hi, setHi] = useState(0);
  const box = useRef(), input = useRef();
  const sel = options.find(o => o.nim === value);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? options.filter(o => (o.nama + " " + o.nim).toLowerCase().includes(s)) : options).slice(0, 80);
  }, [q, options]);
  useEffect(() => { setHi(0); }, [q]);
  useEffect(() => {
    const out = e => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", out); return () => document.removeEventListener("pointerdown", out);
  }, []);
  const pick = o => { onChange(o.nim); setOpen(false); setQ(""); };
  const key = e => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi(h => Math.min(h + 1, list.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && open && list[hi]) { e.preventDefault(); pick(list[hi]); }
    else if (e.key === "Escape") setOpen(false);
  };
  return (
    <div className="cb" ref={box}>
      <button type="button" className={`cb-btn ${error ? "bad" : ""}`} onClick={() => { setOpen(o => !o); setTimeout(() => input.current?.focus(), 0); }} aria-haspopup="listbox" aria-expanded={open}>
        {sel ? <span><b>{sel.nama}</b><small>{sel.nim} • Kelas {sel.kelas}</small></span> : <span className="ph">{loading ? "Memuat data mahasiswa..." : placeholder}</span>}
        <ChevronDown size={18} className={open ? "up" : ""} />
      </button>
      {open && (
        <div className="cb-pop">
          <label className="cb-s"><Search size={16} /><input ref={input} value={q} onChange={e => setQ(e.target.value)} onKeyDown={key} placeholder="Cari nama atau NIM..." autoFocus /></label>
          <ul role="listbox">
            {list.map((o, i) => (
              <li key={o.nim} role="option" aria-selected={o.nim === value} className={`${i === hi ? "hi" : ""} ${o.nim === value ? "on" : ""}`} onMouseEnter={() => setHi(i)} onClick={() => pick(o)}>
                <b>{o.nama}</b><small>{o.nim} • Kelas {o.kelas}</small>
              </li>
            ))}
            {!list.length && <li className="none">{options.length ? "Tidak ditemukan." : "Semua mahasiswa sudah terdaftar atau data kosong."}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
