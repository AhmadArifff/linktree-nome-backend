// ============================================================
// server/routes/store.ts
//
// BUG FIX — "Endpoint tidak ditemukan" saat simpan profil toko:
//
//   Di server/index.ts router ini di-mount dua kali:
//     app.use('/api/store',       storeRoutes)  ← untuk public GET
//     app.use('/api/admin/store', storeRoutes)  ← untuk admin PUT
//
//   Sebelumnya: router.put('/admin', ...)
//     → URL terbentuk: /api/admin/store + /admin = /api/admin/store/admin
//     → Frontend kirim ke PUT /api/admin/store  → 404 "Endpoint tidak ditemukan"
//
//   Sesudah fix: router.put('/', ...)
//     → URL terbentuk: /api/admin/store + /     = /api/admin/store  ✓
//     → Cocok dengan yang frontend kirim
// ============================================================

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { supabase, uploadFile, deleteFile, extractFilePath } from '../lib/supabase'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { uploadLogo, generateFileName } from '../lib/upload'

const router = Router()

const StoreProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  theme_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'theme_color harus format hex (#RRGGBB)')
    .optional(),
})

// ============================================================
// GET /api/store
// Publik: ambil profil toko
// Mount: app.use('/api/store', storeRoutes) → router.get('/') = /api/store ✓
// ============================================================
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('store_profile')
      .select('id, name, description, logo_url, theme_color')
      .limit(1)
      .single()

    if (error || !data) {
      res.status(200).json({
        success: true,
        data: {
          id: null,
          name: 'ShopLink Store',
          description: null,
          logo_url: null,
          theme_color: '#7F77DD',
        },
      })
      return
    }

    res.status(200).json({ success: true, data })
  } catch (err) {
    console.error('[STORE] GET error:', err)
    res.status(500).json({ success: false, message: 'Gagal mengambil profil toko' })
  }
})

// ============================================================
// PUT /api/admin/store
// Admin: update profil + upload logo
// Mount: app.use('/api/admin/store', storeRoutes) → router.put('/') = /api/admin/store ✓
//
// SEBELUMNYA: router.put('/admin', ...) → /api/admin/store/admin → 404!
// SESUDAH:    router.put('/', ...)      → /api/admin/store       → 200 ✓
// ============================================================
router.put('/', requireAuth, (req: AuthRequest, res: Response): void => {
  uploadLogo(req, res, async (uploadErr) => {
    if (uploadErr) {
      res.status(400).json({ success: false, message: uploadErr.message })
      return
    }

    const parse = StoreProfileSchema.safeParse(req.body)
    if (!parse.success) {
      res.status(400).json({
        success: false,
        message: 'Input tidak valid',
        errors: parse.error.flatten().fieldErrors,
      })
      return
    }

    try {
      const updates: Record<string, unknown> = { ...parse.data }

      // Upload logo baru jika ada file yang dikirim
      if (req.file) {
        const { data: existing } = await supabase
          .from('store_profile')
          .select('logo_url')
          .limit(1)
          .single()

        const fileName = generateFileName(req.file.originalname, 'logo')
        updates.logo_url = await uploadFile(
          'store-assets',
          fileName,
          req.file.buffer,
          req.file.mimetype
        )

        // Hapus logo lama dari storage (non-blocking)
        if (existing?.logo_url) {
          const oldPath = extractFilePath(existing.logo_url, 'store-assets')
          if (oldPath) deleteFile('store-assets', oldPath)
        }
      }

      // Cek apakah row sudah ada (upsert manual)
      const { data: existing } = await supabase
        .from('store_profile')
        .select('id')
        .limit(1)
        .single()

      let result
      if (existing?.id) {
        result = await supabase
          .from('store_profile')
          .update(updates)
          .eq('id', existing.id)
          .select()
          .single()
      } else {
        result = await supabase
          .from('store_profile')
          .insert(updates)
          .select()
          .single()
      }

      if (result.error) throw result.error

      res.status(200).json({
        success: true,
        message: 'Profil toko berhasil diperbarui',
        data: result.data,
      })
    } catch (err) {
      console.error('[STORE] PUT error:', err)
      res.status(500).json({ success: false, message: 'Gagal memperbarui profil toko' })
    }
  })
})

export default router