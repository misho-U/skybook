import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function useRequireAuth() {
  const { user, isLoading } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login', {
        state:   { from: location.pathname + location.search },
        replace: true,
      })
    }
  }, [user, isLoading, navigate, location])

  return { user, isLoading }
}
