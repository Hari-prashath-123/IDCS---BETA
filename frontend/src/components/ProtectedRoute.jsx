import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ allowedRoles = [], children }) {
  const { user, loading } = useAuth()

  if (loading) return null

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const hasRole = () => {
    if (!allowedRoles || allowedRoles.length === 0) return true
    return allowedRoles.some((role) => {
      switch (role) {
        case 'superuser':
          return !!user.is_superuser || !!user.is_superuser === true
        case 'hod':
          return !!user.is_hod || (user.role && user.role.toLowerCase() === 'hod')
        case 'ahod':
          return !!user.is_ahod || (user.role && user.role.toLowerCase() === 'ahod')
        case 'staff':
        case 'faculty':
          return !!user.is_faculty || !!user.is_staff
        case 'student':
          return !!user.is_student
        default:
          return false
      }
    })
  }

  if (!hasRole()) {
    return <Navigate to="/login" replace />
  }

  return children
}
