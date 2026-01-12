import { useEffect, useState } from 'react'
import { Users, UserPlus, Home, FileText, Megaphone } from 'lucide-react'
// @ts-expect-error - JS file without type declarations
import api from '../../services/api'
// @ts-expect-error - JSX file without type declarations
import { useAuth } from '../../context/AuthContext'
import DashboardLayout from '../../components/DashboardLayout'

export default function AdminDashboard() {
  const { user } = useAuth();
  const [studentCount, setStudentCount] = useState<number | null>(null)
  const [staffCount, setStaffCount] = useState<number | null>(null)

  const sidebarItems = [
    { label: 'Dashboard', path: '/admin-dashboard', icon: <Home className="h-5 w-5" /> },
    { label: 'Manage Students', path: '/admin/students', icon: <Users className="h-5 w-5" /> },
    { label: 'Manage Staff', path: '/admin/staff', icon: <UserPlus className="h-5 w-5" /> },
    { label: 'Create', path: '/admin/create', icon: <UserPlus className="h-5 w-5" /> },
    { label: 'Views', path: '/admin/views', icon: <FileText className="h-5 w-5" /> },
    { label: 'Notices', path: '/notices', icon: <Megaphone className="h-5 w-5" /> },
  ];

  useEffect(() => {
    let mounted = true

    async function loadCounts() {
      try {
        // try consolidated stats endpoint first (not present) - skip
        // const res = await api.get('/stats/')
        if (!mounted) return
        setStudentCount(res.data.students ?? null)
        setStaffCount(res.data.staff ?? null)
        return
      } catch (e) {
        // fallback to individual endpoints
      }

      try {
        const [sRes, fRes] = await Promise.all([
          api.get('/students/'),
          api.get('/staff/'),
        ])
        if (!mounted) return
        const sCount = Array.isArray(sRes.data) ? sRes.data.length : (sRes.data.count ?? null)
        const fCount = Array.isArray(fRes.data) ? fRes.data.length : (fRes.data.count ?? null)
        setStudentCount(sCount)
        setStaffCount(fCount)
      } catch (err) {
        // ignore errors, leave counts null
      }
    }

    loadCounts()
    return () => { mounted = false }
  }, [])

  return (
    <DashboardLayout sidebarItems={sidebarItems}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-slate-800">Admin Dashboard</h1>
          <p className="text-slate-600 mt-1">Welcome, {user?.name || user?.email}</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Students</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">
                  {studentCount !== null ? studentCount : '...'}
                </p>
              </div>
              <Users className="h-12 w-12 text-blue-600 opacity-20" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Staff</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {staffCount !== null ? staffCount : '...'}
                </p>
              </div>
              <UserPlus className="h-12 w-12 text-green-600 opacity-20" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
          <p className="text-slate-600">Use the sidebar to navigate to different admin sections.</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
