import React from 'react'
import DashboardLayout from '../../components/DashboardLayout'

export default function Views() {
  const sidebarItems = [
    { label: 'Dashboard', path: '/admin-dashboard', icon: null },
    { label: 'Manage Students', path: '/admin/students', icon: null },
    { label: 'Manage Staff', path: '/admin/staff', icon: null },
    { label: 'Create', path: '/admin/create', icon: null },
    { label: 'Add Curriculum', path: '/admin/add-curriculum', icon: null },
    { label: 'Views', path: '/admin/views', icon: null },
  ];
  return (
    <DashboardLayout sidebarItems={sidebarItems}>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-xl font-bold">Views</h1>
        <p className="text-slate-600 mt-2">Placeholder for admin views.</p>
      </div>
    </DashboardLayout>
  )
}
