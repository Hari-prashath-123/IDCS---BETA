import { Routes, Route } from 'react-router-dom'
import './App.css'

import Home from './pages/Home'
import Login from './pages/Login.jsx'
import AdminDashboard from './pages/admin/AdminDashboard'
import Create from './pages/admin/Create'
import Views from './pages/admin/Views'
import Students from './pages/admin/Students'
import Staff from './pages/admin/Staff'
import AddCurriculum from './pages/admin/AddCurriculum'
import ViewCurriculum from './pages/admin/ViewCurriculum'
import ProtectedRoute from './components/ProtectedRoute'
import HodDashboard from './pages/hod/Dashboard'
import StaffDashboard from './pages/staff/Dashboard'
import StudentDashboard from './pages/student/Dashboard'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<ProtectedRoute allowedRoles={["superuser"]}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={["superuser"]}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin-dashboard" element={<ProtectedRoute allowedRoles={["superuser"]}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/staff/dashboard" element={<ProtectedRoute allowedRoles={["faculty","staff","hod"]}><StaffDashboard /></ProtectedRoute>} />
      <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={["student"]}><StudentDashboard /></ProtectedRoute>} />
      <Route path="/hod/dashboard" element={<ProtectedRoute allowedRoles={["hod"]}><HodDashboard /></ProtectedRoute>} />
      <Route path="/admin/create" element={<ProtectedRoute allowedRoles={["superuser"]}><Create /></ProtectedRoute>} />
      <Route path="/admin/add-curriculum" element={<ProtectedRoute allowedRoles={["superuser"]}><AddCurriculum /></ProtectedRoute>} />
      <Route path="/admin/curriculum" element={<ProtectedRoute allowedRoles={["superuser"]}><ViewCurriculum /></ProtectedRoute>} />
      <Route path="/admin/views" element={<ProtectedRoute allowedRoles={["superuser"]}><Views /></ProtectedRoute>} />
      <Route path="/admin/students" element={<ProtectedRoute allowedRoles={["superuser"]}><Students /></ProtectedRoute>} />
      <Route path="/admin/staff" element={<ProtectedRoute allowedRoles={["superuser"]}><Staff /></ProtectedRoute>} />
    </Routes>
  )
}

export default App
