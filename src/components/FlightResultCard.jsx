import { formatTime, formatPrice, calcDuration } from '../utils/format'

export default function FlightResultCard({ flight, selected, onSelect }) {
  const departure = formatTime(flight.departure_time)
  const arrival   = formatTime(flight.arrival_time)
  const duration  = calcDuration(flight.departure_time, flight.arrival_time)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-2xl border p-4 transition-all duration-150 group
        ${selected
          ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200'
          : 'border-slate-100 bg-white shadow-sm hover:border-blue-300 hover:shadow-md'
        }`}
    >
      {/* Airline + selected badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500">{flight.airline}</span>
        {selected
          ? <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">✓ Selected</span>
          : <span className="text-xs text-slate-300 group-hover:text-blue-400 font-semibold transition-colors">Select →</span>
        }
      </div>

      {/* Time row */}
      <div className="flex items-center gap-2 mb-3">
        <div className="text-center shrink-0">
          <p className="text-xl font-extrabold text-slate-800 tabular-nums">{departure}</p>
          <p className="text-xs font-bold text-slate-400 mt-0.5">{flight.origin?.code ?? '—'}</p>
        </div>

        <div className="flex-1 flex flex-col items-center">
          <p className="text-xs text-slate-400 mb-1">{duration}</p>
          <div className="w-full flex items-center gap-1">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-slate-300 text-xs">✈</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <p className="text-xs text-slate-400 mt-1">Non-stop</p>
        </div>

        <div className="text-center shrink-0">
          <p className="text-xl font-extrabold text-slate-800 tabular-nums">{arrival}</p>
          <p className="text-xs font-bold text-slate-400 mt-0.5">{flight.destination?.code ?? '—'}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <span className="text-xs text-slate-400 truncate pr-2">
          {flight.origin?.city} → {flight.destination?.city}
        </span>
        <span className={`text-base font-bold shrink-0 ${selected ? 'text-blue-600' : 'text-slate-800'}`}>
          {formatPrice(flight.price)}
        </span>
      </div>
    </button>
  )
}
