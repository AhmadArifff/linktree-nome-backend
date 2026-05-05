// ============================================================
// server/routes/analytics.ts — FIXED
//
// FIX: Rename public endpoint dari /analytics/event
//      menjadi /track/hit agar tidak diblokir ad blocker.
//
// Ad blocker (uBlock, AdBlock Plus) memblokir URL yang mengandung
// kata: analytics, track, pixel, beacon, collect, stats
// → pakai kata netral: /track/hit atau /t/e
//
// NOTE: Route ini di-mount di server/index.ts sebagai:
//   app.use('/api/analytics', analyticsRoutes)   ← public (POST /event → POST /hit)
//   app.use('/api/admin/analytics', analyticsRoutes) ← admin (GET /summary, dll)
//   app.use('/api/t', analyticsRoutes)            ← alias anti-adblock
// ============================================================

import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { requireAuth } from '../middleware/auth'

const router = Router()

function getDateRange(period: string, fromQuery?: string, toQuery?: string): { from: Date; to: Date } {
  const now = new Date()
  if (fromQuery && toQuery) {
    const from = new Date(String(fromQuery))
    const to = new Date(String(toQuery))
    if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
      return { from, to }
    }
  }

  const to = new Date(now)
  const from = new Date(now)
  switch (period) {
    case '1d':  from.setDate(from.getDate() - 1);  break
    case '7d':  from.setDate(from.getDate() - 7);  break
    case '30d':
    default:    from.setDate(from.getDate() - 30); break
  }
  return { from, to }
}

// ── Core insert logic (dipakai oleh 2 route) ─────────────────
async function handleTrackEvent(req: Request, res: Response) {
  try {
    const {
      event_type, category_id, product_id, session_id,
      city, region, country, latitude, longitude,
    } = req.body

    if (!['category_view', 'product_click'].includes(event_type)) {
      res.status(400).json({ success: false, message: 'event_type tidak valid' })
      return
    }

    if (!category_id && !product_id) {
      res.status(400).json({ success: false, message: 'category_id atau product_id harus ada' })
      return
    }

    // Deduplication per session
    if (session_id && typeof session_id === 'string') {
      const windowMin  = event_type === 'product_click' ? 5 : 30
      const dedupeFrom = new Date(Date.now() - windowMin * 60 * 1000).toISOString()

      let q = supabase
        .from('analytics_events')
        .select('id')
        .eq('event_type',  event_type)
        .eq('session_id',  session_id)
        .gte('created_at', dedupeFrom)
        .limit(1)

      if (product_id)  q = q.eq('product_id',  product_id)
      if (category_id) q = q.eq('category_id', category_id)

      const { data: dup } = await q.maybeSingle()
      if (dup) {
        res.status(200).json({ success: true, message: 'skipped:duplicate' })
        return
      }
    }

    const { error } = await supabase.from('analytics_events').insert({
      event_type,
      category_id: category_id ?? null,
      product_id:  product_id  ?? null,
      session_id:  session_id  ?? null,
      ip_address:  null,
      city:        city        ?? null,
      region:      region      ?? null,
      country:     country     ?? 'ID',
      latitude:    latitude    ?? null,
      longitude:   longitude   ?? null,
    })

    if (error) throw error
    res.status(201).json({ success: true })
  } catch (err) {
    console.error('[track/event]', err)
    // Selalu return 200 ke publik — jangan tampilkan error ke visitor
    res.status(200).json({ success: false })
  }
}

// ============================================================
// PUBLIC: POST /api/analytics/event  (route lama — tetap ada)
// PUBLIC: POST /api/t/hit            (route baru — anti ad-block)
//
// Frontend sebaiknya pakai /api/t/hit
// ============================================================
router.post('/event', handleTrackEvent)   // lama (mungkin diblokir)
router.post('/hit',   handleTrackEvent)   // ✅ baru — aman dari ad blocker


// ============================================================
// ADMIN: GET /summary  →  /api/admin/analytics/summary
// ============================================================
router.get('/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const { from, to } = getDateRange(
      (req.query.period as string) ?? '7d',
      req.query.from as string | undefined,
      req.query.to as string | undefined,
    )

    const { data, error } = await supabase
      .from('analytics_events')
      .select('event_type')
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())

    if (error) throw error

    const rows        = data ?? []
    const totalViews  = rows.filter(r => r.event_type === 'category_view').length
    const totalClicks = rows.filter(r => r.event_type === 'product_click').length

    res.json({
      success: true,
      data: { totalViews, totalClicks, period: req.query.period ?? '7d' },
    })
  } catch (err) {
    console.error('[analytics/summary]', err)
    res.status(500).json({ success: false, message: 'Gagal mengambil summary' })
  }
})

// ============================================================
// ADMIN: GET /daily
// ============================================================
router.get('/daily', requireAuth, async (req: Request, res: Response) => {
  try {
    const { from, to } = getDateRange(
      (req.query.period as string) ?? '7d',
      req.query.from as string | undefined,
      req.query.to as string | undefined,
    )
    const { data, error } = await supabase.rpc('get_daily_stats', {
      p_from: from.toISOString(),
      p_to:   to.toISOString(),
    })
    if (error) throw error
    res.json({ success: true, data: data ?? [] })
  } catch (err) {
    console.error('[analytics/daily]', err)
    res.status(500).json({ success: false, message: 'Gagal mengambil daily analytics' })
  }
})

// ============================================================
// ADMIN: GET /products
// ============================================================
router.get('/products', requireAuth, async (req: Request, res: Response) => {
  try {
    const { from, to } = getDateRange(
      (req.query.period as string) ?? '7d',
      req.query.from as string | undefined,
      req.query.to as string | undefined,
    )
    const { data, error } = await supabase.rpc('get_product_stats', {
      p_from: from.toISOString(),
      p_to:   to.toISOString(),
    })
    if (error) throw error
    res.json({ success: true, data: data ?? [] })
  } catch (err) {
    console.error('[analytics/products]', err)
    res.status(500).json({ success: false, message: 'Gagal mengambil product analytics' })
  }
})

// ============================================================
// ADMIN: GET /categories
// ============================================================
router.get('/categories', requireAuth, async (req: Request, res: Response) => {
  try {
    const { from, to } = getDateRange(
      (req.query.period as string) ?? '7d',
      req.query.from as string | undefined,
      req.query.to as string | undefined,
    )
    const { data, error } = await supabase.rpc('get_category_stats', {
      p_from: from.toISOString(),
      p_to:   to.toISOString(),
    })
    if (error) throw error
    res.json({ success: true, data: data ?? [] })
  } catch (err) {
    console.error('[analytics/categories]', err)
    res.status(500).json({ success: false, message: 'Gagal mengambil category analytics' })
  }
})

// ============================================================
// ADMIN: GET /locations
// ============================================================
router.get('/locations', requireAuth, async (req: Request, res: Response) => {
  try {
    const { from, to } = getDateRange(
      (req.query.period as string) ?? '7d',
      req.query.from as string | undefined,
      req.query.to as string | undefined,
    )
    const { data, error } = await supabase.rpc('get_location_stats', {
      p_from: from.toISOString(),
      p_to:   to.toISOString(),
    })
    if (error) throw error
    res.json({ success: true, data: data ?? [] })
  } catch (err) {
    console.error('[analytics/locations]', err)
    res.status(500).json({ success: false, message: 'Gagal mengambil location analytics' })
  }
})

export default router