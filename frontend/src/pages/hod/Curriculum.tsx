import React, { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api.js'

export default function HodCurriculum() {
  const { user } = useAuth()
  const [batch, setBatch] = useState<number | string>(2023)
  const [loading, setLoading] = useState(false)
  const [courses, setCourses] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [added, setAdded] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const userDeptRaw = (user && (user.department || user.department_admin_for || user.admin_department_name)) || ''
  const userDept = useMemo(() => {
    if (!userDeptRaw) return ''
    if (typeof userDeptRaw === 'object') return (userDeptRaw.name || userDeptRaw.code || userDeptRaw.id || '').toString()
    return String(userDeptRaw)
  }, [userDeptRaw])

  useEffect(() => {
    const loadDeps = async () => {
      try {
        const res = await api.get('/departments/')
        const data = res.data || []
        const items = Array.isArray(data) ? data : (data.results || [])
        setDepartments(items)
      } catch (e) {
        console.debug('Failed to load departments', e)
      }
    }
    loadDeps()
  }, [])

  const loadCourses = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/courses/')
      const data = res.data || []
      const items = Array.isArray(data) ? data : (data.results || [])
      setCourses(items)
    } catch (e: any) {
      console.error('Failed to load courses', e)
      setError('Failed to load courses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // initial load
    loadCourses()
  }, [])

  const deptId = useMemo(() => {
    if (!userDept || !departments || departments.length === 0) return null
    const found = departments.find((d: any) => String(d.name) === String(userDept) || String(d.id) === String(userDept) || String(d.code) === String(userDept))
    return found ? found.id : null
  }, [userDept, departments])

  const filteredByBatchAndDept = useMemo(() => {
    if (!courses) return []
    const normalizedUserDept = (userDept || '').toString().trim().toLowerCase()
    return courses.filter((c: any) => {
      const courseBatch = c.batch ?? c.BATCH ?? 2023
      if (String(courseBatch) !== String(batch)) return false
      // Robust admin department extraction (handle multiple field names)
      const adminDeptRaw = c.admin_department_name ?? c.admin_department ?? c.admin_dept ?? c.admin_dept_name ?? c.ADMIN_DEPARTMENT_NAME ?? ''
      const adminDept = (adminDeptRaw || '').toString().trim().toLowerCase()

      // If admin department explicitly set to ALL (or missing), consider available to all
      if (!adminDept || adminDept === 'all') return true

      // If admin department matches user's department (case-insensitive), include
      if (normalizedUserDept && adminDept === normalizedUserDept) return true

      // Extract target departments from various possible fields
      let targetsRaw: any = c.target_departments ?? c.target_depts ?? c.target_dept ?? c.targets ?? c.TARGET_DEPARTMENTS ?? []
      let targetsArr: string[] = []
      if (Array.isArray(targetsRaw)) {
        targetsArr = targetsRaw.map((t: any) => {
          if (!t) return ''
          if (typeof t === 'object') return (t.name || t.code || t.id || '').toString().trim().toLowerCase()
          return String(t).toString().trim().toLowerCase()
        }).filter(Boolean)
      } else if (typeof targetsRaw === 'string') {
        targetsArr = targetsRaw.split(/[;,|]/).map(s => s.trim().toLowerCase()).filter(Boolean)
      } else if (targetsRaw != null) {
        // fallback: coerce to string
        targetsArr = String(targetsRaw).split(/[;,|]/).map(s => s.trim().toLowerCase()).filter(Boolean)
      }

      // If no explicit targets were provided, treat as available to all
      if (!targetsArr || targetsArr.length === 0) return true

      // Check if any target matches the user's dept name/code or the deptId
      const matchesTarget = targetsArr.some((t: string) => {
        if (!t) return false
        if (deptId && String(t) === String(deptId)) return true
        if (t === normalizedUserDept) return true
        return false
      })

      if (matchesTarget) return true
      return false
    })
  }, [courses, batch, userDept, deptId])

  const grouped = useMemo(() => {
    const g: Record<number, any[]> = {}
    filteredByBatchAndDept.forEach((c: any) => {
      const sem = Number(c.semester) || 0
      if (!g[sem]) g[sem] = []
      g[sem].push(c)
    })
    const keys = Object.keys(g).map(Number).sort((a,b)=>a-b)
    return { g, keys }
  }, [filteredByBatchAndDept])

  const handleAdd = (courseId: any) => {
    setAdded((prev) => ({ ...prev, [courseId]: true }))
    // TODO: call backend endpoint to persist this assignment
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">HoD — Define Current Semester Curriculum</h1>
          <p className="text-slate-600 mt-1">Select a batch (year) to list courses mapped to your department and add them to the semester plan.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-sm text-slate-600">Your Department</label>
              <input readOnly value={userDept || '—'} className="w-full px-2 py-1 border rounded bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm text-slate-600">Batch (Year)</label>
              <input value={batch} onChange={(e)=>setBatch(e.target.value)} className="w-full px-2 py-1 border rounded" />
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={loadCourses} className="px-4 py-2 bg-indigo-600 text-white rounded">Reload Courses</button>
              <button onClick={() => {/* no-op placeholder to save plan */}} className="px-4 py-2 border rounded">Save Plan</button>
            </div>
          </div>
        </div>

        {loading && <div className="text-sm text-slate-600">Loading courses…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="space-y-6">
          {grouped.keys.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-4 text-slate-600">No courses found for selected batch and your department.</div>
          )}

          {grouped.keys.map((sem) => (
            <div key={sem} className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h3 className="font-semibold">Semester {sem}</h3>
                  <p className="text-sm text-slate-500">{grouped.g[sem].length} course{grouped.g[sem].length !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-sm text-slate-500">Batch: {batch}</div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="px-3 py-2">Code</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Class Types</th>
                      <th className="px-3 py-2">Credits</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped.g[sem].map((c: any) => (
                      <tr key={c.id} className="border-b hover:bg-slate-50">
                        <td className="px-3 py-2 align-top">{c.code}</td>
                        <td className="px-3 py-2 align-top">{c.name}</td>
                        <td className="px-3 py-2 align-top">{(c.class_types || []).join(', ')}</td>
                        <td className="px-3 py-2 align-top">{c.L ?? c.l ?? 0} - {c.T ?? c.t ?? 0} - {c.P ?? c.p ?? 0} - {c.S ?? c.s ?? 0} ({c.C ?? c.c ?? 0})</td>
                        <td className="px-3 py-2 align-top">
                          <button disabled={!!added[c.id]} onClick={() => handleAdd(c.id)} className={`px-3 py-1 rounded ${added[c.id] ? 'bg-green-600 text-white' : 'border hover:bg-slate-50'}`}>
                            {added[c.id] ? 'Added' : 'Add'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

      </div>
    </DashboardLayout>
  )
}
