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
// const allowedOrigins = [
//   process.env.FRONTEND_URL ?? 'http://localhost:3000',
//   'http://localhost:3000',
//   'http://localhost:3001','https://linktree-nome-frontend.vercel.app',
// ]
// ── LANGKAH 1: CORS — HARUS PALING PERTAMA ───────────────────
// Tangani OPTIONS preflight sebelum request sampai ke route manapun
const allowedOrigins = [
  // Lokal development
  'http://localhost:3000',
  'http://localhost:3001',
  // Production Vercel — sesuaikan dengan domain kamu
  'https://linktree-nome-frontend.vercel.app',
  // Tambah custom domain jika ada (misal: https://tokomu.com)
]
 
// Jika FRONTEND_URL di-set via env var, tambahkan juga
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL)
}
app.use(
  cors({
    origin: (origin, callback) => {
      // Izinkan request tanpa origin (Postman, curl, server-to-server)
      if (!origin) return callback(null, true)
 
      // Cek exact match
      if (allowedOrigins.includes(origin)) return callback(null, true)
 
      // Izinkan semua subdomain *.vercel.app (preview deployments)
      if (origin.endsWith('.vercel.app')) return callback(null, true)
 
      // Izinkan semua subdomain dari custom domain jika ada
      const customDomain = process.env.CUSTOM_DOMAIN
      if (customDomain && origin.endsWith(customDomain)) return callback(null, true)
 
      // Tolak semua lainnya
      callback(new Error(`CORS: Origin ${origin} tidak diizinkan`))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // Izinkan browser cache hasil preflight 10 menit
    maxAge: 600,
  })
)
 
// ── LANGKAH 2: Handle OPTIONS preflight secara eksplisit ─────
// Vercel Serverless kadang butuh ini untuk memastikan 200 response
// pada OPTIONS request sebelum actual request
app.options('*', cors())
 
// ── LANGKAH 3: Body parser ────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
 
// ── LANGKAH 4: Logger (dev only) ─────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
    next()
  })
}
 
// ── LANGKAH 5: Routes — semua SETELAH cors() ─────────────────
 
// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'ShopLink API is running',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  })
})
 
// Auth
app.use('/api/auth', authRoutes)
 
// Store (public)
app.use('/api/store', storeRoutes)
 
// Categories (public)
app.use('/api/categories', categoryRoutes)
 
// Products (public)
app.use('/api/products', productRoutes)
 
// Analytics — public event tracker
// /api/analytics/event  → route lama (mungkin diblokir ad blocker)
// /api/t/hit            → route baru anti-adblock (FIX: dipasang SETELAH cors)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/t',         analyticsRoutes)   // ← FIX: sekarang SETELAH cors()
 
// Admin routes (semua require JWT di dalam routernya)
app.use('/api/admin/store',      storeRoutes)
app.use('/api/admin/categories', categoryRoutes)
app.use('/api/admin/products',   productRoutes)
app.use('/api/admin/analytics',  analyticsRoutes)
 
// ── LANGKAH 6: 404 handler ───────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' })
})
 
// ── LANGKAH 7: Global error handler ──────────────────────────
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
    message: process.env.NODE_ENV === 'production'
      ? 'Terjadi kesalahan server internal'
      : err.message,
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
// ── Start server (lokal saja, Vercel pakai export default) ────
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║   ShopLink API Server Running        ║
║   http://localhost:${PORT}              ║
╚══════════════════════════════════════╝
    `)
  })
}
export default app