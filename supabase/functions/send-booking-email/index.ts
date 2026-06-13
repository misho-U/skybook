import { buildEmailHtml, type EmailPayload } from './email-template.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json()
    const { to, bookingRef, tripType, passengers, flights, seats, totalPrice } = body

    if (!to || !bookingRef || !flights?.outbound) {
      return json({
        error:   'missing_fields',
        message: 'Required fields: to, bookingRef, flights.outbound.',
      }, 400)
    }

    const payload: EmailPayload = { bookingRef, tripType, passengers, flights, seats, totalPrice }
    const html = buildEmailHtml(payload)

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SkyBook <onboarding@resend.dev>',
        to: [to],
        subject: `Booking Confirmed – ${bookingRef} ✈️`,
        html,
      }),
    })

    if (!resendRes.ok) {
      const detail = await resendRes.text()
      console.error('Resend error:', detail)
      return json({
        error:   'email_provider_failed',
        message: 'Resend rejected the email send request.',
        details: detail,
      }, 502)
    }

    return json({ success: true })
  } catch (err) {
    console.error('send-booking-email error:', err)
    return json({
      error:   'internal_error',
      message: 'Internal server error while sending the confirmation email.',
    }, 500)
  }
})
