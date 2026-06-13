/**
 * POST → GET bridge for Flitt's response_url redirect.
 *
 * Flitt redirects the browser to response_url via a form POST, but Vercel's
 * static hosting only serves GET. This function accepts the POST, extracts
 * the payment fields, and 303-redirects the browser to the SPA's /payment
 * route with the fields as query params — which the browser performs as GET.
 *
 * Set PUBLIC_SITE_URL in Supabase function secrets to your deployed origin:
 *   supabase secrets set PUBLIC_SITE_URL=https://skybook-tau.vercel.app
 *
 * Note: do NOT use SITE_URL — that name is reserved by Supabase Auth and
 * can leak in as the project's own *.supabase.co URL, which would make this
 * function 303-redirect onto Supabase (which has no /payment route → 404).
 * We still read SITE_URL as a secondary fallback, but reject any value that
 * points at supabase.co.
 */

const FALLBACK_SITE_URL = 'https://skybook-tau.vercel.app'

/** Strip trailing slashes so we never produce `//payment`. */
function trimSlash(s: string) {
  return s.replace(/\/+$/, '')
}

/** Reject anything pointing at supabase.co — protects against env-var clashes. */
function isSafeOrigin(url: string | undefined | null): url is string {
  if (!url) return false
  return !url.includes('supabase.co') && url.startsWith('http')
}

Deno.serve(async (req) => {
  let params = new URLSearchParams()

  try {
    if (req.method === 'POST') {
      const contentType = req.headers.get('content-type') ?? ''

      if (contentType.includes('application/x-www-form-urlencoded')) {
        const text = await req.text()
        params = new URLSearchParams(text)
      } else if (contentType.includes('multipart/form-data')) {
        const form = await req.formData()
        for (const [k, v] of form.entries()) params.set(k, v.toString())
      } else if (contentType.includes('application/json')) {
        const body = await req.json()
        for (const [k, v] of Object.entries(body ?? {})) {
          if (v !== null && v !== undefined) params.set(k, String(v))
        }
      } else {
        // Last-ditch: try url-encoded text anyway
        const text = await req.text()
        params = new URLSearchParams(text)
      }
    } else {
      // GET — pass query params straight through
      params = new URL(req.url).searchParams
    }
  } catch (err) {
    console.error('[flitt-redirect] Failed to parse body:', err)
  }

  // ── Resolve the destination origin ─────────────────────────────────────────
  const envPublic = Deno.env.get('PUBLIC_SITE_URL')
  const envLegacy = Deno.env.get('SITE_URL')

  let siteUrl: string
  let source:  string

  if (isSafeOrigin(envPublic)) {
    siteUrl = envPublic
    source  = 'PUBLIC_SITE_URL'
  } else if (isSafeOrigin(envLegacy)) {
    siteUrl = envLegacy
    source  = 'SITE_URL (legacy)'
  } else {
    siteUrl = FALLBACK_SITE_URL
    source  = 'hardcoded FALLBACK_SITE_URL'
  }

  siteUrl = trimSlash(siteUrl)

  // ── Choose destination based on payment outcome ────────────────────────────
  // Approved → /payment with status+order_id so Payment.jsx can run
  //            finalizeBooking() against the existing pending_booking.
  //            (Sending the user straight to /my-bookings would skip the
  //             database write entirely — they'd have paid but no trip row.)
  // Anything else (declined / expired / reversed / missing) → /payment with
  //            ALL original params, so the failure UI can render with context.
  const orderStatus = params.get('order_status') ?? ''
  const orderId     = params.get('order_id')     ?? ''
  const isApproved  = orderStatus === 'approved'

  const target = (() => {
    if (isApproved) {
      const q = new URLSearchParams({ order_status: 'approved' })
      if (orderId) q.set('order_id', orderId)
      return `${siteUrl}/payment?${q.toString()}`
    }
    return `${siteUrl}/payment?${params.toString()}`
  })()

  console.log('[flitt-redirect] method             :', req.method)
  console.log('[flitt-redirect] env PUBLIC_SITE_URL:', envPublic ?? '(unset)')
  console.log('[flitt-redirect] env SITE_URL       :', envLegacy ?? '(unset)')
  console.log('[flitt-redirect] resolved source    :', source)
  console.log('[flitt-redirect] resolved siteUrl   :', siteUrl)
  console.log('[flitt-redirect] params received    :', Object.fromEntries(params))
  console.log('[flitt-redirect] order_status       :', orderStatus || '(missing)')
  console.log('[flitt-redirect] redirecting to     :', target)

  if (envLegacy && envLegacy.includes('supabase.co')) {
    console.warn(
      '[flitt-redirect] SITE_URL pointed at supabase.co — ignored. ' +
      'Set PUBLIC_SITE_URL to override.',
    )
  }

  // 303 forces the browser to issue a GET for the next request, regardless
  // of whether the inbound request was POST or GET — exactly what we want.
  return new Response(null, {
    status: 303,
    headers: {
      Location: target,
      'Access-Control-Allow-Origin': '*',
    },
  })
})
