// Pembangkit acak deterministik untuk variasi per NIM. ESM murni (dipakai Next dan CLI).
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const seedOf = nim => fnv1a(`${nim}:live`);
// acak per tugas: rand() -> [0,1); randInt(a,b) -> bilangan bulat a..b (inklusif); pick(arr)
export function rngFor(nim, n) {
  const rand = mulberry32(fnv1a(`${nim}:live:${n}`));
  const randInt = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  return { rand, randInt, pick, seed: seedOf(nim) };
}
// urutan tampil 10 tugas (angka 1..10) yang dikocok per NIM
export function orderFor(nim) {
  const rand = mulberry32(seedOf(nim)), a = Array.from({ length: 10 }, (_, i) => i + 1);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
