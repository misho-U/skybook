import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import { ToastProvider } from './context/ToastContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'

// Eagerly loaded — the landing page and auth screens are part of the
// minimal first-paint bundle.
import Home from './pages/Home'
import Login from './pages/Login'
import NotFound from './pages/NotFound'

// Lazy-loaded — these pages are only reached after the user has navigated
// past the landing page, so they don't need to be in the initial bundle.
// Saves ~60-80 KB gzipped of JS (Payment.jsx alone pulls in the Flitt SDK
// loader + finalizeBooking + PaymentResult helpers).
const SearchResults  = lazy(() => import('./pages/SearchResults'))
const MyBookings     = lazy(() => import('./pages/MyBookings'))
const Booking        = lazy(() => import('./pages/Booking'))
const Payment        = lazy(() => import('./pages/Payment'))
const PaymentResult  = lazy(() => import('./pages/PaymentResult'))

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

/** Spinner shown while a lazy route chunk is downloading. */
function RouteFallback() {
  return (
    <main className="flex items-center justify-center py-32" aria-live="polite" aria-busy="true">
      <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
      <span className="sr-only">Loading page…</span>
    </main>
  )
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
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/"             element={<Home />}          />
                  <Route path="/login"        element={<Login />}         />
                  <Route path="/my-bookings"  element={<MyBookings />}    />
                  <Route path="/results"      element={<SearchResults />} />
                  <Route path="/booking"        element={<ProtectedRoute><Booking /></ProtectedRoute>} />
                  <Route path="/payment"        element={<ProtectedRoute><Payment /></ProtectedRoute>} />
                  <Route path="/payment-result" element={<ProtectedRoute><PaymentResult /></ProtectedRoute>} />
                  <Route path="*"               element={<NotFound />} />
                </Routes>
              </Suspense>
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
