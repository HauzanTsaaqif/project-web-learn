import { issue } from "../common";
import { getPool } from "../db";
import { parseGrants } from "./_b";

// Live 28 / tugas 08: kasir_live hanya boleh SELECT, INSERT, UPDATE pada live_t08.* (tanpa hak global, GRANT OPTION, atau DB lain).
export default async function check({ db, expect }) {
  const pool = getPool();
  const user = expect.user, want = expect.hak.join(", ");
  // semua host akun ini (localhost, 127.0.0.1, dan kalau ada '%'), cadangan: dua host bawaan
  let hosts = [];
  try { hosts = (await pool.query("SELECT Host h FROM mysql.user WHERE User=?", [user]))[0].map(r => r.h); } catch { hosts = expect.hosts; }
  const perHost = [];
  for (const h of [...new Set(hosts)]) {
    try { perHost.push({ h, lines: (await pool.query("SHOW GRANTS FOR ?@?", [user, h]))[0].map(r => String(Object.values(r)[0])) }); }
    catch (e) { if (e.errno !== 1141 && e.errno !== 1133) throw e; } // akun/hak tidak ada untuk host ini
  }
  if (!perHost.length) return { ok: false, issues: [issue("USER_MISSING", `Akun ${user} tidak ditemukan`, `Tidak ada akun '${user}'@'localhost' atau '${user}'@'127.0.0.1'. Akunnya terhapus (DROP USER)?`, `Jangan menghapus akunnya; cabut hak yang berlebih saja. Untuk memulihkan: npm run live:siapkan (menyiapkan ulang seluruh tugas).`)] };

  const bad = [], shown = [];
  for (const { h, lines } of perHost) {
    const g = parseGrants(lines), who = `'${user}'@'${h}'`;
    const dbPriv = [...(g.perDb.get(`${db}.*`) || [])].sort(), glob = [...g.global].sort();
    const others = [...g.perDb.keys()].filter(k => k !== `${db}.*`);
    shown.push({ host: h, grants: lines });
    if (glob.length) bad.push(issue("GRANT_GLOBAL", `${who} masih punya hak global: ${glob.join(", ")}`, "Hak pada *.* berlaku untuk SEMUA database di server. Akun kasir tidak boleh punya hak global (selain USAGE).", `Cabut dengan REVOKE ... ON *.* FROM ${who}; periksa hasilnya dengan SHOW GRANTS FOR ${who};`));
    if (g.option) bad.push(issue("GRANT_OPTION", `${who} memiliki WITH GRANT OPTION`, "Akun kasir tidak boleh menurunkan haknya kepada akun lain.", "REVOKE ALL PRIVILEGES tidak mencabut GRANT OPTION; cabut juga GRANT OPTION-nya."));
    if (others.length || g.other.length) bad.push(issue("GRANT_SCOPE", `${who} punya hak di luar ${db}`, [...others.map(k => `${[...g.perDb.get(k)].join(", ")} ON ${k}`), ...g.other].slice(0, 4).join("; ") + ". Hak hanya boleh pada database tugas ini.", undefined));
    if (dbPriv.join() !== [...expect.hak].sort().join()) {
      const extra = dbPriv.filter(p => !expect.hak.includes(p)), miss = expect.hak.filter(p => !dbPriv.includes(p));
      bad.push(issue(miss.length && !extra.length ? "GRANT_MISSING" : "GRANT_EXCESS", `Hak pada ${db}.* untuk ${who} belum tepat`, `Ditemukan: ${dbPriv.join(", ") || "(tidak ada)"}. Seharusnya tepat: ${want}.${extra.length ? ` Berlebih: ${extra.join(", ")}.` : ""}${miss.length ? ` Kurang: ${miss.join(", ")}.` : ""}`, `Aplikasi kasir hanya perlu membaca, menambah, dan mengubah data pada ${db}; tidak perlu DELETE, DROP, ALTER, dan sebagainya.`));
    }
  }
  return { ok: !bad.length, issues: bad, data: { akun: shown } };
}
