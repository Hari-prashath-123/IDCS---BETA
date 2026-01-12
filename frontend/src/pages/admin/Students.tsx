import React, { useEffect, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'

export default function Students() {
  const { user } = useAuth()
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deptMap, setDeptMap] = useState<Record<number, string>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<any>({})
  const [yearFilter, setYearFilter] = useState<number | ''>('')
  const [deptFilter, setDeptFilter] = useState<number | ''>('')
  const [sectionFilter, setSectionFilter] = useState<string | ''>('')
  const [searchQuery, setSearchQuery] = useState<string>('')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        setLoading(true)
        const res = await api.get('/students/')
        if (!mounted) return
        const data = res.data || []
        setStudents(Array.isArray(data) ? data : data.results || [])
        console.log('Students: loaded', Array.isArray(data) ? (data[0] || null) : (data.results ? data.results[0] : null))
        // After loading students, fetch department names for any numeric department IDs
        const missingDeptIds = new Set<number>()
        const dataArr = Array.isArray(data) ? data : (data.results || [])
        (dataArr || []).forEach((s: any) => {
          const dep = s?.department
          if (dep && typeof dep !== 'object') {
            const idNum = Number(dep)
            if (!Number.isNaN(idNum) && !deptMap[idNum]) missingDeptIds.add(idNum)
          }
        })
        if (missingDeptIds.size > 0) {
          for (const id of Array.from(missingDeptIds)) {
            try {
              const r = await api.get(`/departments/${id}/`)
              const d = r.data
              if (d && d.id) {
                setDeptMap((prev) => ({ ...prev, [Number(d.id)]: d.name }))
              }
            } catch (e) {
              // ignore individual failures
            }
          }
        }
      } catch (err: any) {
        console.error('Error fetching students:', err)
        setError(err.message || String(err))
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  // Ensure departments map is loaded independently so IDs can be resolved to names
  useEffect(() => {
    let mounted = true
    const loadDepts = async () => {
      try {
        const dres = await api.get('/departments/')
        if (!mounted) return
        const dlist = dres.data || []
        let items: any[] = []
        if (Array.isArray(dlist)) items = dlist
        else if (dlist && dlist.results && Array.isArray(dlist.results)) items = dlist.results
        else if (dlist && typeof dlist === 'object') {
          for (const k in dlist) {
            if (Object.prototype.hasOwnProperty.call(dlist, k)) items.push((dlist as any)[k])
          }
        } else items = []
        const map: Record<number, string> = {}
        if (Array.isArray(items)) {
          items.forEach((d: any) => { if (d && d.id) map[Number(d.id)] = d.name })
        } else if (items && typeof items === 'object') {
          for (const k in items) {
            if (Object.prototype.hasOwnProperty.call(items, k)) {
              const d = (items as any)[k]
              if (d && d.id) map[Number(d.id)] = d.name
            }
          }
        }
        console.log('Students: loaded deptMap', map)
        setDeptMap(map)
      } catch (e) {
        console.log('Students: failed to load departments', e)
      }
    }
    loadDepts()
    return () => { mounted = false }
  }, [])

  const resolveField = (s: any, field: string) => {
    if (!s) return ''
    if (s[field]) return s[field]
    // common nested shapes
    const candidates = [
      s?.profile,
      s?.student,
      s?.studentprofile,
      s?.user,
      s?.user?.profile,
      s?.user?.studentprofile,
      s?.data,
    ]
    for (const c of candidates) {
      if (c && c[field]) return c[field]
    }
    return ''
  }

  const sidebarItems = [
    { label: 'Dashboard', path: '/admin-dashboard', icon: null },
    { label: 'Create', path: '/admin/create', icon: null },
  ]

  return (
    <DashboardLayout sidebarItems={sidebarItems}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold">Manage Students</h1>
          <p className="text-slate-600 mt-1">List of registered students</p>
        </div>

        <div className="bg-white rounded p-3 mb-4 flex flex-col md:flex-row md:items-end md:space-x-4">
          <div className="mb-2 md:mb-0">
            <label className="block text-sm text-slate-600">Year</label>
            <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value ? Number(e.target.value) : '')} className="px-2 py-1 border rounded">
              <option value="">All</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>
          <div className="mb-2 md:mb-0">
            <label className="block text-sm text-slate-600">Department</label>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value ? Number(e.target.value) : '')} className="px-2 py-1 border rounded">
              <option value="">All</option>
              {Object.entries(deptMap).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
          <div className="mb-2 md:mb-0">
            <label className="block text-sm text-slate-600">Section</label>
            <input value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value.toUpperCase())} placeholder="A" className="px-2 py-1 border rounded w-20" />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-slate-600">Search</label>
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search name, reg_no or roll_no" className="w-full px-2 py-1 border rounded" />
          </div>
        </div>

        {loading && <div className="p-4 bg-white rounded">Loading students...</div>}
        {error && <div className="p-4 bg-red-50 text-red-700 rounded">{error}</div>}

        {!loading && !error && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-2">Name</th>
                  <th className="py-2">Reg No</th>
                  <th className="py-2">Roll No</th>
                  <th className="py-2">Year</th>
                  <th className="py-2">Section</th>
                  <th className="py-2">Department</th>
                </tr>
              </thead>
              <tbody>
                {students
                  .filter((s: any) => {
                    // year filter
                    const yearVal = resolveField(s, 'year') || s.year
                    if (yearFilter && Number(yearVal) !== Number(yearFilter)) return false
                    // dept filter: s.department may be id or object
                    if (deptFilter) {
                      const depVal = typeof s.department === 'object' ? s.department?.id : s.department
                      if (Number(depVal) !== Number(deptFilter)) return false
                    }
                    // section filter
                    const secVal = resolveField(s, 'section') || s.section
                    if (sectionFilter && (secVal || '').toString().toUpperCase() !== sectionFilter) return false
                    // search
                    if (searchQuery) {
                      const q = searchQuery.toLowerCase()
                      const name = (resolveField(s, 'name') || s.name || '').toString().toLowerCase()
                      const reg = (resolveField(s, 'reg_no') || s.reg_no || '').toString().toLowerCase()
                      const roll = (resolveField(s, 'roll_no') || s.roll_no || '').toString().toLowerCase()
                      if (!(name.includes(q) || reg.includes(q) || roll.includes(q))) return false
                    }
                    return true
                  })
                  .map((s: any) => {
                    const isEditing = editingId === String(s.id)
                    const depName = typeof s.department === 'object' ? s.department?.name : (s.department && deptMap[Number(s.department)]) ? deptMap[Number(s.department)] : s.department
                    return (
                      <tr key={s.id} className="border-t">
                        <td className="py-2">
                          {isEditing ? (
                            <input className="w-full px-2 py-1 border rounded" value={editValues.name || ''} onChange={(e) => setEditValues((p:any)=>({ ...p, name: e.target.value }))} />
                          ) : (
                            s.name || s.user || s.email
                          )}
                        </td>
                        <td className="py-2">{isEditing ? <input className="px-2 py-1 border rounded w-32" value={editValues.reg_no || ''} onChange={(e)=>setEditValues((p:any)=>({...p, reg_no: e.target.value}))} /> : (resolveField(s, 'reg_no') || s.reg_no)}</td>
                        <td className="py-2">{isEditing ? <input className="px-2 py-1 border rounded w-24" value={editValues.roll_no || ''} onChange={(e)=>setEditValues((p:any)=>({...p, roll_no: e.target.value}))} /> : (resolveField(s, 'roll_no') || s.roll_no)}</td>
                        <td className="py-2">{isEditing ? <input className="px-2 py-1 border rounded w-20" value={editValues.year || ''} onChange={(e)=>setEditValues((p:any)=>({...p, year: e.target.value}))} /> : (resolveField(s, 'year') || s.year)}</td>
                        <td className="py-2">{isEditing ? <input className="px-2 py-1 border rounded w-20" value={editValues.section || ''} onChange={(e)=>setEditValues((p:any)=>({...p, section: e.target.value}))} /> : (resolveField(s, 'section') || s.section)}</td>
                        <td className="py-2">{isEditing ? (
                          <select className="px-2 py-1 border rounded" value={editValues.department_name || depName || ''} onChange={(e)=>setEditValues((p:any)=>({...p, department_name: e.target.value}))}>
                            <option value="">— Select —</option>
                            {Object.values(deptMap).map((dn) => <option key={dn} value={dn}>{dn}</option>)}
                          </select>
                        ) : depName}</td>
                        <td className="py-2">
                          {isEditing ? (
                            <div className="flex space-x-2">
                              <button className="py-1 px-2 bg-indigo-600 text-white rounded" onClick={async ()=>{
                                // save
                                try{
                                  const payload: any = { name: editValues.name, reg_no: editValues.reg_no, roll_no: editValues.roll_no, year: editValues.year, section: editValues.section };
                                  // map department name back to id when possible
                                  if (editValues.department_name) {
                                    const found = Object.entries(deptMap).find(([,n])=>n===editValues.department_name)
                                    if (found) payload.department = Number(found[0])
                                    else payload.department = editValues.department_name
                                  }
                                  const r = await api.patch(`/students/${s.id}/`, payload)
                                  // optimistic update
                                  setStudents((prev)=> prev.map((x:any)=> x.id===s.id ? r.data : x))
                                  setEditingId(null)
                                }catch(err){ console.error('Failed to save student', err); alert('Save failed') }
                              }}>Save</button>
                              <button className="py-1 px-2 border rounded" onClick={()=>{ setEditingId(null); setEditValues({}); }}>Cancel</button>
                            </div>
                          ) : (
                            <div className="flex space-x-2">
                              <button className="py-1 px-2 bg-yellow-500 text-white rounded" onClick={()=>{ setEditingId(String(s.id)); setEditValues({ name: s.name || resolveField(s,'name') || '', reg_no: resolveField(s,'reg_no') || s.reg_no || '', roll_no: resolveField(s,'roll_no') || s.roll_no || '', year: resolveField(s,'year') || s.year || '', section: resolveField(s,'section') || s.section || '', department_name: depName }) }}>Edit</button>
                              <button className="py-1 px-2 bg-red-600 text-white rounded" onClick={async ()=>{
                                if (!confirm('Delete this student?')) return;
                                try{
                                  await api.delete(`/students/${s.id}/`)
                                  setStudents((prev)=> prev.filter((x:any)=> x.id !== s.id))
                                }catch(err){ console.error('Delete failed', err); alert('Delete failed') }
                              }}>Delete</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
