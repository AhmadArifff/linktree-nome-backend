// ============================================================
// server/routes/categories.ts
// Route CRUD Kategori
//
// PUBLIC (tanpa auth):
//   GET  /api/categories         → list semua kategori aktif
//   GET  /api/categories/:slug   → detail kategori + produknya
//
// ADMIN (require JWT):
//   GET    /api/admin/categories        → list semua kategori (aktif + nonaktif)
//   POST   /api/admin/categories        → buat kategori baru
//   PUT    /api/admin/categories/:id    → edit kategori
//   DELETE /api/admin/categories/:id    → hapus kategori
//   PUT    /api/admin/categories/reorder → urut ulang kategori
// ============================================================

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

// Helper: buat slug dari nama (huruf kecil, spasi → tanda hubung)
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

// Schema validasi kategori
const CategorySchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().max(10).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
})

// ============================================================
// GET /api/categories
// Publik: list semua kategori aktif, urut by sort_order
// ============================================================
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, slug, icon, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) throw error

    res.status(200).json({
      success: true,
      data,
    })
  } catch (err) {
    console.error('[CATEGORIES] GET all error:', err)
    res.status(500).json({ success: false, message: 'Gagal mengambil data kategori' })
  }
})

// ============================================================
// GET /api/categories/:slug
// Publik: detail kategori + list produk aktif di dalamnya
// ============================================================
router.get('/:slug', async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params

  try {
    // Ambil kategori
    const { data: category, error: catErr } = await supabase
      .from('categories')
      .select('id, name, slug, icon')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (catErr || !category) {
      res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' })
      return
    }

    // Ambil produk aktif dalam kategori ini
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('id, name, short_description, price, image_url, marketplace_url, sort_order')
      .eq('category_id', category.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (prodErr) throw prodErr

    res.status(200).json({
      success: true,
      data: {
        ...category,
        products: products ?? [],
      },
    })
  } catch (err) {
    console.error('[CATEGORIES] GET by slug error:', err)
    res.status(500).json({ success: false, message: 'Gagal mengambil data kategori' })
  }
})

// ============================================================
// GET /api/admin/categories
// Admin: list semua kategori (aktif + nonaktif), urut by sort_order
// ============================================================
router.get('/', requireAuth, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, slug, icon, sort_order, is_active')
      .order('sort_order', { ascending: true })

    if (error) throw error

    res.status(200).json({
      success: true,
      data,
    })
  } catch (err) {
    console.error('[CATEGORIES] GET admin all error:', err)
    res.status(500).json({ success: false, message: 'Gagal mengambil data kategori' })
  }
})

// ============================================================
// POST /api/admin/categories
// Admin: buat kategori baru
// ============================================================
router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const parse = CategorySchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({
      success: false,
      message: 'Input tidak valid',
      errors: parse.error.flatten().fieldErrors,
    })
    return
  }

  const { name, icon, sort_order, is_active } = parse.data
  const slug = slugify(name)

  try {
    // Cek slug sudah dipakai atau belum
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existing) {
      res.status(409).json({
        success: false,
        message: `Kategori dengan nama "${name}" sudah ada`,
      })
      return
    }

    // Hitung sort_order jika tidak disertakan (append di akhir)
    let finalSortOrder = sort_order
    if (finalSortOrder === undefined) {
      const { count } = await supabase
        .from('categories')
        .select('*', { count: 'exact', head: true })
      finalSortOrder = (count ?? 0) + 1
    }

    const { data, error } = await supabase
      .from('categories')
      .insert({ name, slug, icon, sort_order: finalSortOrder, is_active: is_active ?? true })
      .select()
      .single()

    if (error) throw error

    res.status(201).json({ success: true, message: 'Kategori berhasil dibuat', data })
  } catch (err) {
    console.error('[CATEGORIES] POST error:', err)
    res.status(500).json({ success: false, message: 'Gagal membuat kategori' })
  }
})

// ============================================================
// PUT /api/admin/categories/reorder
// Admin: urut ulang kategori (drag & drop)
// Body: { items: [{ id: string, sort_order: number }] }
// ============================================================
router.put('/reorder', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { items } = req.body as { items: { id: string; sort_order: number }[] }

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ success: false, message: 'Data reorder tidak valid' })
    return
  }

  try {
    // Update sort_order untuk setiap item secara paralel
    await Promise.all(
      items.map(({ id, sort_order }) =>
        supabase.from('categories').update({ sort_order }).eq('id', id)
      )
    )

    res.status(200).json({ success: true, message: 'Urutan kategori berhasil disimpan' })
  } catch (err) {
    console.error('[CATEGORIES] REORDER error:', err)
    res.status(500).json({ success: false, message: 'Gagal menyimpan urutan' })
  }
})

// ============================================================
// PUT /api/admin/categories/:id
// Admin: edit kategori
// ============================================================
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params
  const parse = CategorySchema.partial().safeParse(req.body)

  if (!parse.success) {
    res.status(400).json({
      success: false,
      message: 'Input tidak valid',
      errors: parse.error.flatten().fieldErrors,
    })
    return
  }

  // Jika nama berubah, update slug juga
  const updates: Record<string, unknown> = { ...parse.data }
  if (parse.data.name) {
    updates.slug = slugify(parse.data.name)
  }

  try {
    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' })
        return
      }
      throw error
    }

    res.status(200).json({ success: true, message: 'Kategori berhasil diperbarui', data })
  } catch (err) {
    console.error('[CATEGORIES] PUT error:', err)
    res.status(500).json({ success: false, message: 'Gagal memperbarui kategori' })
  }
})

// ============================================================
// DELETE /api/admin/categories/:id
// Admin: hapus kategori (produk ikut terhapus via CASCADE)
// ============================================================
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params

  try {
    const { error } = await supabase.from('categories').delete().eq('id', id)

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' })
        return
      }
      throw error
    }

    res.status(200).json({ success: true, message: 'Kategori dan semua produknya berhasil dihapus' })
  } catch (err) {
    console.error('[CATEGORIES] DELETE error:', err)
    res.status(500).json({ success: false, message: 'Gagal menghapus kategori' })
  }
})

export default router
