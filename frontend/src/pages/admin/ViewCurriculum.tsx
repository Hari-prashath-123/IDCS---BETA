import React, { useEffect, useState, useMemo } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import api from '../../services/api.js'

export default function ViewCurriculum() {
  const [courses, setCourses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [departments, setDepartments] = useState<any[]>([])
  const [semesterFilter, setSemesterFilter] = useState<string | number>('')
  const [deptFilter, setDeptFilter] = useState<string | number>('')
  const [selectedBatch, setSelectedBatch] = useState<string | number>('')
  const [editCourseId, setEditCourseId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<any>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const [cRes, dRes] = await Promise.all([api.get('/courses/'), api.get('/departments/')])
        if (!mounted) return
        // Debug: log raw API responses
        console.log('ViewCurriculum: courses response', cRes.data)
        console.log('ViewCurriculum: departments response', dRes.data)

        const coursesData = Array.isArray(cRes.data) ? cRes.data : (cRes.data.results || [])
        setCourses(coursesData)
        const dItems = Array.isArray(dRes.data) ? dRes.data : (dRes.data.results || [])
        // Keep all departments so we can map IDs to names regardless of type
        setDepartments(dItems)
      } catch (err) {
        console.error('Failed to load curriculum or departments', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const getDeptName = (id: any) => {
    if (!id) return ''
    // If department object is passed, prefer its name
    if (typeof id === 'object') {
      return id.name || id.title || id.display_name || id.department_name || id.name_en || id.label || ''
    }
    const found = departments.find((d: any) => String(d.id) === String(id) || String(d.pk) === String(id))
    return found ? (found.name || found.title || found.display_name || '') : String(id)
  }

  const getDeptNamesFromField = (field: any) => {
    if (!field) return ''
    let items: any[] = []
    if (Array.isArray(field)) {
      items = field
    } else if (typeof field === 'string') {
      // try JSON parse first (e.g. "[1,2]")
      try {
        const parsed = JSON.parse(field)
        if (Array.isArray(parsed)) items = parsed
        else items = String(field).split(',').map(s => s.trim()).filter(Boolean)
      } catch (e) {
        items = String(field).split(',').map(s => s.trim()).filter(Boolean)
      }
    } else if (typeof field === 'number') {
      items = [field]
    } else if (typeof field === 'object') {
      // could be a single department object
      if (field.id || field.name) items = [field]
      else if (Array.isArray(field.items)) items = field.items
    }
    // Debug: if no items found, log the raw field
    if (!items || items.length === 0) console.debug('ViewCurriculum: empty parsed target_departments', field)
    return items.map(i => getDeptName(i)).filter(Boolean).join(', ')
  }

  const fetchFiltered = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (semesterFilter) params.semester = semesterFilter
      if (deptFilter) params.department = deptFilter
      const res = await api.get('/courses/', { params })
      console.log('ViewCurriculum: filtered courses response', res.data, 'params', params)
      const coursesData = Array.isArray(res.data) ? res.data : (res.data.results || [])
      setCourses(coursesData)
    } catch (err) {
      console.error('Failed to fetch filtered courses', err)
    } finally {
      setLoading(false)
    }
  }

  const batchList = useMemo(() => {
    const set = new Set<string>()
    courses.forEach((c: any) => {
      const b = c.batch ?? c.BATCH ?? 2023
      set.add(String(b))
    })
    return Array.from(set).map((s) => Number(s)).sort((a, b) => b - a)
  }, [courses])

  const sidebarItems = [
    { label: 'Dashboard', path: '/admin-dashboard', icon: null },
    { label: 'Manage Students', path: '/admin/students', icon: null },
    { label: 'Manage Staff', path: '/admin/staff', icon: null },
    { label: 'Create', path: '/admin/create', icon: null },
    { label: 'Add Curriculum', path: '/admin/add-curriculum', icon: null },
    { label: 'Curriculum', path: '/admin/curriculum', icon: null },
  ]

  return (
    <DashboardLayout sidebarItems={sidebarItems}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Curriculum</h1>
          <p className="text-slate-600 mt-1">View courses added to the curriculum</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-sm text-slate-600">Semester</label>
              <select value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)} className="w-full px-2 py-1 border rounded">
                <option value="">All</option>
                {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-600">Department</label>
              <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="w-full px-2 py-1 border rounded">
                <option value="">All</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-600">Batch</label>
              <select value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)} className="w-full px-2 py-1 border rounded">
                <option value="">All</option>
                {batchList.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div className="flex space-x-2">
              <button onClick={fetchFiltered} className="px-4 py-2 bg-indigo-600 text-white rounded">Filter</button>
              <button onClick={() => { setSemesterFilter(''); setDeptFilter(''); fetchFiltered() }} className="px-4 py-2 border rounded">Reset</button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          {loading ? (
            <div>Loading...</div>
          ) : (
            <div className="space-y-6">
              {/* Group courses by batch year and render a table per batch (newest first) */}
              {(() => {
                if (!courses || courses.length === 0) {
                  return <div className="text-center text-slate-600">No courses found.</div>
                }
                const groups: Record<string, any[]> = {}
                courses.forEach((c: any) => {
                  const b = c.batch ?? c.BATCH ?? 2023
                  const key = String(b)
                  if (!groups[key]) groups[key] = []
                  groups[key].push(c)
                })
                let batches = Object.keys(groups).map(Number).sort((a, b) => b - a)
                if (selectedBatch) {
                  const asNum = Number(selectedBatch)
                  if (batches.includes(asNum)) batches = [asNum]
                  else batches = []
                }

                return batches.map((batchYear) => {
                  const rows = groups[String(batchYear)] || []
                  return (
                    <div key={batchYear}>
                      <div className="mb-2 flex justify-between items-center">
                        <div className="text-sm font-semibold text-slate-700">Batch: {batchYear}</div>
                        <div className="text-sm text-slate-500">{rows.length} course{rows.length !== 1 ? 's' : ''}</div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full table-auto">
                          <thead>
                            <tr className="text-left border-b">
                              <th className="px-3 py-2">Code</th>
                              <th className="px-3 py-2">Name</th>
                              <th className="px-3 py-2">Sem</th>
                              <th className="px-3 py-2">Admin Dept</th>
                              <th className="px-3 py-2">Target Depts</th>
                              <th className="px-3 py-2">Class Types</th>
                              <th className="px-3 py-2">Category</th>
                              <th className="px-3 py-2">L</th>
                              <th className="px-3 py-2">T</th>
                              <th className="px-3 py-2">P</th>
                              <th className="px-3 py-2">S</th>
                              <th className="px-3 py-2">C</th>
                              <th className="px-3 py-2">Total Marks</th>
                              <th className="px-3 py-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((course: any) => (
                              <tr key={course.id} className="border-b hover:bg-slate-50">
                                {editCourseId === course.id ? (
                                  <>
                                    <td className="px-3 py-2 align-top">
                                      <input className="w-full border rounded px-2 py-1" value={editForm.code || ''} onChange={(e) => setEditForm({...editForm, code: e.target.value})} />
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                      <input className="w-full border rounded px-2 py-1" value={editForm.name || ''} onChange={(e) => setEditForm({...editForm, name: e.target.value})} />
                                    </td>
                                    <td className="px-3 py-2 align-top">{course.semester}</td>
                                    <td className="px-3 py-2 align-top">{course.admin_department_name}</td>
                                    <td className="px-3 py-2 align-top">{getDeptNamesFromField(course.target_departments)}</td>
                                    <td className="px-3 py-2 align-top">{(course.class_types || []).join(', ')}</td>
                                    <td className="px-3 py-2 align-top">
                                      <input className="w-full border rounded px-2 py-1" value={editForm.category || ''} onChange={(e) => setEditForm({...editForm, category: e.target.value})} />
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                      <input className="w-16 border rounded px-2 py-1" value={editForm.L ?? editForm.l ?? ''} onChange={(e) => setEditForm({...editForm, L: e.target.value})} />
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                      <input className="w-16 border rounded px-2 py-1" value={editForm.T ?? editForm.t ?? ''} onChange={(e) => setEditForm({...editForm, T: e.target.value})} />
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                      <input className="w-16 border rounded px-2 py-1" value={editForm.P ?? editForm.p ?? ''} onChange={(e) => setEditForm({...editForm, P: e.target.value})} />
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                      <input className="w-16 border rounded px-2 py-1" value={editForm.S ?? editForm.s ?? ''} onChange={(e) => setEditForm({...editForm, S: e.target.value})} />
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                      <input className="w-20 border rounded px-2 py-1" value={editForm.C ?? editForm.c ?? ''} onChange={(e) => setEditForm({...editForm, C: e.target.value})} />
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                      <div className="flex items-center space-x-2">
                                        <input className="w-20 border rounded px-2 py-1" value={editForm.internal_marks ?? ''} onChange={(e) => setEditForm({...editForm, internal_marks: e.target.value})} />
                                        <span className="text-sm text-slate-500">+</span>
                                        <input className="w-20 border rounded px-2 py-1" value={editForm.external_marks ?? ''} onChange={(e) => setEditForm({...editForm, external_marks: e.target.value})} />
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                      <div className="flex space-x-2">
                                        <button disabled={savingEdit} onClick={async () => {
                                          setSavingEdit(true)
                                          try {
                                            const payload: any = {}
                                            payload.name = editForm.name
                                            payload.code = editForm.code
                                            if (editForm.category !== undefined) payload.category = editForm.category
                                            if (editForm.L !== undefined) payload.L = Number(editForm.L)
                                            else if (editForm.l !== undefined) payload.L = Number(editForm.l)
                                            if (editForm.T !== undefined) payload.T = Number(editForm.T)
                                            else if (editForm.t !== undefined) payload.T = Number(editForm.t)
                                            if (editForm.P !== undefined) payload.P = Number(editForm.P)
                                            else if (editForm.p !== undefined) payload.P = Number(editForm.p)
                                            if (editForm.S !== undefined) payload.S = Number(editForm.S)
                                            else if (editForm.s !== undefined) payload.S = Number(editForm.s)
                                            if (editForm.C !== undefined) payload.C = Number(editForm.C)
                                            else if (editForm.c !== undefined) payload.C = Number(editForm.c)
                                            if (editForm.internal_marks !== undefined) payload.internal_marks = Number(editForm.internal_marks)
                                            if (editForm.external_marks !== undefined) payload.external_marks = Number(editForm.external_marks)
                                            const res = await api.patch(`/courses/${course.id}/`, payload)
                                            setCourses(prev => prev.map(p => p.id === course.id ? {...p, ...res.data} : p))
                                            setEditCourseId(null)
                                            setEditForm(null)
                                          } catch (err) {
                                            console.error('Failed to save course edits', err)
                                            alert('Failed to save changes')
                                          } finally {
                                            setSavingEdit(false)
                                          }
                                        }} className="px-3 py-1 bg-green-600 text-white rounded">{savingEdit ? 'Saving...' : 'Save'}</button>
                                        <button onClick={() => { setEditCourseId(null); setEditForm(null) }} className="px-3 py-1 border rounded">Cancel</button>
                                      </div>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="px-3 py-2 align-top">{course.code}</td>
                                    <td className="px-3 py-2 align-top">{course.name}</td>
                                    <td className="px-3 py-2 align-top">{course.semester}</td>
                                    <td className="px-3 py-2 align-top">{course.admin_department_name}</td>
                                    <td className="px-3 py-2 align-top">{getDeptNamesFromField(course.target_departments)}</td>
                                    <td className="px-3 py-2 align-top">{(course.class_types || []).join(', ')}</td>
                                    <td className="px-3 py-2 align-top">{course.category}</td>
                                    <td className="px-3 py-2 align-top">{course.L ?? course.l ?? ''}</td>
                                    <td className="px-3 py-2 align-top">{course.T ?? course.t ?? ''}</td>
                                    <td className="px-3 py-2 align-top">{course.P ?? course.p ?? ''}</td>
                                    <td className="px-3 py-2 align-top">{course.S ?? course.s ?? ''}</td>
                                    <td className="px-3 py-2 align-top">{course.C ?? course.c ?? ''}</td>
                                    <td className="px-3 py-2 align-top">{(course.internal_marks || 0) + (course.external_marks || 0)}</td>
                                    <td className="px-3 py-2 align-top">
                                      <button onClick={() => { setEditCourseId(course.id); setEditForm({...course}) }} className="px-3 py-1 border rounded">Edit</button>
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
