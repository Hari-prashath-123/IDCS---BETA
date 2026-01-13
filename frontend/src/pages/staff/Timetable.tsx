import React, { useEffect, useState, useMemo } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import api, { getActiveCourses } from '../../services/api.js'

interface ClassAssignment {
  id: number
  department: number
  department_name: string
  batch_year: number
  section: string
  staff: number
  staff_name: string
}

interface Course {
  id: number
  code: string
  name: string
  semester: number
}

interface TimetableEntry {
  id?: number
  department: number
  batch_year: number
  section: string
  semester: number
  day: string
  period: number
  subject: number | null
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]

export default function StaffTimetable() {
  const { user } = useAuth()
  const [myClasses, setMyClasses] = useState<ClassAssignment[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [selectedClassData, setSelectedClassData] = useState<ClassAssignment | null>(null)
  const [semester, setSemester] = useState<number>(1)
  const [courses, setCourses] = useState<Course[]>([])
  const [timetableData, setTimetableData] = useState<Record<string, number | null>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ day: string; period: number } | null>(null)

  // Load classes where current user is advisor
  useEffect(() => {
    const loadMyClasses = async () => {
      setLoading(true)
      try {
        const res = await api.get('/class-advisors/my-classes/')
        const classes = res.data || []
        setMyClasses(classes)
        
        if (classes.length === 0) {
          setMessage({ type: 'error', text: 'You are not assigned as a Class Advisor' })
        }
      } catch (e: any) {
        console.error('Failed to load classes', e)
        setMessage({ type: 'error', text: 'Failed to load your class assignments' })
      } finally {
        setLoading(false)
      }
    }

    loadMyClasses()
  }, [])

  // When a class is selected, load timetable and courses
  useEffect(() => {
    if (!selectedClass) {
      setSelectedClassData(null)
      return
    }

    const classData = myClasses.find(c => `${c.department}-${c.batch_year}-${c.section}` === selectedClass)
    if (!classData) return

    setSelectedClassData(classData)
    loadTimetableAndCourses(classData)
  }, [selectedClass, semester])

  const loadTimetableAndCourses = async (classData: ClassAssignment) => {
    setLoading(true)
    try {
      // Load existing timetable
      const timetableRes = await api.get('/timetables/', {
        params: {
          department: classData.department,
          batch_year: classData.batch_year,
          section: classData.section,
          semester: semester,
        }
      })

      const entries = timetableRes.data || []
      const items = Array.isArray(entries) ? entries : entries.results || []
      
      // Convert to grid format
      const gridData: Record<string, number | null> = {}
      items.forEach((entry: TimetableEntry) => {
        const key = `${entry.day}_${entry.period}`
        gridData[key] = entry.subject
      })
      setTimetableData(gridData)

      // Load active courses for this class
      try {
        const activeCourses = await getActiveCourses(classData.department, classData.batch_year, semester)
        setCourses(activeCourses)
        
        if (activeCourses.length === 0) {
          setMessage({ 
            type: 'error', 
            text: 'No active courses defined for this semester. HOD must configure semester courses first.' 
          })
        }
      } catch (e) {
        console.error('Failed to load active courses', e)
        // Fallback: load all courses
        const allCoursesRes = await api.get('/courses/')
        const allData = allCoursesRes.data || []
        const allItems = Array.isArray(allData) ? allData : allData.results || []
        setCourses(allItems.filter((c: Course) => c.semester === semester))
      }
    } catch (e: any) {
      console.error('Failed to load timetable data', e)
      setMessage({ type: 'error', text: 'Failed to load timetable data' })
    } finally {
      setLoading(false)
    }
  }

  const handleSlotClick = (day: string, period: number) => {
    setSelectedSlot({ day, period })
    setShowSubjectModal(true)
  }

  const handleSubjectSelect = (subjectId: number | null) => {
    if (!selectedSlot) return

    const key = `${selectedSlot.day}_${selectedSlot.period}`
    setTimetableData(prev => ({
      ...prev,
      [key]: subjectId
    }))

    setShowSubjectModal(false)
    setSelectedSlot(null)
  }

  const handleSave = async () => {
    if (!selectedClassData) {
      setMessage({ type: 'error', text: 'No class selected' })
      return
    }

    setSaving(true)
    try {
      // Convert grid data to API format
      const slots: any[] = []
      
      DAYS.forEach(day => {
        PERIODS.forEach(period => {
          const key = `${day}_${period}`
          const subjectId = timetableData[key]
          
          slots.push({
            department: selectedClassData.department,
            batch_year: selectedClassData.batch_year,
            section: selectedClassData.section,
            semester: semester,
            day: day,
            period: period,
            subject: subjectId || null
          })
        })
      })

      // Bulk create/update
      await api.post('/timetables/', { slots })
      
      setMessage({ type: 'success', text: 'Timetable saved successfully!' })
    } catch (e: any) {
      console.error('Failed to save timetable', e)
      setMessage({ type: 'error', text: e.response?.data?.detail || 'Failed to save timetable' })
    } finally {
      setSaving(false)
    }
  }

  const getSubjectForSlot = (day: string, period: number): Course | null => {
    const key = `${day}_${period}`
    const subjectId = timetableData[key]
    if (!subjectId) return null
    return courses.find(c => c.id === subjectId) || null
  }

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [message])

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Manage Class Timetable</h1>
          <p className="text-slate-600 mt-1">Create and edit timetable for your assigned classes</p>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-4 p-4 rounded ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {loading && myClasses.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading your class assignments...</p>
          </div>
        ) : myClasses.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">Not Assigned as Class Advisor</h2>
            <p className="text-slate-600">You are not currently assigned as a class advisor. Contact your HOD for assignment.</p>
          </div>
        ) : (
          <>
            {/* Class Selection */}
            <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Select Class to Manage *</label>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Select Class --</option>
                    {myClasses.map(cls => (
                      <option 
                        key={cls.id} 
                        value={`${cls.department}-${cls.batch_year}-${cls.section}`}
                      >
                        {cls.department_name} - Batch {cls.batch_year} - Section {cls.section}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Semester *</label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                    disabled={!selectedClass}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                      <option key={sem} value={sem}>Semester {sem}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleSave}
                    disabled={!selectedClass || saving || loading}
                    className="w-full px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Save Timetable'}
                  </button>
                </div>
              </div>

              {selectedClassData && (
                <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Managing:</strong> {selectedClassData.department_name} - Batch {selectedClassData.batch_year} - Section {selectedClassData.section} - Semester {semester}
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    {courses.length} course(s) available for this semester
                  </p>
                </div>
              )}
            </div>

            {/* Timetable Grid */}
            {selectedClass && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-lg font-semibold mb-4">Weekly Timetable</h2>
                
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-2 text-slate-600">Loading timetable...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="border border-slate-300 bg-slate-100 px-3 py-2 text-left font-semibold">
                            Day / Period
                          </th>
                          {PERIODS.map(period => (
                            <th key={period} className="border border-slate-300 bg-slate-100 px-3 py-2 text-center font-semibold">
                              Period {period}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {DAYS.map(day => (
                          <tr key={day}>
                            <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-semibold">
                              {day}
                            </td>
                            {PERIODS.map(period => {
                              const subject = getSubjectForSlot(day, period)
                              return (
                                <td
                                  key={`${day}-${period}`}
                                  className="border border-slate-300 px-2 py-2 text-center cursor-pointer hover:bg-indigo-50 transition"
                                  onClick={() => handleSlotClick(day, period)}
                                >
                                  {subject ? (
                                    <div className="text-sm">
                                      <div className="font-semibold text-indigo-700">{subject.code}</div>
                                      <div className="text-xs text-slate-600 truncate">{subject.name}</div>
                                    </div>
                                  ) : (
                                    <div className="text-slate-400 text-sm">Free</div>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-4 text-sm text-slate-600">
                  <p>💡 <strong>Tip:</strong> Click on any cell to assign or change the subject for that time slot.</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Subject Selection Modal */}
        {showSubjectModal && selectedSlot && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-semibold">
                  Select Subject - {selectedSlot.day} Period {selectedSlot.period}
                </h3>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
                <div className="space-y-2">
                  <button
                    onClick={() => handleSubjectSelect(null)}
                    className="w-full px-4 py-3 text-left border border-slate-300 rounded hover:bg-slate-50 transition"
                  >
                    <div className="font-semibold text-slate-700">Free Period</div>
                    <div className="text-xs text-slate-500">No subject assigned</div>
                  </button>
                  
                  {courses.length === 0 ? (
                    <div className="text-center py-4 text-slate-600">
                      No courses available for this semester
                    </div>
                  ) : (
                    courses.map(course => (
                      <button
                        key={course.id}
                        onClick={() => handleSubjectSelect(course.id)}
                        className="w-full px-4 py-3 text-left border border-slate-300 rounded hover:bg-indigo-50 hover:border-indigo-400 transition"
                      >
                        <div className="font-semibold text-indigo-700">{course.code}</div>
                        <div className="text-sm text-slate-700">{course.name}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
              
              <div className="px-6 py-4 border-t bg-slate-50">
                <button
                  onClick={() => {
                    setShowSubjectModal(false)
                    setSelectedSlot(null)
                  }}
                  className="w-full px-4 py-2 border border-slate-300 rounded hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
