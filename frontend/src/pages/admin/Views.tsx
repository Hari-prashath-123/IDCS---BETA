import React from 'react'
import DashboardLayout from '../../components/DashboardLayout'

export default function Views() {
  const sidebarItems = [];
  return (
    <DashboardLayout sidebarItems={sidebarItems}>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-xl font-bold">Views</h1>
        <p className="text-slate-600 mt-2">Placeholder for admin views.</p>
      </div>
    </DashboardLayout>
  )
}
