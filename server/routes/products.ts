// ============================================================
// server/routes/products.ts
// Route CRUD Produk
//
// PUBLIC (tanpa auth):
//   GET  /api/products          → list produk aktif (query: ?category=slug)
//   GET  /api/products/:id      → detail satu produk
//
// ADMIN (require JWT):
//   GET    /api/admin/products/all    → list semua produk (aktif & nonaktif)
//   POST   /api/admin/products        → buat produk baru + upload gambar
//   PUT    /api/admin/products/:id    → edit produk + ganti gambar
//   PATCH  /api/admin/products/:id    → update partial produk (tanpa gambar)
//   DELETE /api/admin/products/:id    → hapus produk + gambar dari storage
//   PUT    /api/admin/products/reorder → urut ulang produk
//
// Upload: multipart/form-data, field "image"
// ============================================================

// ============================================================
// server/routes/products.ts
//
// BUG FIXES:
//   1. Route conflict: GET /all HARUS didefinisikan SEBELUM GET /:id
//      Kalau /:id duluan, Express tangkap string "all" sebagai :id → 404
//   2. Tambah PATCH /:id untuk toggle is_active tanpa upload gambar
//   3. Perbaiki urutan semua route: spesifik dulu, dynamic (:id) belakangan
// ============================================================

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { supabase, uploadFile, deleteFile, extractFilePath } from '../lib/supabase'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { uploadSingle, generateFileName } from '../lib/upload'

const router = Router()

// Schema validasi produk (full)
const ProductSchema = z.object({
  category_id: z.string().uuid({ message: 'category_id harus berupa UUID valid' }),
  name: z.string().min(1).max(200),
  short_description: z.string().max(300).optional(),
  description: z.string().optional(),
  price: z.string().max(50).optional(),
  marketplace_url: z.string().url({ message: 'marketplace_url harus berupa URL valid' }),
  sort_order: z.coerce.number().int().min(0).optional(),
  is_active: z.preprocess(
    (val) => (val === 'true' ? true : val === 'false' ? false : val),
    z.boolean().optional()
  ),
})

// Schema validasi partial (untuk PATCH)
const ProductPatchSchema = z.object({
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
  name: z.string().min(1).max(200).optional(),
  price: z.string().max(50).optional(),
})

// ============================================================
// ⚠️  PENTING: Route STATIS harus SEBELUM route DINAMIS (:id)
//     GET /all → harus di atas GET /:id
//     PUT /reorder → harus di atas PUT /:id
// ============================================================

// ============================================================
// GET /api/products
// Publik: list produk aktif dengan join kategori
// ============================================================
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { category, limit = '50', offset = '0' } = req.query

  try {
    let query = supabase
      .from('products')
      .select(`
        id, category_id, name, short_description, price, image_url,
        marketplace_url, sort_order,
        categories(id, name, slug, icon)
      `)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .range(Number(offset), Number(offset) + Number(limit) - 1)

    if (category && typeof category === 'string') {
      // Filter via join — perlu inner join agar bisa filter by slug
      query = supabase
        .from('products')
        .select(`
          id, category_id, name, short_description, price, image_url,
          marketplace_url, sort_order,
          categories!inner(id, name, slug, icon)
        `)
        .eq('is_active', true)
        .eq('categories.slug', category)
        .order('sort_order', { ascending: true })
        .range(Number(offset), Number(offset) + Number(limit) - 1)
    }

    const { data, error } = await query
    if (error) throw error

    res.status(200).json({ success: true, data: data ?? [], meta: { total: data?.length ?? 0 } })
  } catch (err) {
    console.error('[PRODUCTS] GET all error:', err)
    res.status(500).json({ success: false, message: 'Gagal mengambil data produk' })
  }
})

// ============================================================
// GET /api/admin/products/all  ← STATIC ROUTE — WAJIB SEBELUM /:id
// Admin: list SEMUA produk (aktif & nonaktif) dengan category_id
// ============================================================
router.get('/all', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { is_active, limit = '200', offset = '0' } = req.query

  try {
    let query = supabase
      .from('products')
      .select(`
        id, category_id, name, short_description, price, image_url,
        marketplace_url, sort_order, is_active, created_at,
        categories(id, name, slug, icon)
      `)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1)

    // Filter is_active jika dikirim
    if (is_active !== undefined && is_active !== '') {
      query = query.eq('is_active', is_active === 'true')
    }

    const { data, error } = await query
    if (error) throw error

    // Pastikan category_id selalu ada di setiap item
    const normalizedData = (data ?? []).map((p: any) => ({
      ...p,
      category_id: p.category_id ?? p.categories?.id ?? null,
    }))

    res.status(200).json({ success: true, data: normalizedData })
  } catch (err) {
    console.error('[PRODUCTS] ADMIN GET /all error:', err)
    res.status(500).json({ success: false, message: 'Gagal mengambil data produk' })
  }
})

// ============================================================
// PUT /api/admin/products/reorder  ← STATIC ROUTE — WAJIB SEBELUM /:id
// Admin: urut ulang produk
// ============================================================
router.put('/reorder', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { items } = req.body as { items: { id: string; sort_order: number }[] }

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ success: false, message: 'Data reorder tidak valid' })
    return
  }

  try {
    await Promise.all(
      items.map(({ id, sort_order }) =>
        supabase.from('products').update({ sort_order }).eq('id', id)
      )
    )
    res.status(200).json({ success: true, message: 'Urutan produk berhasil disimpan' })
  } catch (err) {
    console.error('[PRODUCTS] REORDER error:', err)
    res.status(500).json({ success: false, message: 'Gagal menyimpan urutan' })
  }
})

// ============================================================
// GET /api/products/:id  ← DYNAMIC ROUTE — setelah semua static
// Publik: detail satu produk
// ============================================================
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params

  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        id, category_id, name, short_description, description, price,
        image_url, marketplace_url, sort_order,
        categories(id, name, slug, icon)
      `)
      .eq('id', id)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      res.status(404).json({ success: false, message: 'Produk tidak ditemukan' })
      return
    }

    res.status(200).json({ success: true, data })
  } catch (err) {
    console.error('[PRODUCTS] GET by id error:', err)
    res.status(500).json({ success: false, message: 'Gagal mengambil data produk' })
  }
})

// ============================================================
// POST /api/admin/products
// Admin: buat produk baru + upload gambar (multipart/form-data)
// ============================================================
router.post('/', requireAuth, (req: AuthRequest, res: Response): void => {
  uploadSingle(req, res, async (uploadErr) => {
    if (uploadErr) {
      res.status(400).json({ success: false, message: uploadErr.message })
      return
    }

    const parse = ProductSchema.safeParse(req.body)
    if (!parse.success) {
      res.status(400).json({
        success: false,
        message: 'Input tidak valid',
        errors: parse.error.flatten().fieldErrors,
      })
      return
    }

    try {
      let image_url: string | null = null

      if (req.file) {
        const fileName = generateFileName(req.file.originalname, 'product')
        image_url = await uploadFile('product-images', fileName, req.file.buffer, req.file.mimetype)
      }

      const { data, error } = await supabase
        .from('products')
        .insert({ ...parse.data, image_url, is_active: parse.data.is_active ?? true })
        .select()
        .single()

      if (error) throw error

      res.status(201).json({ success: true, message: 'Produk berhasil dibuat', data })
    } catch (err) {
      console.error('[PRODUCTS] POST error:', err)
      res.status(500).json({ success: false, message: 'Gagal membuat produk' })
    }
  })
})

// ============================================================
// PATCH /api/admin/products/:id
// Admin: update sebagian field TANPA upload gambar
// Dipakai untuk toggle is_active dari list produk
// ============================================================
router.patch('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params
  const parse = ProductPatchSchema.safeParse(req.body)

  if (!parse.success) {
    res.status(400).json({
      success: false,
      message: 'Input tidak valid',
      errors: parse.error.flatten().fieldErrors,
    })
    return
  }

  if (Object.keys(parse.data).length === 0) {
    res.status(400).json({ success: false, message: 'Tidak ada field yang diupdate' })
    return
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .update(parse.data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ success: false, message: 'Produk tidak ditemukan' })
        return
      }
      throw error
    }

    res.status(200).json({ success: true, message: 'Produk berhasil diperbarui', data })
  } catch (err) {
    console.error('[PRODUCTS] PATCH error:', err)
    res.status(500).json({ success: false, message: 'Gagal memperbarui produk' })
  }
})

// ============================================================
// PUT /api/admin/products/:id
// Admin: update produk lengkap + ganti gambar (opsional)
// ============================================================
router.put('/:id', requireAuth, (req: AuthRequest, res: Response): void => {
  uploadSingle(req, res, async (uploadErr) => {
    if (uploadErr) {
      res.status(400).json({ success: false, message: uploadErr.message })
      return
    }

    const { id } = req.params
    const parse = ProductSchema.partial().safeParse(req.body)

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

      if (req.file) {
        const { data: existing } = await supabase
          .from('products')
          .select('image_url')
          .eq('id', id)
          .single()

        const fileName = generateFileName(req.file.originalname, 'product')
        updates.image_url = await uploadFile('product-images', fileName, req.file.buffer, req.file.mimetype)

        if (existing?.image_url) {
          const oldPath = extractFilePath(existing.image_url, 'product-images')
          if (oldPath) deleteFile('product-images', oldPath)
        }
      }

      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          res.status(404).json({ success: false, message: 'Produk tidak ditemukan' })
          return
        }
        throw error
      }

      res.status(200).json({ success: true, message: 'Produk berhasil diperbarui', data })
    } catch (err) {
      console.error('[PRODUCTS] PUT error:', err)
      res.status(500).json({ success: false, message: 'Gagal memperbarui produk' })
    }
  })
})

// ============================================================
// DELETE /api/admin/products/:id
// Admin: hapus produk + gambar dari Storage
// ============================================================
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params

  try {
    const { data: product } = await supabase
      .from('products')
      .select('image_url')
      .eq('id', id)
      .single()

    const { error } = await supabase.from('products').delete().eq('id', id)

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ success: false, message: 'Produk tidak ditemukan' })
        return
      }
      throw error
    }

    if (product?.image_url) {
      const filePath = extractFilePath(product.image_url, 'product-images')
      if (filePath) deleteFile('product-images', filePath)
    }

    res.status(200).json({ success: true, message: 'Produk berhasil dihapus' })
  } catch (err) {
    console.error('[PRODUCTS] DELETE error:', err)
    res.status(500).json({ success: false, message: 'Gagal menghapus produk' })
  }
})

export default router