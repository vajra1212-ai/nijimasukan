import { Staff, Role } from '@/types'

const AUTH_KEY = 'nijimasukan_auth'

export interface AuthState {
  staffId: string
  name: string
  role: Role
}

export function getAuth(): AuthState | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(AUTH_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setAuth(staff: Staff) {
  const state: AuthState = { staffId: staff.id, name: staff.name, role: staff.role }
  localStorage.setItem(AUTH_KEY, JSON.stringify(state))
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY)
}

export function isAdmin(): boolean {
  return getAuth()?.role === 'admin'
}

// 簡易PINハッシュ（ブラウザ側）
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin + 'nijimasukan_salt')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const computed = await hashPin(pin)
  return computed === hash
}
