import React, { useEffect, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api.js'

interface Staff {
  id: number
  name: string
  faculty_id: string
  department: number
}

interface ClassAdvisor {
  id: number
  department: number
  department_name: string
  batch_year: number
  section: string
  staff: number
  staff_name: string
  created_at: string
}

export default function AssignAdvisors() {
  const { user } = useAuth()
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [assignments, setAssignments] = useState<ClassAdvisor[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    staff: '',
    batch_year: new Date().getFullYear(),
    section: '',
    department: '',
  })

  // Get HOD's department
  const userDept = (user && (user.department || user.department_admin_for || user.admin_department_name)) || ''

  // Load departments
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await api.get('/departments/')
        const data = res.data || []
        const items = Array.isArray(data) ? data : data.results || []
        setDepartments(items)
        
        // Auto-select HOD's department
        if (userDept) {
          const found = items.find(
            (d: any) =>
              String(d.name) === String(userDept) ||
              String(d.id) === String(userDept) ||
              String(d.code) === String(userDept)
          )
          if (found) {
            setFormData(prev => ({ ...prev, department: String(found.id) }))
          }
        }
      } catch (e) {
        console.error('Failed to load departments', e)
      }
    }
    loadDepartments()
  }, [userDept])

  // Load staff and assignments
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        // Fetch staff list
        const staffRes = await api.get('/staff/')
        const staffData = staffRes.data || []
        const staffItems = Array.isArray(staffData) ? staffData : staffData.results || []
        setStaffList(staffItems)

        // Fetch existing class advisors
        const advisorsRes = await api.get('/class-advisors/')
        const advisorsData = advisorsRes.data || []
        const advisorItems = Array.isArray(advisorsData) ? advisorsData : advisorsData.results || []
        setAssignments(advisorItems)
      } catch (e: any) {
        console.error('Failed to load data', e)
        setMessage({ type: 'error', text: 'Failed to load data' })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.staff || !formData.batch_year || !formData.section || !formData.department) {
      setMessage({ type: 'error', text: 'Please fill in all fields' })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        staff_id: parseInt(formData.staff),
        batch_year: parseInt(String(formData.batch_year)),
        section: formData.section.trim().toUpperCase(),
        department: parseInt(formData.department),
      }

      const res = await api.post('/class-advisors/', payload)
      const newAdvisor = res.data

      setAssignments(prev => [...prev, newAdvisor])
      setMessage({ type: 'success', text: 'Advisor assigned successfully!' })
      
      // Reset form (keep department)
      setFormData(prev => ({
        ...prev,
        staff: '',
        section: '',
      }))
    } catch (e: any) {
      console.error('Failed to assign advisor (full):', e)
      console.error('Response data:', e.response?.data)
      const respData = e.response?.data
      let errorMsg = 'Failed to assign advisor'
      if (respData) {
        if (typeof respData === 'object') {
          errorMsg = Object.entries(respData).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ')
        } else {
          errorMsg = String(respData)
        }
      }
      setMessage({ type: 'error', text: errorMsg })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to remove this advisor assignment?')) {
      return
    }

    try {
      await api.delete(`/class-advisors/${id}/`)
      setAssignments(prev => prev.filter(a => a.id !== id))
      setMessage({ type: 'success', text: 'Advisor assignment removed' })
    } catch (e: any) {
      console.error('Failed to delete assignment', e)
      setMessage({ type: 'error', text: 'Failed to remove assignment' })
    }
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
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Assign Class Advisors</h1>
          <p className="text-slate-600 mt-1">Assign staff members as advisors for specific classes</p>
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

        {/* Assignment Form */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">New Assignment</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Department *</label>
                <select
                  value={formData.department}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Staff Member *</label>
                <select
                  value={formData.staff}
                  onChange={(e) => handleInputChange('staff', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                  required
                  disabled={loading}
                >
                  <option value="">Select Staff</option>
                  {staffList.map(staff => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name || staff.faculty_id} ({staff.faculty_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Batch Year *</label>
                <input
                  type="number"
                  min="2000"
                  max="2100"
                  value={formData.batch_year}
                  onChange={(e) => handleInputChange('batch_year', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Section *</label>
                <input
                  type="text"
                  value={formData.section}
                  onChange={(e) => handleInputChange('section', e.target.value)}
                  placeholder="e.g., A, B, C"
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Assigning...' : 'Assign Advisor'}
            </button>
          </form>
        </div>

        {/* Current Assignments */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Current Assignments</h2>
          
          {loading ? (
            <div className="text-center py-8 text-slate-600">Loading assignments...</div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-8 text-slate-600">No advisor assignments yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2">Batch Year</th>
                    <th className="px-3 py-2">Section</th>
                    <th className="px-3 py-2">Advisor</th>
                    <th className="px-3 py-2">Assigned On</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map(assignment => (
                    <tr key={assignment.id} className="border-b hover:bg-slate-50">
                      <td className="px-3 py-2">{assignment.department_name || assignment.department}</td>
                      <td className="px-3 py-2">{assignment.batch_year}</td>
                      <td className="px-3 py-2">{assignment.section}</td>
                      <td className="px-3 py-2">{assignment.staff_name || `Staff ID: ${assignment.staff}`}</td>
                      <td className="px-3 py-2">
                        {new Date(assignment.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => handleDelete(assignment.id)}
                          className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
