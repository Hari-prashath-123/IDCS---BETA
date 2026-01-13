import React, { useEffect, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import api from '../../services/api'

export default function DepartmentsList() {
	const [departments, setDepartments] = useState<any[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		const load = async () => {
			try {
				const res = await api.get('/departments/')
				const data = res.data || []
				const items = Array.isArray(data) ? data : (data.results || [])
				setDepartments(items)
			} catch (e) {
				console.error('Failed to load departments', e)
			} finally {
				setLoading(false)
			}
		}
		load()
	}, [])

	return (
		<DashboardLayout>
			<div className="max-w-5xl mx-auto">
				<div className="mb-6">
					<h1 className="text-2xl font-bold">Departments</h1>
					<p className="text-slate-600 mt-1">List of departments</p>
				</div>

				{loading ? (
					<div className="bg-white rounded-xl shadow-sm border p-6">Loading…</div>
				) : (
					<div className="bg-white rounded-xl shadow-sm border p-4">
						<ul className="space-y-2">
							{departments.map((d: any) => (
								<li key={d.id} className="p-3 border rounded">
									<div className="font-medium">{d.name} ({d.code})</div>
									<div className="text-sm text-slate-500">Type: {d.type}</div>
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		</DashboardLayout>
	)
}
