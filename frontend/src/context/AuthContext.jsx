import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
// Prefer the `jwt-decode` library when available, but fall back to a
// lightweight JWT payload parser to avoid runtime "jwtDecode is not a function"
// issues caused by differing module interop behavior in bundlers.
function decodeJwt(token) {
  if (!token || typeof token !== 'string') return null
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const payload = parts[1]
    // Add padding if needed
    const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=')
    const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
    // Some environments require decoding URI components
    try {
      return JSON.parse(decodeURIComponent(escape(decoded)))
    } catch (e) {
      return JSON.parse(decoded)
    }
  } catch (e) {
    return null
  }
}

let jwtDecode = decodeJwt
try {
  // Attempt to import the library (works in modern bundlers)
  // eslint-disable-next-line import/no-extraneous-dependencies
  // Note: this `require` will be tree-shaken in ESM builds that use native imports.
  // It is wrapped in try/catch to avoid breaking environments where require is unavailable.
  // @ts-ignore
  const lib = require && require('jwt-decode')
  if (lib) jwtDecode = lib.default || lib
} catch (e) {
  // ignore and use fallback
}
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const refreshTimeoutRef = useRef(null)

  const clearRefreshTimeout = () => {
    try {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
        refreshTimeoutRef.current = null
      }
    } catch (e) {
      // ignore
    }
  }

  const scheduleTokenRefresh = (accessToken) => {
    clearRefreshTimeout()
    try {
      const decoded = jwtDecode(accessToken)
      if (!decoded || !decoded.exp) return
      const expiresAt = decoded.exp * 1000
      // Refresh 60 seconds before expiry
      const refreshAt = Math.max(0, expiresAt - Date.now() - 60000)
      refreshTimeoutRef.current = setTimeout(async () => {
        try {
          await refreshToken()
        } catch (err) {
          logout()
        }
      }, refreshAt)
    } catch (e) {
      // ignore
    }
  }

  const refreshToken = async () => {
    const refresh = localStorage.getItem('refresh_token')
    if (!refresh) throw new Error('no refresh token')
    try {
      const res = await api.post('/auth/refresh/', { refresh })
      const newAccess = res.data.access || res.data.token || res.data.access_token
      if (newAccess) {
        localStorage.setItem('access_token', newAccess)
        scheduleTokenRefresh(newAccess)
      }
      return newAccess
    } catch (err) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      throw err
    }
  }

  const login = async (username, password) => {
    setLoading(true)
    try {
      console.debug('AuthProvider: calling /auth/login/ for', username)
      const res = await api.post('/auth/login/', { username, password })
      console.debug('AuthProvider: /auth/login/ response', res && res.status)
      const { access, refresh, token, access_token, refresh_token } = res.data

      // support multiple token shapes
      const accessToken = access || token || access_token
      const refreshToken = refresh || refresh_token

      if (accessToken) {
        localStorage.setItem('access_token', accessToken)
        scheduleTokenRefresh(accessToken)
      }
      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken)
      }

      if (accessToken) {
        localStorage.setItem('access_token', accessToken)
        // After storing token, fetch authoritative user profile from backend
        try {
          const userRes = await api.get('/auth/user/')
          const profile = userRes.data
          console.debug('AuthProvider: login profile', profile)
          setUser(profile)

          // robust HoD detection and routing
          const isHodProfile = (p) => {
            if (!p) return false
            // explicit boolean flags
            if (p.is_hod || p.is_department_head || p.is_department_admin || p.is_head) return true
            // arrays or groups
            const groups = p.groups || p.roles || p.role_names || p.permissions || []
            try {
              if (Array.isArray(groups)) {
                for (const g of groups) {
                  const name = typeof g === 'string' ? g : (g && (g.name || g.code || g.id))
                  if (!name) continue
                  const s = String(name).toLowerCase()
                  if (s.includes('hod') || (s.includes('head') && s.includes('department'))) return true
                }
              }
            } catch (e) {}

            // designation/title/role fields
            const designation = (p.designation || p.title || p.position || p.user_type || p.role) ? String(p.designation || p.title || p.position || p.user_type || p.role).toLowerCase() : ''
            if (designation.includes('hod') || (designation.includes('head') && designation.includes('department'))) return true

            // fallback: department admin fields
            if (p.department_admin_for || p.admin_department_name || p.department_admin) return true

            return false
          }

          // Extra check: query staff list to see if this user's email/faculty id is marked as HOD
          try {
            const staffRes = await api.get('/staff/')
            const staffItems = Array.isArray(staffRes.data) ? staffRes.data : (staffRes.data?.results || [])
            const lowerEmail = profile && profile.email ? String(profile.email).toLowerCase() : ''
            const matched = (staffItems || []).find((s) => {
              try {
                const sEmail = s?.email || s?.user || ''
                if (sEmail && String(sEmail).toLowerCase() === lowerEmail) return true
                const sFaculty = s?.faculty_id || ''
                if (sFaculty && profile && profile.faculty_id && String(sFaculty) === String(profile.faculty_id)) return true
                return false
              } catch (e) { return false }
            })
            if (matched) {
              const des = (matched.designation || '').toString().toLowerCase()
              if (des.includes('hod') || (des.includes('head') && des.includes('department'))) {
                // treat as HoD
                navigate('/hod/dashboard')
                try { scheduleTokenRefresh(accessToken) } catch (e) { }
                return profile
              }
            }
          } catch (e) {
            // ignore staff lookup errors
          }

          if (profile.is_superuser) {
            navigate('/admin/dashboard')
          } else if (isHodProfile(profile)) {
            navigate('/hod/dashboard')
          } else if (profile.is_student) {
            navigate('/student/dashboard')
          } else if (profile.is_faculty || profile.is_staff) {
            navigate('/staff/dashboard')
          } else {
            navigate('/', { replace: true })
          }

          // schedule automatic refresh based on token expiry
          try { scheduleTokenRefresh(accessToken) } catch (e) { }
          return profile
        } catch (e) {
          // If the backend rejects the token (401), remove it to avoid repeated 401s
          if (e && e.response && e.response.status === 401) {
            localStorage.removeItem('access_token')
            localStorage.removeItem('refresh_token')
            setUser(null)
            setLoading(false)
            return null
          }

          // fallback: try decoding token client-side
          const decoded = jwtDecode(accessToken)
          setUser(decoded)
          try { scheduleTokenRefresh(accessToken) } catch (e) { }
          return decoded
        }
      }
    } catch (err) {
      console.error('AuthProvider: login error', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    try { if (refreshTimeoutRef?.current) clearTimeout(refreshTimeoutRef.current) } catch (e) {}
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
    navigate('/login')
  }

  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem('access_token')
      if (!token) {
        setLoading(false)
        return
      }

      // Quick expiry check: if token contains exp and is expired, clear it and skip backend call
      try {
        const decoded = jwtDecode(token)
        if (decoded && decoded.exp && decoded.exp * 1000 < Date.now()) {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          setLoading(false)
          setUser(null)
          return
        }
      } catch (err) {
        // decoding failed — proceed to backend call which will handle invalid token
      }

      // Try to load authoritative user profile from backend
      try {
        const res = await api.get('/auth/user/')
        setUser(res.data)
        try { scheduleTokenRefresh(token) } catch (err) { }
      } catch (e) {
        // If backend rejects token (401), remove tokens to avoid repeated 401s
        if (e && e.response && e.response.status === 401) {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          setUser(null)
        } else {
          // fallback to decoding token if backend call fails for other reasons
          try {
            const decoded = jwtDecode(token)
            setUser(decoded)
            try { scheduleTokenRefresh(token) } catch (err) { }
          } catch (err) {
            setUser(null)
          }
        }
      } finally {
        setLoading(false)
      }
    }

    bootstrap()
  }, [])

  // clear any scheduled timeout on unmount
  useEffect(() => {
    return () => {
      try {
        if (refreshTimeoutRef?.current) clearTimeout(refreshTimeoutRef.current)
      } catch (e) {}
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}

// Export the context if other modules need it, and make the default export
// the provider component to keep Fast Refresh consistent (default export
// should be a React component when the file defines components).
export { AuthContext }
export default AuthProvider
