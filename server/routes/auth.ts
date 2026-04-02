// ============================================================
// server/routes/auth.ts
// Route autentikasi admin: login, register, logout, verify token
//
// POST /api/auth/login    → return JWT token
// POST /api/auth/register → buat admin baru + return JWT token
// POST /api/auth/logout   → (stateless, handled client-side)
// GET  /api/auth/me       → verify token & return admin info
// ============================================================

import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { generateToken, requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

// Schema validasi input login
const LoginSchema = z.object({
  email: z.string().email({ message: 'Format email tidak valid' }),
  password: z.string().min(1, { message: 'Password tidak boleh kosong' }),
})

// Schema validasi input register
const RegisterSchema = z.object({
  email: z.string().email({ message: 'Format email tidak valid' }),
  password: z.string().min(6, { message: 'Password minimal 6 karakter' }),
})

// ============================================================
// POST /api/auth/login
// Login admin dengan email & password
// ============================================================
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  // 1. Validasi input
  const parse = LoginSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({
      success: false,
      message: 'Input tidak valid',
      errors: parse.error.flatten().fieldErrors,
    })
    return
  }

  const { email, password } = parse.data

  try {
    // 2. Cari admin berdasarkan email
    const { data: admin, error } = await supabase
      .from('admins')
      .select('id, email, password_hash')
      .eq('email', email.toLowerCase())
      .single()

    // Selalu return pesan generik agar tidak bocorkan info
    if (error || !admin) {
      res.status(401).json({
        success: false,
        message: 'Email atau password salah',
      })
      return
    }

    // 3. Verifikasi password dengan bcrypt
    const passwordMatch = await bcrypt.compare(password, admin.password_hash)
    if (!passwordMatch) {
      res.status(401).json({
        success: false,
        message: 'Email atau password salah',
      })
      return
    }

    // 4. Generate JWT token
    const token = generateToken({ id: admin.id, email: admin.email })

    res.status(200).json({
      success: true,
      message: 'Login berhasil',
      data: {
        token,
        admin: {
          id: admin.id,
          email: admin.email,
        },
      },
    })
  } catch (err) {
    console.error('[AUTH] Login error:', err)
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server. Coba lagi.',
    })
  }
})

// ============================================================
// POST /api/auth/register
// Register admin baru — hash password + insert ke database
// ============================================================
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  // 1. Validasi input
  const parse = RegisterSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({
      success: false,
      message: 'Input tidak valid',
      errors: parse.error.flatten().fieldErrors,
    })
    return
  }

  const { email, password } = parse.data

  try {
    // 2. Cek apakah email sudah terdaftar
    const { data: existingAdmin } = await supabase
      .from('admins')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()

    if (existingAdmin) {
      res.status(409).json({
        success: false,
        message: 'Email sudah terdaftar',
      })
      return
    }

    // 3. Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // 4. Insert admin baru
    const { data: newAdmin, error } = await supabase
      .from('admins')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
      })
      .select('id, email')
      .single()

    if (error) {
      console.error('[AUTH] Register insert error:', error)
      res.status(500).json({
        success: false,
        message: 'Gagal membuat akun. Coba lagi.',
      })
      return
    }

    // 5. Generate JWT token
    const token = generateToken({ id: newAdmin.id, email: newAdmin.email })

    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil',
      data: {
        token,
        admin: {
          id: newAdmin.id,
          email: newAdmin.email,
        },
      },
    })
  } catch (err) {
    console.error('[AUTH] Register error:', err)
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server. Coba lagi.',
    })
  }
})

// ============================================================
// POST /api/auth/logout
// Stateless logout — client cukup hapus token dari storage
// ============================================================
router.post('/logout', (_req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    message: 'Logout berhasil',
  })
})

// ============================================================
// GET /api/auth/me
// Verifikasi token dan return data admin yang sedang login
// ============================================================
router.get('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: admin, error } = await supabase
      .from('admins')
      .select('id, email, created_at')
      .eq('id', req.admin!.id)
      .single()

    if (error || !admin) {
      res.status(404).json({
        success: false,
        message: 'Admin tidak ditemukan',
      })
      return
    }

    res.status(200).json({
      success: true,
      data: admin,
    })
  } catch (err) {
    console.error('[AUTH] Me error:', err)
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    })
  }
})

export default router
