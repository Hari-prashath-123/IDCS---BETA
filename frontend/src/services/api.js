import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach Authorization header if access token present in localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Global response handler: if token is invalid or expired, clear tokens and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const resp = error && error.response
    if (resp && resp.status === 401) {
      try {
        const data = resp.data || {}
        const code = data.code || null
        const detail = data.detail || ''
        // Handle SimpleJWT invalid-token response
        if (code === 'token_not_valid' || (typeof detail === 'string' && detail.toLowerCase().includes('token'))) {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          // redirect to login so user can re-authenticate
          if (typeof window !== 'undefined' && window.location) {
            window.location.href = '/login'
          }
        }
      } catch (e) {
        // ignore
      }
    }
    return Promise.reject(error)
  }
)

export async function fetchCourses() {
  const res = await api.get('/courses/')
  return res.data
}

export async function uploadStudentExcel(formData) {
  console.debug('Uploading student Excel', formData.get('file') && formData.get('file').name)
  // Let axios/browser set the proper Content-Type with boundary for FormData
  const res = await api.post('/import/students/', formData, { timeout: 120000 })
  return res.data
}

export async function uploadStaffExcel(formData) {
  console.debug('Uploading staff Excel', formData.get('file') && formData.get('file').name)
  const res = await api.post('/import/staff/', formData, { timeout: 120000 })
  return res.data
}

export default api
