import React, { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api.js'

export default function HodDashboard() {
  const { user } = useAuth()
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [studentCount, setStudentCount] = useState<number | null>(null)
  const [staffCount, setStaffCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const userDept = (user && (user.department || user.department_admin_for || user.admin_department_name)) || ''

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const dres = await api.get('/departments/')
        const ddata = dres.data || []
        const items = Array.isArray(ddata) ? ddata : (ddata.results || [])
        setDepartments(items)

        // try to find dept id
        const found = items.find((d: any) => String(d.name).toLowerCase() === String(userDept).toLowerCase() || String(d.code).toLowerCase() === String(userDept).toLowerCase() || String(d.id) === String(userDept))
        const deptId = found ? found.id : null

        // Fetch students and staff filtered by department when possible
        const studentParams: any = {}
        const staffParams: any = {}
        if (deptId) {
          studentParams.department = deptId
          staffParams.department = deptId
        } else if (userDept) {
          studentParams.department_name = userDept
          staffParams.department_name = userDept
        }

        const [sRes, fRes] = await Promise.all([
          api.get('/students/', { params: studentParams }),
          api.get('/staff/', { params: staffParams }),
        ])

        const sData = Array.isArray(sRes.data) ? sRes.data : (sRes.data?.results || [])
        const fData = Array.isArray(fRes.data) ? fRes.data : (fRes.data?.results || [])

        setStudentCount(sData.length)
        setStaffCount(fData.length)
      } catch (e: any) {
        console.error('HoD Dashboard load error', e)
        setError('Failed to load department counts')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">HoD Dashboard</h1>
          <p className="text-slate-600 mt-1">Overview for your department: {userDept || '—'}</p>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border p-6">Loading…</div>
        ) : error ? (
          <div className="bg-white rounded-xl shadow-sm border p-6 text-red-600">{error}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col items-start">
              <div className="text-sm text-slate-500">Total Students</div>
              <div className="text-3xl font-bold text-indigo-600 mt-2">{studentCount ?? '—'}</div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col items-start">
              <div className="text-sm text-slate-500">Total Staff</div>
              <div className="text-3xl font-bold text-emerald-600 mt-2">{staffCount ?? '—'}</div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
