import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'

export default function NotFound() {
  usePageTitle('Page Not Found')

  return (
    <main className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="animate-fade-in-up">
        {/* Illustration */}
        <div className="relative mb-8 inline-block">
          <span className="text-[96px] leading-none select-none drop-shadow-sm">✈️</span>
          <div className="absolute -top-2 -right-4 bg-red-100 text-red-500 font-extrabold text-xl w-10 h-10 rounded-full flex items-center justify-center border-2 border-white shadow">
            ?
          </div>
        </div>

        <h1 className="text-6xl font-extrabold text-slate-800 mb-3 tracking-tight">404</h1>
        <p className="text-xl font-semibold text-slate-700 mb-2">Page not found</p>
        <p className="text-slate-500 max-w-sm mb-10">
          Looks like this flight got rerouted. The page you're looking for doesn't exist.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 active:scale-[0.97] transition-all shadow-sm shadow-blue-200"
          >
            ← Back to Home
          </Link>
          <Link
            to="/my-bookings"
            className="px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-xl font-semibold text-sm hover:bg-slate-50 active:scale-[0.97] transition-all"
          >
            My Bookings
          </Link>
        </div>
      </div>
    </main>
  )
}
