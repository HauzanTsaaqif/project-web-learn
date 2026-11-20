// Live 28 (tugas 08): kasir_live memegang ALL PRIVILEGES ON *.*. Password tetap: live123.
// Idempoten: DROP USER IF EXISTS lalu buat ulang untuk localhost dan 127.0.0.1.
const DB = "live_t08", USER = "kasir_live", PASS = "live123", HOSTS = ["localhost", "127.0.0.1"];

export function build() {
  const statements = [
    `DROP DATABASE IF EXISTS ${DB}`,
    `CREATE DATABASE ${DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    `USE ${DB}`,
    "CREATE TABLE produk (id INT AUTO_INCREMENT PRIMARY KEY, nama VARCHAR(80) NOT NULL, harga DECIMAL(12,2) NOT NULL, stok INT NOT NULL DEFAULT 0) ENGINE=InnoDB",
    "INSERT INTO produk (id, nama, harga, stok) VALUES (1, 'Kopi Susu', 18000, 30), (2, 'Americano', 15000, 25), (3, 'Latte', 22000, 20)",
    "CREATE TABLE struk (id INT AUTO_INCREMENT PRIMARY KEY, waktu DATETIME NOT NULL, total DECIMAL(12,2) NOT NULL) ENGINE=InnoDB",
    "INSERT INTO struk (id, waktu, total) VALUES (1, '2026-01-05 09:10:00', 36000), (2, '2026-01-05 10:45:00', 15000)",
    `DROP USER IF EXISTS '${USER}'@'%'`,
    ...HOSTS.map(h => `DROP USER IF EXISTS '${USER}'@'${h}'`),
    ...HOSTS.map(h => `CREATE USER '${USER}'@'${h}' IDENTIFIED BY '${PASS}'`),
    ...HOSTS.map(h => `GRANT ALL PRIVILEGES ON *.* TO '${USER}'@'${h}'`),
  ];
  return { db: DB, statements, expect: { user: USER, password: PASS, hosts: HOSTS, hak: ["INSERT", "SELECT", "UPDATE"] } };
}
