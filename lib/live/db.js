import "server-only";
import mysql from "mysql2/promise";

// Pool TANPA database default: setiap tugas memakai database sendiri (live_t01..live_t10).
let pool;
export const getPool = () => (pool ||= mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1", port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root", password: process.env.DB_PASSWORD || "",
  connectionLimit: 6, connectTimeout: 4000, decimalNumbers: true,
}));

export const dbName = n => `live_t${String(n).padStart(2, "0")}`;
// kutip identifier secara aman (nama hanya dari kode kita, tetap di-escape)
export const qi = name => "`" + String(name).replace(/`/g, "``") + "`";
