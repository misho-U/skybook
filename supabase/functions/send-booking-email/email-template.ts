interface Flight {
  departure_time: string
  arrival_time: string
  airline: string
  base_price: number | string
  origin?: { code: string; city: string }
  destination?: { code: string; city: string }
}

interface Seat {
  row_number: number
  seat_letter: string
  extra_price?: number | string
}

interface Passenger {
  firstName: string
  lastName: string
  type: 'adult' | 'child' | 'infant'
  luggageOutbound?: string
  luggageReturn?: string
}

export interface EmailPayload {
  bookingRef: string
  tripType: string
  passengers: Passenger[]
  flights: { outbound: Flight; return?: Flight }
  seats: { outbound: Seat[]; return?: Seat[] }
  totalPrice: number
}

const LUGGAGE_NAMES: Record<string, string> = {
  cabin_only: 'Cabin Only',
  standard:   'Standard (20 kg)',
  comfort:    'Comfort (32 kg)',
  family:     'Family (2×20 kg)',
}

const TYPE_LABELS: Record<string, string> = { adult: 'Adult', child: 'Child', infant: 'Infant' }

function fmtTime(dt: string) {
  try { return new Date(dt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) }
  catch { return dt }
}

function fmtDate(dt: string) {
  try { return new Date(dt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) }
  catch { return dt }
}

function fmtPrice(n: number) {
  return '$' + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '')
}

function calcDur(dep: string, arr: string) {
  const diff = new Date(arr).getTime() - new Date(dep).getTime()
  return `${Math.floor(diff / 3_600_000)}h ${Math.floor((diff % 3_600_000) / 60_000)}m`
}

function flightBlock(flight: Flight, label: string, flightSeats: Seat[], accent: string) {
  const seatList = flightSeats.length
    ? flightSeats.map(s => `${s.row_number}${s.seat_letter}`).join(', ')
    : '—'
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <tr><td style="background:${accent};padding:10px 20px;">
      <span style="font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:1px;">${label}</span>
    </td></tr>
    <tr><td style="padding:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="text-align:center;width:90px;">
            <p style="margin:0;font-size:26px;font-weight:900;color:#0f172a;font-family:monospace,Courier New,Courier;">${fmtTime(flight.departure_time)}</p>
            <p style="margin:4px 0 0;font-size:13px;font-weight:700;color:#334155;">${flight.origin?.code ?? '—'}</p>
            <p style="margin:2px 0 0;font-size:11px;color:#94a3b8;">${flight.origin?.city ?? ''}</p>
          </td>
          <td style="text-align:center;padding:0 12px;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">${calcDur(flight.departure_time, flight.arrival_time)}</p>
            <p style="margin:8px 0;font-size:14px;color:#cbd5e1;letter-spacing:2px;">─── ✈ ───</p>
            <span style="font-size:10px;font-weight:700;color:#059669;background:#d1fae5;padding:2px 10px;border-radius:999px;">Non-stop</span>
          </td>
          <td style="text-align:center;width:90px;">
            <p style="margin:0;font-size:26px;font-weight:900;color:#0f172a;font-family:monospace,Courier New,Courier;">${fmtTime(flight.arrival_time)}</p>
            <p style="margin:4px 0 0;font-size:13px;font-weight:700;color:#334155;">${flight.destination?.code ?? '—'}</p>
            <p style="margin:2px 0 0;font-size:11px;color:#94a3b8;">${flight.destination?.city ?? ''}</p>
          </td>
        </tr>
      </table>
      <p style="margin:14px 0 0;padding-top:12px;border-top:1px solid #f1f5f9;font-size:12px;color:#64748b;">
        <strong style="color:#334155;">${flight.airline}</strong> &nbsp;·&nbsp; ${fmtDate(flight.departure_time)}
        &nbsp;·&nbsp; <strong style="color:#1d4ed8;">Seats: ${seatList}</strong>
      </p>
    </td></tr>
  </table>`
}

export function buildEmailHtml(data: EmailPayload): string {
  const { bookingRef, tripType, passengers, flights, seats, totalPrice } = data
  const isRoundTrip = tripType === 'round_trip'
  const outFlight = flights.outbound
  const retFlight = isRoundTrip ? (flights.return ?? null) : null
  const outSeats  = seats.outbound ?? []
  const retSeats  = seats.return ?? []

  const seatsNeeded  = passengers.filter(p => p.type !== 'infant').length
  const baseFare     = (Number(outFlight?.base_price ?? 0) + (retFlight ? Number(retFlight.base_price) : 0)) * seatsNeeded
  const seatExtras   = [...outSeats, ...retSeats].reduce((s, seat) => s + Number(seat.extra_price ?? 0), 0)
  const luggageCost  = Math.max(0, totalPrice - baseFare - seatExtras)

  const passengerRows = passengers.map((p, i) => {
    const lug    = p.type !== 'infant' ? (LUGGAGE_NAMES[p.luggageOutbound ?? ''] ?? 'Cabin Only') : '—'
    const retLug = isRoundTrip && p.type !== 'infant' ? (LUGGAGE_NAMES[p.luggageReturn ?? ''] ?? 'Cabin Only') : null
    return `<tr style="background:${i % 2 === 0 ? '#f8fafc' : '#ffffff'}">
      <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#0f172a;border-bottom:1px solid #f1f5f9;">${p.firstName} ${p.lastName}</td>
      <td style="padding:10px 16px;font-size:12px;color:#64748b;border-bottom:1px solid #f1f5f9;">${TYPE_LABELS[p.type] ?? p.type}</td>
      <td style="padding:10px 16px;font-size:12px;color:#1d4ed8;border-bottom:1px solid #f1f5f9;">${lug}${retLug ? `<br><span style="color:#4f46e5">↩ ${retLug}</span>` : ''}</td>
    </tr>`
  }).join('')

  const priceRows = [
    [`Base fare${isRoundTrip ? ' × 2 legs' : ''} × ${seatsNeeded} pax`, fmtPrice(baseFare)],
    ...(seatExtras  > 0 ? [['Seat upgrades',  `+${fmtPrice(seatExtras)}`]]  : []),
    ...(luggageCost > 0 ? [['Luggage add-ons', `+${fmtPrice(luggageCost)}`]] : []),
  ].map(([label, amt]) => `<tr>
    <td style="padding:9px 20px;font-size:13px;color:#475569;border-bottom:1px solid #f8fafc;">${label}</td>
    <td style="padding:9px 20px;font-size:13px;color:#334155;text-align:right;border-bottom:1px solid #f8fafc;">${amt}</td>
  </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Booking Confirmed – ${bookingRef}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.08);">

  <tr><td style="background:linear-gradient(135deg,#1e40af 0%,#4f46e5 100%);padding:36px 40px;text-align:center;">
    <p style="margin:0;font-size:30px;font-weight:900;color:#fff;letter-spacing:-0.5px;">✈️ SkyBook</p>
    <p style="margin:6px 0 0;font-size:11px;font-weight:700;color:#bfdbfe;letter-spacing:2px;text-transform:uppercase;">Flight Booking Confirmation</p>
  </td></tr>

  <tr><td style="padding:40px 40px 28px;text-align:center;border-bottom:2px solid #f1f5f9;">
    <table cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 20px;"><tr>
      <td width="72" height="72" style="background:#d1fae5;border-radius:36px;text-align:center;vertical-align:middle;font-size:36px;color:#059669;font-weight:900;">&#10003;</td>
    </tr></table>
    <h1 style="margin:0;font-size:28px;font-weight:900;color:#0f172a;">Booking Confirmed!</h1>
    <p style="margin:10px 0 0;font-size:15px;color:#64748b;">Your seats are reserved. Have an amazing flight!</p>
  </td></tr>

  <tr><td style="padding:28px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="background:#eff6ff;border:2px solid #bfdbfe;border-radius:14px;padding:20px;text-align:center;">
        <p style="margin:0;font-size:11px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:2px;">Booking Reference</p>
        <p style="margin:10px 0 0;font-size:34px;font-weight:900;color:#1d4ed8;letter-spacing:6px;font-family:monospace,Courier New,Courier;">${bookingRef}</p>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:0 40px 12px;">
    <p style="margin:0 0 16px;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;">Flight Details</p>
    ${flightBlock(outFlight, isRoundTrip ? '→ Outbound' : '→ Your Flight', outSeats, '#2563eb')}
    ${retFlight ? flightBlock(retFlight, '← Return', retSeats, '#4f46e5') : ''}
  </td></tr>

  <tr><td style="padding:0 40px 28px;">
    <p style="margin:0 0 14px;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;">Passengers</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <tr style="background:#f8fafc;">
        <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;text-align:left;border-bottom:1px solid #e2e8f0;">Name</th>
        <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;text-align:left;border-bottom:1px solid #e2e8f0;">Type</th>
        <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;text-align:left;border-bottom:1px solid #e2e8f0;">Luggage</th>
      </tr>
      ${passengerRows}
    </table>
  </td></tr>

  <tr><td style="padding:0 40px 36px;">
    <p style="margin:0 0 14px;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;">Price Breakdown</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      ${priceRows}
      <tr style="background:#eff6ff;">
        <td style="padding:14px 20px;font-size:15px;font-weight:900;color:#0f172a;border-top:2px solid #bfdbfe;">Total</td>
        <td style="padding:14px 20px;font-size:20px;font-weight:900;color:#1d4ed8;text-align:right;border-top:2px solid #bfdbfe;">${fmtPrice(totalPrice)}</td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:28px 40px;text-align:center;">
    <p style="margin:0;font-size:14px;color:#64748b;">Thank you for booking with <strong style="color:#1d4ed8;">SkyBook</strong> ✈️</p>
    <p style="margin:8px 0 0;font-size:11px;color:#94a3b8;">This is an automated confirmation. Please do not reply to this email.</p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`
}
