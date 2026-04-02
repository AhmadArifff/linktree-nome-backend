// ============================================================
// server/lib/upload.ts
// Konfigurasi Multer untuk handle upload file gambar
// File disimpan sementara di memory, lalu diupload ke Supabase Storage
// ============================================================

import multer from 'multer'
import { Request } from 'express'

// Tipe MIME yang diizinkan
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

// Filter file — tolak jika bukan gambar
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Format file tidak didukung. Gunakan JPG, PNG, atau WebP.'))
  }
}

// Simpan di memory (bukan disk) — langsung stream ke Supabase
const storage = multer.memoryStorage()

// Instance multer untuk 1 file (field: "image")
export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
}).single('image')

// Instance multer untuk logo toko (field: "logo", max 2MB)
export const uploadLogo = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
}).single('logo')

// Helper: generate nama file unik untuk storage
// Format: {prefix}-{timestamp}-{random}.{ext}
export function generateFileName(
  originalName: string,
  prefix: string = 'img'
): string {
  const ext = originalName.split('.').pop()?.toLowerCase() ?? 'jpg'
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}-${timestamp}-${random}.${ext}`
}
