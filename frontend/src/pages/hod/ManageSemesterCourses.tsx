import React, { useEffect, useState, useMemo } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import api, { getDepartmentCourses, saveSemesterAllocation, getActiveCourses } from '../../services/api.js'

interface Course {
  id: number
  code: string
  name: string
  C: number
  c?: number
  class_types?: string[]
  semester: number
  L?: number
  T?: number
  P?: number
  S?: number
}

interface Department {
  id: number
  name: string
  code: string
}

export default function ManageSemesterCourses() {
  const { user } = useAuth()
  const currentYear = new Date().getFullYear()

  // State
  const [selectedBatch, setSelectedBatch] = useState<number>(currentYear)
  const [selectedSemester, setSelectedSemester] = useState<number>(1)
  const [allCourses, setAllCourses] = useState<Course[]>([])
  const [checkedCourseIds, setCheckedCourseIds] = useState<Set<number>>(new Set())
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // New course form state
  const [newCourse, setNewCourse] = useState({
    name: '',
    code: '',
    C: 0,
    L: 0,
    T: 0,
    P: 0,
    S: 0,
    class_types: [] as string[],
    category: 'PC',
    semester: selectedSemester,
    admin_department_name: '',
    internal_marks: 40,
    external_marks: 60,
  })

  // Get HOD's department
  const userDept = (user && (user.department || user.department_admin_for || user.admin_department_name)) || ''

  const deptId = useMemo(() => {
    if (!userDept || !departments || departments.length === 0) return null
    const found = departments.find(
      (d: Department) =>
        String(d.name) === String(userDept) ||
        String(d.id) === String(userDept) ||
        String(d.code) === String(userDept)
    )
    return found ? found.id : null
  }, [userDept, departments])

  // Load departments
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await api.get('/departments/')
        const data = res.data || []
        const items = Array.isArray(data) ? data : data.results || []
        setDepartments(items)
      } catch (e) {
        console.error('Failed to load departments', e)
      }
    }
    loadDepartments()
  }, [])

  // Load courses when department changes
  // Load both all courses and active allocation for current inputs
  const loadCoursesAndActive = async (options?: { showMessage?: boolean }) => {
    if (!deptId) return
    setLoading(true)
    try {
      const courses = await getDepartmentCourses(deptId)
      const items = Array.isArray(courses) ? courses : courses.results || []
      setAllCourses(items)

      const active = await getActiveCourses(deptId, selectedBatch, selectedSemester)
      const activeIds = Array.isArray(active) ? active.map((c: any) => c.id) : []
      setCheckedCourseIds(new Set(activeIds))
      if (options && options.showMessage) setMessage({ type: 'success', text: `Loaded ${activeIds.length} active courses` })
    } catch (e) {
      console.error('Failed to load courses or active allocation', e)
      setMessage({ type: 'error', text: 'Failed to load courses or active allocation' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // auto-load when department / batch / semester change
    loadCoursesAndActive()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptId, selectedBatch, selectedSemester])

  // Load saved allocation
  const handleLoadSaved = async () => {
    if (!deptId) {
      setMessage({ type: 'error', text: 'Department not found' })
      return
    }

    setLoading(true)
    try {
      const activeCourses = await getActiveCourses(deptId, selectedBatch, selectedSemester)
      const courseIds = activeCourses.map((c: any) => c.id)
      setCheckedCourseIds(new Set(courseIds))
      setMessage({ type: 'success', text: `Loaded ${courseIds.length} courses` })
    } catch (e) {
      console.error('Failed to load saved allocation', e)
      setMessage({ type: 'error', text: 'Failed to load saved allocation' })
    } finally {
      setLoading(false)
    }
  }

  // Toggle checkbox
  const handleToggleCourse = (courseId: number) => {
    setCheckedCourseIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(courseId)) {
        newSet.delete(courseId)
      } else {
        newSet.add(courseId)
      }
      return newSet
    })
  }

  const handleSelectAllVisible = (checked: boolean) => {
    if (!filteredCourses || filteredCourses.length === 0) return
    setCheckedCourseIds((prev) => {
      const newSet = new Set(prev)
      if (checked) {
        filteredCourses.forEach((c) => newSet.add(c.id))
      } else {
        filteredCourses.forEach((c) => newSet.delete(c.id))
      }
      return newSet
    })
  }

  // Save configuration
  const handleSaveConfiguration = async () => {
    if (!deptId) {
      setMessage({ type: 'error', text: 'Department not found' })
      return
    }

    setSaving(true)
    try {
      const data = {
        department: deptId,
        batch_year: selectedBatch,
        semester: selectedSemester,
        courses: Array.from(checkedCourseIds),
      }
      await saveSemesterAllocation(data)
      setMessage({ type: 'success', text: 'Curriculum Updated Successfully' })
    } catch (e: any) {
      console.error('Failed to save configuration', e)
      setMessage({ type: 'error', text: e.response?.data?.detail || 'Failed to save configuration' })
    } finally {
      setSaving(false)
    }
  }

  // Create new course
  const handleCreateCourse = async () => {
    try {
      const courseData = {
        ...newCourse,
        semester: selectedSemester,
        batch: selectedBatch,
        admin_department_name: userDept,
        target_departments: deptId ? [deptId] : [],
      }

      const res = await api.post('/courses/', courseData)
      const createdCourse = res.data

      // Add to list and auto-check
      setAllCourses((prev) => [...prev, createdCourse])
      setCheckedCourseIds((prev) => new Set(prev).add(createdCourse.id))

      setMessage({ type: 'success', text: 'Course created successfully!' })
      setShowCreateModal(false)
      setNewCourse({
        name: '',
        code: '',
        C: 0,
        L: 0,
        T: 0,
        P: 0,
        S: 0,
        class_types: [],
        category: 'PC',
        semester: selectedSemester,
        admin_department_name: '',
        internal_marks: 40,
        external_marks: 60,
      })
    } catch (e: any) {
      console.error('Failed to create course (full error):', e)
      console.error('Response data:', e.response?.data)
      console.error('Sent payload:', courseData)
      const respData = e.response?.data
      if (respData && typeof respData === 'object') {
        const combined = Object.entries(respData).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ')
        setMessage({ type: 'error', text: combined || 'Failed to create course' })
      } else {
        setMessage({ type: 'error', text: respData?.detail || 'Failed to create course' })
      }
    }
  }

  // Filter courses by semester
  const filteredCourses = useMemo(() => {
    return allCourses.filter((c) => c.semester === selectedSemester)
  }, [allCourses, selectedSemester])

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [message])

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Semester Course Planning</h1>
          <p className="text-gray-600 mt-2">
            Select batch and semester, then choose which courses to activate for your department.
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch Year</label>
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
                onClick={handleLoadSaved}
                disabled={loading}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Load Saved'}
              </button>
            </div>
          </div>
        </div>

        {/* Course List */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Courses for Semester {selectedSemester}</h2>
              <p className="text-sm text-gray-600 mt-1">{checkedCourseIds.size} of {filteredCourses.length} courses selected</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Create New Course
              </button>
              <button
                onClick={handleSaveConfiguration}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-center text-gray-600">Loading courses...</div>
          ) : filteredCourses.length === 0 ? (
            <div className="p-6 text-center text-gray-600">
              No courses found for this semester. Create a new course to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <input
                            type="checkbox"
                            checked={filteredCourses.length > 0 && filteredCourses.every((c) => checkedCourseIds.has(c.id))}
                            onChange={(e) => handleSelectAllVisible(e.target.checked)}
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
                      Credits
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCourses.map((course) => (
                    <tr key={course.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={checkedCourseIds.has(course.id)}
                          onChange={() => handleToggleCourse(course.id)}
                          className="h-4 w-4 text-indigo-600 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {course.code}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{course.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {course.L ?? 0}-{course.T ?? 0}-{course.P ?? 0}-{course.S ?? 0} ({course.C ?? course.c ?? 0})
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {(course.class_types || []).join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Removed fixed save button; primary Save is now in table header */}

        {/* Create Course Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <h3 className="text-xl font-semibold text-gray-900">Create New Course</h3>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Course Code*</label>
                    <input
                      type="text"
                      value={newCourse.code}
                      onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="CS101"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={newCourse.category}
                      onChange={(e) => setNewCourse({ ...newCourse, category: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="PC">PC - Professional Core</option>
                      <option value="PE">PE - Professional Elective</option>
                      <option value="ES">ES - Engineering Science</option>
                      <option value="HS">HS - Humanities & Social</option>
                      <option value="BS">BS - Basic Science</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Course Name*</label>
                  <input
                    type="text"
                    value={newCourse.name}
                    onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Introduction to Computer Science"
                  />
                </div>

                <div className="grid grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">L</label>
                    <input
                      type="number"
                      value={newCourse.L}
                      onChange={(e) => setNewCourse({ ...newCourse, L: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      min="0"
                      step="0.5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">T</label>
                    <input
                      type="number"
                      value={newCourse.T}
                      onChange={(e) => setNewCourse({ ...newCourse, T: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      min="0"
                      step="0.5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">P</label>
                    <input
                      type="number"
                      value={newCourse.P}
                      onChange={(e) => setNewCourse({ ...newCourse, P: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      min="0"
                      step="0.5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">S</label>
                    <input
                      type="number"
                      value={newCourse.S}
                      onChange={(e) => setNewCourse({ ...newCourse, S: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      min="0"
                      step="0.5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">C*</label>
                    <input
                      type="number"
                      value={newCourse.C}
                      onChange={(e) => setNewCourse({ ...newCourse, C: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      min="0"
                      step="0.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Internal Marks</label>
                    <input
                      type="number"
                      value={newCourse.internal_marks}
                      onChange={(e) => setNewCourse({ ...newCourse, internal_marks: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">External Marks</label>
                    <input
                      type="number"
                      value={newCourse.external_marks}
                      onChange={(e) => setNewCourse({ ...newCourse, external_marks: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class Types (comma-separated)</label>
                  <input
                    type="text"
                    value={newCourse.class_types.join(', ')}
                    onChange={(e) =>
                      setNewCourse({
                        ...newCourse,
                        class_types: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Theory, Practical"
                  />
                </div>
              </div>

              <div className="p-6 border-t flex justify-end space-x-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCourse}
                  disabled={!newCourse.code || !newCourse.name || newCourse.C === 0}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Course
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
