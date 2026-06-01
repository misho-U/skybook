/**
 * Polls Flitt's order-status API server-side. Called from the browser as a
 * last-resort signal when neither the webhook (server_callback_url) nor the
 * redirect URL params delivered a status — typical in sandbox mode.
 *
 * Why an edge function and not a direct fetch from the browser:
 *   1. Flitt's API doesn't allow browser origins (CORS).
 *   2. Signing the request needs FLITT_SECRET_KEY, which must never ship
 *      in the JS bundle.
 *
 * Returns: { order_status, payment_id, raw }  on success
 *          { error, details }                 on failure
 */

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

async function sha1(stringToHash: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(stringToHash))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function buildSignature(
  secretKey: string,
  params: Record<string, string | number>,
): Promise<string> {
  const values = Object.keys(params)
    .sort()
    .map(k => params[k])
    .filter(v => v !== '' && v !== null && v !== undefined)
    .map(v => String(v))
  return sha1([secretKey, ...values].join('|'))
}

/** Try the user-specified endpoint first, then fall back to the documented one. */
const ENDPOINTS = [
  'https://pay.flitt.com/api/checkout/status',
  'https://pay.flitt.com/api/status/order_id',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const { orderId } = await req.json()
    if (!orderId) return json({ error: 'Missing orderId' }, 400)

    const secretKey  = Deno.env.get('FLITT_SECRET_KEY')  ?? 'test'
    const merchantId = Deno.env.get('FLITT_MERCHANT_ID') ?? '1549901'

    const params: Record<string, string | number> = {
      merchant_id: merchantId,
      order_id:    orderId,
    }

    const signature = await buildSignature(secretKey, params)
    const requestBody = JSON.stringify({ request: { ...params, signature } })

    console.log('[check-flitt-status] Order ID :', orderId)
    console.log('[check-flitt-status] Request  :', requestBody)

    let lastErrorDetails: unknown = null

    for (const endpoint of ENDPOINTS) {
      try {
        const flittRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
        })

        const flittData = await flittRes.json()
        console.log('[check-flitt-status] Endpoint:', endpoint)
        console.log('[check-flitt-status] Response:', JSON.stringify(flittData))

        if (flittData?.response?.response_status === 'success') {
          return json({
            order_status: flittData.response.order_status,
            payment_id:   flittData.response.payment_id,
            endpoint,
            raw:          flittData.response,
          })
        }

        lastErrorDetails = flittData
      } catch (err) {
        console.warn('[check-flitt-status] Endpoint failed:', endpoint, err)
        lastErrorDetails = String(err)
      }
    }

    return json(
      { error: 'All Flitt status endpoints failed', details: lastErrorDetails },
      502,
    )
  } catch (err) {
    console.error('check-flitt-status error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
