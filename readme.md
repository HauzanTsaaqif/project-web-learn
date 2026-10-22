# project-web-learn (DataQuest Lab)
Aplikasi Next.js untuk latihan database mahasiswa: 5 kasus bertingkat yang membaca **MySQL lokal** (XAMPP / Laragon). Jika skema dan data benar, tampilan berjalan dan poin masuk ke leaderboard (`be-web-learn`).

## Menjalankan
```bash
git clone https://github.com/HauzanTsaaqif/project-web-learn.git
cd project-web-learn
cp .env.example .env.local   # isi DB_* sesuai MySQL lokalmu + SERVICE_KEY dari pemateri
npm install
npm run build
npm start                    # http://localhost:3001
```
Buka `/register`, pilih nama/NIM, buat password, lalu kerjakan kasus 1-5.

## Keamanan poin
- Poin hanya diklaim **server-ke-server** (`SERVICE_KEY`) setelah pengecekan skema+data lolos; browser tidak bisa menambah poin.
- Backend menyimpan `UNIQUE(player_id, case_id)`: satu kasus hanya memberi poin sekali (aman terhadap klik ganda/paralel).
- Token sesi disimpan di cookie `httpOnly`; aksi ubah-state memeriksa Origin; pengecekan dibatasi 1 kali / 1,2 detik.
