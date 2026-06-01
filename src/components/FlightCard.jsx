import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../utils/format'

/** Read the array of booked flight IDs from localStorage. */
function getBookedFlightIds() {
  try { return JSON.parse(localStorage.getItem('skybook_flight_ids') || '[]') }
  catch { return [] }
}

export default function FlightCard({ flight }) {
  const [isBooked] = useState(() => getBookedFlightIds().includes(flight.id))
  const [showConfirm, setShowConfirm] = useState(false)

  const buttonRef  = useRef(null)
  const popoverRef = useRef(null)

  // Dismiss the popover on outside click
  useEffect(() => {
    if (!showConfirm) return
    function onDown(e) {
      if (popoverRef.current?.contains(e.target)) return
      if (buttonRef.current?.contains(e.target))  return
      setShowConfirm(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showConfirm])

  const bookingUrl = `/booking?outbound=${flight.id}&adults=1&tripType=one_way`

  return (
    // overflow-hidden removed from the outer card so the popover can extend below;
    // image container now carries rounded-t-2xl to preserve the corner clipping.
    <div className="bg-white rounded-2xl border border-slate-100 card-hover shadow-sm group">
      <div className="relative h-44 overflow-hidden rounded-t-2xl">
        <img
          src={flight.image}
          alt={flight.city}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
        <span className="absolute bottom-3 left-3 text-white font-bold text-lg drop-shadow leading-none">
          {flight.city}
        </span>
        <span className="absolute bottom-3 right-3 bg-white/95 text-blue-700 text-xs font-bold px-2 py-1 rounded-full shadow-sm">
          {flight.code}
        </span>
        {isBooked && (
          <div className="absolute top-3 right-3 bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
            ✓ Booked
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="text-slate-500 text-sm mb-3">
          {flight.country}
          <span className="mx-1.5 text-slate-300">·</span>
          {flight.duration}
        </p>

        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-slate-400 text-xs block leading-none mb-0.5">From</span>
            <p className="text-blue-600 font-bold text-xl leading-none">{formatPrice(flight.price)}</p>
          </div>

          {/* Button + popover wrapper (relative anchor) */}
          <div className="relative">
            {isBooked ? (
              <button
                ref={buttonRef}
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-white border-2 border-blue-500 text-blue-600 hover:bg-blue-50 btn-press transition-colors flex items-center gap-1.5"
              >
                Book Again
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </button>
            ) : (
              <Link
                to={bookingUrl}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-200 btn-press"
              >
                Book Now
              </Link>
            )}

            {showConfirm && (
              <div
                ref={popoverRef}
                className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 p-3 z-30 animate-fade-in"
              >
                {/* little arrow */}
                <div className="absolute -top-1.5 right-6 w-3 h-3 bg-white border-l border-t border-slate-100 rotate-45" />

                <p className="text-sm text-slate-700 font-medium mb-3 leading-snug relative">
                  You already have a seat on this flight. Book another seat?
                </p>
                <div className="flex gap-2 relative">
                  <Link
                    to={bookingUrl}
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-center btn-press transition-colors"
                  >
                    Yes, book another
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowConfirm(false)}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 btn-press transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Booked-state label under the button */}
        {isBooked && (
          <p className="mt-2.5 text-xs text-emerald-600 font-semibold flex items-center gap-1 select-none">
            <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            You have a ticket for this flight
          </p>
        )}
      </div>
    </div>
  )
}
