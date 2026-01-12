import axios from 'axios'

const api = axios.create({
  // Use relative `/api` so Vite dev server proxy forwards requests to Django
  baseURL: '/api/',
  headers: {
    'Content-Type': 'application/json',
  },
})

export async function fetchCourses() {
  const res = await api.get('courses/')
  return res.data
}

export default api
