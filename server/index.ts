// ============================================================
// server/index.ts
//
// BUG FIX:
//   - Tambah 'PATCH' ke allowed CORS methods
//     (tanpa ini semua PATCH request dari browser → Network Error)
// ============================================================

import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import authRoutes from './routes/auth'
import categoryRoutes from './routes/categories'
import productRoutes from './routes/products'
import storeRoutes from './routes/store'
import analyticsRoutes from './routes/analytics'   // ← NEW

dotenv.config()

const app = express()
const PORT = process.env.PORT ?? 3001

// ── CORS ─────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL ?? 'http://localhost:3000',
  'http://localhost:3000',
  'http://localhost:3001',
]

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        callback(null, true)
      } else {
        callback(new Error(`CORS: Origin ${origin} tidak diizinkan`))
      }
    },
    credentials: true,
    // ⚠️  FIX: tambah 'PATCH' — tanpa ini toggle is_active → Network Error
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

if (process.env.NODE_ENV !== 'production') {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
    next()
  })
}

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'ShopLink API is running',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  })
})
// ── Analytics — PUBLIC event recorder ─────────────────────────
// POST /api/analytics/event  → dipanggil dari halaman publik
app.use('/api/analytics', analyticsRoutes)
// Analytics admin queries (summary, daily, products, categories)
app.use('/api/admin/analytics',  analyticsRoutes)   // ← NEW

// ── Public routes ─────────────────────────────────────────────
app.use('/api/store', storeRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/products', productRoutes)

// ── Auth routes ───────────────────────────────────────────────
app.use('/api/auth', authRoutes)

// ── Admin routes ──────────────────────────────────────────────
// Semua route /api/admin/* diarahkan ke masing-masing router
// Router sudah handle requireAuth middleware di dalam masing-masing route
app.use('/api/admin/store', storeRoutes)
app.use('/api/admin/categories', categoryRoutes)
// ⚠️  PENTING: /api/admin/products mount ke productRoutes
//     Route di products.ts: GET /all, PATCH /:id, PUT /:id, DELETE /:id, POST /
//     Semua di-prefix /api/admin/products oleh mount ini
app.use('/api/admin/products', productRoutes)

// ── 404 ───────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' })
})

// ── Global error handler ──────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ERROR]', err.message)

  if (err.message.startsWith('CORS:')) {
    res.status(403).json({ success: false, message: err.message })
    return
  }
  if (err.message.includes('File too large')) {
    res.status(413).json({ success: false, message: 'Ukuran file terlalu besar. Maksimal 5MB.' })
    return
  }

  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Terjadi kesalahan server internal' : err.message,
  })
})
// if (process.env.NODE_ENV !== 'production') {
//   app.listen(PORT, () => { ... })
// }
// ── Start server ──────────────────────────────────────────────
// if (process.env.NODE_ENV !== 'production') {
//   app.listen(PORT, () => {
//     console.log(`
// ╔══════════════════════════════════════╗
// ║   ShopLink API Server Running        ║
// ║   http://localhost:${PORT}              ║
// ╚══════════════════════════════════════╝
//     `)
//   })
// }
export default app