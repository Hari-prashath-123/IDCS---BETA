import { Routes, Route } from 'react-router-dom'
import './App.css'

import Home from './pages/Home'
import Login from './pages/Login.jsx'
import AdminDashboard from './pages/admin/AdminDashboard'
import Create from './pages/admin/Create'
import Views from './pages/admin/Views'
import Students from './pages/admin/Students'
import Staff from './pages/admin/Staff'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<ProtectedRoute allowedRoles={["superuser"]}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={["superuser"]}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin-dashboard" element={<ProtectedRoute allowedRoles={["superuser"]}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/create" element={<ProtectedRoute allowedRoles={["superuser"]}><Create /></ProtectedRoute>} />
      <Route path="/admin/views" element={<ProtectedRoute allowedRoles={["superuser"]}><Views /></ProtectedRoute>} />
      <Route path="/admin/students" element={<ProtectedRoute allowedRoles={["superuser"]}><Students /></ProtectedRoute>} />
      <Route path="/admin/staff" element={<ProtectedRoute allowedRoles={["superuser"]}><Staff /></ProtectedRoute>} />
    </Routes>
  )
}

export default App
