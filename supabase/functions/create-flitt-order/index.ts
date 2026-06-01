import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/** SHA-1 via Web Crypto — returns lowercase hex string */
async function sha1(stringToHash: string): Promise<string> {
  const msgBuffer  = new TextEncoder().encode(stringToHash)
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer)
  const hashArray  = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function buildSignature(
  secretKey: string,
  params: Record<string, string | number>,
): Promise<{ signature: string; stringToHash: string }> {
  const values = Object.keys(params)
    .sort()
    .map(k => params[k])
    .filter(v => v !== '' && v !== null && v !== undefined)
    .map(v => String(v))
  const stringToHash = [secretKey, ...values].join('|')
  const signature    = await sha1(stringToHash)
  return { signature, stringToHash }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const { tripId, amount, orderDesc, responseUrl } = await req.json()

    if (!tripId || amount == null) {
      return json({ error: 'Missing required fields: tripId, amount' }, 400)
    }

    const secretKey   = Deno.env.get('FLITT_SECRET_KEY')  ?? 'test'
    const merchantId  = Deno.env.get('FLITT_MERCHANT_ID') ?? '1549901'
    const siteUrl     = Deno.env.get('SITE_URL')          ?? 'http://localhost:5173'
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!

    const amountTetri = Math.round(Number(amount) * 100)
    const desc        = (orderDesc as string) ??
      `SkyBook Flight Booking ${String(tripId).slice(0, 8).toUpperCase()}`

    // Flitt POSTs to response_url with form data. A Vercel SPA can't accept
    // POST (returns 405), so we route through our flitt-redirect edge fn
    // which 303-redirects the browser onto /payment with query params.
    // The frontend can still override via `responseUrl` for debugging.
    const bridgeUrl        = `${supabaseUrl}/functions/v1/flitt-redirect`
    const finalResponseUrl = (responseUrl as string) || bridgeUrl

    // ── All signed params ────────────────────────────────────────────────────
    const params: Record<string, string | number> = {
      amount:              amountTetri,
      currency:            'GEL',
      merchant_id:         merchantId,
      order_desc:          desc,
      order_id:            tripId,
      response_url:        finalResponseUrl,
      server_callback_url: `${supabaseUrl}/functions/v1/flitt-callback`,
    }

    const { signature, stringToHash } = await buildSignature(secretKey, params)

    console.log('[Flitt] String being hashed:', stringToHash)
    console.log('[Flitt] Computed signature :', signature)

    const flittRes = await fetch('https://pay.flitt.com/api/checkout/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request: { ...params, signature } }),
    })

    const flittData = await flittRes.json()

    if (flittData?.response?.response_status !== 'success') {
      console.error('[Flitt] Token request failed:', JSON.stringify(flittData))
      return json({ error: 'Flitt rejected the order', details: flittData }, 502)
    }

    const token = flittData.response.token as string

    // ── Track this attempt in payment_intents so the client can poll for status
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { error: insertErr } = await supabase
      .from('payment_intents')
      .insert({ flitt_order_id: tripId, status: 'pending' })

    if (insertErr) {
      // Not fatal — log and continue. The widget still works; only polling breaks.
      console.warn('[Flitt] payment_intents insert failed:', insertErr)
    }

    return json({ token, orderId: tripId })
  } catch (err) {
    console.error('create-flitt-order error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
