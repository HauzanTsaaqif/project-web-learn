"use client";
import { useEffect, useState } from "react";
import { ArrowLeftRight, Check, Coffee, Crown, Mail, Package, Receipt, ShieldCheck, ShoppingBag, TrendingUp, UserCheck, UserCog, UserX, Zap } from "lucide-react";

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

/* 6. Daftar akun kasir */
const dts = v => dt(String(v).replace(" ", "T"));
export function CashierView({ kasir }) {
  const aktif = kasir.filter(k => Number(k.aktif) === 1).length;
  return (
    <div className="dash">
      <div className="kpis"><Kpi icon={UserCog} label="Akun terdaftar" value={kasir.length} /><Kpi icon={ShieldCheck} label="Admin" value={kasir.filter(k => k.role === "admin").length} tone="p" /><Kpi icon={UserCheck} label="Akun aktif" value={aktif} tone="b" /></div>
      <section className="panel"><h4>Pegawai Kedai Kopi Nusantara</h4>
        <div className="staff">{kasir.map((k, i) => (
          <article key={k.id} className="staff-c" style={{ "--i": i }}><span className={`av ${k.role}`}>{k.nama.slice(0, 1)}</span>
            <div><b>{k.nama}</b><small>@{k.username} • sejak {dts(k.dibuat_pada)}</small></div>
            <span className={`role ${k.role}`}>{k.role}</span><span className={`dot ${Number(k.aktif) === 1 ? "on" : ""}`} title={Number(k.aktif) === 1 ? "Aktif" : "Nonaktif"} /></article>))}</div></section>
    </div>
  );
}

/* 7. Struk kasir */
export function ReceiptView({ struk }) {
  const [id, setId] = useState(struk[0].id), s = struk.find(x => x.id === id), sum = s.items.reduce((a, i) => a + i.qty * i.harga_satuan, 0);
  return (
    <div className="dash">
      <div className="tabs2">{struk.map(x => <button key={x.id} className={x.id === id ? "on" : ""} onClick={() => setId(x.id)}>{x.nomor}<small>{x.metode}</small></button>)}</div>
      <div className="receipt" key={id}>
        <header><Coffee size={22} /><h4>KEDAI KOPI NUSANTARA</h4><small>Struk penjualan</small></header>
        <dl><div><dt>No</dt><dd>{s.nomor}</dd></div><div><dt>Waktu</dt><dd>{s.waktu}</dd></div><div><dt>Kasir</dt><dd>{s.kasir}</dd></div></dl>
        <ul>{s.items.map((i, k) => <li key={k} style={{ "--i": k }}><span>{i.produk}</span><em>{i.qty} x {rp(i.harga_satuan)}</em><b>{rp(i.qty * i.harga_satuan)}</b></li>)}</ul>
        <footer><div><span>TOTAL</span><b>{rp(s.total)}</b></div><div><span>Bayar</span><b>{s.metode}</b></div></footer>
        {Math.abs(sum - s.total) > 0.01 && <p className="warn-r">Total struk ({rp(s.total)}) berbeda dari jumlah item ({rp(sum)}). Dicek di kasus 9.</p>}
      </div>
    </div>
  );
}

/* 8. Audit aturan integritas */
export function IntegrityView({ rules, struk, item }) {
  return (
    <div className="dash">
      <div className="kpis"><Kpi icon={Receipt} label="Struk dilindungi" value={struk} /><Kpi icon={Package} label="Item struk" value={item} tone="b" /><Kpi icon={ShieldCheck} label="Aturan aktif" value={rules.length} tone="p" /></div>
      <section className="panel"><h4>Audit integritas database</h4>
        <div className="audit">{rules.map((r, i) => <div key={r.aturan} className="audit-r" style={{ "--i": i }}><ShieldCheck size={20} /><div><b>{r.aturan}</b><code>{r.detail}</code></div><span className="okb"><Check size={13} />Terbukti</span></div>)}</div>
        <small>Setiap aturan diuji langsung di MySQL-mu lewat transaksi yang di-ROLLBACK, jadi datamu tetap utuh.</small></section>
    </div>
  );
}

/* 9. Buku besar mutasi stok */
export function LedgerView({ mutasi, stok }) {
  const jual = mutasi.filter(m => m.jenis === "jual"), unit = -jual.reduce((a, m) => a + m.perubahan, 0), mx = Math.max(...stok.map(s => Number(s.stok)), 1);
  return (
    <div className="dash">
      <div className="kpis"><Kpi icon={ArrowLeftRight} label="Catatan mutasi" value={mutasi.length} /><Kpi icon={ShoppingBag} label="Unit terjual" value={unit} tone="b" /><Kpi icon={Package} label="Produk" value={stok.length} tone="p" /></div>
      <div className="two">
        <section className="panel"><h4>Buku besar stok_mutasi</h4><div className="tw"><table><thead><tr><th>Waktu</th><th>Produk</th><th>Jenis</th><th>Ubah</th><th>Struk</th></tr></thead>
          <tbody>{mutasi.map((m, i) => <tr key={m.id} style={{ "--i": i }}><td>{m.waktu || "-"}</td><td>{m.produk}</td><td><span className="tag">{m.jenis}</span></td><td><b className={m.perubahan < 0 ? "neg" : "pos"}>{m.perubahan > 0 ? "+" : ""}{m.perubahan}</b></td><td>{m.ref || "-"}</td></tr>)}</tbody></table></div></section>
        <section className="panel"><h4>Stok saat ini</h4>{stok.map((s, i) => <div className="stk" key={s.nama}><span>{s.nama}</span><div className="bar"><i style={{ width: Number(s.stok) / mx * 100 + "%", "--i": i }} /></div><em>{s.stok}</em></div>)}</section>
      </div>
    </div>
  );
}

/* 10. Rekap shift */
export function ShiftView({ rows, total, uji }) {
  const per = Object.values(rows.reduce((m, r) => { const o = (m[r.kasir] ||= { kasir: r.kasir, omzet: 0, struk: 0 }); o.omzet += r.omzet; o.struk += r.jumlah_struk; return m; }, {})).sort((a, b) => b.omzet - a.omzet), mx = Math.max(...per.map(p => p.omzet), 1);
  return (
    <div className="dash">
      <div className="kpis"><Kpi icon={TrendingUp} label="Total omzet" value={total} fmt={rp} /><Kpi icon={Receipt} label="Jumlah struk" value={rows.reduce((a, r) => a + r.jumlah_struk, 0)} tone="b" /><Kpi icon={UserCog} label="Kasir bertugas" value={per.length} tone="p" /></div>
      <div className="two">
        <section className="panel"><h4>Omzet per kasir</h4>{per.map((p, i) => <div className="bar-row" key={p.kasir}><span className="rk">{i + 1}</span><div><b>{p.kasir}</b><div className="bar"><i style={{ width: p.omzet / mx * 100 + "%", "--i": i }} /></div></div><em>{rp(p.omzet)}</em></div>)}</section>
        <section className="panel"><h4>Rekap harian (VIEW)</h4><div className="tw"><table><thead><tr><th>Tanggal</th><th>Kasir</th><th>Struk</th><th>Omzet</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td>{r.tanggal}</td><td>{r.kasir}</td><td>{r.jumlah_struk}</td><td>{rp(r.omzet)}</td></tr>)}</tbody></table></div></section>
      </div>
      {uji && <section className="panel"><h4>Uji trigger otomatis</h4><p className="trig"><Zap size={16} />Satu item uji ({uji.qty} x {uji.produk}) dimasukkan lalu dibatalkan: stok <b>{uji.sebelum} → {uji.sesudah}</b> dan {uji.mutasi} catatan stok_mutasi muncul otomatis.</p></section>}
    </div>
  );
}

export function ResultView({ id, data }) {
  return { 1: <CatalogView produk={data.produk} />, 2: <CategoryView produk={data.produk} />, 3: <CrmView pelanggan={data.pelanggan} />, 4: <InvoiceView pesanan={data.pesanan} />, 5: <ReportView rows={data.rows} total={data.total} />,
    6: <CashierView kasir={data.kasir} />, 7: <ReceiptView struk={data.struk} />, 8: <IntegrityView rules={data.rules} struk={data.struk} item={data.item} />, 9: <LedgerView mutasi={data.mutasi} stok={data.stok} />, 10: <ShiftView rows={data.rows} total={data.total} uji={data.uji} /> }[id];
}
