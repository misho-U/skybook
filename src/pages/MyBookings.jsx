import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { AIRPORT_IMAGES, FALLBACK_IMAGE, calcDuration, formatPrice, formatDate, formatTime, formatDayMonth } from '../utils/format'
import { usePageTitle } from '../hooks/usePageTitle'
import { useRequireAuth } from '../hooks/useRequireAuth'

const LUGGAGE_LABEL = {
  cabin_only: { icon: '🎒', name: 'Cabin Only' },
  standard:   { icon: '🧳', name: 'Standard'   },
  comfort:    { icon: '🧳', name: 'Comfort'    },
  family:     { icon: '🧳🧳', name: 'Family'   },
}

/**
 * Skeleton card mirroring the shape of a real booking row — three are shown
 * while trips are being fetched. Avoids the layout pop that a centered
 * spinner causes when the list snaps in.
 */
function BookingSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-pulse">
      <div className="h-1 bg-gradient-to-r from-slate-100 to-slate-200" />
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <div className="h-6 w-24 bg-slate-100 rounded-full" />
            <div className="h-6 w-32 bg-slate-100 rounded-full" />
          </div>
          <div className="h-7 w-20 bg-slate-100 rounded" />
        </div>
        <div className="space-y-2 mb-4">
          <div className="h-4 w-2/3 bg-slate-100 rounded" />
          <div className="h-3 w-1/2 bg-slate-100 rounded" />
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 flex items-start gap-3">
          <div className="w-16 h-12 bg-slate-200 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/2 bg-slate-100 rounded" />
            <div className="h-3 w-1/3 bg-slate-100 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-28 bg-white rounded-2xl border border-slate-100 shadow-sm text-center px-4 animate-fade-in">
      <div className="relative mb-6">
        <span className="text-8xl leading-none select-none drop-shadow-sm">✈️</span>
        <div className="absolute -bottom-1 -right-2 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-500 text-lg shadow-sm border-2 border-white">
          +
        </div>
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">No bookings yet</h2>
      <p className="text-slate-500 text-sm mb-8 max-w-xs leading-relaxed">
        You haven't booked any flights yet. Start exploring destinations and find your next adventure!
      </p>
      <Link
        to="/"
        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 shadow-sm shadow-blue-200 btn-press transition-all"
      >
        Search Flights →
      </Link>
    </div>
  )
}

function CancelConfirm({ label, onConfirm, onCancel, cancelling }) {
  return (
    <div className="flex items-center gap-2 flex-wrap animate-fade-in">
      <span className="text-sm text-slate-600 font-medium">Cancel {label}?</span>
      <button
        onClick={onConfirm}
        disabled={cancelling}
        className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 btn-press transition-all disabled:opacity-60 flex items-center gap-1.5"
      >
        {cancelling && <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
        Yes, cancel
      </button>
      <button
        onClick={onCancel}
        disabled={cancelling}
        className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 btn-press transition-all"
      >
        Keep it
      </button>
    </div>
  )
}

function PaymentBadge() {
  // Trips are only persisted after a successful Flitt approval now,
  // so every row in My Bookings is paid by definition.
  return (
    <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
      <span className="text-[10px]">✓</span> Paid
    </span>
  )
}

function FlightLeg({ label, booking, accentClass }) {
  const f = booking.flight
  if (!f) return null
  const image = AIRPORT_IMAGES[f.destination?.code] ?? FALLBACK_IMAGE
  const duration = calcDuration(f.departure_time, f.arrival_time)
  const seats = booking.seats ?? []

  return (
    <div className={`rounded-xl border p-4 ${accentClass}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
          label === 'Outbound'
            ? 'bg-blue-100 text-blue-600'
            : 'bg-indigo-100 text-indigo-600'
        }`}>
          {label === 'Outbound' ? '→' : '←'} {label}
        </span>
        <span className="text-xs text-slate-400">{f.airline}</span>
      </div>

      <div className="flex items-start gap-3">
        <img
          src={image}
          alt={f.destination?.city}
          className="w-16 h-12 object-cover rounded-lg shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-slate-800">
              {f.origin?.code} → {f.destination?.code}
            </span>
            <span className="text-xs text-slate-400">{duration}</span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {formatTime(f.departure_time)} – {formatTime(f.arrival_time)}
            <span className="mx-1.5 text-slate-300">·</span>
            {formatDayMonth(f.departure_time)}
          </p>
          {seats.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {seats.map(seat => (
                <span
                  key={seat.id}
                  className="text-xs bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-100"
                >
                  {seat.row_number}{seat.seat_letter}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-slate-700">{formatPrice(Number(f.base_price))}</p>
          <p className="text-xs text-slate-400">base</p>
        </div>
      </div>
    </div>
  )
}

export default function MyBookings() {
  usePageTitle('My Bookings')
  const { addToast }  = useToast()
  const { user }      = useRequireAuth()

  const [trips,         setTrips]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [confirmingRef, setConfirmingRef] = useState(null)
  const [cancelling,    setCancelling]    = useState(false)

  useEffect(() => {
    if (!user) return

    supabase
      .from('trips')
      .select(`
        *,
        bookings(
          id,
          direction,
          seat:seats!seat_id(*),
          flight:flights!flight_id(
            *,
            origin:airports!fk_origin(*),
            destination:airports!fk_destination(*)
          )
        )
      `)
      .eq('user_id', user.id)
      .order('booked_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { console.error(error); setLoading(false); return }

        const rows = (data ?? []).map(trip => {
          const outboundBookings = trip.bookings.filter(b => b.direction === 'outbound')
          const returnBookings   = trip.bookings.filter(b => b.direction === 'return')

          const outboundFlight = outboundBookings[0]?.flight ?? null
          const returnFlight   = returnBookings[0]?.flight   ?? null

          const outLeg = outboundFlight ? {
            flight: outboundFlight,
            seats:  outboundBookings.map(b => b.seat).filter(Boolean),
          } : null

          const retLeg = returnFlight ? {
            flight: returnFlight,
            seats:  returnBookings.map(b => b.seat).filter(Boolean),
          } : null

          const allSeatIds = trip.bookings.map(b => b.seat?.id).filter(Boolean)

          const outPrice   = outboundFlight ? Number(outboundFlight.base_price) : 0
          const retPrice   = returnFlight   ? Number(returnFlight.base_price)   : 0
          const seatExtra  = trip.bookings.reduce((s, b) => s + Number(b.seat?.extra_price ?? 0), 0)
          const seatsCount = (trip.adults ?? trip.passenger_count ?? 1) + (trip.children ?? 0)
          const totalPrice = (outPrice + retPrice) * seatsCount + seatExtra

          return {
            tripId:        trip.id,
            tripRef:       trip.id.slice(0, 8).toUpperCase(),
            tripType:      trip.trip_type,
            paymentStatus: trip.payment_status ?? 'pending',
            paymentAmount: trip.payment_amount ?? totalPrice,
            passengerName:  trip.passenger_name,
            passengerEmail: trip.passenger_email,
            contactEmail:   trip.contact_email,
            contactPhone:   trip.contact_phone,
            passengerCount: trip.passenger_count,
            adults:         trip.adults,
            children:       trip.children,
            infants:        trip.infants,
            passengers:     trip.passengers,
            bookedAt:     trip.booked_at,
            outLeg,
            retLeg,
            allSeatIds,
            totalPrice,
          }
        })

        setTrips(rows)
        setLoading(false)
      })
  }, [user])

  async function handleCancel(trip) {
    setCancelling(true)
    try {
      await supabase.from('trips').delete().eq('id', trip.tripId)
      if (trip.allSeatIds.length > 0) {
        await supabase.from('seats').update({ is_occupied: false }).in('id', trip.allSeatIds)
      }

      // Prune this trip's flight IDs from the booked-IDs list so the
      // "Booked" badge disappears from those flight cards on Home/Results
      const cancelledFlightIds = [
        trip.outLeg?.flight?.id,
        trip.retLeg?.flight?.id,
      ].filter(Boolean)
      if (cancelledFlightIds.length > 0) {
        const existing  = JSON.parse(localStorage.getItem('skybook_flight_ids') || '[]')
        const remaining = existing.filter(id => !cancelledFlightIds.includes(id))
        localStorage.setItem('skybook_flight_ids', JSON.stringify(remaining))
      }

      setTrips(prev => prev.filter(t => t.tripId !== trip.tripId))
      addToast(`Trip ${trip.tripRef} has been cancelled.`, 'info')
      setConfirmingRef(null)
    } catch (err) {
      console.error(err)
      addToast('Failed to cancel booking. Please try again.', 'error')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">My Bookings</h1>
        <p className="text-slate-500 mt-1">
          {loading
            ? 'Loading your bookings…'
            : trips.length === 0
              ? 'No trips booked yet.'
              : `${trips.length} trip${trips.length > 1 ? 's' : ''} found`}
        </p>
      </div>

      {loading ? (
        <div className="space-y-5" aria-live="polite" aria-busy="true">
          <span className="sr-only">Loading your bookings…</span>
          <BookingSkeleton />
          <BookingSkeleton />
          <BookingSkeleton />
        </div>
      ) : trips.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-5">
          {trips.map((trip, i) => (
            <div
              key={trip.tripId}
              className="bg-white rounded-2xl border border-slate-100 shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden animate-fade-in-up animate-stagger"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Accent bar */}
              <div className={`h-1 bg-gradient-to-r ${
                trip.tripType === 'round_trip'
                  ? 'from-indigo-500 to-blue-500'
                  : 'from-blue-500 to-cyan-400'
              }`} />

              <div className="p-5">
                {/* Trip header */}
                <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                      trip.tripType === 'round_trip'
                        ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                        : 'bg-blue-50 text-blue-600 border-blue-200'
                    }`}>
                      {trip.tripType === 'round_trip' ? '↔ Round Trip' : '→ One Way'}
                    </span>
                    {(trip.adults > 0 || trip.passengerCount > 1) && (() => {
                      const a = trip.adults ?? trip.passengerCount ?? 1
                      const c = trip.children ?? 0
                      const inf = trip.infants ?? 0
                      const parts = [
                        `${a} adult${a !== 1 ? 's' : ''}`,
                        c   > 0 ? `${c} child${c !== 1 ? 'ren' : ''}`   : null,
                        inf > 0 ? `${inf} infant${inf !== 1 ? 's' : ''}` : null,
                      ].filter(Boolean)
                      return (
                        <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2.5 py-1 rounded-full">
                          {parts.join(', ')}
                        </span>
                      )
                    })()}
                    <span className="text-xs text-slate-400 font-mono">Ref: {trip.tripRef}</span>
                    <PaymentBadge />
                  </div>
                  <div className="text-right">
                    <p className="text-blue-600 font-extrabold text-xl leading-none">
                      {formatPrice(trip.totalPrice)}
                    </p>
                    <p className="text-slate-400 text-xs mt-0.5">total</p>
                  </div>
                </div>

                {/* Passengers */}
                <div className="mb-4">
                  {trip.passengers && trip.passengers.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {trip.passengers.map((p, i) => {
                        const outLug = p.luggageOutbound ? LUGGAGE_LABEL[p.luggageOutbound] : null
                        const retLug = p.luggageReturn   ? LUGGAGE_LABEL[p.luggageReturn]   : null
                        return (
                          <div key={i} className="flex flex-col gap-0.5">
                            <span className="text-xs bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-full self-start">
                              {p.firstName} {p.lastName}
                            </span>
                            {(outLug || retLug) && (
                              <span className="text-xs text-slate-400 pl-1 flex gap-2">
                                {outLug && (
                                  <span>{outLug.icon} {outLug.name}{retLug ? ' (out)' : ''}</span>
                                )}
                                {retLug && outLug?.name !== retLug?.name && (
                                  <span>{retLug.icon} {retLug.name} (ret)</span>
                                )}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-slate-700 mb-1">{trip.passengerName}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
                    {(trip.contactEmail || trip.passengerEmail) && (
                      <span>{trip.contactEmail || trip.passengerEmail}</span>
                    )}
                    <span className="text-slate-300">·</span>
                    <span>Booked {formatDate(trip.bookedAt)}</span>
                  </div>
                </div>

                {/* Flight legs */}
                <div className="space-y-3">
                  {trip.outLeg && (
                    <FlightLeg
                      label="Outbound"
                      booking={trip.outLeg}
                      accentClass="border-blue-100 bg-blue-50/30"
                    />
                  )}
                  {trip.retLeg && (
                    <FlightLeg
                      label="Return"
                      booking={trip.retLeg}
                      accentClass="border-indigo-100 bg-indigo-50/30"
                    />
                  )}
                </div>

                {/* Cancel */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                  {confirmingRef === trip.tripRef ? (
                    <CancelConfirm
                      label={`trip ${trip.tripRef}`}
                      onConfirm={() => handleCancel(trip)}
                      onCancel={() => setConfirmingRef(null)}
                      cancelling={cancelling}
                    />
                  ) : (
                    <button
                      onClick={() => setConfirmingRef(trip.tripRef)}
                      className="text-sm text-slate-400 hover:text-red-500 font-semibold transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50 btn-press"
                    >
                      Cancel booking
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
