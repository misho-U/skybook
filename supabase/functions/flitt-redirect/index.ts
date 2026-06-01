/**
 * POST → GET bridge for Flitt's response_url redirect.
 *
 * Flitt redirects the browser to response_url via a form POST, but Vercel's
 * static hosting only serves GET. This function accepts the POST, extracts
 * the payment fields, and 303-redirects the browser to the SPA's /payment
 * route with the fields as query params — which the browser performs as GET.
 *
 * Set SITE_URL in Supabase function secrets to your deployed origin, e.g.
 *   supabase secrets set SITE_URL=https://skybook-tau.vercel.app
 */

const FALLBACK_SITE_URL = 'https://skybook-tau.vercel.app'

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
      // GET — just pass query params straight through
      params = new URL(req.url).searchParams
    }
  } catch (err) {
    console.error('[flitt-redirect] Failed to parse body:', err)
  }

  const siteUrl = Deno.env.get('SITE_URL') ?? FALLBACK_SITE_URL
  const target  = `${siteUrl}/payment?${params.toString()}`

  console.log('[flitt-redirect] Method:', req.method)
  console.log('[flitt-redirect] Params received:', Object.fromEntries(params))
  console.log('[flitt-redirect] Redirecting to :', target)

  // 303 forces the browser to issue a GET for the next request, regardless
  // of whether the inbound request was POST or GET — exactly what we want.
  return new Response(null, {
    status: 303,
    headers: {
      Location: target,
      // Permissive CORS in case Flitt's preflight checks
      'Access-Control-Allow-Origin': '*',
    },
  })
})
