import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { ToastProvider } from './context/ToastContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import MyBookings from './pages/MyBookings'
import SearchResults from './pages/SearchResults'
import Booking from './pages/Booking'
import NotFound from './pages/NotFound'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <main className="flex items-center justify-center py-32">
        <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
      </main>
    )
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  }
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <div className="min-h-screen flex flex-col bg-slate-50">
            <Navbar />
            <div className="flex-1">
              <ScrollToTop />
              <Routes>
                <Route path="/"             element={<Home />}          />
                <Route path="/login"        element={<Login />}         />
                <Route path="/my-bookings"  element={<MyBookings />}    />
                <Route path="/results"      element={<SearchResults />} />
                <Route path="/booking"      element={<ProtectedRoute><Booking /></ProtectedRoute>} />
                <Route path="*"             element={<NotFound />}      />
              </Routes>
            </div>

            <footer className="bg-white border-t border-slate-100 py-8 mt-auto">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-blue-600 font-extrabold text-lg">
                  <span>✈️</span>
                  <span>SkyBook</span>
                </div>
                <p className="text-slate-400 text-sm">
                  © {new Date().getFullYear()} SkyBook · All rights reserved
                </p>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <span className="hover:text-slate-600 cursor-pointer transition-colors">Privacy</span>
                  <span className="hover:text-slate-600 cursor-pointer transition-colors">Terms</span>
                  <span className="hover:text-slate-600 cursor-pointer transition-colors">Help</span>
                </div>
              </div>
            </footer>
          </div>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
