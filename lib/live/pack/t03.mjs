// Tugas 3 (kasus 23): pelanggan.email ganda (termasuk beda kapitalisasi); sebagian kembar dipakai struk.
import { head, DDL, baseCs, baseInserts, inserts, fixedRng, ymd, hms, cs, crc32, f2 } from "./_a.mjs";

const NAMA = ["Rina Putri", "Andi Pratama", "Siti Aminah", "Bagas Wicaksono", "Lina Marlina", "Dimas Aryo", "Maya Sari", "Fajar Nugroho", "Intan Permata", "Rudi Hartono",
  "Nadia Safitri", "Yoga Pradana", "Citra Dewi", "Hendra Gunawan", "Putri Ayu", "Eko Prasetyo", "Tari Anggraini", "Gilang Ramadhan", "Wulan Sari", "Ahmad Fauzi",
  "Dewi Kartika", "Bayu Setiawan", "Ratna Juwita", "Irfan Hakim", "Mega Lestari", "Ocha Pertiwi", "Joko Susilo", "Vina Melati", "Taufik Hidayat", "Sekar Arum"];
const emailOf = n => `${n.toLowerCase().replace(/ /g, ".")}@mail.test`;
const titleCase = e => e.replace(/(^|\.|@)([a-z])/g, (_, a, b) => a + b.toUpperCase());

export function build() {
  const g = fixedRng(103), { randInt } = g;
  const pel = NAMA.map((n, i) => [i + 1, n, emailOf(n)]); // 30 pelanggan unik
  // Grup kembar: [id dasar, jumlah salinan, siapa yang dipakai struk, ragam]
  const grup = [[3, 2, "last", "case"], [7, 1, "base", "exact"], [9, 1, "copy", "case"], [12, 1, "none", "exact"], [15, 1, "copy", "exact"], [20, 1, "base", "case"], [26, 1, "none", "case"]];
  const used = new Set(), blocked = new Set();
  let nextId = 31;
  for (const [base, jml, who, ragam] of grup) {
    const ids = [base];
    for (let k = 0; k < jml; k++) {
      const b = pel[base - 1];
      pel.push([nextId, ragam === "case" ? b[1].toUpperCase() : b[1], ragam === "case" ? titleCase(b[2]) : b[2]]);
      ids.push(nextId++);
    }
    const pick = who === "last" ? ids[ids.length - 1] : who === "base" ? ids[0] : who === "copy" ? ids[1] : null;
    ids.forEach(i => { if (i !== pick) blocked.add(i); });
    if (pick) used.add(pick);
  }
  const allowed = pel.map(p => p[0]).filter(i => !blocked.has(i));
  // struk: pastikan tiap pelanggan "dipakai" muncul, sisanya acak (20% tanpa pelanggan)
  const mustUse = [...used], rows = [];
  for (let i = 0, id = 1; i < 14; i++) {
    for (let k = 0; k < 4; k++) {
      const pid = mustUse.length ? mustUse.shift() : g.rand() < 0.2 ? null : allowed[randInt(0, allowed.length - 1)];
      const total = randInt(30, 240) * 500;
      rows.push([id, `KK-${String(id).padStart(4, "0")}`, randInt(1, 4), randInt(1, 3), pid, `${ymd([2026, 3, 16], i)} ${hms(randInt(8, 21), randInt(0, 59), randInt(0, 59))}`, total]);
      id++;
    }
  }
  const usedIds = [...new Set(rows.map(r => r[4]).filter(x => x != null))].sort((a, b) => a - b);
  const C = ["id", "nomor", "kasir_id", "metode_bayar_id", "pelanggan_id", "waktu", "total"];
  const byId = new Map(pel.map(p => [p[0], p]));
  const unik = new Set(pel.map(p => p[2].toLowerCase())).size;
  return {
    db: "live_t03",
    statements: [
      ...head("live_t03"),
      DDL.kasir, DDL.metode_bayar,
      "CREATE TABLE pelanggan (id INT NOT NULL AUTO_INCREMENT, nama VARCHAR(100) NOT NULL, email VARCHAR(120) NOT NULL, PRIMARY KEY (id)) ENGINE=InnoDB",
      DDL.struk({ pelanggan: true }),
      ...baseInserts().filter(s => !s.startsWith("INSERT INTO kategori")),
      ...inserts("pelanggan", ["id", "nama", "email"], pel),
      ...inserts("struk", C, rows),
    ],
    expect: {
      cs: {
        kasir: baseCs().kasir, metode_bayar: baseCs().metode_bayar,
        struk: cs("struk", C, rows.map(r => [...r.slice(0, 6), f2(r[6])])),
        pelanggan_dipakai: cs("pelanggan", ["id", "nama", "email"], usedIds.map(i => byId.get(i)), `id IN (${usedIds.join(",")})`),
      },
      dipakai: usedIds,
      unik,                                                  // jumlah pelanggan seharusnya setelah dibersihkan
      lower_c: String(Array.from(new Set(pel.map(p => p[2].toLowerCase()))).reduce((a, e) => a + crc32(e), 0)), // SUM(CRC32(LOWER(email))) setelah bersih
      awal: pel.length,
    },
  };
}
