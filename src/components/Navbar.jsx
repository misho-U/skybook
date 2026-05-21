import { useEffect, useState } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const { user, isLoading, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  const linkClass = ({ isActive }) =>
    `relative px-1 py-5 text-sm font-medium transition-colors duration-200 border-b-2 ${
      isActive
        ? 'text-blue-600 border-blue-600 font-semibold'
        : 'text-slate-600 border-transparent hover:text-blue-600 hover:border-blue-300'
    }`

  return (
    <nav className={`bg-white sticky top-0 z-50 transition-shadow duration-300 ${
      scrolled ? 'shadow-md' : 'border-b border-slate-100'
    }`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/"
            className="flex items-center gap-2 font-extrabold text-xl tracking-tight text-blue-600 hover:text-blue-700 transition-colors">
            <span className="text-2xl">✈️</span>
            <span>SkyBook</span>
          </Link>

          <div className="flex items-center gap-6">
            <NavLink to="/" end className={linkClass}>Home</NavLink>
            <NavLink to="/my-bookings" className={linkClass}>My Bookings</NavLink>

            {!isLoading && (
              user ? (
                <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
                  <span className="text-sm text-slate-500 max-w-[140px] truncate hidden sm:block">
                    {user.email}
                  </span>
                  <button
                    onClick={handleSignOut}
                    className="text-sm font-semibold text-slate-600 hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all btn-press">
                    Sign Out
                  </button>
                </div>
              ) : (
                <Link to="/login"
                  className="text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all btn-press shadow-sm shadow-blue-200">
                  Sign In
                </Link>
              )
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
