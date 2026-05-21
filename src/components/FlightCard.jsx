import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../utils/format'
import { getLocalTrips } from '../lib/queries'

export default function FlightCard({ flight }) {
  const [isBooked] = useState(() =>
    getLocalTrips().some(t => t.outboundFlightId === flight.id)
  )

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden card-hover shadow-sm group">
      <div className="relative h-44 overflow-hidden">
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
          {isBooked ? (
            <Link to="/my-bookings"
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 btn-press">
              View booking
            </Link>
          ) : (
            <Link to={`/booking?outbound=${flight.id}&adults=1&tripType=one_way`}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-200 btn-press">
              Book Now
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
