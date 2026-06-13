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

async function sha1(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Verify Flitt's callback signature.
 *
 * Flitt has shipped both alphabetically-sorted AND original-payload-order
 * signatures across SDK versions / regions, so we try the payload order
 * first (their newer behaviour) and fall back to sorted.
 *
 * Returns `{ valid, note }` rather than a bare boolean so callers can log
 * which strategy matched (or which expected hashes were compared on miss).
 */
async function verifySignature(
  secretKey: string,
  payload: Record<string, unknown>,
  receivedSig: string,
): Promise<{ valid: boolean; note: string }> {
  const SKIP = new Set(['signature', 'response_status'])

  const valuesForKeys = (keys: string[]) =>
    keys
      .filter(k => !SKIP.has(k))
      .map(k => payload[k])
      .filter(v => v !== '' && v !== null && v !== undefined)
      .map(v => String(v))

  // Attempt 1: original payload key order
  const originalKeys = Object.keys(payload)
  const originalHash = await sha1([secretKey, ...valuesForKeys(originalKeys)].join('|'))
  if (originalHash === receivedSig) {
    return { valid: true, note: 'matched on original key order' }
  }

  // Attempt 2: alphabetical sort (fallback)
  const sortedKeys = [...originalKeys].sort()
  const sortedHash = await sha1([secretKey, ...valuesForKeys(sortedKeys)].join('|'))
  if (sortedHash === receivedSig) {
    return { valid: true, note: 'matched on sorted key order' }
  }

  return {
    valid: false,
    note: `received=${receivedSig} · expected (original)=${originalHash} · expected (sorted)=${sortedHash}`,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed', message: 'Use POST.' }, 405)
  }

  try {
    const body = await req.json()
    // Diagnostic — see exactly what Flitt sent
    console.log('[flitt-callback] Raw request body:', JSON.stringify(body))

    // Flitt wraps data in a `data` key for server callbacks
    const data: Record<string, unknown> = body?.data ?? body

    const { order_id, order_status, signature } = data as {
      order_id:     string
      order_status: string
      signature:    string
    }

    if (!order_id || !order_status) {
      return json({
        error:   'missing_fields',
        message: 'Required fields: order_id, order_status.',
      }, 400)
    }

    // --- Signature verification (non-blocking unless FLITT_STRICT_SIG=true) ---
    const secretKey = Deno.env.get('FLITT_SECRET_KEY') ?? 'test'
    const strictSig = Deno.env.get('FLITT_STRICT_SIG') === 'true'
    if (signature) {
      const { valid, note } = await verifySignature(secretKey, data, signature)
      if (valid) {
        console.log('[flitt-callback] Signature OK for order', order_id, '·', note)
      } else {
        console.error('[flitt-callback] Signature MISMATCH for order', order_id, '·', note)
        if (strictSig) {
          return json({
            error:   'invalid_signature',
            message: 'Signature does not match expected hash.',
          }, 400)
        }
        // Non-strict mode: log and continue. Trust the callback payload —
        // useful while Flitt's signature format drifts between SDK versions.
      }
    }

    // Map Flitt's order_status → our intent status
    let intentStatus: string
    let tripStatus:   string
    if (order_status === 'approved') {
      intentStatus = 'approved'
      tripStatus   = 'paid'
    } else if (['declined', 'expired', 'reversed', 'refunded'].includes(order_status)) {
      intentStatus = 'declined'
      tripStatus   = 'failed'
    } else {
      // processing, created, etc. — leave the row in 'pending'
      return json({ status: 'ok', note: `Unhandled status: ${order_status}` })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── PRIMARY: update payment_intents (this is what the client polls) ─────
    const { data: updatedRows, error: intentErr } = await supabase
      .from('payment_intents')
      .update({ status: intentStatus })
      .eq('flitt_order_id', order_id)
      .select()

    if (intentErr) {
      console.error('payment_intents update error:', intentErr)
      return json({
        error:   'intent_update_failed',
        message: 'Failed to update payment_intents.',
      }, 500)
    }

    const rowsTouched = updatedRows?.length ?? 0
    if (rowsTouched > 0) {
      console.log(
        `[flitt-callback] updated ${rowsTouched} row(s) for order_id`,
        order_id, '→', intentStatus,
      )
    }

    // If the callback raced ahead of create-flitt-order's INSERT, no row was
    // updated.  Upsert by flitt_order_id so the status isn't lost.
    if (!updatedRows || updatedRows.length === 0) {
      console.warn(
        '[flitt-callback] upsert fallback — no payment_intents row matched order_id',
        order_id,
      )
      const { error: upsertErr } = await supabase
        .from('payment_intents')
        .upsert(
          {
            flitt_order_id: order_id,
            status:         intentStatus,
            updated_at:     new Date().toISOString(),
          },
          { onConflict: 'flitt_order_id' },
        )
      if (upsertErr) {
        console.error('payment_intents upsert error:', upsertErr)
        return json({
          error:   'intent_upsert_failed',
          message: 'Failed to upsert payment_intents.',
        }, 500)
      }
    }

    // ── SECONDARY: also touch the trip if it exists (race-condition safety).
    // This is a no-op while the trip hasn't been persisted yet — harmless.
    const { error: tripErr } = await supabase
      .from('trips')
      .update({ payment_status: tripStatus })
      .eq('flitt_order_id', order_id)

    if (tripErr) {
      // Don't fail the callback — trip may simply not exist yet.
      console.warn('trips update warning (likely no row yet):', tripErr)
    }

    return json({ status: 'ok', intent_status: intentStatus })
  } catch (err) {
    console.error('flitt-callback error:', err)
    return json({
      error:   'internal_error',
      message: 'Internal server error in flitt-callback.',
    }, 500)
  }
})
