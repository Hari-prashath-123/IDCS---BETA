import React, { useEffect, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import api from '../../services/api.js'

export default function AddCurriculum() {
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  const [formData, setFormData] = useState({
    semester: '',
    admin_department_name: '',
    name: '',
    code: '',
    batch: '2023',
    L: '',
    T: '',
    P: '',
    S: '',
    C: '',
    internal_marks: '',
    external_marks: '',
  })

  const [selectedDepts, setSelectedDepts] = useState<string[]>([])
  const [allDepts, setAllDepts] = useState(false)
  
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])
  const [otherClass, setOtherClass] = useState('')
  
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [otherCategory, setOtherCategory] = useState('')

  const classOptions = ['Theory', 'TCPR', 'TCPL', 'Practical', 'Project', 'Audit', 'Others']
  const categoryOptions = ['BS', 'ES', 'PC', 'HS', 'EM', 'OE', 'MG', 'PE', 'Others']

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await api.get('/departments/')
        const data = res.data || []
        const items = Array.isArray(data) ? data : (data.results || [])
        // Filter for top-level ACADEMIC departments (parentless) if present, otherwise fall back to all
        const academic = items.filter((d: any) => d && (d.type === 'ACADEMIC' || d.type === 'academic') && !d.parent)
        const deptsToSet = (academic && academic.length > 0) ? academic : items
        setDepartments(deptsToSet)
        console.log('AddCurriculum: fetched departments', items, 'using', (academic && academic.length > 0) ? 'ACADEMIC (top-level)' : 'ALL')
      } catch (err) {
        console.error('Error fetching departments:', err)
        showToast('error', 'Failed to load departments')
      } finally {
        setLoading(false)
      }
    }
    fetchDepartments()
  }, [])

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 5000)
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleAllDeptsChange = async (checked: boolean) => {
    setAllDepts(checked)
    if (checked) {
      // if departments not loaded yet, fetch them now
      let depts = departments
      if (!depts || depts.length === 0) {
        try {
          const res = await api.get('/departments/')
          const data = res.data || []
          const items = Array.isArray(data) ? data : (data.results || [])
          // keep the same filter as initial load (ACADEMIC)
          depts = items.filter((d: any) => d.type === 'ACADEMIC')
          setDepartments(depts)
        } catch (err) {
          console.error('AddCurriculum: failed to fetch departments for ALL selection', err)
          showToast('error', 'Failed to load departments')
          setSelectedDepts([])
          return
        }
      }
      const ids = depts.map(d => String(d.id))
      setSelectedDepts(ids)
      console.log('AddCurriculum: ALL selected, selectedDepts ->', ids)
    } else {
      setSelectedDepts([])
      console.log('AddCurriculum: ALL deselected')
    }
  }

  const handleDeptChange = (deptId: string, checked: boolean) => {
    if (checked) {
      const newSelected = [...selectedDepts, deptId]
      setSelectedDepts(newSelected)
      // Check if all are selected
      if (newSelected.length === departments.length) {
        setAllDepts(true)
      }
      console.log('AddCurriculum: dept checked', deptId, 'selectedDepts ->', newSelected)
    } else {
      setSelectedDepts(selectedDepts.filter(id => id !== deptId))
      setAllDepts(false)
      console.log('AddCurriculum: dept unchecked', deptId, 'selectedDepts ->', selectedDepts.filter(id => id !== deptId))
    }
  }

  const handleClassChange = (className: string, checked: boolean) => {
    if (checked) {
      setSelectedClasses([...selectedClasses, className])
    } else {
      setSelectedClasses(selectedClasses.filter(c => c !== className))
      if (className === 'Others') {
        setOtherClass('')
      }
    }
  }

  const handleCategoryChange = (category: string, checked: boolean) => {
    if (checked) {
      setSelectedCategories([...selectedCategories, category])
    } else {
      setSelectedCategories(selectedCategories.filter(c => c !== category))
      if (category === 'Others') {
        setOtherCategory('')
      }
    }
  }

  const getTotalMarks = () => {
    const internal = parseInt(formData.internal_marks) || 0
    const external = parseInt(formData.external_marks) || 0
    return internal + external
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (selectedDepts.length === 0) {
      showToast('error', 'Please select at least one target department')
      return
    }

    if (!formData.semester || !formData.admin_department_name || !formData.name || !formData.code || !(formData as any).batch) {
      showToast('error', 'Please fill in all required fields')
      return
    }

    if (selectedClasses.length === 0) {
      showToast('error', 'Please select at least one class type')
      return
    }

    if (selectedCategories.length === 0) {
      showToast('error', 'Please select at least one category')
      return
    }

    setSubmitting(true)

    try {
      // Prepare class_types array (ensure 'Others' replaced by typed value)
      let classTypes = selectedClasses.filter(c => c !== 'Others')
      if (selectedClasses.includes('Others') && otherClass.trim()) {
        classTypes.push(otherClass.trim())
      }

      // Prepare category (replace 'Others' with typed value; send as comma-separated string)
      const explicitCats = selectedCategories.filter(c => c !== 'Others')
      if (selectedCategories.includes('Others') && otherCategory.trim()) {
        explicitCats.push(otherCategory.trim())
      }
      const category = explicitCats.filter(Boolean).join(',')

      const payload = {
        semester: parseInt(formData.semester),
        admin_department_name: formData.admin_department_name,
        name: formData.name,
        code: formData.code,
        // Ensure we never send the literal 'ALL' — send numeric IDs only
        target_departments: selectedDepts.filter(id => id !== 'ALL').map(id => parseInt(id)),
        class_types: classTypes,
        category: category,
        L: parseFloat(formData.L) || 0,
        T: parseFloat(formData.T) || 0,
        P: parseFloat(formData.P) || 0,
        S: parseFloat(formData.S) || 0,
        C: parseFloat(formData.C) || 0,
        batch: parseInt((formData as any).batch) || 2023,
        internal_marks: parseInt(formData.internal_marks) || 0,
        external_marks: parseInt(formData.external_marks) || 0,
      }

      console.log('AddCurriculum: submit payload', payload)

      await api.post('/courses/', payload)
      showToast('success', 'Course added successfully!')
      
      // Reset form
      setFormData({
        semester: '',
        admin_department_name: '',
        name: '',
        code: '',
        batch: '2023',
        L: '',
        T: '',
        P: '',
        S: '',
        C: '',
        internal_marks: '',
        external_marks: '',
      })
      setSelectedDepts([])
      setAllDepts(false)
      setSelectedClasses([])
      setOtherClass('')
      setSelectedCategories([])
      setOtherCategory('')
      
    } catch (err: any) {
      console.error('Error adding course:', err)
      const errorMsg = err.response?.data?.detail || err.response?.data?.error || err.message || 'Failed to add course'
      showToast('error', errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  const sidebarItems = [
    { label: 'Dashboard', path: '/admin-dashboard', icon: null },
    { label: 'Manage Students', path: '/admin/students', icon: null },
    { label: 'Manage Staff', path: '/admin/staff', icon: null },
    { label: 'Create', path: '/admin/create', icon: null },
    { label: 'Add Curriculum', path: '/admin/add-curriculum', icon: null },
  ]

  return (
    <DashboardLayout sidebarItems={sidebarItems}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Add Course to Curriculum</h1>
          <p className="text-slate-600 mt-1">Create a new course entry</p>
        </div>

        {/* Toast Notification */}
        {toast && (
          <div className={`mb-4 p-4 rounded ${toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {toast.message}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border p-6">Loading departments...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Semester *</label>
                  <select
                    value={formData.semester}
                    onChange={(e) => handleInputChange('semester', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Select Semester</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                      <option key={sem} value={sem}>Semester {sem}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Admin Department *</label>
                  <input
                    type="text"
                    value={formData.admin_department_name}
                    onChange={(e) => handleInputChange('admin_department_name', e.target.value)}
                    placeholder="e.g., Computer Science"
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Course Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., Data Structures"
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Course Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => handleInputChange('code', e.target.value)}
                    placeholder="e.g., CS201"
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Batch (Year) *</label>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={(formData as any).batch}
                    onChange={(e) => handleInputChange('batch', e.target.value)}
                    placeholder="e.g., 2023"
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Target Departments Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Target Departments *</h2>
              <p className="text-sm text-slate-600 mb-3">Select which departments study this course</p>
              
              <div className="space-y-2">
                <label className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded">
                  <input
                    type="checkbox"
                    checked={allDepts}
                    onChange={(e) => handleAllDeptsChange(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="font-medium text-slate-700">ALL Departments</span>
                </label>
                
                <div className="border-t pt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {departments.map(dept => (
                    <label key={dept.id} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded">
                      <input
                        type="checkbox"
                        checked={selectedDepts.includes(String(dept.id))}
                        onChange={(e) => handleDeptChange(String(dept.id), e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span className="text-slate-700">{dept.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Class Types Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Class Type *</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {classOptions.map(cls => (
                  <label key={cls} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded">
                    <input
                      type="checkbox"
                      checked={selectedClasses.includes(cls)}
                      onChange={(e) => handleClassChange(cls, e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <span className="text-slate-700">{cls}</span>
                  </label>
                ))}
              </div>
              
              {selectedClasses.includes('Others') && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={otherClass}
                    onChange={(e) => setOtherClass(e.target.value)}
                    placeholder="Specify other class type"
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* Category Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Category (CAT) *</h2>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {categoryOptions.map(cat => (
                  <label key={cat} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat)}
                      onChange={(e) => handleCategoryChange(cat, e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <span className="text-slate-700">{cat}</span>
                  </label>
                ))}
              </div>
              
              {selectedCategories.includes('Others') && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={otherCategory}
                    onChange={(e) => setOtherCategory(e.target.value)}
                    placeholder="Specify other category"
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* Credits Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Credits (L-T-P-S-C)</h2>
              <div className="grid grid-cols-5 gap-3">
                {['L', 'T', 'P', 'S', 'C'].map(credit => (
                  <div key={credit}>
                    <label className="block text-sm font-medium text-slate-700 mb-1 text-center">{credit}</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={(formData as any)[credit]}
                      onChange={(e) => handleInputChange(credit, e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-center focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Marks Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Marks Distribution</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Internal Marks</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.internal_marks}
                    onChange={(e) => handleInputChange('internal_marks', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">External Marks</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.external_marks}
                    onChange={(e) => handleInputChange('external_marks', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Total Marks</label>
                  <input
                    type="number"
                    value={getTotalMarks()}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-300 rounded bg-slate-100 text-slate-700 font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="px-6 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Adding Course...' : 'Add Course'}
              </button>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  )
}
