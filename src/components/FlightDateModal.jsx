import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PriceCalendar from './PriceCalendar'
import { formatSearchDate } from '../utils/format'

/** Groups flights by date, keeping the cheapest flight per date. */
function buildFlightsByDate(flights) {
  const map = new Map()
  for (const f of flights ?? []) {
    const ds    = f.departure_time.slice(0, 10)
    const price = Number(f.base_price)
    const curr  = map.get(ds)
    if (!curr || price < curr.price) {
      map.set(ds, { price, airline: f.airline, time: f.departure_time })
    }
  }
  return map
}

export default function FlightDateModal({ destination, kutId, onClose }) {
  const navigate = useNavigate()

  const [isOneWay,        setIsOneWay]        = useState(false)
  const [departDate,      setDepartDate]      = useState(null)
  const [returnDate,      setReturnDate]      = useState(null)
  const [outboundFlights, setOutboundFlights] = useState(null)
  const [returnFlights,   setReturnFlights]   = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('flights')
        .select('departure_time, base_price, airline')
        .eq('origin_id',      kutId)
        .eq('destination_id', destination.id),
      supabase.from('flights')
        .select('departure_time, base_price, airline')
        .eq('origin_id',      destination.id)
        .eq('destination_id', kutId),
    ]).then(([out, ret]) => {
      setOutboundFlights(buildFlightsByDate(out.data))
      setReturnFlights(buildFlightsByDate(ret.data))
    })
  }, [kutId, destination.id])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleSearch() {
    if (!departDate) return
    const params = new URLSearchParams({
      origin:      'Kutaisi',
      destination: destination.city,
      adults:      '1',
      tripType:    isOneWay ? 'one_way' : 'round_trip',
    })
    params.set('departure', departDate)
    if (!isOneWay && returnDate) params.set('return', returnDate)
    onClose()
    navigate(`/results?${params.toString()}`)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Route</p>
            <h2 className="text-lg font-extrabold text-slate-800">
              Kutaisi → {destination.city}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setIsOneWay(v => !v); setReturnDate(null) }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                isOneWay
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              One Way
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Calendars */}
        <div className={`p-6 flex flex-col md:flex-row gap-8`}>
          <PriceCalendar
            label="Departure"
            flightsByDate={outboundFlights}
            selectedDate={departDate}
            onSelect={setDepartDate}
          />
          {!isOneWay && (
            <>
              <div className="hidden md:block w-px bg-slate-100 self-stretch" />
              <PriceCalendar
                label="Return"
                flightsByDate={returnFlights}
                selectedDate={returnDate}
                onSelect={setReturnDate}
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2 text-sm">
            {departDate ? (
              <span className="bg-blue-50 text-blue-700 font-semibold px-3 py-1 rounded-full border border-blue-100">
                ✈ {formatSearchDate(departDate)}
              </span>
            ) : (
              <span className="text-slate-400 text-sm">Select a departure date</span>
            )}
            {!isOneWay && returnDate && (
              <span className="bg-indigo-50 text-indigo-700 font-semibold px-3 py-1 rounded-full border border-indigo-100">
                ↩ {formatSearchDate(returnDate)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={!departDate}
            className="px-5 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed btn-press transition-all shadow-sm shadow-blue-200"
          >
            Search Flights →
          </button>
        </div>

      </div>
    </div>,
    document.body
  )
}
