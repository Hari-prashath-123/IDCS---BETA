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

      // If admin department explicitly set to ALL (or missing/generic), consider available to all
      if (!adminDept || adminDept === 'all' || adminDept === 'dept') return true

      // If admin department matches user's department (case-insensitive), include
      if (normalizedUserDept && adminDept === normalizedUserDept) return true

      // Extract target departments from various possible fields
      let targetsRaw: any = c.target_departments ?? c.target_depts ?? c.target_dept ?? c.targets ?? c.TARGET_DEPARTMENTS ?? []
      let targetsArr: (string | number)[] = []
      
      if (Array.isArray(targetsRaw)) {
        // Flatten array elements - they might be IDs (numbers), objects, or comma-separated strings
        targetsArr = targetsRaw.flatMap((t: any) => {
          if (t == null) return []
          
          // If it's a number (department ID), keep it as is
          if (typeof t === 'number') return [t]
          
          // If it's an object with id/name/code, extract those
          if (typeof t === 'object') {
            if (t.id) return [t.id] // Return the ID if available
            const name = (t.name || t.code || '').toString().trim().toLowerCase()
            return name ? [name] : []
          }
          
          // If t is a string, it might be comma-separated like "AI, CSE, EEE"
          const tStr = String(t).trim()
          if (tStr.includes(',')) {
            return tStr.split(/[;,|]/).map(s => s.trim().toLowerCase()).filter(Boolean)
          }
          return [tStr.toLowerCase()]
        }).filter(val => val !== null && val !== undefined && val !== '')
      } else if (typeof targetsRaw === 'string') {
        targetsArr = targetsRaw.split(/[;,|]/).map(s => s.trim().toLowerCase()).filter(Boolean)
      } else if (targetsRaw != null) {
        // fallback: coerce to string
        targetsArr = String(targetsRaw).split(/[;,|]/).map(s => s.trim().toLowerCase()).filter(Boolean)
      }

      // If no explicit targets were provided, treat as available to all
      if (!targetsArr || targetsArr.length === 0) return true

      // Check if any target matches the user's dept name/code or the deptId
      const matchesTarget = targetsArr.some((t: string | number) => {
        if (t == null || t === '') return false
        
        // If target is a number (dept ID), match against user's deptId
        if (typeof t === 'number') {
          return deptId && Number(t) === Number(deptId)
        }
        
        // String matching for names/codes
        const tStr = String(t).toLowerCase()
        // Match by ID
        if (deptId && tStr === String(deptId)) return true
        // Match by normalized name (exact or partial)
        if (tStr === normalizedUserDept) return true
        if (normalizedUserDept && tStr.includes(normalizedUserDept)) return true
        if (normalizedUserDept && normalizedUserDept.includes(tStr)) return true
        return false
      })

      if (matchesTarget) return true
      return false
    })
  }, [courses, batch, userDept, deptId])
  // Debug: expose filtering inputs and results to browser console
  useEffect(() => {
    try {
      const matchedCodes = (filteredByBatchAndDept || []).map((c: any) => c.code || c.code)
      const allCourseSummaries = (courses || []).map((c: any) => ({ code: c.code, name: c.name, targets: c.target_departments }))
      // eslint-disable-next-line no-console
      console.log('Curriculum Debug:', { userDept, deptId, batch, coursesCount: (courses || []).length, matchedCodes, allCourseSummaries })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Curriculum debug error', err)
    }
  }, [filteredByBatchAndDept, userDept, deptId, batch, courses])

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
