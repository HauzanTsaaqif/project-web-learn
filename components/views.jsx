"use client";
import { useEffect, useState } from "react";
import { Coffee, Crown, Mail, Package, ShoppingBag, TrendingUp, UserX } from "lucide-react";

const rp = n => "Rp " + Number(n || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });
const dt = v => new Date(v).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

function useCount(to, ms = 900) {
  const [v, set] = useState(0);
  useEffect(() => {
    let raf, t0;
    const step = t => { t0 ??= t; const p = Math.min(1, (t - t0) / ms); set(to * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return v;
}
const Kpi = ({ icon: I, label, value, fmt = x => Math.round(x).toLocaleString("id-ID"), tone }) => { const v = useCount(value); return <div className={`kpi ${tone || ""}`}><span><I size={18} /></span><small>{label}</small><b>{fmt(v)}</b></div>; };

/* 1. Katalog produk */
export function CatalogView({ produk }) {
  return (
    <div className="store">
      <div className="store-h"><b>Toko Kopi Nusantara</b><small>{produk.length} produk tersedia</small></div>
      <div className="pgrid">{produk.map((p, i) => (
        <article key={p.id} className="pcard" style={{ "--i": i }}><div className="pimg"><Coffee size={34} /></div><h4>{p.nama}</h4><b>{rp(p.harga)}</b>
          <div className="stock"><i style={{ width: Math.min(100, p.stok) + "%" }} /></div><small>Stok {p.stok}</small><button>Tambah ke keranjang</button></article>))}</div>
    </div>
  );
}

/* 2. Katalog per kategori */
export function CategoryView({ produk }) {
  const cats = [...new Set(produk.map(p => p.kategori))], [c, setC] = useState(cats[0]);
  return (
    <div className="store">
      <div className="tabs2">{cats.map(k => <button key={k} className={k === c ? "on" : ""} onClick={() => setC(k)}>{k}<small>{produk.filter(p => p.kategori === k).length}</small></button>)}</div>
      <div className="pgrid" key={c}>{produk.filter(p => p.kategori === c).map((p, i) => (
        <article key={p.id} className="pcard" style={{ "--i": i }}><div className="pimg alt"><Package size={32} /></div><span className="tag">{p.kategori}</span><h4>{p.nama}</h4><b>{rp(p.harga)}</b><small>Stok {p.stok}</small></article>))}</div>
    </div>
  );
}

/* 3. CRM pelanggan */
export function CrmView({ pelanggan }) {
  const rev = pelanggan.reduce((a, r) => a + Number(r.total), 0), inactive = pelanggan.filter(r => Number(r.jumlah_transaksi) === 0), max = Math.max(...pelanggan.map(r => Number(r.total)), 1);
  return (
    <div className="dash">
      <div className="kpis"><Kpi icon={TrendingUp} label="Total pendapatan" value={rev} fmt={rp} /><Kpi icon={Crown} label="Pelanggan" value={pelanggan.length} tone="b" /><Kpi icon={UserX} label="Belum pernah belanja" value={inactive.length} tone="r" /></div>
      <div className="two"><section className="panel"><h4>Pelanggan teratas</h4>{pelanggan.filter(r => Number(r.total) > 0).slice(0, 6).map((r, i) => (
        <div className="bar-row" key={r.id}><span className="rk">{i + 1}</span><div><b>{r.nama}</b><div className="bar"><i style={{ width: Number(r.total) / max * 100 + "%", "--i": i }} /></div></div><em>{rp(r.total)}</em></div>))}</section>
        <section className="panel"><h4>Perlu follow-up</h4>{inactive.map(r => <div className="fu" key={r.id}><Mail size={16} /><div><b>{r.nama}</b><small>{r.email}</small></div><button>Kirim promo</button></div>)}</section></div>
    </div>
  );
}

/* 4. Faktur pesanan */
export function InvoiceView({ pesanan }) {
  const ids = Object.keys(pesanan), [id, setId] = useState(ids[0]), rows = pesanan[id], total = rows.reduce((a, r) => a + Number(r.subtotal), 0);
  return (
    <div className="dash">
      <div className="tabs2">{ids.map(i => <button key={i} className={i === id ? "on" : ""} onClick={() => setId(i)}>Pesanan #{i}</button>)}</div>
      <div className="invoice" key={id}>
        <header><div><small>FAKTUR</small><h4>INV-{String(id).padStart(5, "0")}</h4></div><div className="stamp">LUNAS</div></header>
        <p><b>{rows[0].pelanggan}</b><br /><small>{dt(rows[0].tanggal)} • status: {rows[0].status}</small></p>
        <table><thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} style={{ "--i": i }}><td>{r.produk}</td><td>{r.qty}</td><td>{rp(r.harga_satuan)}</td><td>{rp(r.subtotal)}</td></tr>)}</tbody></table>
        <footer><span>Total</span><b>{rp(total)}</b></footer>
      </div>
    </div>
  );
}

/* 5. Dashboard eksekutif */
export function ReportView({ rows, total }) {
  const bulan = [...new Set(rows.map(r => String(r.bulan).slice(0, 7)))], cats = [...new Set(rows.map(r => r.kategori))];
  const col = ["#10B981", "#6F8FE6", "#F59E0B", "#8457E6", "#F26BA5"];
  const per = bulan.map(b => rows.filter(r => String(r.bulan).slice(0, 7) === b));
  const mx = Math.max(...per.map(l => l.reduce((a, r) => a + Number(r.total_penjualan), 0)), 1);
  return (
    <div className="dash">
      <div className="kpis"><Kpi icon={TrendingUp} label="Total penjualan" value={total} fmt={rp} /><Kpi icon={ShoppingBag} label="Jumlah pesanan" value={rows.reduce((a, r) => a + Number(r.jumlah_pesanan), 0)} tone="b" /><Kpi icon={Package} label="Kategori aktif" value={cats.length} tone="p" /></div>
      <section className="panel"><h4>Penjualan per bulan</h4>
        <div className="chart">{per.map((l, i) => <div key={i} className="col"><div className="stack" style={{ height: l.reduce((a, r) => a + Number(r.total_penjualan), 0) / mx * 100 + "%" }}>{l.map(r => <i key={r.kategori} title={`${r.kategori}: ${rp(r.total_penjualan)}`} style={{ flex: Number(r.total_penjualan), background: col[cats.indexOf(r.kategori) % 5], "--i": i }} />)}</div><small>{bulan[i]}</small></div>)}</div>
        <div className="legend">{cats.map((k, i) => <span key={k}><i style={{ background: col[i % 5] }} />{k}</span>)}</div></section>
      <section className="panel"><h4>Rincian dari VIEW v_laporan_penjualan</h4><div className="tw"><table><thead><tr><th>Bulan</th><th>Kategori</th><th>Pesanan</th><th>Total</th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}><td>{String(r.bulan).slice(0, 7)}</td><td>{r.kategori}</td><td>{r.jumlah_pesanan}</td><td>{rp(r.total_penjualan)}</td></tr>)}</tbody></table></div></section>
    </div>
  );
}

export function ResultView({ id, data }) {
  return { 1: <CatalogView produk={data.produk} />, 2: <CategoryView produk={data.produk} />, 3: <CrmView pelanggan={data.pelanggan} />, 4: <InvoiceView pesanan={data.pesanan} />, 5: <ReportView rows={data.rows} total={data.total} /> }[id];
}
