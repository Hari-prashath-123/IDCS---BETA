import React, { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api.js'

export default function HodCurriculum() {
  const { user } = useAuth()
  const currentYear = new Date().getFullYear()
  
  // State Management
  const [selectedBatch, setSelectedBatch] = useState<number>(currentYear)
  const [selectedSemester, setSelectedSemester] = useState<number>(1)
  const [allCourses, setAllCourses] = useState<any[]>([])
  const [allocatedCourseIds, setAllocatedCourseIds] = useState<number[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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

  const deptId = useMemo(() => {
    if (!userDept || !departments || departments.length === 0) return null
    const found = departments.find((d: any) => String(d.name) === String(userDept) || String(d.id) === String(userDept) || String(d.code) === String(userDept))
    return found ? found.id : null
  }, [userDept, departments])

  // Fetch ALL courses for department and existing allocation
  const loadCoursesAndAllocation = async () => {
    if (!deptId) return
    setLoading(true)
    try {
      // Fetch 1: Get ALL courses for this department (no batch filter)
      const coursesRes = await api.get('/courses/', { params: { department: deptId } })
      const coursesData = coursesRes.data || []
      const coursesItems = Array.isArray(coursesData) ? coursesData : (coursesData.results || [])
      setAllCourses(coursesItems)

      // Fetch 2: Get existing allocation for selected batch + semester
      const allocationRes = await api.get('/course-allocations/active-courses/', {
        params: {
          department: deptId,
          batch_year: selectedBatch,
          semester: selectedSemester
        }
      })
      const allocationData = allocationRes.data || []
      const activeIds = Array.isArray(allocationData) ? allocationData.map((c: any) => c.id) : []
      setAllocatedCourseIds(activeIds)
    } catch (e: any) {
      console.error('Failed to load courses or allocation', e)
      setMessage({ type: 'error', text: 'Failed to load courses or allocation' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Reload when department, batch, or semester changes
    loadCoursesAndAllocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptId, selectedBatch, selectedSemester])

  // Filter courses by selected semester
  const filteredCourses = useMemo(() => {
    return allCourses.filter((c: any) => c.semester === selectedSemester)
  }, [allCourses, selectedSemester])

  // Toggle course in allocation
  const handleToggleCourse = (courseId: number) => {
    setAllocatedCourseIds((prev) => {
      if (prev.includes(courseId)) {
        return prev.filter(id => id !== courseId)
      } else {
        return [...prev, courseId]
      }
    })
  }

  // Select/Deselect all visible courses
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = filteredCourses.map((c: any) => c.id)
      setAllocatedCourseIds(allIds)
    } else {
      setAllocatedCourseIds([])
    }
  }

  // Save allocation
  const handleSave = async () => {
    if (!deptId) {
      setMessage({ type: 'error', text: 'Department not found' })
      return
    }

    setSaving(true)
    try {
      await api.post('/course-allocations/', {
        department: deptId,
        batch_year: selectedBatch,
        semester: selectedSemester,
        courses: allocatedCourseIds
      })
      setMessage({ type: 'success', text: `Curriculum updated for Batch ${selectedBatch} Semester ${selectedSemester}` })
    } catch (e: any) {
      console.error('Failed to save allocation', e)
      setMessage({ type: 'error', text: e.response?.data?.detail || 'Failed to save allocation' })
    } finally {
      setSaving(false)
    }
  }

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [message])

  // Propose new course form state
  const [showPropose, setShowPropose] = useState(false)
  const [proposeForm, setProposeForm] = useState<any>({
    code: '',
    name: '',
    type: 'Theory',
    category: 'PC',
    L: 0,
    T: 0,
    P: 0,
    S: 0,
    C: 0,
    internal_marks: 0,
    external_marks: 0,
  })
  const [proposing, setProposing] = useState(false)

  const classOptions = ['Theory', 'TCPR', 'TCPL', 'Practical', 'Project', 'Audit', 'Others']
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])
  const [otherClass, setOtherClass] = useState('')

  const handleProposeChange = (k: string, v: any) => setProposeForm((p: any) => ({ ...p, [k]: v }))

  const handleClassChange = (cls: string, checked: boolean) => {
    if (checked) setSelectedClasses(prev => [...prev, cls])
    else setSelectedClasses(prev => prev.filter(c => c !== cls))
  }

  const submitProposal = async () => {
    if (!deptId) {
      setMessage({ type: 'error', text: 'Department not resolved' })
      return
    }
    setProposing(true)
    try {
      // prepare class_types array
      let classTypes = selectedClasses.filter(c => c !== 'Others')
      if (selectedClasses.includes('Others') && otherClass.trim()) classTypes.push(otherClass.trim())

      const payload: any = {
        code: proposeForm.code,
        name: proposeForm.name,
        semester: selectedSemester,
        class_types: classTypes,
        category: proposeForm.category,
        L: Number(proposeForm.L) || 0,
        T: Number(proposeForm.T) || 0,
        P: Number(proposeForm.P) || 0,
        S: Number(proposeForm.S) || 0,
        C: Number(proposeForm.C) || 0,
        internal_marks: Number(proposeForm.internal_marks) || 0,
        external_marks: Number(proposeForm.external_marks) || 0,
        batch: selectedBatch,
        admin_department_name: userDept || '',
        target_departments: [deptId]
      }

      const res = await api.post('/courses/', payload)
      // Append to local list so it shows up (pending will be visible due to backend filtering)
      setAllCourses(prev => [res.data, ...prev])
      setMessage({ type: 'success', text: 'Course Proposal Sent to Admin for Approval' })
      setShowPropose(false)
      setProposeForm({ code: '', name: '', type: 'Theory', category: 'PC', L: 0, T: 0, P: 0, S: 0, C: 0, internal_marks: 0, external_marks: 0 })
      setSelectedClasses([])
      setOtherClass('')
    } catch (e: any) {
      console.error('Failed to propose course', e)
      // Show detailed server response if available for easier debugging
      const resp = e?.response?.data
      let text = e?.message || 'Failed to submit proposal'
      try {
        if (resp) {
          // Log full response for debugging
          console.error('Server response for failed proposal:', resp)
          if (typeof resp === 'string') text = resp
          else if (Array.isArray(resp)) text = resp.join('; ')
          else if (typeof resp === 'object') {
            // pick first field error to show succinctly
            const keys = Object.keys(resp)
            if (keys.length > 0) {
              const k = keys[0]
              const v = resp[k]
              text = `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`
            } else {
              text = JSON.stringify(resp)
            }
          }
        }
      } catch (err) {
        // fallback
        text = e?.message || 'Failed to submit proposal'
      }
      setMessage({ type: 'error', text })
    } finally {
      setProposing(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Semester Curriculum Allocation</h1>
          <p className="text-gray-600 mt-2">
            Select target batch and semester, then choose which courses to allocate.
          </p>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Controls */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <input
                type="text"
                readOnly
                value={userDept || '—'}
                className="w-full px-3 py-2 border rounded-lg bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Batch Year</label>
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {Array.from({ length: 9 }, (_, i) => currentYear - 4 + i).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                  <option key={sem} value={sem}>
                    Semester {sem}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? 'Saving...' : 'Save Semester Curriculum'}
              </button>
            </div>
          </div>
        </div>

        {/* Course Table */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Courses for Semester {selectedSemester}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {allocatedCourseIds.length} of {filteredCourses.length} courses selected
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-center text-gray-600">Loading courses...</div>
          ) : filteredCourses.length === 0 ? (
            <div className="p-6 text-center text-gray-600">
              No courses found for this semester. Add courses in the Course Management page.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={filteredCourses.length > 0 && filteredCourses.every((c) => allocatedCourseIds.includes(c.id))}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="h-4 w-4 text-indigo-600 rounded"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Credits
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCourses.map((course) => (
                    <tr key={course.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={allocatedCourseIds.includes(course.id)}
                          onChange={() => handleToggleCourse(course.id)}
                          className="h-4 w-4 text-indigo-600 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center space-x-2">
                          <span>{course.code}</span>
                          {(!course.is_approved && !course.is_rejected) && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">Pending Approval</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{course.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {(course.class_types || []).join(', ') || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {course.L ?? 0}-{course.T ?? 0}-{course.P ?? 0}-{course.S ?? 0} ({course.C ?? 0})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/* Propose New Course */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border p-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Propose New Course for Batch {selectedBatch}</h3>
            <button onClick={() => setShowPropose(s => !s)} className="px-3 py-1 border rounded text-sm">{showPropose ? 'Hide' : 'Propose New Course'}</button>
          </div>

          {showPropose && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600">Code</label>
                <input value={proposeForm.code} onChange={(e) => handleProposeChange('code', e.target.value)} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Name</label>
                <input value={proposeForm.name} onChange={(e) => handleProposeChange('name', e.target.value)} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Class Type</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {classOptions.map(cls => (
                    <label key={cls} className="flex items-center space-x-2 p-1 hover:bg-slate-50 rounded">
                      <input type="checkbox" checked={selectedClasses.includes(cls)} onChange={(e) => handleClassChange(cls, e.target.checked)} className="w-4 h-4 text-indigo-600 rounded" />
                      <span className="text-sm text-slate-700">{cls}</span>
                    </label>
                  ))}
                </div>
                {selectedClasses.includes('Others') && (
                  <div className="mt-2">
                    <input type="text" value={otherClass} onChange={(e) => setOtherClass(e.target.value)} placeholder="Specify other class type" className="w-full px-3 py-2 border rounded" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-600">Category</label>
                <select value={proposeForm.category} onChange={(e) => handleProposeChange('category', e.target.value)} className="w-full px-3 py-2 border rounded">
                  <option>PC</option>
                  <option>ES</option>
                  <option>PE</option>
                  <option>HS</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-sm text-gray-600 mb-1">Credits (L-T-P-S-C)</label>
                <div className="flex gap-2">
                  <input type="number" value={proposeForm.L} onChange={(e) => handleProposeChange('L', e.target.value)} className="w-16 px-2 py-1 border rounded" />
                  <input type="number" value={proposeForm.T} onChange={(e) => handleProposeChange('T', e.target.value)} className="w-16 px-2 py-1 border rounded" />
                  <input type="number" value={proposeForm.P} onChange={(e) => handleProposeChange('P', e.target.value)} className="w-16 px-2 py-1 border rounded" />
                  <input type="number" value={proposeForm.S} onChange={(e) => handleProposeChange('S', e.target.value)} className="w-16 px-2 py-1 border rounded" />
                  <input type="number" value={proposeForm.C} onChange={(e) => handleProposeChange('C', e.target.value)} className="w-20 px-2 py-1 border rounded" />
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="block text-sm text-gray-600 mb-1">Marks Distribution</label>
                <div className="flex gap-2 items-center">
                  <div>
                    <div className="text-xs text-slate-600">Internal Marks</div>
                    <input type="number" value={proposeForm.internal_marks} onChange={(e) => handleProposeChange('internal_marks', e.target.value)} className="w-28 px-2 py-1 border rounded" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-600">External Marks</div>
                    <input type="number" value={proposeForm.external_marks} onChange={(e) => handleProposeChange('external_marks', e.target.value)} className="w-28 px-2 py-1 border rounded" />
                  </div>
                </div>
              </div>

              <div className="md:col-span-3 flex space-x-3">
                <button disabled={proposing} onClick={submitProposal} className="px-4 py-2 bg-indigo-600 text-white rounded">{proposing ? 'Submitting...' : 'Submit Proposal'}</button>
                <button onClick={() => setShowPropose(false)} className="px-4 py-2 border rounded">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}