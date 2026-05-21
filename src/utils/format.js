export const AIRPORT_IMAGES = {
  JFK: 'https://images.unsplash.com/photo-1500916434205-0c77489c6cf7?w=600&q=80',
  LHR: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&q=80',
  CDG: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80',
  DXB: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80',
  NRT: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80',
  IST: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=600&q=80',
  BCN: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=600&q=80',
  FCO: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=600&q=80',
  AMS: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=600&q=80',
  SIN: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&q=80',
}

export const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&q=80'

export function calcDuration(departure, arrival) {
  const mins = Math.round((new Date(arrival) - new Date(departure)) / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function normalizeDbFlight(f) {
  return {
    id:             f.id,
    city:           f.destination.city,
    country:        f.destination.country,
    code:           f.destination.code,
    flag:           f.destination.flag,
    airline:        f.airline,
    image:          AIRPORT_IMAGES[f.destination.code] ?? FALLBACK_IMAGE,
    price:          Number(f.base_price),
    duration:       calcDuration(f.departure_time, f.arrival_time),
    departure_time: f.departure_time,
    arrival_time:   f.arrival_time,
    origin:         f.origin,
    destination:    f.destination,
  }
}

export function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  })
}

export function formatDayMonth(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

export function formatPrice(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

export function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// "2026-06-12" → "Jun 12, 2026" without timezone shift
export function formatSearchDate(dateStr) {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
