import React, { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as jwtDecodeModule from 'jwt-decode'
const jwtDecode = (jwtDecodeModule && (jwtDecodeModule.default || jwtDecodeModule))
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
        const decoded = jwtDecode(accessToken)
        setUser(decoded)

        // route based on token claims
        if (decoded.is_student) {
          navigate('/student/dashboard')
        } else if (decoded.is_faculty) {
          navigate('/staff/dashboard')
        } else {
          navigate('/dashboard')
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
    const token = localStorage.getItem('access_token')
    if (token) {
      try {
        const decoded = jwtDecode(token)
        setUser(decoded)
      } catch (e) {
        setUser(null)
      }
    }
    setLoading(false)
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

export default AuthContext
