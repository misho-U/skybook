import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { useRequireAuth } from '../hooks/useRequireAuth'
import { finalizeBooking } from '../lib/finalizeBooking'
import { formatPrice, formatDayMonth, formatTime } from '../utils/format'

const FLITT_SDK_URL = 'https://pay.flitt.com/latest/checkout-vue/checkout.js'
const FLITT_CSS_URL = 'https://pay.flitt.com/latest/checkout-vue/checkout.css'

const POLL_INTERVAL_MS = 2000
const POLL_MAX_ATTEMPTS = 150        // 150 × 2s ≈ 5 minutes

// ── Helpers ────────────────────────────────────────────────────────────────────

function injectCss(href) {
  if (document.querySelector(`link[href="${href}"]`)) return
  const link = document.createElement('link')
  link.rel  = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (typeof window.checkout === 'function') { resolve(); return }
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      existing.addEventListener('load',  resolve, { once: true })
      existing.addEventListener('error', reject,  { once: true })
      return
    }
    const script    = document.createElement('script')
    script.src      = src
    script.onload   = resolve
    script.onerror  = reject
    document.body.appendChild(script)
  })
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Payment() {
  usePageTitle('Complete Payment')
  useRequireAuth()
  const navigate     = useNavigate()
  const { user }     = useAuth()
  const { addToast } = useToast()

  const [pending,             setPending]             = useState(null)
  const [initError,           setInitError]           = useState(null)
  const [checkoutReady,       setCheckoutReady]       = useState(false)
  const [flittOrderId,        setFlittOrderId]        = useState(null)
  const [resumedFromRedirect, setResumedFromRedirect] = useState(false)

  // Detect Flitt's late tail-redirect AFTER a successful finalize.
  // If the previous Payment mount finalized the booking, it stamped
  // `payment_finalized` to the same order_id we still have in sessionStorage.
  // When Flitt's 5–10s tail redirect lands us back here, we recognise the
  // pattern and bounce to /my-bookings before any UI mounts.
  //
  // IMPORTANT: only treat this as a tail-redirect when there is NO fresh
  // `pending_booking` in sessionStorage. Otherwise we'd incorrectly bounce
  // a user who's starting a NEW booking right after a previous one finished
  // (stale `flitt_order_id` + `payment_finalized` linger after success).
  const [isPostFinalizeTail] = useState(() => {
    const oid     = sessionStorage.getItem('flitt_order_id')
    const fin     = sessionStorage.getItem('payment_finalized')
    const pending = sessionStorage.getItem('pending_booking')
    return Boolean(oid && fin && oid === fin && !pending)
  })

  // Detect a payment that was already approved by Flitt but whose finalize
  // hadn't completed when the page was closed/refreshed/crashed (e.g. Supabase
  // was briefly down). On reload, we skip the Flitt widget entirely and retry
  // the finalize step against the existing order.
  const [needsFinalizeRetry] = useState(() => {
    if (isPostFinalizeTail) return false   // already covered by the other path
    const oid = sessionStorage.getItem('flitt_order_id')
    const approved = sessionStorage.getItem('payment_approved_pending_finalize')
    const finalized = sessionStorage.getItem('payment_finalized')
    return Boolean(oid && approved && oid === approved && !finalized)
  })

  // 'idle' | 'finalizing' | 'finalize-error' | 'success' | 'failed' | 'timeout'
  // Start in 'finalizing' if we're picking up an unfinished finalize so the
  // widget UI never flashes for retry users.
  const [paymentState, setPaymentState] = useState(needsFinalizeRetry ? 'finalizing' : 'idle')
  const [bookingRef,   setBookingRef]   = useState(null)
  const [errorMsg,     setErrorMsg]     = useState(null)
  const [isRetrying,   setIsRetrying]   = useState(false)

  const initialized      = useRef(false)
  const finalized        = useRef(false)
  const flittApiChecked  = useRef(false)   // we only hit Flitt's status API once
  const retryEffectRan   = useRef(false)   // ensure the auto-retry runs only once

  // ── 0. Post-finalize tail-redirect short-circuit ────────────────────────────
  // Fires before any other effect — bounces straight to /my-bookings if this
  // mount is just Flitt landing the user back after a payment we already
  // finalized in a previous mount.
  useEffect(() => {
    if (!isPostFinalizeTail) return
    console.log('[Payment] Post-finalize tail redirect detected — bouncing to /my-bookings')
    sessionStorage.removeItem('flitt_order_id')
    sessionStorage.removeItem('payment_finalized')
    navigate('/my-bookings', { replace: true })
  }, [isPostFinalizeTail, navigate])

  // ── 0b. Auto-retry an unfinished finalize on mount ──────────────────────────
  // Triggered when the user reloads / re-opens the page after their payment
  // was approved but finalize crashed (Supabase down, network out, etc.).
  // Waits for auth to resolve, then runs handleApproved exactly once.
  useEffect(() => {
    if (!needsFinalizeRetry) return
    if (!user?.id) return
    if (retryEffectRan.current) return
    retryEffectRan.current = true
    console.log('[Payment] Resuming unfinished finalize for order', sessionStorage.getItem('flitt_order_id'))
    handleApproved()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsFinalizeRetry, user?.id])

  // ── 1. Hydrate pending booking from sessionStorage ──────────────────────────
  useEffect(() => {
    if (isPostFinalizeTail) return   // handled above

    // Retry path: don't run normal hydration. Just lift flitt_order_id into
    // state so handleApproved() can stamp the right sentinels. We DO try to
    // load pending_booking (finalizeBooking needs it) but don't bounce home
    // if it's missing — the retry UI handles that case with a clear message.
    if (needsFinalizeRetry) {
      const oid = sessionStorage.getItem('flitt_order_id')
      if (oid) setFlittOrderId(oid)
      const raw = sessionStorage.getItem('pending_booking')
      if (raw) {
        try { setPending(JSON.parse(raw)) } catch { /* handled in retry */ }
      }
      return
    }

    try {
      const raw = sessionStorage.getItem('pending_booking')
      if (!raw) { navigate('/', { replace: true }); return }
      setPending(JSON.parse(raw))

      // If we already created a Flitt order in a previous mount (e.g. Flitt
      // redirected the user back here after payment), skip remounting the
      // widget and resume polling against the existing order_id immediately.
      const existingOrderId = sessionStorage.getItem('flitt_order_id')
      if (existingOrderId) {
        initialized.current = true
        setFlittOrderId(existingOrderId)
        setCheckoutReady(true)
        setResumedFromRedirect(true)

        // In sandbox, Flitt's server_callback often doesn't fire. The redirect
        // URL is the only signal we get — trust `order_status=approved` from
        // the URL as a trigger for finalization (polling will validate via
        // payment_intents anyway, this just kicks the next poll faster).
        const urlStatus = new URLSearchParams(window.location.search).get('order_status')
        console.log('[Payment] Resume — order_status from URL:', urlStatus)
      }
    } catch {
      navigate('/', { replace: true })
    }
  }, [navigate, isPostFinalizeTail, needsFinalizeRetry])

  // ── 2. Load SDK, fetch token, mount the widget ──────────────────────────────
  useEffect(() => {
    if (!pending || initError || initialized.current) return
    if (needsFinalizeRetry) return   // retry path doesn't need a fresh widget

    let cancelled = false
    injectCss(FLITT_CSS_URL)

    const run = async () => {
      try {
        await loadScript(FLITT_SDK_URL)
      } catch {
        if (!cancelled) setInitError('Failed to load payment widget. Please refresh the page.')
        return
      }
      if (cancelled) return

      const orderId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'sky-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10)
      sessionStorage.setItem('flitt_order_id', orderId)

      // Note: we deliberately don't send responseUrl from here. The edge fn
      // routes Flitt's POST through a redirect bridge (a SPA can't accept POST).
      // The bridge ultimately lands the browser back on /payment via GET.
      const requestBody = {
        tripId:    orderId,
        amount:    pending.total,
        orderDesc: `SkyBook Flight Booking ${orderId.slice(0, 8).toUpperCase()}`,
      }
      console.log('[Payment] create-flitt-order request body:', requestBody)
      console.log('[Payment] field-by-field:',
        '\n  tripId   :', requestBody.tripId,
        '\n  amount   :', requestBody.amount, `(${typeof requestBody.amount})`,
        '\n  orderDesc:', requestBody.orderDesc,
      )

      const { data: tokenData, error: fnErr } = await supabase.functions.invoke(
        'create-flitt-order',
        { body: requestBody },
      )

      if (cancelled) return
      if (fnErr || !tokenData?.token) {
        console.error('create-flitt-order error:', fnErr, tokenData)
        setInitError('Failed to initialize payment. Please try again or contact support.')
        return
      }

      initialized.current = true
      setCheckoutReady(true)
      setFlittOrderId(orderId)   // ← unlocks the polling effect

      window.checkout('#flitt-checkout', {
        options: {
          methods:          ['card'],
          methods_disabled: ['most_popular', 'banks', 'wallets', 'installments'],
          card_icons:       ['mastercard', 'visa', 'maestro'],
          active_tab:       'card',
          title:            'SkyBook Payment',
          full_screen:      false,
          theme: {
            type:   'light',
            preset: 'navy_shimmer',
          },
          show_email: false,
          locales:    ['en', 'ka'],
        },
        params: {
          token:        tokenData.token,
          sender_email: user?.email ?? undefined,
        },
        button: {
          on_click: function () { console.log('[Flitt] Pay button clicked') },
        },
      })
    }

    run().catch(err => {
      console.error('Payment init error:', err)
      if (!cancelled) setInitError('Failed to load payment widget. Please refresh the page.')
    })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, initError, user])

  // ── 3. Poll payment_intents for status ──────────────────────────────────────
  useEffect(() => {
    if (!flittOrderId) return
    if (paymentState !== 'idle') return

    let cancelled = false
    let attempts  = 0
    let timeoutHandle

    // Two independent escape hatches for sandbox mode where server_callback
    // never fires:
    //   (a) URL params from the Flitt redirect (if present)
    //   (b) Direct query to Flitt's order-status API after 10 s of silence
    const urlStatus = new URLSearchParams(window.location.search).get('order_status')
    const URL_APPROVAL_AFTER     = 3       // polls (~1.5 s) before trusting URL
    const FLITT_API_CHECK_AFTER  = 3000    // ms before hitting Flitt's status API
    const startedAt              = Date.now()

    const pollOnce = async () => {
      if (cancelled) return
      attempts++
      const elapsed = Date.now() - startedAt

      // ── 1. Standard payment_intents poll ─────────────────────────────────
      const { data, error } = await supabase
        .from('payment_intents')
        .select('status')
        .eq('flitt_order_id', flittOrderId)
        .maybeSingle()

      if (cancelled) return
      if (error) {
        console.warn('[Payment] poll error:', error)
        // Don't abort polling on transient errors — just try again next tick
      }

      const status = data?.status
      if (status === 'approved') { await handleApproved(); return }
      if (status === 'declined') { handleDeclined();        return }

      // ── 2. URL-based fallback (only when the redirect carried a status) ──
      if (urlStatus && resumedFromRedirect && attempts >= URL_APPROVAL_AFTER) {
        if (urlStatus === 'approved') {
          console.warn('[Payment] No DB update after', attempts, 'polls — trusting URL order_status=approved')
          await handleApproved()
          return
        }
        if (['declined', 'expired', 'reversed'].includes(urlStatus)) {
          console.warn('[Payment] URL order_status indicates failure:', urlStatus)
          handleDeclined()
          return
        }
      }

      // ── 3. Flitt API direct check ────────────────────────────────────────
      // Fires once, when:
      //   - we've been polling > 10 s
      //   - the URL has NO order_status (otherwise the URL fallback handles it)
      //   - the DB row is still 'pending'
      //   - we have a flitt_order_id to query
      if (!urlStatus && flittOrderId && !flittApiChecked.current && elapsed >= FLITT_API_CHECK_AFTER) {
        flittApiChecked.current = true
        console.log('[Payment] No status after', elapsed, 'ms — querying Flitt API directly for order', flittOrderId)

        try {
          const { data: apiData, error: apiErr } = await supabase.functions.invoke(
            'check-flitt-status',
            { body: { orderId: flittOrderId } },
          )

          if (cancelled) return

          if (apiErr) {
            console.warn('[Payment] check-flitt-status invocation error:', apiErr)
          } else {
            console.log('[Payment] Flitt API result:', apiData)
            const apiStatus = apiData?.order_status
            if (apiStatus === 'approved') {
              console.log('[Payment] Flitt API says approved → finalizing')
              await handleApproved()
              return
            }
            if (apiStatus && ['declined', 'expired', 'reversed'].includes(apiStatus)) {
              console.log('[Payment] Flitt API says', apiStatus, '→ failing')
              handleDeclined()
              return
            }
            // anything else (processing, created, …) → keep polling payment_intents
          }
        } catch (err) {
          console.warn('[Payment] check-flitt-status threw:', err)
        }
      }

      // ── 4. Hard timeout ──────────────────────────────────────────────────
      if (attempts >= POLL_MAX_ATTEMPTS) {
        setPaymentState('timeout')
        setErrorMsg('Payment is taking longer than expected. If you completed the payment, your booking will appear in My Bookings shortly.')
        return
      }

      timeoutHandle = setTimeout(pollOnce, resumedFromRedirect ? 500 : POLL_INTERVAL_MS)
    }

    // Give Flitt a moment before the first poll (avoid wasted query on instant mount).
    // When resumed from a redirect, the result is likely already in payment_intents,
    // so poll faster (500ms) to feel snappy.
    timeoutHandle = setTimeout(pollOnce, resumedFromRedirect ? 500 : POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      if (timeoutHandle) clearTimeout(timeoutHandle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flittOrderId, paymentState, user, resumedFromRedirect])

  // ── Approval / decline handlers ─────────────────────────────────────────────
  async function handleApproved() {
    if (finalized.current) return
    finalized.current = true
    setIsRetrying(true)
    setErrorMsg(null)
    setPaymentState('finalizing')

    // Stamp the "approved but not finalized" sentinel BEFORE attempting the
    // save, so a crash/refresh between here and the success branch lets us
    // recover on the next mount. Cleared only after finalize succeeds.
    const orderId = flittOrderId || sessionStorage.getItem('flitt_order_id')
    if (orderId) {
      sessionStorage.setItem('payment_approved_pending_finalize', orderId)
    }

    let result
    try {
      result = await finalizeBooking({
        user,
        onEmailResult: (emailErr) => {
          addToast(
            emailErr ? 'Booking confirmed (email delivery failed)' : 'Confirmation email sent! ✉️',
            emailErr ? 'info' : 'success',
          )
        },
      })
    } catch (err) {
      console.error('[Payment] finalizeBooking threw:', err)
      finalized.current = false   // allow user-initiated retry
      setIsRetrying(false)
      setErrorMsg(
        err?.message
          ? `Could not save your booking: ${err.message}`
          : 'Could not save your booking. Your payment was received — please retry.'
      )
      setPaymentState('finalize-error')
      return
    }

    if (!result.ok) {
      finalized.current = false   // allow user-initiated retry
      setIsRetrying(false)

      // NO_PENDING means pending_booking is gone from sessionStorage. Recovery
      // from this state needs human help — show a clear support message.
      if (result.code === 'NO_PENDING') {
        setErrorMsg(
          `Your payment was received but we lost the booking details for this session. ` +
          `Please contact support with order ID ${orderId?.slice(0, 8).toUpperCase() ?? '(unknown)'}.`
        )
      } else {
        setErrorMsg(result.message ?? 'Could not save your booking. Please retry.')
      }
      setPaymentState('finalize-error')
      return
    }

    // ── Success ──────────────────────────────────────────────────────────
    sessionStorage.removeItem('payment_approved_pending_finalize')

    setBookingRef(result.ref)
    setPaymentState('success')
    setIsRetrying(false)

    // Stamp a sentinel so a late Flitt tail-redirect (5–10s after the user
    // has already been navigated to /my-bookings) doesn't drop them back
    // onto a half-rendered Payment page.
    if (orderId) {
      sessionStorage.setItem('payment_finalized', orderId)
    }

    setTimeout(() => navigate('/my-bookings'), 2000)
  }

  function handleDeclined() {
    setErrorMsg('Your card was declined. Please try a different card.')
    setPaymentState('failed')
  }

  function retry() {
    sessionStorage.removeItem('flitt_order_id')
    window.location.reload()
  }

  /** User-initiated retry of the finalize step (payment already approved). */
  function retryFinalize() {
    if (isRetrying) return
    handleApproved()
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  // Post-finalize tail-redirect from Flitt — the bounce effect is already
  // queued; show a thin spinner for the millisecond before navigate() fires.
  if (isPostFinalizeTail) {
    return (
      <main className="max-w-xl mx-auto px-4 py-32 flex flex-col items-center gap-4 animate-fade-in">
        <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Returning to your bookings…</p>
      </main>
    )
  }

  // Don't show "Preparing your payment…" if we're recovering from an
  // unfinished finalize — the retry UI handles its own loading state.
  if (!pending && !initError && !needsFinalizeRetry) {
    return (
      <main className="max-w-xl mx-auto px-4 py-32 flex flex-col items-center gap-4 animate-fade-in">
        <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Preparing your payment…</p>
      </main>
    )
  }

  if (initError) {
    return (
      <main className="max-w-xl mx-auto px-4 py-24 text-center animate-fade-in">
        <p className="text-7xl mb-5 select-none">⚠️</p>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Something went wrong</h1>
        <p className="text-slate-500 mb-8 text-sm">{initError}</p>
        <Link
          to="/"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 btn-press transition-all"
        >
          ← Back to Home
        </Link>
      </main>
    )
  }

  // ── Retry path: minimal layout, no trip summary (pending may be null) ──
  if (needsFinalizeRetry) {
    const shortRef = (sessionStorage.getItem('flitt_order_id') ?? flittOrderId ?? '')
      .slice(0, 8).toUpperCase()
    return (
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-11 h-11 bg-blue-100 rounded-2xl flex items-center justify-center text-xl shrink-0">
            ✈️
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 leading-tight">Finishing your booking</h1>
            <p className="text-sm text-slate-500">
              Order <span className="font-mono font-bold text-slate-700">{shortRef}</span>
            </p>
          </div>
        </div>

        {paymentState === 'finalizing' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center py-16 gap-3 min-h-[200px] animate-fade-in">
            <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
            <p className="text-slate-700 text-sm font-semibold">Saving your booking…</p>
            <p className="text-slate-400 text-xs">Your payment was already received.</p>
          </div>
        )}

        {paymentState === 'success' && (
          <div className="bg-white rounded-2xl border-2 border-emerald-200 shadow-md p-8 text-center animate-fade-in">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl">✅</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-800 mb-1">Booking Saved!</h2>
            <p className="text-slate-500 text-sm mb-1">
              Booking reference: <span className="font-mono font-bold text-slate-700">{bookingRef}</span>
            </p>
            <p className="text-slate-400 text-xs">Redirecting to My Bookings…</p>
          </div>
        )}

        {paymentState === 'finalize-error' && (
          <FinalizeErrorCard
            errorMsg={errorMsg}
            shortRef={shortRef}
            onRetry={retryFinalize}
            isRetrying={isRetrying}
          />
        )}
      </main>
    )
  }

  const outFlight   = pending.outboundFlight
  const retFlight   = pending.returnFlight
  const isRoundTrip = pending.tripType === 'round_trip'

  return (
    <main className="max-w-xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">

      <Link
        to="/booking"
        onClick={(e) => { e.preventDefault(); window.history.back() }}
        className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors"
      >
        ← Back
      </Link>

      <div className="mt-6 mb-6 flex items-center gap-3">
        <div className="w-11 h-11 bg-blue-100 rounded-2xl flex items-center justify-center text-xl shrink-0">
          ✈️
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 leading-tight">Complete Payment</h1>
          <p className="text-sm text-slate-500">Your trip is reserved while you pay</p>
        </div>
      </div>

      {/* Trip summary */}
      {outFlight && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-6">
          <FlightRow flight={outFlight} label={isRoundTrip ? 'Outbound' : undefined} />
          {isRoundTrip && retFlight && (
            <>
              <div className="border-t border-slate-100 my-3" />
              <FlightRow flight={retFlight} label="Return" />
            </>
          )}
          <div className="border-t border-slate-100 mt-3 pt-3 flex items-center justify-between">
            <span className="text-sm text-slate-500 font-medium">Total due</span>
            <span className="text-xl font-extrabold text-blue-600">
              {formatPrice(pending.total)}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400 leading-snug">
            Amount charged in <span className="font-semibold text-slate-500">GEL</span> (Georgian Lari).
            <br />
            {formatPrice(pending.total)} USD ≈ {Number(pending.total).toFixed(2)} GEL
            <span className="text-slate-300"> · 1:1 rate for demo</span>
          </p>
        </div>
      )}

      {/* Success */}
      {paymentState === 'success' && (
        <div className="bg-white rounded-2xl border-2 border-emerald-200 shadow-md p-8 text-center animate-fade-in">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <span className="text-4xl">✅</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-800 mb-1">Payment Successful!</h2>
          <p className="text-slate-500 text-sm mb-1">
            Booking reference: <span className="font-mono font-bold text-slate-700">{bookingRef}</span>
          </p>
          <p className="text-slate-400 text-xs mb-5">A confirmation email is on its way.</p>
          <p className="text-slate-400 text-xs">Redirecting to My Bookings…</p>
        </div>
      )}

      {/* Finalize error — payment was received, save to DB failed */}
      {paymentState === 'finalize-error' && (
        <FinalizeErrorCard
          errorMsg={errorMsg}
          shortRef={(flittOrderId ?? '').slice(0, 8).toUpperCase()}
          onRetry={retryFinalize}
          isRetrying={isRetrying}
        />
      )}

      {/* Failed / timeout */}
      {(paymentState === 'failed' || paymentState === 'timeout') && (
        <div className="bg-white rounded-2xl border-2 border-red-200 shadow-md p-6 text-center animate-fade-in">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">{paymentState === 'timeout' ? '⏱️' : '⚠️'}</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-800 mb-1">
            {paymentState === 'timeout' ? 'Payment Timeout' : 'Payment Failed'}
          </h2>
          <p className="text-slate-500 text-sm mb-5 max-w-sm mx-auto">{errorMsg}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={retry}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 shadow-sm shadow-blue-200 btn-press transition-all"
            >
              Try Again
            </button>
            <Link
              to="/my-bookings"
              onClick={() => {
                sessionStorage.removeItem('pending_booking')
                sessionStorage.removeItem('flitt_order_id')
              }}
              className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200 btn-press transition-all"
            >
              My Bookings
            </Link>
          </div>
        </div>
      )}

      {/* Widget (with overlay during finalization) */}
      {(paymentState === 'idle' || paymentState === 'finalizing') && (
        <>
          {resumedFromRedirect ? (
            // Resumed from Flitt redirect — widget already did its job, we're
            // just waiting for the payment_intents row to flip to approved/declined.
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center py-16 gap-3 min-h-[200px] animate-fade-in">
              <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-slate-700 text-sm font-semibold">Verifying your payment…</p>
              <p className="text-slate-400 text-xs">This usually takes a few seconds.</p>
            </div>
          ) : (
            <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-h-[200px]">
              {!checkoutReady && (
                <div className="flex flex-col items-center py-14 gap-3">
                  <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                  <p className="text-slate-400 text-sm">Loading payment form…</p>
                </div>
              )}
              <div id="flitt-checkout" />

              {paymentState === 'finalizing' && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 animate-fade-in">
                  <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
                  <p className="text-slate-700 text-sm font-semibold">Finalizing your booking…</p>
                  <p className="text-slate-400 text-xs">Don't close this window.</p>
                </div>
              )}
            </div>
          )}

          {/* Polling status hint (suppressed when resumed — "Verifying" already says it) */}
          {!resumedFromRedirect && checkoutReady && paymentState === 'idle' && (
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
              <div className="w-3 h-3 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
              <span>Waiting for payment confirmation…</span>
            </div>
          )}

          <p className="mt-4 text-center text-xs text-slate-400">
            🔒 Secured by <span className="font-semibold text-slate-500">Flitt</span> · Payments are encrypted and processed securely
          </p>
        </>
      )}
    </main>
  )
}

// ── FinalizeErrorCard ─────────────────────────────────────────────────────────
// Shown when payment WAS approved but saving the booking to Supabase failed.
// Distinct from the "Payment Failed" card because the user must NOT be sent
// through Flitt again — they'd be charged twice. They retry only the save.

function FinalizeErrorCard({ errorMsg, shortRef, onRetry, isRetrying }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-amber-200 shadow-md p-6 text-center animate-fade-in">
      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-3xl">⚠️</span>
      </div>
      <h2 className="text-xl font-extrabold text-slate-800 mb-1">Couldn't save your booking</h2>
      <p className="text-emerald-600 text-xs font-semibold mb-3">
        ✓ Your payment was received successfully
      </p>
      <p className="text-slate-500 text-sm mb-5 max-w-sm mx-auto">{errorMsg}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 shadow-sm shadow-blue-200 btn-press transition-all disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
      >
        {isRetrying && (
          <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        )}
        {isRetrying ? 'Retrying…' : 'Retry'}
      </button>
      {shortRef && (
        <p className="mt-4 text-xs text-slate-400">
          Order ID: <span className="font-mono text-slate-500">{shortRef}</span>
        </p>
      )}
    </div>
  )
}

// ── FlightRow helper ──────────────────────────────────────────────────────────

function FlightRow({ flight, label }) {
  return (
    <div className="flex items-center gap-3">
      {label && (
        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${
          label === 'Return'
            ? 'bg-indigo-50 text-indigo-500'
            : 'bg-blue-50 text-blue-500'
        }`}>
          {label === 'Return' ? '←' : '→'} {label}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-800 text-sm">
          {flight.origin?.code} → {flight.destination?.code}
          <span className="text-slate-400 font-normal ml-1.5 text-xs">{flight.airline}</span>
        </p>
        <p className="text-xs text-slate-400">
          {formatTime(flight.departure_time)} – {formatTime(flight.arrival_time)}
          <span className="mx-1 text-slate-300">·</span>
          {formatDayMonth(flight.departure_time)}
        </p>
      </div>
    </div>
  )
}
