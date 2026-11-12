"use client";
import { useEffect, useState } from "react";
import { Archive, ArrowLeftRight, BarChart3, Check, Coffee, Cog, Crown, Database, Eye, EyeOff, Gauge, KeyRound, Lock, Mail, Package, Plug, Receipt, ShieldCheck, ShoppingBag, Trash2, TrendingUp, UserCheck, UserCog, UserX, X, Zap } from "lucide-react";

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

/* ---------- Minggu 3 ---------- */
const TXT = v => (v == null ? "-" : String(v));

/* 11. Akun pengguna dengan hash bcrypt */
export function HashView({ rows }) {
  const r0 = rows[0], cost = Math.min(...rows.map(r => r.cost));
  return (
    <div className="dash">
      <div className="kpis"><Kpi icon={KeyRound} label="Akun terlindungi" value={rows.length} /><Kpi icon={ShieldCheck} label="Cost bcrypt terendah" value={cost} tone="p" /><Kpi icon={Lock} label="Panjang hash" value={r0.len} tone="b" /></div>
      <section className="panel"><h4>Anatomi satu hash bcrypt</h4>
        <div className="anat" aria-label="Bagian-bagian hash bcrypt"><span className="a1"><b>{r0.pre.slice(0, 4)}</b><small>algoritma</small></span><span className="a2"><b>{r0.pre.slice(4, 6)}</b><small>cost (2^{r0.cost} putaran)</small></span><span className="a3"><b>{r0.salt}</b><small>salt acak 22 karakter</small></span><span className="a4"><b>••••••••••••••••••••••••••••••••</b><small>hash 31 karakter</small></span></div>
        <small>Salt yang berbeda membuat password yang sama menghasilkan hash yang berbeda, sehingga penyerang tidak bisa memakai tabel hash yang sudah dihitung sebelumnya.</small></section>
      <section className="panel"><h4>Tabel pengguna</h4>
        <div className="staff">{rows.map((u, i) => (
          <article key={u.id} className="staff-c" style={{ "--i": i }}><span className="av">{u.nama.slice(0, 1)}</span>
            <div><b>{u.nama}</b><small>@{u.username} • sejak {TXT(u.dibuat_pada)}</small><code className="hmask">{u.pre}{u.salt.slice(0, 6)}…••••••</code></div>
            <span className="role">bcrypt • cost {u.cost}</span><span className="dot on" title="Hash valid" /></article>))}</div>
        <small>Password asli tidak pernah ditampilkan. Aplikasi hanya membandingkan hash saat login.</small></section>
    </div>
  );
}

/* 12. Audit & soft delete */
export function AuditView({ rows, aktif, dihapus, uji }) {
  const [semua, setSemua] = useState(true), shown = semua ? rows : rows.filter(r => !r.dihapus_pada);
  return (
    <div className="dash">
      <div className="kpis"><Kpi icon={Package} label="Semua baris" value={rows.length} /><Kpi icon={Eye} label="Terlihat di VIEW" value={aktif} tone="b" /><Kpi icon={Archive} label="Soft delete" value={dihapus} tone="p" /></div>
      <section className="panel"><div className="ph"><h4>Jejak audit produk</h4>
        <button className="chipbtn" onClick={() => setSemua(s => !s)} aria-pressed={semua}>{semua ? <EyeOff size={14} /> : <Eye size={14} />}{semua ? "Sembunyikan yang dihapus" : "Tampilkan semua"}</button></div>
        <div className="tw"><table><thead><tr><th>Produk</th><th>Stok</th><th>Dibuat</th><th>Diubah</th><th>Status</th></tr></thead>
          <tbody>{shown.map((r, i) => <tr key={r.id} className={r.dihapus_pada ? "gone" : ""} style={{ "--i": i }}><td>{r.nama}</td><td>{r.stok}</td><td>{TXT(r.dibuat_pada)}</td><td>{TXT(r.diubah_pada)}</td>
            <td>{r.dihapus_pada ? <span className="tag del">dihapus {r.dihapus_pada}</span> : <span className="tag act">aktif</span>}</td></tr>)}</tbody></table></div>
        <small>Baris yang dihapus tetap ada untuk audit, tetapi aplikasi hanya membaca VIEW v_produk_aktif.</small></section>
      {uji?.otomatis && <section className="panel"><h4>Uji ON UPDATE</h4><p className="trig"><Zap size={16} />Satu UPDATE stok dijalankan lalu dibatalkan: <b>diubah_pada</b> terisi otomatis oleh database, tanpa kode aplikasi.</p></section>}
    </div>
  );
}

/* 13. Matriks peran x izin + simulasi akses */
export function RbacView({ grid, izin, users }) {
  const [uid, setUid] = useState(users[0]?.id), [res, setRes] = useState(null);
  const u = users.find(x => x.id === uid), g = u && grid.find(x => x.peran === u.peran);
  const coba = kode => { const i = izin.findIndex(x => x.kode.toLowerCase() === kode); setRes({ kode, ok: !!(g && i >= 0 && g.izin[i]), who: u }); };
  return (
    <div className="dash">
      <section className="panel"><h4>Matriks peran dan izin</h4>
        <div className="tw"><table className="rbac"><thead><tr><th>Peran</th>{izin.map(i => <th key={i.id}>{i.kode}</th>)}</tr></thead>
          <tbody>{grid.map(r => <tr key={r.peran}><td><b>{r.peran}</b></td>{r.izin.map((v, k) => <td key={k} className={v ? "yes" : "no"}>{v ? <Check size={16} /> : <X size={16} />}</td>)}</tr>)}</tbody></table></div></section>
      <section className="panel"><h4>Coba sebagai pengguna</h4>
        <div className="tabs2">{users.map(x => <button key={x.id} className={x.id === uid ? "on" : ""} onClick={() => { setUid(x.id); setRes(null); }}>{x.nama.split(" ")[0]}<small>{x.peran}</small></button>)}</div>
        <div className="row-btn"><button className="btn sm" onClick={() => coba("produk.hapus")}><Trash2 size={15} />Hapus produk</button><button className="btn sm alt" onClick={() => coba("struk.buat")}><ShoppingBag size={15} />Buat struk</button></div>
        {res && <div className={`access ${res.ok ? "ok" : "no"}`} key={res.kode + res.who.id}>{res.ok ? <Check size={18} /> : <X size={18} />}<span><b>{res.who.nama}</b> ({res.who.peran}) {res.ok ? "diizinkan" : "ditolak"} untuk <code>{res.kode}</code>.</span></div>}
        <small>Aplikasi cukup bertanya "apakah peran ini punya izin X?". Peran baru berarti baris data baru, bukan kode baru.</small></section>
    </div>
  );
}

/* 14. Hasil uji API */
export function ApiView({ tests, sample, payloads }) {
  return (
    <div className="dash">
      <div className="kpis"><Kpi icon={Plug} label="Uji lolos" value={tests.length} /><Kpi icon={ShieldCheck} label="Payload injection ditolak" value={payloads.length} tone="p" /><Kpi icon={Package} label="Total produk" value={sample.total} tone="b" /></div>
      <section className="panel"><h4>Hasil uji endpoint /api/latihan/produk</h4>
        <div className="audit">{tests.map((t, i) => <div key={t.nama} className="audit-r" style={{ "--i": i }}><ShieldCheck size={20} /><div><b>{t.nama}</b><code>{t.detail}</code></div><span className="okb"><Check size={13} />Lolos</span></div>)}</div></section>
      <section className="panel"><h4>Contoh respons (halaman 1)</h4><pre className="json">{JSON.stringify(sample, null, 2)}</pre></section>
      <section className="panel"><h4>Payload yang dikirim aplikasi sebagai penyerang</h4><div className="pay">{payloads.map(p => <code key={p}>{p.trim()}</code>)}</div><small>Karena query memakai placeholder, semua payload diperlakukan sebagai teks biasa: tidak ada produk yang cocok.</small></section>
    </div>
  );
}

/* 15. Hasil uji stored procedure */
export function ProcView({ uji }) {
  if (!uji) return null;
  return (
    <div className="dash">
      <div className="kpis"><Kpi icon={Cog} label="Total struk uji" value={uji.total ?? 0} fmt={rp} /><Kpi icon={Package} label={`Stok ${uji.stokAwal} → ${uji.stokAkhir}`} value={uji.qty} fmt={x => `-${Math.round(x)}`} tone="b" /><Kpi icon={ArrowLeftRight} label="Catatan mutasi" value={uji.mutasi} tone="p" /></div>
      <section className="panel"><h4>Pemanggilan yang berhasil</h4>
        <pre className="termx"><span className="p">mysql&gt;</span> CALL sp_checkout(kasir, metode, <b>{uji.produk}</b>, {uji.qty}, @sid);{"\n"}Query OK{"\n"}<span className="p">mysql&gt;</span> SELECT @sid;  <span className="o">→ {uji.sid}</span></pre>
        <small>{uji.qty} x {uji.produk} @ {rp(uji.harga)}: struk, item, pengurangan stok, dan mutasi terbentuk bersama. Semuanya dibatalkan setelah uji (ROLLBACK).</small></section>
      <div className="two">
        <section className="panel"><h4>Stok tidak cukup</h4><pre className="termx err"><span className="p">ERROR 1644 (45000):</span>{"\n"}{uji.tolakStok}</pre></section>
        <section className="panel"><h4>Qty tidak valid</h4><pre className="termx err"><span className="p">ERROR 1644 (45000):</span>{"\n"}{uji.tolakQty}</pre></section>
      </div>
    </div>
  );
}

/* ---------- Minggu 4 ---------- */

/* 16. Hak user aplikasi */
export function GrantView({ user, db, grants, allowed, denied }) {
  return (
    <div className="dash">
      <div className="kpis"><Kpi icon={KeyRound} label="Hak diberikan" value={allowed.length} /><Kpi icon={ShieldCheck} label="Hak yang ditolak" value={denied.length} tone="p" /><Kpi icon={Database} label="Database dijangkau" value={1} tone="b" /></div>
      <section className="panel"><h4>Hasil SHOW GRANTS untuk {user}</h4>
        <pre className="termx"><span className="p">mysql&gt;</span> SHOW GRANTS FOR CURRENT_USER();{"\n"}{grants.map((g, i) => <span key={i}>{g.replace(/ IDENTIFIED BY PASSWORD '[^']*'/i, " IDENTIFIED BY PASSWORD '…'")}{"\n"}</span>)}</pre>
        <small>Hak hanya berlaku pada <code>{db}.*</code>. Itulah satu-satunya pintu yang boleh dipakai aplikasi.</small></section>
      <div className="two">
        <section className="panel"><h4>Boleh dilakukan aplikasi</h4><div className="pay">{allowed.map(p => <code key={p} style={{ background: "var(--g100)", color: "var(--g800)" }}>{p}</code>)}</div><small>Membaca menu, mencatat struk, mengubah stok.</small></section>
        <section className="panel"><h4>Ditolak oleh database</h4><div className="pay">{denied.map(p => <code key={p}>{p}</code>)}</div><small>Penyerang yang menguasai aplikasi tetap tidak bisa menjalankan DROP atau mengubah struktur.</small></section>
      </div>
    </div>
  );
}

/* 17. Hasil pemulihan backup */
export function RestoreView({ tabel, db }) {
  const baris = tabel.reduce((a, t) => a + t.baris, 0);
  return (
    <div className="dash">
      <div className="kpis"><Kpi icon={Database} label={`Tabel pulih di ${db}`} value={tabel.filter(t => t.ok).length} /><Kpi icon={Package} label="Total baris" value={baris} tone="b" /><Kpi icon={ShieldCheck} label="Checksum cocok" value={tabel.filter(t => t.ok).length} tone="p" /></div>
      <section className="panel"><h4>Pencocokan dengan isi backup</h4>
        <div className="audit">{tabel.map((t, i) => <div key={t.tabel} className="audit-r" style={{ "--i": i }}><Database size={20} /><div><b>{t.tabel}</b><code>{t.baris.toLocaleString("id-ID")} baris</code></div><span className="okb"><Check size={13} />Identik</span></div>)}</div>
        <small>Backup baru dianggap berguna setelah terbukti bisa dipulihkan. Jumlah baris dan checksum setiap tabel sama persis dengan sumbernya.</small></section>
    </div>
  );
}

/* 18. EXPLAIN dan index */
export function IndexView({ total, explain, kolom, ms, tanggal, hasil }) {
  return (
    <div className="dash">
      <div className="kpis"><Kpi icon={Package} label="Baris di tabel struk" value={total} /><Kpi icon={Gauge} label="Baris diperiksa (EXPLAIN)" value={explain.rows} tone="p" /><Kpi icon={Zap} label="Waktu query (ms)" value={ms} fmt={x => x.toFixed(1)} tone="b" /></div>
      <section className="panel"><h4>EXPLAIN query laporan</h4>
        <div className="tw"><table><thead><tr><th>type</th><th>key</th><th>rows</th><th>Extra</th></tr></thead><tbody><tr><td><span className="tag act">{explain.type}</span></td><td><code>{explain.key}</code></td><td>{explain.rows.toLocaleString("id-ID")}</td><td>{explain.extra || "-"}</td></tr></tbody></table></div>
        <small>Sebelum index komposit: <b>type = ALL</b> dengan ±{total.toLocaleString("id-ID")} baris. Sekarang hanya {explain.rows.toLocaleString("id-ID")} baris yang disentuh.</small></section>
      <div className="two">
        <section className="panel"><h4>Index yang dipakai</h4><div className="pay">{kolom.map((c, i) => <code key={c} style={{ background: "var(--g100)", color: "var(--g800)" }}>{i + 1}. {c}</code>)}</div><small>Kolom dengan "=" lebih dulu, kolom rentang sesudahnya (awalan paling kiri).</small></section>
        <section className="panel"><h4>Hasil laporan {tanggal}</h4><p className="trig"><Zap size={16} />{hasil.jumlah} struk, omzet <b>{rp(hasil.omzet)}</b>, dibaca dalam {ms} ms.</p></section>
      </div>
    </div>
  );
}

/* 19. Hasil arsip */
export function ArchiveView({ uji, arsip }) {
  if (!uji) return null;
  return (
    <div className="dash">
      <div className="kpis"><Kpi icon={Archive} label="Struk uji dipindahkan" value={uji.dipindah} /><Kpi icon={Package} label="Tetap di struk" value={uji.tersisa} tone="b" /><Kpi icon={ShieldCheck} label="Panggil ulang aman" value={uji.ulang ? 1 : 0} fmt={x => (x >= 1 ? "Ya" : "Tidak")} tone="p" /></div>
      <section className="panel"><h4>Pemanggilan yang diuji</h4>
        <pre className="termx"><span className="p">mysql&gt;</span> START TRANSACTION;{"\n"}<span className="p">mysql&gt;</span> CALL sp_arsip_struk(<b>'{uji.batas}'</b>);{"\n"}Query OK{"\n"}<span className="p">mysql&gt;</span> ROLLBACK;  <span className="o">→ data aslimu tidak berubah</span></pre>
        <small>Sebelum batas dipindahkan seluruhnya, yang tepat pada batas tetap tinggal. Aplikasi memakai data uji tahun 1999 lalu membatalkannya.</small></section>
      <section className="panel"><h4>Isi tabel arsip saat ini</h4><p className="trig"><Archive size={16} />struk_arsip berisi <b>{Number(arsip).toLocaleString("id-ID")}</b> baris milikmu.</p></section>
    </div>
  );
}

/* 20. Tabel ringkasan */
export function SummaryView({ rows, hari, struk, omzet, uji }) {
  const mx = Math.max(...rows.map(r => r.omzet), 1);
  return (
    <div className="dash">
      <div className="kpis"><Kpi icon={TrendingUp} label="Total omzet" value={omzet} fmt={rp} /><Kpi icon={Receipt} label="Struk terhitung" value={struk} tone="b" /><Kpi icon={BarChart3} label="Baris ringkasan (hari)" value={hari} tone="p" /></div>
      <section className="panel"><h4>Omzet {rows.length} hari terakhir (dari ringkasan_harian)</h4>
        {rows.map((r, i) => <div className="bar-row" key={r.tanggal}><span className="rk">{i + 1}</span><div><b>{r.tanggal}</b><div className="bar"><i style={{ width: r.omzet / mx * 100 + "%", "--i": i }} /></div></div><em>{rp(r.omzet)}</em></div>)}
        <small>Satu baris per hari, dibaca langsung tanpa menjumlahkan puluhan ribu struk.</small></section>
      {uji && <section className="panel"><h4>Uji trigger otomatis</h4><p className="trig"><Zap size={16} />Dua struk disisipkan pada {uji.tanggal} lalu dibatalkan: ringkasan menjadi <b>{uji.jumlah} struk / {rp(uji.omzet)}</b> tanpa kode aplikasi, dan tanggal lain tidak ikut berubah.</p></section>}
    </div>
  );
}

export function ResultView({ id, data }) {
  return { 1: <CatalogView produk={data.produk} />, 2: <CategoryView produk={data.produk} />, 3: <CrmView pelanggan={data.pelanggan} />, 4: <InvoiceView pesanan={data.pesanan} />, 5: <ReportView rows={data.rows} total={data.total} />,
    6: <CashierView kasir={data.kasir} />, 7: <ReceiptView struk={data.struk} />, 8: <IntegrityView rules={data.rules} struk={data.struk} item={data.item} />, 9: <LedgerView mutasi={data.mutasi} stok={data.stok} />, 10: <ShiftView rows={data.rows} total={data.total} uji={data.uji} />,
    11: <HashView rows={data.rows} />, 12: <AuditView rows={data.rows} aktif={data.aktif} dihapus={data.dihapus} uji={data.uji} />, 13: <RbacView grid={data.grid} izin={data.izin} users={data.users} />, 14: <ApiView tests={data.tests} sample={data.sample} payloads={data.payloads} />, 15: <ProcView uji={data.uji} />,
    16: <GrantView user={data.user} db={data.db} grants={data.grants} allowed={data.allowed} denied={data.denied} />, 17: <RestoreView tabel={data.tabel} db={data.db} />, 18: <IndexView total={data.total} explain={data.explain} kolom={data.kolom} ms={data.ms} tanggal={data.tanggal} hasil={data.hasil} />, 19: <ArchiveView uji={data.uji} arsip={data.arsip} />, 20: <SummaryView rows={data.rows} hari={data.hari} struk={data.struk} omzet={data.omzet} uji={data.uji} /> }[id];
}
