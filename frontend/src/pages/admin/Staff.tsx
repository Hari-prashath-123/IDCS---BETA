import React, { useEffect, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import api from '../../services/api.js'
import { useAuth } from '../../context/AuthContext'

export default function Staff() {
  const { user } = useAuth()
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deptMap, setDeptMap] = useState<Record<number, string>>({})
  const [deptFilter, setDeptFilter] = useState<number | ''>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<any>({})

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        setLoading(true)
        const res = await api.get('/staff/')
        if (!mounted) return
        const data = res.data || []
        setStaff(Array.isArray(data) ? data : data.results || [])
        try {
            const dres = await api.get('/departments/')
            const dlist = dres.data || []
          // prefer not to rely on list shape — fetch names for any numeric dept ids in staff
          const current = Array.isArray(data) ? data : (data.results || [])
          const missingDeptIds = new Set<number>()
          (current || []).forEach((s: any) => {
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
                // ignore
              }
            }
          }
        } catch (e) {
          // ignore
        }
      } catch (err: any) {
        console.error('Error fetching staff:', err)
        setError(err.message || String(err))
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

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
          items = Object.keys(dlist).map((k) => (dlist as any)[k])
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
        console.log('Staff: loaded deptMap', map)
        setDeptMap(map)
      } catch (e) {
        console.log('Staff: failed to load departments', e)
      }
    }
    loadDepts()
    return () => { mounted = false }
  }, [])

  const sidebarItems = [
    { label: 'Dashboard', path: '/admin-dashboard', icon: null },
    { label: 'Create', path: '/admin/create', icon: null },
  ]

  return (
    <DashboardLayout sidebarItems={sidebarItems}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold">Manage Staff</h1>
          <p className="text-slate-600 mt-1">List of registered staff</p>
        </div>

        <div className="bg-white rounded p-3 mb-4 flex items-end space-x-4">
          <div>
            <label className="block text-sm text-slate-600">Department</label>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value ? Number(e.target.value) : '')} className="px-2 py-1 border rounded">
              <option value="">All</option>
              {Object.entries(deptMap).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm text-slate-600">Search</label>
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search name, email, or faculty id" className="w-full px-2 py-1 border rounded" />
          </div>
        </div>

        {loading && <div className="p-4 bg-white rounded">Loading staff...</div>}
        {error && <div className="p-4 bg-red-50 text-red-700 rounded">{error}</div>}

        {!loading && !error && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-2">Name</th>
                  <th className="py-2">Faculty ID</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Designation</th>
                  <th className="py-2">Department</th>
                </tr>
              </thead>
              <tbody>
                {staff
                  .filter((s: any) => {
                    if (deptFilter) {
                      const depVal = typeof s.department === 'object' ? s.department?.id : s.department
                      if (Number(depVal) !== Number(deptFilter)) return false
                    }
                    if (searchQuery) {
                      const q = searchQuery.toLowerCase()
                      const name = (s.name || '').toString().toLowerCase()
                      const email = (s.email || '').toString().toLowerCase()
                      const fid = (s.faculty_id || '').toString().toLowerCase()
                      if (!(name.includes(q) || email.includes(q) || fid.includes(q))) return false
                    }
                    return true
                  })
                  .map((s: any) => {
                  const isEditing = editingId === String(s.id)
                  const depName = typeof s.department === 'object' ? s.department?.name : (s.department && deptMap[Number(s.department)]) ? deptMap[Number(s.department)] : s.department
                  return (
                  <tr key={s.id} className="border-t">
                    <td className="py-2">{isEditing ? <input className="px-2 py-1 border rounded" value={editValues.name||''} onChange={(e)=>setEditValues((p:any)=>({...p, name: e.target.value}))} /> : (s.name || s.user || s.email)}</td>
                    <td className="py-2">{isEditing ? <input className="px-2 py-1 border rounded" value={editValues.faculty_id||''} onChange={(e)=>setEditValues((p:any)=>({...p, faculty_id: e.target.value}))} /> : s.faculty_id}</td>
                    <td className="py-2">{isEditing ? <input className="px-2 py-1 border rounded" value={editValues.email||''} onChange={(e)=>setEditValues((p:any)=>({...p, email: e.target.value}))} /> : (s.email || s.user)}</td>
                    <td className="py-2">{isEditing ? <input className="px-2 py-1 border rounded" value={editValues.designation||''} onChange={(e)=>setEditValues((p:any)=>({...p, designation: e.target.value}))} /> : s.designation}</td>
                    <td className="py-2">{isEditing ? (
                        <select className="px-2 py-1 border rounded" value={editValues.department_name || depName || ''} onChange={(e)=>setEditValues((p:any)=>({...p, department_name: e.target.value}))}>
                          <option value="">— Select —</option>
                          {Object.values(deptMap).map((dn) => <option key={dn} value={dn}>{dn}</option>)}
                        </select>
                      ) : depName}
                    </td>
                    <td className="py-2">
                      {isEditing ? (
                        <div className="flex space-x-2">
                          <button className="py-1 px-2 bg-indigo-600 text-white rounded" onClick={async ()=>{
                            try{
                              const payload: any = { name: editValues.name, faculty_id: editValues.faculty_id, email: editValues.email, designation: editValues.designation };
                              if (editValues.department_name) {
                                const found = Object.entries(deptMap).find(([,n])=>n===editValues.department_name)
                                if (found) payload.department = Number(found[0])
                                else payload.department = editValues.department_name
                              }
                              const r = await api.patch(`/staff/${s.id}/`, payload)
                              setStaff((prev)=> prev.map((x:any)=> x.id===s.id ? r.data : x))
                              setEditingId(null)
                            }catch(err){ console.error('Failed to save staff', err); alert('Save failed') }
                          }}>Save</button>
                          <button className="py-1 px-2 border rounded" onClick={()=>{ setEditingId(null); setEditValues({}) }}>Cancel</button>
                        </div>
                      ) : (
                        <div className="flex space-x-2">
                          <button className="py-1 px-2 bg-yellow-500 text-white rounded" onClick={()=>{ setEditingId(String(s.id)); setEditValues({ name: s.name||'', faculty_id: s.faculty_id||'', email: s.email||'', designation: s.designation||'', department_name: depName }) }}>Edit</button>
                          <button className="py-1 px-2 bg-red-600 text-white rounded" onClick={async ()=>{
                            if (!confirm('Delete this staff member?')) return;
                            try{ await api.delete(`/staff/${s.id}/`); setStaff((prev)=> prev.filter((x:any)=> x.id !== s.id)) }catch(err){ console.error('Delete failed', err); alert('Delete failed') }
                          }}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                  )})}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
