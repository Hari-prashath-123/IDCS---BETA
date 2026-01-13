import React from 'react'
import DashboardLayout from '../../components/DashboardLayout'

export default function StudentDashboard() {
  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Student Dashboard</h1>
          <p className="text-slate-600 mt-1">Student portal</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">Welcome — student features coming soon.</div>
      </div>
    </DashboardLayout>
  )
}
