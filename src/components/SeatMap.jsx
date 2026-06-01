import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatPrice } from '../utils/format'

const SECTIONS = [
  { label: 'First Class', fromRow: 1,  toRow: 2,  badge: 'text-amber-700 bg-amber-50 border-amber-200',  bg: 'bg-gradient-to-b from-amber-50 to-amber-50/10 rounded-xl px-2 pt-2 pb-3' },
  { label: 'Business',    fromRow: 3,  toRow: 6,  badge: 'text-indigo-700 bg-indigo-50 border-indigo-200', bg: 'bg-gradient-to-b from-blue-50 to-blue-50/10 rounded-xl px-2 pt-2 pb-3' },
  { label: 'Economy',     fromRow: 7,  toRow: 30, badge: 'text-slate-600  bg-slate-50  border-slate-200',  bg: '' },
]

export function getSeatSurcharge(seat) { return Number(seat?.extra_price ?? 0) }
export function getSeatLabel(seat) {
  const cls = seat?.class ?? 'economy'
  return cls.charAt(0).toUpperCase() + cls.slice(1)
}
export function getSeatDisplay(seat) { return `${seat.row_number}${seat.seat_letter}` }

function SeatButton({ displayKey, isOccupied, isSelected, canSelectMore, onClick }) {
  const disabled = isOccupied || (!isSelected && !canSelectMore)

  let cls
  if (isOccupied) {
    cls = 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
  } else if (isSelected) {
    cls = 'bg-blue-600 border-blue-700 text-white shadow-md scale-105'
  } else if (canSelectMore) {
    cls = 'bg-white border-blue-300 hover:bg-emerald-50 hover:border-emerald-400 hover:scale-110 cursor-pointer'
  } else {
    cls = 'bg-white border-blue-200 opacity-40 cursor-not-allowed'
  }

  return (
    <button
      type="button"
      onClick={() => !disabled && onClick()}
      disabled={disabled}
      title={isOccupied ? 'Occupied' : displayKey}
      aria-label={isOccupied ? `Seat ${displayKey} occupied` : `Seat ${displayKey}`}
      aria-pressed={isSelected}
      className={`w-8 h-8 rounded-md border text-xs font-bold transition-all duration-150 flex items-center justify-center ${cls}`}
    >
      {isOccupied ? '×' : isSelected ? '✓' : ''}
    </button>
  )
}

export default function SeatMap({ flightId, passengerCount = 1, selectedSeats, onSeatToggle }) {
  const [seats,   setSeats]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!flightId) return
    let cancelled = false

    setLoading(true)
    supabase
      .from('seats')
      .select('*')
      .eq('flight_id', flightId)
      .order('row_number')
      .order('seat_letter')
      .then(({ data }) => {
        if (!cancelled) { setSeats(data ?? []); setLoading(false) }
      })

    const channel = supabase
      .channel(`seats-${flightId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'seats', filter: `flight_id=eq.${flightId}` },
        payload => {
          if (!cancelled) setSeats(prev => prev.map(s => s.id === payload.new.id ? payload.new : s))
        },
      )
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [flightId])

  const seatMap       = Object.fromEntries(seats.map(s => [getSeatDisplay(s), s]))
  const selectedKeys  = new Set(selectedSeats.map(getSeatDisplay))
  const canSelectMore = selectedSeats.length < passengerCount

  if (loading) {
    return (
      <div className="flex flex-col items-center py-16 gap-3">
        <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading seat map…</p>
      </div>
    )
  }

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mb-5">
        {[
          { label: 'Available', cls: 'bg-white border-blue-300' },
          { label: 'Selected',  cls: 'bg-blue-600 border-blue-700' },
          { label: 'Occupied',  cls: 'bg-slate-100 border-slate-200' },
          { label: 'Hover',     cls: 'bg-emerald-50 border-emerald-400' },
        ].map(({ label, cls }) => (
          <span key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`inline-block w-4 h-4 rounded border ${cls}`} />
            {label}
          </span>
        ))}
      </div>

      {/* Cabin */}
      <div className="overflow-x-auto pb-1">
        <div className="inline-block min-w-[284px]">

          {/* Plane nose */}
          <div className="flex justify-center mb-1">
            <svg viewBox="0 0 284 58" style={{ width: '100%' }} fill="none" aria-hidden="true">
              <path d="M18 58 Q18 10 142 4 Q266 10 266 58" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
              <ellipse cx="106" cy="33" rx="14" ry="10" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.5" />
              <ellipse cx="178" cy="33" rx="14" ry="10" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.5" />
              <path d="M134 5 Q142 3 150 5" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* Column headers */}
          <div className="flex items-center gap-1 mb-3">
            <div className="w-7 shrink-0" />
            {['A', 'B', 'C'].map(c => (
              <div key={c} className="w-8 text-center text-xs font-bold text-slate-400 tracking-wider">{c}</div>
            ))}
            <div className="w-6 shrink-0" />
            {['D', 'E', 'F'].map(c => (
              <div key={c} className="w-8 text-center text-xs font-bold text-slate-400 tracking-wider">{c}</div>
            ))}
          </div>

          {SECTIONS.map(({ label, fromRow, toRow, badge, bg }) => {
            const sample    = seatMap[`${fromRow}A`]
            const surcharge = Number(sample?.extra_price ?? 0)
            return (
              <div key={label} className={`mb-4 ${bg}`}>
                <div className={`inline-flex items-center gap-1.5 text-xs font-semibold border rounded-full px-2.5 py-0.5 mb-2.5 ${badge}`}>
                  {label}
                  <span className="opacity-60">
                    {surcharge > 0 ? `· +${formatPrice(surcharge)}` : '· Included'}
                  </span>
                </div>

                {Array.from({ length: toRow - fromRow + 1 }, (_, i) => fromRow + i).map(row => (
                  <div key={row} className="flex items-center gap-1 mb-1">
                    <div className="w-7 text-right text-[10px] text-slate-400 pr-1 shrink-0 tabular-nums">{row}</div>
                    {['A', 'B', 'C'].map(col => {
                      const key  = `${row}${col}`
                      const seat = seatMap[key]
                      if (!seat) return <div key={col} className="w-8 h-8" />
                      return (
                        <SeatButton key={col} displayKey={key}
                          isOccupied={seat.is_occupied} isSelected={selectedKeys.has(key)}
                          canSelectMore={canSelectMore} onClick={() => onSeatToggle(seat)} />
                      )
                    })}
                    <div className="w-6 shrink-0 flex items-center justify-center">
                      <div className="h-4 w-px bg-slate-200" />
                    </div>
                    {['D', 'E', 'F'].map(col => {
                      const key  = `${row}${col}`
                      const seat = seatMap[key]
                      if (!seat) return <div key={col} className="w-8 h-8" />
                      return (
                        <SeatButton key={col} displayKey={key}
                          isOccupied={seat.is_occupied} isSelected={selectedKeys.has(key)}
                          canSelectMore={canSelectMore} onClick={() => onSeatToggle(seat)} />
                      )
                    })}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
