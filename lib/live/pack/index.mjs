// Mengumpulkan paket tugas live (t01..t10). Setiap tNN.mjs mengekspor build({ nim, rand, randInt, pick, seed })
// -> { db, statements: string[], expect: object, files?: [{ path, content }] }. File yang belum ada dilewati (null).
import { rngFor } from "./rng.mjs";
export { orderFor, seedOf } from "./rng.mjs";

export const NN = Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(2, "0"));

export async function buildOne(nim, nn) {
  let mod;
  try { mod = await import(`./t${nn}.mjs`); }
  catch (e) { if (e.code === "ERR_MODULE_NOT_FOUND") return null; throw e; }
  return mod.build({ nim, ...rngFor(nim, Number(nn)) });
}

export async function buildAll(nim) {
  const out = {};
  for (const nn of NN) out[nn] = await buildOne(nim, nn);
  return out;
}
