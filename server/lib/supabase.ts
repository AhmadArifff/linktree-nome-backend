// ============================================================
// server/lib/supabase.ts
// Inisialisasi Supabase client dengan Service Role Key
// Service role = bypass RLS → akses penuh untuk operasi admin
// ============================================================

import { createClient } from '@supabase/supabase-js'
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing Supabase credentials. Pastikan SUPABASE_URL dan SUPABASE_SERVICE_KEY sudah diset di .env'
  )
}

// Client dengan service role key — digunakan hanya di backend
// JANGAN gunakan key ini di frontend!
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Helper: upload file ke Supabase Storage
export async function uploadFile(
  bucket: string,
  filePath: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, fileBuffer, {
      contentType: mimeType,
      upsert: true, // timpa file lama jika nama sama
    })

  if (error) {
    throw new Error(`Upload gagal: ${error.message}`)
  }

  // Return public URL
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
  return data.publicUrl
}

// Helper: hapus file dari Supabase Storage
export async function deleteFile(bucket: string, filePath: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([filePath])
  if (error) {
    // Log tapi tidak throw — jangan blokir operasi utama jika hapus file gagal
    console.error(`Gagal hapus file ${filePath}:`, error.message)
  }
}

// Helper: ekstrak nama file dari URL storage Supabase
export function extractFilePath(publicUrl: string, bucket: string): string | null {
  try {
    const url = new URL(publicUrl)
    const marker = `/storage/v1/object/public/${bucket}/`
    const idx = url.pathname.indexOf(marker)
    if (idx === -1) return null
    return url.pathname.slice(idx + marker.length)
  } catch {
    return null
  }
}
