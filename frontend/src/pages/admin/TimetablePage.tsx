import React, { useEffect, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'

export default function TimetablePage() {
	const { user } = useAuth()
	const [departments, setDepartments] = useState<any[]>([])
	const [departmentId, setDepartmentId] = useState<number | null>(null)
	const [studentYear, setStudentYear] = useState<number>(1)
	const [semester, setSemester] = useState<number>(1)
	const [subjects, setSubjects] = useState<any[]>([])
	const [loading, setLoading] = useState(false)

	const userDept = (user && (user.department || user.department_admin_for || user.admin_department_name)) || ''

	useEffect(() => {
		const loadDeps = async () => {
			try {
				const res = await api.get('/departments/')
				const data = res.data || []
				const items = Array.isArray(data) ? data : (data.results || [])
				setDepartments(items)
				const found = items.find((d:any) => String(d.name).toLowerCase() === String(userDept).toLowerCase() || String(d.code).toLowerCase() === String(userDept).toLowerCase() || String(d.id) === String(userDept))
				if (found) setDepartmentId(found.id)
			} catch (e) {
				console.error('Failed to load departments', e)
			}
		}
		loadDeps()
	}, [userDept])

	const loadSubjects = async () => {
		if (!departmentId) {
			alert('Please select a department')
			return
		}
		setLoading(true)
		try {
			const now = new Date()
			const currentYear = now.getFullYear()
			// As requested: batch_year = Current Year - Student Year + 1
			const batch_year = Number(currentYear) - Number(studentYear) + 1

			const res = await api.get('/allocations/get_active_courses', { params: { department_id: departmentId, semester, batch_year } })
			const data = res.data || []
			const items = Array.isArray(data) ? data : (data.results || [])
			setSubjects(items)
		} catch (e) {
			console.error('Failed to load subjects from allocations', e)
			setSubjects([])
		} finally {
			setLoading(false)
		}
	}

	return (
		<DashboardLayout>
			<div className="max-w-5xl mx-auto">
				<div className="mb-6">
					<h1 className="text-2xl font-bold">Timetable — Subject Selection</h1>
					<p className="text-slate-600 mt-1">Use department, student year and semester to load approved subjects.</p>
				</div>

				<div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
					<div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
						<div>
							<label className="block text-sm text-slate-600">Department</label>
							<select value={departmentId ?? ''} onChange={(e)=>setDepartmentId(e.target.value ? Number(e.target.value) : null)} className="w-full px-2 py-1 border rounded">
								<option value="">Select department</option>
								{departments.map((d:any)=> <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
							</select>
						</div>

						<div>
							<label className="block text-sm text-slate-600">Student Year (1 = First Year)</label>
							<select value={studentYear} onChange={(e)=>setStudentYear(Number(e.target.value))} className="w-full px-2 py-1 border rounded">
								{[1,2,3,4,5].map(y=> <option key={y} value={y}>{y}</option>)}
							</select>
						</div>

						<div>
							<label className="block text-sm text-slate-600">Semester</label>
							<select value={semester} onChange={(e)=>setSemester(Number(e.target.value))} className="w-full px-2 py-1 border rounded">
								{Array.from({length:8}).map((_,i)=> <option key={i+1} value={i+1}>{i+1}</option>)}
							</select>
						</div>

						<div className="flex items-center">
							<button onClick={loadSubjects} className="px-4 py-2 bg-indigo-600 text-white rounded">Load Subjects</button>
						</div>
					</div>
				</div>

				<div className="bg-white rounded-xl shadow-sm border p-4">
					<div className="text-sm text-slate-600 mb-3">Subjects available for selection</div>
					{loading ? (
						<div>Loading…</div>
					) : (
						<select className="w-full px-2 py-1 border rounded">
							<option value="">Select subject</option>
							{subjects.map((s:any) => (
								<option key={s.id} value={s.id}>{s.code} — {s.name}</option>
							))}
						</select>
					)}
				</div>
			</div>
		</DashboardLayout>
	)
}
