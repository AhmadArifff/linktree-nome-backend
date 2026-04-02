// ============================================================
// server/middleware/auth.ts
// Middleware JWT untuk memproteksi semua route /admin/*
// Request wajib menyertakan header: Authorization: Bearer <token>
// ============================================================

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

// Extend Express Request agar bisa simpan data admin dari token
export interface AuthRequest extends Request {
  admin?: {
    id: string
    email: string
  }
}

// Payload yang disimpan di JWT
interface JwtPayload {
  id: string
  email: string
  iat: number
  exp: number
}

export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  // 1. Ambil token dari header Authorization
  const authHeader = req.headers['authorization']
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Akses ditolak. Token tidak ditemukan.',
    })
    return
  }

  // 2. Verifikasi token
  const secret = process.env.JWT_SECRET
  if (!secret) {
    res.status(500).json({
      success: false,
      message: 'Server configuration error.',
    })
    return
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload

    // 3. Simpan data admin di request object
    req.admin = {
      id: decoded.id,
      email: decoded.email,
    }

    next()
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: 'Token sudah kadaluarsa. Silakan login kembali.',
      })
      return
    }

    res.status(401).json({
      success: false,
      message: 'Token tidak valid.',
    })
  }
}

// Helper: buat JWT token baru
export function generateToken(payload: { id: string; email: string }): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET tidak dikonfigurasi')

  return jwt.sign(payload, secret, {
    expiresIn: '7d', // token berlaku 7 hari
  })
}
