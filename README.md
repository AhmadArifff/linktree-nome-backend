# ShopLink Backend — Express.js + Supabase

Backend API untuk aplikasi ShopLink. Dibangun dengan Express.js + TypeScript, terhubung ke Supabase PostgreSQL, dan siap di-deploy ke Vercel sebagai Serverless Functions.

---

## Struktur File

```
backend/
├── server/
│   ├── index.ts               ← Entry point Express (mount semua routes)
│   ├── routes/
│   │   ├── auth.ts            ← Login, logout, verify token
│   │   ├── categories.ts      ← CRUD kategori (publik + admin)
│   │   ├── products.ts        ← CRUD produk + upload gambar
│   │   └── store.ts           ← Profil toko + upload logo
│   ├── middleware/
│   │   └── auth.ts            ← JWT middleware + generateToken helper
│   └── lib/
│       ├── supabase.ts        ← Supabase client + upload/delete file helper
│       └── upload.ts          ← Multer config untuk upload gambar
├── package.json
├── tsconfig.json
├── vercel.json                ← Config deploy ke Vercel
└── .env.example               ← Template environment variables
```

---

## Setup Lokal

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Buat file .env

```bash
cp .env.example .env
```

Isi `.env` dengan nilai dari Supabase Dashboard → Settings → API:

```env
SUPABASE_URL=https://XXXXXXXXXXXX.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
JWT_SECRET=random-string-minimal-32-karakter
PORT=3001
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

> **Generate JWT_SECRET:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### 3. Jalankan development server

```bash
npm run dev
```

Server berjalan di `http://localhost:3001`

Cek health endpoint:
```bash
curl http://localhost:3001/api/health
```

### 4. Jalankan TestSprite untuk pengujian lokal

1. Simpan API key TestSprite lokal di file `.env` atau environment variable:

```env
TESTSPRITE_API_KEY=sk-user-your-local-test-key
```

2. Jika ingin menguji login admin, panggil endpoint login berikut dari TestSprite:

```http
POST http://localhost:3001/api/auth/login
Content-Type: application/json

{
  "email": "admin.nome.com",
  "password": "nome123"
}
```

Respons yang diharapkan berisi JWT token di `data.token`.

3. Gunakan token tersebut untuk request selanjutnya:

```http
Authorization: Bearer {{token}}
```

4. Jalankan TestSprite dari folder `backend`:

```bash
npm run test:sprite
```

5. Atau gunakan konfigurasi VS Code di `backend/.vscode/mcp.json`.

> Gunakan API key ini hanya untuk project lokal ini. Jika membuka project baru, buat API key baru agar hasil reporting tetap bersih dan terpisah.

---

## API Endpoints

### Public (tanpa auth)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/health` | Health check server |
| GET | `/api/store` | Profil toko |
| GET | `/api/categories` | List kategori aktif |
| GET | `/api/categories/:slug` | Detail kategori + produknya |
| GET | `/api/products` | List produk aktif (`?category=slug`) |
| GET | `/api/products/:id` | Detail satu produk |

### Auth

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/auth/login` | Login admin → return JWT |
| POST | `/api/auth/logout` | Logout (stateless) |
| GET | `/api/auth/me` | Info admin yang login |

### Admin (wajib header `Authorization: Bearer <token>`)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| PUT | `/api/admin/store` | Update profil toko + logo |
| POST | `/api/admin/categories` | Buat kategori baru |
| PUT | `/api/admin/categories/reorder` | Urut ulang kategori |
| PUT | `/api/admin/categories/:id` | Edit kategori |
| DELETE | `/api/admin/categories/:id` | Hapus kategori |
| GET | `/api/admin/products/all` | List semua produk (termasuk nonaktif) |
| POST | `/api/admin/products` | Buat produk baru |
| PUT | `/api/admin/products/reorder` | Urut ulang produk |
| PUT | `/api/admin/products/:id` | Edit produk |
| DELETE | `/api/admin/products/:id` | Hapus produk |

---

## Contoh Request

### Login Admin

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@shoplink.com","password":"admin123"}'
```

### Buat Kategori Baru

```bash
curl -X POST http://localhost:3001/api/admin/categories \
  -H "Authorization: Bearer TOKEN_ANDA" \
  -H "Content-Type: application/json" \
  -d '{"name":"Pakaian","icon":"👕"}'
```

### Upload Produk dengan Gambar

```bash
curl -X POST http://localhost:3001/api/admin/products \
  -H "Authorization: Bearer TOKEN_ANDA" \
  -F "category_id=UUID_KATEGORI" \
  -F "name=Kaos Polos Premium" \
  -F "short_description=Bahan cotton combed 30s" \
  -F "price=Rp 89.000" \
  -F "marketplace_url=https://shopee.co.id/produk" \
  -F "image=@/path/to/gambar.jpg"
```

---

## Deploy ke Vercel

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Login ke Vercel

```bash
vercel login
```

### 3. Deploy

```bash
vercel --prod
```

### 4. Set Environment Variables di Vercel

```bash
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_KEY
vercel env add JWT_SECRET
vercel env add FRONTEND_URL  # URL frontend Vercel: https://shoplink.vercel.app
vercel env add NODE_ENV      # production
```

Atau via Vercel Dashboard → Project → Settings → Environment Variables.

---

## Catatan Penting

- `SUPABASE_SERVICE_KEY` hanya digunakan di backend — **jangan pernah expose ke frontend**
- JWT token berlaku 7 hari — simpan di `localStorage` atau `httpOnly cookie` di frontend
- Upload gambar menggunakan `multipart/form-data` dengan field name `image` (produk) atau `logo` (toko)
- File gambar disimpan di Supabase Storage bucket `product-images` dan `store-assets`
- Semua operasi admin otomatis bypass RLS karena menggunakan `SUPABASE_SERVICE_KEY`
