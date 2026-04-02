// ============================================================
// server/routes/analytics.ts
//
// PERUBAHAN ARSITEKTUR:
//   Backend sekarang MENERIMA geo data dari frontend (tidak lookup sendiri)
//   Frontend sudah fetch ipapi.co dari browser → data akurat
//   Backend cukup simpan city/region/lat/lon yang dikirim dalam body request
//
//   KEUNTUNGAN:
//   - Tidak ada lagi fallback hardcoded Jakarta
//   - Tidak bergantung pada proxy header x-forwarded-for yang sering hilang
//   - Akurat karena ipapi.co dipanggil langsung dari IP publik browser user
//   - Backend lebih ringan (tidak fetch eksternal per event)
// ============================================================

import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { requireAuth } from '../middleware/auth'

const router = Router()

function getDateRange(period: string): { from: Date; to: Date } {
  const to = new Date()
  const from = new Date()
  switch (period) {
    case '1d':  from.setDate(from.getDate() - 1);  break
    case '7d':  from.setDate(from.getDate() - 7);  break
    case '30d':
    default:    from.setDate(from.getDate() - 30); break
  }
  return { from, to }
}

// ============================================================
// PUBLIC: POST /api/analytics/event
//
// Body yang diterima sekarang termasuk geo fields:
//   { event_type, category_id?, product_id?, session_id?,
//     city?, region?, country?, latitude?, longitude? }
//
// Geo fields dikirim langsung dari browser (lebih akurat).
// Backend hanya validasi dan simpan — tidak lookup eksternal.
// ============================================================
router.post('/event', async (req: Request, res: Response) => {
  try {
    const {
      event_type, category_id, product_id, session_id,
      // Geo dari frontend (ipapi.co dipanggil di browser)
      city, region, country, latitude, longitude,
    } = req.body

    // Validasi event_type
    if (!['category_view', 'product_click'].includes(event_type)) {
      res.status(400).json({ success: false, message: 'event_type tidak valid' })
      return
    }

    if (!category_id && !product_id) {
      res.status(400).json({ success: false, message: 'category_id atau product_id harus ada' })
      return
    }

    // Dedup per session_id (jika ada) — cegah spam dari refresh/re-render
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

    // Insert — simpan geo langsung dari body (dikirim frontend)
    const { error } = await supabase.from('analytics_events').insert({
      event_type,
      category_id:  category_id  ?? null,
      product_id:   product_id   ?? null,
      session_id:   session_id   ?? null,
      ip_address:   null,                         // tidak lagi dipakai untuk geo
      city:         city          ?? null,
      region:       region        ?? null,
      country:      country       ?? 'ID',
      latitude:     latitude      ?? null,
      longitude:    longitude     ?? null,
    })

    if (error) throw error
    res.status(201).json({ success: true })
  } catch (err) {
    console.error('[analytics/event]', err)
    res.status(200).json({ success: false, message: 'internal error' })
  }
})

// ============================================================
// ADMIN: GET /api/admin/analytics/summary?period=7d
// ============================================================
router.get('/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const { from, to } = getDateRange((req.query.period as string) ?? '7d')

    const { data, error } = await supabase
      .from('analytics_events')
      .select('event_type')
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())

    if (error) throw error

    const rows        = data ?? []
    const totalViews  = rows.filter(r => r.event_type === 'category_view').length
    const totalClicks = rows.filter(r => r.event_type === 'product_click').length

    res.json({ success: true, data: { totalViews, totalClicks, period: req.query.period ?? '7d' } })
  } catch (err) {
    console.error('[analytics/summary]', err)
    res.status(500).json({ success: false, message: 'Gagal mengambil summary' })
  }
})

// ============================================================
// ADMIN: GET /api/admin/analytics/daily?period=7d
// ============================================================
router.get('/daily', requireAuth, async (req: Request, res: Response) => {
  try {
    const { from, to } = getDateRange((req.query.period as string) ?? '7d')
    const { data, error } = await supabase.rpc('get_daily_stats', {
      p_from: from.toISOString(), p_to: to.toISOString(),
    })
    if (error) throw error
    res.json({ success: true, data: data ?? [] })
  } catch (err) {
    console.error('[analytics/daily]', err)
    res.status(500).json({ success: false, message: 'Gagal mengambil daily analytics' })
  }
})

// ============================================================
// ADMIN: GET /api/admin/analytics/products?period=7d
// ============================================================
router.get('/products', requireAuth, async (req: Request, res: Response) => {
  try {
    const { from, to } = getDateRange((req.query.period as string) ?? '7d')
    const { data, error } = await supabase.rpc('get_product_stats', {
      p_from: from.toISOString(), p_to: to.toISOString(),
    })
    if (error) throw error
    res.json({ success: true, data: data ?? [] })
  } catch (err) {
    console.error('[analytics/products]', err)
    res.status(500).json({ success: false, message: 'Gagal mengambil product analytics' })
  }
})

// ============================================================
// ADMIN: GET /api/admin/analytics/categories?period=7d
// ============================================================
router.get('/categories', requireAuth, async (req: Request, res: Response) => {
  try {
    const { from, to } = getDateRange((req.query.period as string) ?? '7d')
    const { data, error } = await supabase.rpc('get_category_stats', {
      p_from: from.toISOString(), p_to: to.toISOString(),
    })
    if (error) throw error
    res.json({ success: true, data: data ?? [] })
  } catch (err) {
    console.error('[analytics/categories]', err)
    res.status(500).json({ success: false, message: 'Gagal mengambil category analytics' })
  }
})

// ============================================================
// ADMIN: GET /api/admin/analytics/locations?period=7d
// ============================================================
router.get('/locations', requireAuth, async (req: Request, res: Response) => {
  try {
    const { from, to } = getDateRange((req.query.period as string) ?? '7d')
    const { data, error } = await supabase.rpc('get_location_stats', {
      p_from: from.toISOString(), p_to: to.toISOString(),
    })
    if (error) throw error
    res.json({ success: true, data: data ?? [] })
  } catch (err) {
    console.error('[analytics/locations]', err)
    res.status(500).json({ success: false, message: 'Gagal mengambil location analytics' })
  }
})

export default router