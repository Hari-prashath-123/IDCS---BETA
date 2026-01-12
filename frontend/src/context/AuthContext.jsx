import React, { createContext, useContext, useEffect, useState } from 'react'
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

  const login = async (username, password) => {
    setLoading(true)
    try {
      const res = await api.post('/auth/login/', { username, password })
      const { access, refresh, token, access_token, refresh_token } = res.data

      // support multiple token shapes
      const accessToken = access || token || access_token
      const refreshToken = refresh || refresh_token

      if (accessToken) {
        localStorage.setItem('access_token', accessToken)
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
          setUser(profile)

          // route based on server-provided flags
          if (profile.is_student) {
            navigate('/student/dashboard')
          } else if (profile.is_faculty || profile.is_staff) {
            navigate('/staff/dashboard')
          } else if (profile.is_superuser) {
            navigate('/admin/dashboard')
          } else {
            navigate('/', { replace: true })
          }

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
          return decoded
        }
      }
    } catch (err) {
      throw err
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
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
