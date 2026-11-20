// Live 27 (tugas 07): route pencarian RENTAN SQL injection. Paket menimpa app/api/latihan/live/cari/route.js
// (di repo hanya stub 501). Route mandiri: pool sendiri ke live_t07 memakai DB_* dari .env.local.
const DB = "live_t07";

const PRODUK = [
  [1, "Kopi Susu", 18000, 30], [2, "Kopi O'Brien", 25000, 12], [3, "Americano", 15000, 25], [4, "Latte", 22000, 20],
  [5, "Teh Tarik", 14000, 30], [6, "Choco D'Lite", 21000, 16], [7, "Roti Bakar", 16000, 15], [8, "Croissant", 20000, 12],
  [9, "Kopi Tubruk", 12000, 40], [10, "Es Teh Manis", 8000, 60],
];
const q = s => `'${String(s).replace(/'/g, "''")}'`;

const ROUTE = [
  'import { NextResponse } from "next/server";',
  'import mysql from "mysql2/promise";',
  "",
  "// TUGAS LIVE 27: route pencarian ini RENTAN SQL injection. Perbaiki agar nilai dari pengguna tidak disambung ke teks SQL.",
  "// GET /api/latihan/live/cari?q=kopi  ->  { items: [...], total }",
  "// Setelah mengubah file ini: npm run build && npm start (atau cukup simpan bila memakai npm run dev).",
  'export const dynamic = "force-dynamic";',
  "",
  "let pool;",
  "const getPool = () => (pool ||= mysql.createPool({",
  '  host: process.env.DB_HOST || "127.0.0.1", port: Number(process.env.DB_PORT || 3306),',
  '  user: process.env.DB_USER || "root", password: process.env.DB_PASSWORD || "",',
  `  database: "${DB}", connectionLimit: 3, decimalNumbers: true,`,
  "}));",
  "",
  "export async function GET(req) {",
  '  const q = (new URL(req.url).searchParams.get("q") || "").trim();',
  "  try {",
  "    // BERBAHAYA: nilai q langsung disambung ke dalam SQL",
  `    const sql = "SELECT id, nama, harga, stok FROM produk WHERE nama LIKE '%" + q + "%' ORDER BY id";`,
  "    const [rows] = await getPool().query(sql);",
  "    return NextResponse.json({ items: rows, total: rows.length });",
  "  } catch {",
  '    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });',
  "  }",
  "}",
  "",
].join("\n");

export function build() {
  const statements = [
    `DROP DATABASE IF EXISTS ${DB}`,
    `CREATE DATABASE ${DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    `USE ${DB}`,
    "CREATE TABLE produk (id INT AUTO_INCREMENT PRIMARY KEY, nama VARCHAR(80) NOT NULL, harga DECIMAL(12,2) NOT NULL, stok INT NOT NULL DEFAULT 0) ENGINE=InnoDB",
    `INSERT INTO produk (id, nama, harga, stok) VALUES ${PRODUK.map(([i, n, h, s]) => `(${i}, ${q(n)}, ${h}, ${s})`).join(", ")}`,
  ];
  return {
    db: DB, statements,
    expect: { produk: PRODUK.map(r => [...r]) },
    files: [{ path: "app/api/latihan/live/cari/route.js", content: ROUTE }],
  };
}
