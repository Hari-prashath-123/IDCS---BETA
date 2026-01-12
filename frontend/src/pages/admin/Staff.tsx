import React, { useEffect, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'

export default function Staff() {
  const { user } = useAuth()
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        setLoading(true)
        const res = await api.get('/staff/')
        if (!mounted) return
        const data = res.data || []
        setStaff(Array.isArray(data) ? data : data.results || [])
      } catch (err: any) {
        console.error('Error fetching staff:', err)
        setError(err.message || String(err))
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const sidebarItems = [
    { label: 'Dashboard', path: '/admin-dashboard', icon: null },
    { label: 'Create', path: '/admin/create', icon: null },
  ]

  return (
    <DashboardLayout sidebarItems={sidebarItems}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold">Manage Staff</h1>
          <p className="text-slate-600 mt-1">List of registered staff</p>
        </div>

        {loading && <div className="p-4 bg-white rounded">Loading staff...</div>}
        {error && <div className="p-4 bg-red-50 text-red-700 rounded">{error}</div>}

        {!loading && !error && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-2">Name</th>
                  <th className="py-2">Faculty ID</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Designation</th>
                  <th className="py-2">Department</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s: any) => (
                  <tr key={s.id} className="border-t">
                    <td className="py-2">{s.name || s.user || s.email}</td>
                    <td className="py-2">{s.faculty_id}</td>
                    <td className="py-2">{s.email || s.user}</td>
                    <td className="py-2">{s.designation}</td>
                    <td className="py-2">{typeof s.department === 'object' ? s.department?.name : s.department}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
