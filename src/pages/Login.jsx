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
  const [error,     setError]     = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Magic-link state — independent from password flow above so they don't
  // collide. `email` is shared (both flows want the same address).
  const [magicSent,    setMagicSent]    = useState(false)
  const [magicLoading, setMagicLoading] = useState(false)
  const [magicError,   setMagicError]   = useState('')

  function switchTab(next) {
    setTab(next)
    setError('')
    // Reset magic-link state — it's only meaningful on the Sign In tab and
    // would otherwise linger as a stale "Check your email" card under Sign Up.
    setMagicSent(false)
    setMagicError('')
  }

  /**
   * Sign-in via email + password. Only invoked from the Sign In tab — the
   * Sign Up tab uses magic-link only, so password-based account creation no
   * longer happens through this page.
   */
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    setIsLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setIsLoading(false)

    if (authError) { setError(authError.message); return }
    navigate(from, { replace: true })
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options:  { redirectTo: window.location.origin + from },
    })
  }

  /**
   * Send a magic-link email via Supabase's built-in OTP flow. Supabase handles
   * email delivery using its default template. No password is exchanged — the
   * user clicks the link in their inbox → Supabase verifies → redirects to
   * `emailRedirectTo` → AuthContext's onAuthStateChange listener picks up the
   * new session, no extra page or callback wiring needed.
   *
   * Tab-aware behaviour via `shouldCreateUser`:
   *   - Sign In tab: false — rejects unknown emails so the magic link can't
   *     double as a hidden sign-up channel.
   *   - Sign Up tab: true — Supabase creates the account when the user clicks
   *     the link.
   */
  async function handleMagicLink(e) {
    e.preventDefault()
    setMagicError('')

    if (!email) {
      setMagicError('Enter your email above.')
      return
    }

    const isSignup   = tab === 'signup'
    const redirectTo = window.location.origin + (from === '/login' ? '/' : from)

    setMagicLoading(true)
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: isSignup,
        // After the user clicks the email link, Supabase bounces them here.
        // Use the live origin so localhost dev works without env config.
        // (Both this URL and the production URL must be on the allow-list in
        //  Supabase → Authentication → URL Configuration → Redirect URLs.)
        emailRedirectTo: redirectTo,
      },
    })
    setMagicLoading(false)

    if (otpError) {
      // Translate "user does not exist" variants into a friendly message —
      // only on the Sign In tab (Sign Up is allowed to create).
      const msg   = otpError.message ?? ''
      const lower = msg.toLowerCase()
      const isUserMissing =
        !isSignup && (
             lower.includes('user not found')
          || lower.includes('not found')
          || lower.includes('signups not allowed')
          || lower.includes('not allowed')
          || lower.includes('not authorized')
          || lower.includes('does not exist')
        )

      setMagicError(
        isUserMissing
          ? 'No account found with that email. Please sign up first.'
          : msg
      )
      return
    }

    setMagicSent(true)
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

          {/* ── Password form (Sign In tab only) ────────────────────────── */}
          {tab === 'signin' && (
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
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={inputClass}
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}

              <button type="submit" disabled={isLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all shadow-sm shadow-blue-200 btn-press disabled:opacity-70 flex items-center justify-center gap-2 mt-2">
                {isLoading && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                Sign In
              </button>
            </form>
          )}

          {/* ── Magic-link section (always visible — tab decides creation) ── */}

          {/* The "or" divider only makes sense ABOVE the magic-link form when
              there's another form on top of it. On the Sign Up tab the magic
              link IS the form, so no divider. */}
          {tab === 'signin' && (
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
          )}

          {magicSent ? (
            <div className="text-center py-2 px-1 animate-fade-in" role="status" aria-live="polite">
              <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl select-none" aria-hidden="true">📧</span>
              </div>
              <p className="text-sm font-bold text-slate-800 mb-1">Check your email</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                {tab === 'signup'
                  ? <>We sent a confirmation link to{' '}
                      <span className="font-semibold text-slate-700 break-all">{email}</span>.
                      Click it to create your account.
                    </>
                  : <>We sent a sign-in link to{' '}
                      <span className="font-semibold text-slate-700 break-all">{email}</span>.
                      Click it to sign in.
                    </>
                }
              </p>
              <button
                type="button"
                onClick={() => { setMagicSent(false); setMagicError('') }}
                className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-semibold underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-3">
              <div>
                <label htmlFor="magic-email" className={labelClass}>
                  {tab === 'signup' ? 'Email' : 'Email for magic link'}
                </label>
                <input
                  id="magic-email"
                  name="magic-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>

              {magicError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                  {magicError}
                </p>
              )}

              <button
                type="submit"
                disabled={magicLoading}
                className={
                  // On Sign Up tab the magic link is the primary action →
                  // filled blue. On Sign In tab it's secondary to the
                  // password form above → outlined.
                  tab === 'signup'
                    ? 'w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all shadow-sm shadow-blue-200 btn-press disabled:opacity-70 flex items-center justify-center gap-2'
                    : 'w-full py-3 border-2 border-blue-500 text-blue-600 hover:bg-blue-50 font-bold rounded-xl text-sm transition-all btn-press disabled:opacity-70 flex items-center justify-center gap-2'
                }
              >
                {magicLoading
                  ? <>
                      <div className={`w-4 h-4 border-2 rounded-full animate-spin ${
                        tab === 'signup'
                          ? 'border-white/40 border-t-white'
                          : 'border-blue-600/40 border-t-blue-600'
                      }`} />
                      Sending…
                    </>
                  : <>
                      <span aria-hidden="true">✨</span>
                      Send Magic Link
                    </>
                }
              </button>
            </form>
          )}

          {/* ── OAuth section ───────────────────────────────────────────── */}
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
