import React, { useEffect, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import api, { getActiveCourses } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

export default function TimetablePage() {
	const { user } = useAuth()
	const [departments, setDepartments] = useState<any[]>([])
	const [departmentId, setDepartmentId] = useState<number | null>(null)
	const [studentYear, setStudentYear] = useState<number>(1)
	const [semester, setSemester] = useState<number>(1)
	const [subjects, setSubjects] = useState<any[]>([])
	const [loading, setLoading] = useState(false)
	const [warningMessage, setWarningMessage] = useState<string | null>(null)
	const [usingFallback, setUsingFallback] = useState(false)

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
		setWarningMessage(null)
		setUsingFallback(false)
		
		try {
			const now = new Date()
			const currentYear = now.getFullYear()
			// As requested: batch_year = Current Year - Student Year + 1
			const batch_year = Number(currentYear) - Number(studentYear) + 1

			// Try to get HOD-allocated courses first
			const activeCourses = await getActiveCourses(departmentId, batch_year, semester)
			const items = Array.isArray(activeCourses) ? activeCourses : (activeCourses.results || [])
			
			if (items.length === 0) {
				// HOD hasn't set courses yet - show warning and use fallback
				setWarningMessage('HOD has not defined courses for this semester. Showing all available courses as fallback.')
				setUsingFallback(true)
				
				// Fallback: Load all courses for this department and semester
				try {
					const res = await api.get('/courses/', { 
						params: { 
							department: departmentId,
							semester: semester
						} 
					})
					const fallbackData = res.data || []
					const fallbackItems = Array.isArray(fallbackData) ? fallbackData : (fallbackData.results || [])
					setSubjects(fallbackItems)
				} catch (fallbackError) {
					console.error('Failed to load fallback courses', fallbackError)
					setSubjects([])
				}
			} else {
				// HOD has set courses - use them
				setSubjects(items)
			}
		} catch (e) {
			console.error('Failed to load subjects from allocations', e)
			setWarningMessage('Error loading courses. Please try again.')
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

				{/* Warning Message */}
				{warningMessage && (
					<div className={`mb-4 p-4 rounded-lg ${usingFallback ? 'bg-yellow-100 border border-yellow-300 text-yellow-800' : 'bg-red-100 border border-red-300 text-red-800'}`}>
						<div className="flex items-center">
							<svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
								<path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
							</svg>
							<span>{warningMessage}</span>
						</div>
					</div>
				)}

				<div className="bg-white rounded-xl shadow-sm border p-4">
					<div className="flex justify-between items-center mb-3">
						<div className="text-sm text-slate-600">
							Subjects available for selection
							{usingFallback && <span className="ml-2 text-yellow-600 font-medium">(Fallback Mode)</span>}
						</div>
						{subjects.length > 0 && (
							<div className="text-sm text-slate-500">{subjects.length} course{subjects.length !== 1 ? 's' : ''}</div>
						)}
					</div>
					{loading ? (
						<div className="text-slate-600">Loading…</div>
					) : subjects.length === 0 ? (
						<div className="text-slate-500 text-sm">No courses available. Please check the selection criteria.</div>
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
