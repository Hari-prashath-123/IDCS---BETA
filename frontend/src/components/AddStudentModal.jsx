import React, { useEffect, useState } from 'react'
import api from '../services/api'

export default function AddStudentModal({ isOpen, onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', reg_no: '', email: '', department: '', year: '', section: '' })
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    let mounted = true
    async function load() {
      try {
        const res = await api.get('/departments/')
        if (!mounted) return
        // support both list and paginated responses
        const data = Array.isArray(res.data) ? res.data : (res.data.results || [])
        setDepartments(data)
      } catch (e) {
        setDepartments([])
      }
    }
    load()
    return () => { mounted = false }
  }, [isOpen])

  const handleChange = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      // Submit to /students/ as requested
      const payload = {
        // serializer expects user_id for linking; attempt to send minimal student fields
        reg_no: form.reg_no,
        name: form.name,
        department: form.department || null,
        year: form.year || null,
        section: form.section || '',
      }
      const res = await api.post('/students/', payload)
      setLoading(false)
      if (onSuccess) onSuccess(res.data)
      onClose()
    } catch (err) {
      setLoading(false)
      setError(err?.response?.data || err.message || 'Failed to create student')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-40" onClick={onClose} />
      <div className="bg-white rounded-lg shadow-lg z-50 w-full max-w-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Add Student</h3>
        {error && (
          <div className="mb-3 text-sm text-red-600">{JSON.stringify(error)}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input className="w-full border px-3 py-2 rounded" placeholder="Name" value={form.name} onChange={handleChange('name')} />
          <input className="w-full border px-3 py-2 rounded" placeholder="Email (optional)" value={form.email} onChange={handleChange('email')} />
          <input className="w-full border px-3 py-2 rounded" placeholder="Register No" value={form.reg_no} onChange={handleChange('reg_no')} />
          <select className="w-full border px-3 py-2 rounded" value={form.department} onChange={handleChange('department')}>
            <option value="">Select department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input className="w-1/2 border px-3 py-2 rounded" placeholder="Year" value={form.year} onChange={handleChange('year')} />
            <input className="w-1/2 border px-3 py-2 rounded" placeholder="Section" value={form.section} onChange={handleChange('section')} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded">{loading ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
