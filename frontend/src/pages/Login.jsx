import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      // Assumes backend exposes a token endpoint at /api/token/
      const res = await api.post('token/', { username, password })

      // Common JWT response shapes: { access, refresh } or { token }
      if (res.data.access) {
        localStorage.setItem('accessToken', res.data.access)
        if (res.data.refresh) localStorage.setItem('refreshToken', res.data.refresh)
      } else if (res.data.token) {
        localStorage.setItem('token', res.data.token)
      }

      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white p-6 rounded shadow"
      >
        <h2 className="text-2xl mb-4">Login</h2>

        {error && (
          <div className="mb-3 text-sm text-red-600">{JSON.stringify(error)}</div>
        )}

        <label className="block mb-2">
          <span className="text-sm">Username</span>
          <input
            type="text"
            placeholder="Enter Email, Reg No, or Faculty ID"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 block w-full border rounded p-2"
            required
          />
        </label>

        <label className="block mb-4">
          <span className="text-sm">Password</span>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full border rounded p-2"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  )
}
