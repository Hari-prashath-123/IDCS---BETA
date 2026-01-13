import React, { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext.jsx'
import api from '../../services/api.js'

export default function HodDashboard() {
  const { user } = useAuth()
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [studentCount, setStudentCount] = useState<number | null>(null)
  const [staffCount, setStaffCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [myDepartment, setMyDepartment] = useState<any>(null)

  // Get department from user or from staff profile
  const userDept = (user && (user.department || user.department_admin_for || user.admin_department_name)) || ''

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        // First, get staff profile to find which department this HoD manages
        const [dres, staffRes] = await Promise.all([
          api.get('/departments/'),
          api.get('/staff/').catch(() => ({ data: [] }))
        ])
        
        const ddata = dres.data || []
        const items = Array.isArray(ddata) ? ddata : (ddata.results || [])
        setDepartments(items)

        // Find department where this user is HoD
        const staffData = Array.isArray(staffRes.data) ? staffRes.data : (staffRes.data?.results || [])
        const myStaffProfile = staffData.find((s: any) => 
          s.email === user?.email || s.user === user?.email || s.user === user?.username
        )
        
        // Find the department where this user is head
        let deptId = null
        let deptName = ''
        
        if (myStaffProfile && myStaffProfile.department) {
          const dept = items.find((d: any) => d.id === myStaffProfile.department)
          if (dept) {
            deptId = dept.id
            deptName = dept.name
            setMyDepartment(dept)
          }
        }
        
        // Fallback: try to match by name/code
        if (!deptId && userDept) {
          const found = items.find((d: any) => 
            String(d.name).toLowerCase() === String(userDept).toLowerCase() || 
            String(d.code).toLowerCase() === String(userDept).toLowerCase() || 
            String(d.id) === String(userDept)
          )
          if (found) {
            deptId = found.id
            deptName = found.name
            setMyDepartment(found)
          }
        }

        // Fetch students and staff filtered by department
        const studentParams: any = {}
        const staffParams: any = {}
        if (deptId) {
          studentParams.department = deptId
          staffParams.department = deptId
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
        setError('Failed to load department data: ' + (e.message || 'Unknown error'))
      } finally {
        setLoading(false)
      }
    }
    
    if (user) {
      load()
    }
  }, [user, userDept])

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">HoD Dashboard</h1>
          <p className="text-slate-600 mt-1">
            Welcome, {user?.email || user?.username}
            {myDepartment && <> — {myDepartment.name} Department</>}
          </p>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3">Loading dashboard...</span>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-6">
            <p className="text-red-600 font-medium">Error</p>
            <p className="text-red-500 text-sm mt-1">{error}</p>
          </div>
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
