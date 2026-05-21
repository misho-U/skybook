import { AIRPORT_IMAGES, FALLBACK_IMAGE, calcDuration, formatTime, formatDayMonth } from '../../utils/format'

export default function FlightHeader({ flight, label, accent = 'blue' }) {
  if (!flight) return null
  const image = AIRPORT_IMAGES[flight.destination?.code ?? ''] ?? FALLBACK_IMAGE
  const dep   = formatTime(flight.departure_time)
  const arr   = formatTime(flight.arrival_time)
  const dur   = calcDuration(flight.departure_time, flight.arrival_time)
  const date  = formatDayMonth(flight.departure_time)

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border mb-1
      ${accent === 'indigo' ? 'bg-indigo-50 border-indigo-100' : 'bg-blue-50 border-blue-100'}`}>
      <img src={image} alt="" className="w-12 h-9 rounded-lg object-cover shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold uppercase tracking-wide ${accent === 'indigo' ? 'text-indigo-500' : 'text-blue-500'}`}>
            {label}
          </span>
          <span className="text-sm font-bold text-slate-800">
            {flight.origin?.code} → {flight.destination?.code}
          </span>
          <span className="text-xs text-slate-400">{date}</span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{flight.airline} · {dep}–{arr} · {dur}</p>
      </div>
    </div>
  )
}
