import { Routes, Route } from 'react-router-dom'
import './App.css'

import Home from './pages/Home'
import Login from './pages/Login.jsx'
import AdminDashboard from './pages/admin/AdminDashboard'
import Create from './pages/admin/Create'
import Views from './pages/admin/Views'
import TimetablePage from './pages/admin/TimetablePage'
import Students from './pages/admin/Students'
import Staff from './pages/admin/Staff'
import AddCurriculum from './pages/admin/AddCurriculum'
import ViewCurriculum from './pages/admin/ViewCurriculum'
import SubjectsPage from './pages/admin/SubjectsPage'
import DepartmentsList from './pages/admin/DepartmentsList'
import HodTimetable from './pages/admin/TimetablePage'
import StaffTimetable from './pages/staff/Timetable'
import HodDashboard from './pages/hod/Dashboard'
import HodCurriculum from './pages/hod/Curriculum'
import ManageSemesterCourses from './pages/hod/ManageSemesterCourses'
import AssignAdvisors from './pages/hod/AssignAdvisors'
import StaffDashboard from './pages/staff/Dashboard'
import StudentDashboard from './pages/student/Dashboard'
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
      <Route path="/admin/students" element={<ProtectedRoute allowedRoles={["superuser"]}><Students /></ProtectedRoute>} />
      <Route path="/admin/staff" element={<ProtectedRoute allowedRoles={["superuser"]}><Staff /></ProtectedRoute>} />
      <Route path="/admin/add-curriculum" element={<ProtectedRoute allowedRoles={["superuser"]}><AddCurriculum /></ProtectedRoute>} />
      <Route path="/admin/curriculum" element={<ProtectedRoute allowedRoles={["superuser"]}><ViewCurriculum /></ProtectedRoute>} />
      <Route path="/admin/subjects" element={<ProtectedRoute allowedRoles={["superuser"]}><SubjectsPage /></ProtectedRoute>} />
      <Route path="/admin/departments" element={<ProtectedRoute allowedRoles={["superuser"]}><DepartmentsList /></ProtectedRoute>} />
      <Route path="/admin/views" element={<ProtectedRoute allowedRoles={["superuser"]}><Views /></ProtectedRoute>} />
      <Route path="/admin/timetable" element={<ProtectedRoute allowedRoles={["superuser"]}><TimetablePage /></ProtectedRoute>} />
      <Route path="/hod/dashboard" element={<ProtectedRoute allowedRoles={["hod"]}><HodDashboard /></ProtectedRoute>} />
      <Route path="/hod/curriculum" element={<ProtectedRoute allowedRoles={["hod"]}><HodCurriculum /></ProtectedRoute>} />
      <Route path="/hod/timetable" element={<ProtectedRoute allowedRoles={["hod"]}><HodTimetable /></ProtectedRoute>} />
      <Route path="/hod/manage-semester-courses" element={<ProtectedRoute allowedRoles={["hod"]}><ManageSemesterCourses /></ProtectedRoute>} />
      <Route path="/hod/assign-advisors" element={<ProtectedRoute allowedRoles={["hod"]}><AssignAdvisors /></ProtectedRoute>} />
      <Route path="/staff/dashboard" element={<ProtectedRoute allowedRoles={["staff", "faculty"]}><StaffDashboard /></ProtectedRoute>} />
      <Route path="/staff/timetable" element={<ProtectedRoute allowedRoles={["staff", "faculty"]}><StaffTimetable /></ProtectedRoute>} />
      <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={["student"]}><StudentDashboard /></ProtectedRoute>} />
    </Routes>
  )
}

export default App
