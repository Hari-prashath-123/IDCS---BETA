import React, { useEffect, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import api from '../../services/api'

export default function SubjectsPage() {
	const [subjects, setSubjects] = useState<any[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		const load = async () => {
			try {
				const res = await api.get('/courses/')
				const data = res.data || []
				const items = Array.isArray(data) ? data : (data.results || [])
				setSubjects(items)
			} catch (e) {
				console.error('Failed to load subjects', e)
			} finally {
				setLoading(false)
			}
		}
		load()
	}, [])

	return (
		<DashboardLayout>
			<div className="max-w-6xl mx-auto">
				<div className="mb-6">
					<h1 className="text-2xl font-bold">Subjects</h1>
					<p className="text-slate-600 mt-1">All courses in the curriculum</p>
				</div>

				{loading ? (
					<div className="bg-white rounded-xl shadow-sm border p-6">Loading…</div>
				) : (
					<div className="bg-white rounded-xl shadow-sm border p-4">
						<table className="w-full text-sm">
							<thead>
								<tr className="text-left border-b">
									<th className="px-3 py-2">Code</th>
									<th className="px-3 py-2">Name</th>
									<th className="px-3 py-2">Semester</th>
									<th className="px-3 py-2">Batch</th>
								</tr>
							</thead>
							<tbody>
								{subjects.map((s:any)=> (
									<tr key={s.id} className="border-b hover:bg-slate-50">
										<td className="px-3 py-2">{s.code}</td>
										<td className="px-3 py-2">{s.name}</td>
										<td className="px-3 py-2">{s.semester}</td>
										<td className="px-3 py-2">{s.batch ?? '-'}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</DashboardLayout>
	)
}
