import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { useRequireAuth } from '../hooks/useRequireAuth'
import { finalizeBooking } from '../lib/finalizeBooking'

/**
 * Fallback landing page for Flitt's response_url redirect.
 * The canonical payment flow now finalizes inline on /payment via polling.
 * This page exists for the case where Flitt redirects before the poll catches up.
 *
 * Lookup logic:
 *   1. Read order_id from URL
 *   2. Query payment_intents
 *   3. status='approved' → finalize via shared helper
 *      status='declined' → show declined screen
 *      status='pending'  → bounce to /my-bookings (poll will catch up)
 *      no row            → bounce to /my-bookings
 */
export default function PaymentResult() {
  usePageTitle('Payment Result')
  useRequireAuth()
  const navigate     = useNavigate()
  const { user }     = useAuth()
  const { addToast } = useToast()

  const params      = new URLSearchParams(window.location.search)
  const orderId     = params.get('order_id')
  const orderStatus = params.get('order_status')

  const [state,      setState]      = useState('checking')
  // 'checking' | 'finalizing' | 'success' | 'declined' | 'error' | 'no-data'
  const [bookingRef, setBookingRef] = useState(null)
  const [errorMsg,   setErrorMsg]   = useState(null)

  const ran = useRef(false)

  // Diagnostic dump
  useEffect(() => {
    const all = Object.fromEntries(params.entries())
    console.log('[PaymentResult] Flitt redirect params:', all)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Main resolver
  useEffect(() => {
    if (ran.current) return
    if (!user) return
    if (!orderId) { setState('no-data'); return }
    ran.current = true

    const resolve = async () => {
      // Look up the intent
      const { data: intent, error } = await supabase
        .from('payment_intents')
        .select('status')
        .eq('flitt_order_id', orderId)
        .maybeSingle()

      if (error) {
        console.warn('[PaymentResult] payment_intents lookup error:', error)
      }

      const status = intent?.status ?? orderStatus  // fall back to URL if no row

      if (status === 'approved' || orderStatus === 'approved') {
        setState('finalizing')
        const result = await finalizeBooking({
          user,
          onEmailResult: (emailErr) => {
            addToast(
              emailErr ? 'Booking confirmed (email delivery failed)' : 'Confirmation email sent! ✉️',
              emailErr ? 'info' : 'success',
            )
          },
        })

        if (!result.ok) {
          // NO_PENDING means Payment.jsx polling already finalized — go to bookings
          if (result.code === 'NO_PENDING') {
            navigate('/my-bookings', { replace: true })
            return
          }
          setErrorMsg(result.message)
          setState('error')
          return
        }

        setBookingRef(result.ref)
        setState('success')
        setTimeout(() => navigate('/my-bookings'), 2000)
        return
      }

      if (status === 'declined') {
        setState('declined')
        return
      }

      // pending or unknown — Payment.jsx polling is the authoritative path,
      // so just send the user to bookings (their trip will appear shortly)
      navigate('/my-bookings', { replace: true })
    }

    resolve()
  }, [user, orderId, orderStatus, navigate, addToast])

  // ── Render ────────────────────────────────────────────────────────────────

  if (state === 'checking' || state === 'finalizing') {
    return (
      <main className="max-w-xl mx-auto px-4 py-32 flex flex-col items-center gap-4 animate-fade-in">
        <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-slate-500 text-sm font-medium">
          {state === 'finalizing' ? 'Finalizing your booking…' : 'Checking payment status…'}
        </p>
      </main>
    )
  }

  if (state === 'success') {
    return (
      <main className="max-w-xl mx-auto px-4 py-24 text-center animate-fade-in">
        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
          <span className="text-5xl select-none">✅</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-800 mb-2">Payment Successful!</h1>
        <p className="text-slate-500 mb-1">
          Booking reference:{' '}
          <span className="font-mono font-bold text-slate-700">{bookingRef}</span>
        </p>
        <p className="text-slate-400 text-sm mb-8">A confirmation email is on its way.</p>
        <Link
          to="/my-bookings"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 shadow-sm shadow-blue-200 btn-press transition-all"
        >
          View My Bookings →
        </Link>
      </main>
    )
  }

  if (state === 'declined') {
    return (
      <main className="max-w-xl mx-auto px-4 py-24 text-center animate-fade-in">
        <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-5xl select-none">⚠️</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-800 mb-2">Payment Declined</h1>
        <p className="text-slate-500 text-sm mb-2">Your card was declined. No charge was made.</p>
        <p className="text-slate-400 text-sm mb-8">
          Your booking details are still saved — try again with a different card.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/payment')}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 shadow-sm shadow-blue-200 btn-press transition-all"
          >
            Try Again
          </button>
          <Link
            to="/"
            onClick={() => {
              sessionStorage.removeItem('pending_booking')
              sessionStorage.removeItem('flitt_order_id')
            }}
            className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200 btn-press transition-all"
          >
            Cancel
          </Link>
        </div>
      </main>
    )
  }

  if (state === 'no-data') {
    return (
      <main className="max-w-xl mx-auto px-4 py-24 text-center animate-fade-in">
        <p className="text-7xl mb-5 select-none">🚫</p>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Invalid Access</h1>
        <p className="text-slate-500 text-sm mb-8">
          This page can only be reached via the payment provider.
        </p>
        <Link
          to="/"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 btn-press transition-all"
        >
          ← Back to Home
        </Link>
      </main>
    )
  }

  // state === 'error' (payment succeeded but finalization failed)
  return (
    <main className="max-w-xl mx-auto px-4 py-24 text-center animate-fade-in">
      <p className="text-7xl mb-5 select-none">⚠️</p>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Booking Error</h1>
      <p className="text-slate-500 mb-8 text-sm max-w-md mx-auto">
        {errorMsg ?? 'Something went wrong. Please contact support.'}
      </p>
      <Link
        to="/my-bookings"
        className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 btn-press transition-all"
      >
        View My Bookings →
      </Link>
    </main>
  )
}
