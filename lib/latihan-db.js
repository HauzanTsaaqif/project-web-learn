import "server-only";
import mysql from "mysql2/promise";

// Koneksi MySQL untuk route latihan buatanmu (kasus 14). Memakai .env.local yang sama dengan aplikasi.
// Contoh:  const [rows] = await getPool().query("SELECT id, nama FROM produk WHERE nama LIKE ? LIMIT ?", [`%${q}%`, limit]);
// Selalu kirim nilai dari pengguna lewat tanda tanya (?), JANGAN disambung ke dalam teks SQL.
let pool;
export const getPool = () => (pool ||= mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1", port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root", password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME, connectionLimit: 4, decimalNumbers: true,
}));
