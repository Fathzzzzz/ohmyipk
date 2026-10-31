# OhMyIPK

Web-based GPA planner & predictor untuk mahasiswa S1 (144 SKS). Mengubah pertanyaan
"IPK saya berapa?" menjadi "nilai apa yang masih mungkin dan aman untuk mencapai target?".

## Struktur

```
ohmyipk/
├─ backend/    # Express + Prisma + Postgres; calc engine di backend/src/calc/ + unit test
└─ frontend/   # React (Vite); impor calc engine lewat alias @ohmyipk/calc
```

Calc engine murni (IPS/IPK, required average, loss budget, enumerasi kombinasi, what-if)
tinggal di `backend/src/calc/` — satu sumber kebenaran. Backend memakainya untuk validasi,
frontend mengimpornya lewat alias `@ohmyipk/calc` (bukan duplikat) untuk hitung real-time.
Semua aritmetika integer (bobot ×100).

## Prasyarat

- Node ≥ 20, PostgreSQL berjalan.
- Salin `backend/.env.example` → `backend/.env`, isi `DATABASE_URL`.

## Jalankan

```bash
npm install
cp backend/.env.example backend/.env   # isi DATABASE_URL
npm run db:migrate                     # prisma migrate deploy
npm run db:seed                        # scale nilai + akun demo (demo@ohmyipk.dev / sandbox123)
npm run dev:backend                    # http://localhost:4000
npm run dev:frontend                   # http://localhost:5173
```

## Test & build

```bash
npm test        # unit test calc engine
npm run build   # shared + backend + frontend
```

## Rumus inti

- `points = Σ(weight × credits)`, `weight = GPA × 100` (integer — bebas dari error floating point).
- `required = ceil((target×total − earned) / remaining)`.
- `lossBudget = (earned + 400×remaining) − target×total`.
- Status: **AMAN** (`required ≤ 3.50`), **KETAT** (`3.50 < required ≤ 4.00`), **GAGAL** (`required > 4.00`).
- Kombinasi di-enumerate persis untuk ≤ 6 mata kuliah sisa; greedy untuk lebih banyak.

## Skala nilai

Tabel `GradeScale` adalah sumber bobot. Sesuaikan `weight` tiap huruf lewat seed/DB
(weight = nilai × 100; mis. A = 400, B+ = 350).

## Deploy

Tidak termasuk konfigurasi deploy/docker (ditangani terpisah). Frontend cukup di-build
(`npm run build -w @ohmyipk/frontend`) dan diserve sebagai static; backend dijalankan
dengan `npm run start -w @ohmyipk/backend` setelah `DATABASE_URL`, `JWT_SECRET`,
`COOKIE_SECURE=true`, dan `CORS_ORIGIN` di-set.