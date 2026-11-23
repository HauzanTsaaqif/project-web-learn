import "server-only";

// Helper bersama checker soal 6-10 (milik sesi paket B).

// Buang komentar dan isi string agar pencarian kata kunci tidak tertipu: -- ..., # ..., /* ... */, '...', "..."
export function stripSql(s) {
  return String(s || "")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^'\\]|\\[\s\S]|'')*'/g, "''")
    .replace(/"(?:[^"\\]|\\[\s\S]|"")*"/g, '""')
    .replace(/--[^\n]*/g, " ")
    .replace(/#[^\n]*/g, " ");
}

// Panggil route JSON di origin sendiri. Mengembalikan { status, json, text } atau { error }.
export async function callJson(origin, path, ms = 5000) {
  try {
    const r = await fetch(`${origin}${path}`, { cache: "no-store", signal: AbortSignal.timeout(ms) });
    const text = await r.text(); let json = null;
    try { json = JSON.parse(text); } catch { /* bukan JSON */ }
    return { status: r.status, json, text };
  } catch (e) { return { error: e.name === "TimeoutError" ? `Tidak menjawab dalam ${Math.round(ms / 1000)} detik` : (e.cause?.code || e.message) }; }
}

// Normalisasi hasil SHOW GRANTS (MySQL dan MariaDB berbeda format) menjadi struktur sederhana.
//  global: Set hak pada *.* tanpa USAGE; perDb: Map("db.*" -> Set hak); option: ada WITH GRANT OPTION; other: baris di luar pola
const unq = s => String(s).replace(/`/g, "").replace(/\\_/g, "_").replace(/\\%/g, "%");
export function parseGrants(lines) {
  const global = new Set(), perDb = new Map(), other = []; let option = false;
  for (const line of lines) {
    const m = /^GRANT\s+(.+?)\s+ON\s+(\S+)\s+TO\s/is.exec(line);
    if (!m) { other.push(String(line).slice(0, 80)); continue; }
    if (/\bWITH\s+GRANT\s+OPTION\b/i.test(line)) option = true;
    const scope = unq(m[2]);
    if (m[1].includes("(")) { other.push(`${m[1].replace(/\s+/g, " ")} ON ${scope}`); continue; } // hak per kolom
    const privs = m[1].split(",").map(x => x.trim().toUpperCase().replace(/^ALL$/, "ALL PRIVILEGES")).filter(x => x && x !== "USAGE");
    if (scope === "*.*") privs.forEach(p => global.add(p));
    else if (/^[^.]+\.\*$/.test(scope)) { const s = perDb.get(scope) || new Set(); privs.forEach(p => s.add(p)); perDb.set(scope, s); }
    else if (privs.length) other.push(`${privs.join(", ")} ON ${scope}`);
  }
  return { global, perDb, option, other };
}
