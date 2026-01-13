import React from 'react'
import DashboardLayout from '../../components/DashboardLayout'

export default function StaffDashboard() {
  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Staff Dashboard</h1>
          <p className="text-slate-600 mt-1">Your staff workspace</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">Welcome — staff features coming soon.</div>
      </div>
    </DashboardLayout>
  )
}
