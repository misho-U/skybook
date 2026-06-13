import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePageTitle } from '../hooks/usePageTitle'

const inputClass = 'w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all'
const labelClass = 'block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5'

export default function Login() {
  usePageTitle('Sign In')
  const navigate = useNavigate()
  const location = useLocation()
  const from     = location.state?.from || '/'

  const [tab,       setTab]       = useState('signin')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [error,     setError]     = useState('')
  const [isLoading, setIsLoading] = useState(false)

  function switchTab(next) { setTab(next); setError('') }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (tab === 'signup' && password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setIsLoading(true)
    const { error: authError } = tab === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    if (authError) { setError(authError.message); setIsLoading(false); return }
    navigate(from, { replace: true })
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options:  { redirectTo: window.location.origin + from },
    })
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 font-extrabold text-2xl text-blue-600">
            <span>✈️</span><span>SkyBook</span>
          </Link>
          <p className="text-slate-500 text-sm mt-2">Sign in to manage your bookings</p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100/60 shadow-2xl shadow-slate-200/80 p-8">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6">
            {[['signin', 'Sign In'], ['signup', 'Sign Up']].map(([val, label]) => (
              <button key={val} type="button" onClick={() => switchTab(val)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tab === val ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className={labelClass}>Email</label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="login-password" className={labelClass}>Password</label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                required
                placeholder="••••••••"
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>
            {tab === 'signup' && (
              <div>
                <label htmlFor="login-confirm" className={labelClass}>Confirm Password</label>
                <input
                  id="login-confirm"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="••••••••"
                  minLength={6}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className={inputClass}
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button type="submit" disabled={isLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all shadow-sm shadow-blue-200 btn-press disabled:opacity-70 flex items-center justify-center gap-2 mt-2">
              {isLoading && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {tab === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">or continue with</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <button onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all btn-press">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#4285F4" d="M47.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h13.2C36.4 33 34 35.6 30.7 37.3v5h7.6c4.5-4.1 7.2-10.2 7.2-17.8z"/>
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.7l-7.6-5c-2.2 1.5-5 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-9.9H2.6v5.2C6.5 42.8 14.7 48 24 48z"/>
              <path fill="#FBBC04" d="M10.5 29.7A14.5 14.5 0 0 1 9.5 24c0-2 .4-3.9 1-5.7v-5.2H2.6A23.9 23.9 0 0 0 0 24c0 3.9.9 7.6 2.6 10.9l7.9-5.2z"/>
              <path fill="#E94235" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.5 30.5 0 24 0 14.7 0 6.5 5.2 2.6 13.1l7.9 5.2C12.4 13.7 17.7 9.5 24 9.5z"/>
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </main>
  )
}
