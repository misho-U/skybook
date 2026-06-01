import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { FLIGHT_SELECT } from '../lib/queries'
import { getSeatSurcharge } from '../components/SeatMap'
import { luggagePrice } from '../components/LuggageSelector'
import { formatPrice, formatDayMonth } from '../utils/format'
import { useRequireAuth } from '../hooks/useRequireAuth'
import ProgressBar      from '../components/booking/ProgressBar'
import FlightHeader     from '../components/booking/FlightHeader'
import StepSeatSelection  from '../components/booking/StepSeatSelection'
import StepLuggage        from '../components/booking/StepLuggage'
import StepPassengerInfo  from '../components/booking/StepPassengerInfo'
import StepConfirmation   from '../components/booking/StepConfirmation'

function StickyFlightBar({ outboundFlight, isRoundTrip, adults, children, infants, total }) {
  const origin = outboundFlight?.origin?.code ?? '—'
  const dest   = outboundFlight?.destination?.city ?? '—'
  const date   = outboundFlight ? formatDayMonth(outboundFlight.departure_time) : ''
  const pax    = [
    `${adults} adult${adults !== 1 ? 's' : ''}`,
    children > 0 && `${children} child${children !== 1 ? 'ren' : ''}`,
    infants  > 0 && `${infants} infant${infants !== 1 ? 's' : ''}`,
  ].filter(Boolean).join(', ')

  return (
    <div className="sticky top-16 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-100 shadow-sm">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 text-sm">
          <span className="font-bold text-slate-800 shrink-0">
            {origin} → {dest}{isRoundTrip ? ' ↔' : ''}
          </span>
          {date && (
            <>
              <span className="text-slate-300 hidden sm:inline">·</span>
              <span className="text-slate-500 hidden sm:inline shrink-0">{date}</span>
            </>
          )}
          <span className="text-slate-300 hidden sm:inline">·</span>
          <span className="text-slate-500 hidden sm:inline truncate">{pax}</span>
        </div>
        <span className="font-extrabold text-blue-600 text-base shrink-0">{formatPrice(total)}</span>
      </div>
    </div>
  )
}

function buildSteps(isRoundTrip) {
  return isRoundTrip
    ? ['Outbound Seat', 'Return Seat', 'Luggage', 'Passenger Info', 'Confirmation']
    : ['Seat Selection', 'Luggage', 'Passenger Info', 'Confirmation']
}

export default function Booking() {
  const { user }       = useRequireAuth()
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const { addToast }   = useToast()

  const outboundId  = searchParams.get('outbound')  || ''
  const returnId    = searchParams.get('return')    || ''
  const tripType    = searchParams.get('tripType')  || 'one_way'
  const isRoundTrip = tripType === 'round_trip'

  const adults      = Math.min(9, Math.max(1, parseInt(searchParams.get('adults')   || '1', 10)))
  const children    = Math.min(9, Math.max(0, parseInt(searchParams.get('children') || '0', 10)))
  const infants     = Math.min(9, Math.max(0, parseInt(searchParams.get('infants')  || '0', 10)))
  const seatsNeeded = adults + children

  const STEPS = buildSteps(isRoundTrip)

  const [outboundFlight, setOutboundFlight] = useState(null)
  const [returnFlight,   setReturnFlight]   = useState(null)
  const [isLoadingFlight, setIsLoadingFlight] = useState(true)
  const [flightError,    setFlightError]    = useState(null)

  const [step,          setStep]         = useState(1)
  const [outboundSeats, setOutboundSeats] = useState([])
  const [returnSeats,   setReturnSeats]   = useState([])
  const [luggage,       setLuggage]       = useState(() =>
    Array.from({ length: seatsNeeded }, () => ({ outbound: 'cabin_only', return: 'cabin_only' }))
  )
  const [passengers, setPassengers] = useState(() => [
    ...Array.from({ length: adults },   () => ({ type: 'adult',  firstName: '', lastName: '', dob: '', passport: '' })),
    ...Array.from({ length: children }, () => ({ type: 'child',  firstName: '', lastName: '', dob: '', passport: '' })),
    ...Array.from({ length: infants },  () => ({ type: 'infant', firstName: '', lastName: '', dob: '' })),
  ])
  const [contact,      setContact]     = useState({ email: '', phone: '' })
  const [isConfirming, setIsConfirming] = useState(false)
  const [seatError,    setSeatError]   = useState(null)

  const runningTotal = useMemo(() => {
    const base      = (Number(outboundFlight?.base_price ?? 0) + (isRoundTrip ? Number(returnFlight?.base_price ?? 0) : 0)) * seatsNeeded
    const seatExtra = [...outboundSeats, ...returnSeats].reduce((s, seat) => s + getSeatSurcharge(seat), 0)
    const lugExtra  = luggage.reduce((s, l) => s + luggagePrice(l.outbound) + (isRoundTrip ? luggagePrice(l.return) : 0), 0)
    return base + seatExtra + lugExtra
  }, [outboundFlight, returnFlight, isRoundTrip, seatsNeeded, outboundSeats, returnSeats, luggage])

  useEffect(() => {
    if (user?.email) setContact(prev => ({ ...prev, email: prev.email || user.email }))
  }, [user?.email])

  usePageTitle(outboundFlight ? `Book · ${outboundFlight.destination?.city}${isRoundTrip ? ' ↔' : ''}` : 'Book Flight')

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  useEffect(() => {
    if (!outboundId) { setFlightError('No flight selected.'); setIsLoadingFlight(false); return }

    const fetchReturn = isRoundTrip && returnId
      ? supabase.from('flights').select(FLIGHT_SELECT).eq('id', returnId).single()
      : Promise.resolve({ data: null, error: null })

    Promise.all([
      supabase.from('flights').select(FLIGHT_SELECT).eq('id', outboundId).single(),
      fetchReturn,
    ]).then(([out, ret]) => {
      if (out.error || !out.data) { setFlightError('Outbound flight not found.'); setIsLoadingFlight(false); return }
      if (isRoundTrip && (ret.error || !ret.data)) { setFlightError('Return flight not found.'); setIsLoadingFlight(false); return }
      setOutboundFlight(out.data)
      setReturnFlight(ret.data)
      setIsLoadingFlight(false)
    })
  }, [outboundId, returnId, isRoundTrip])

  // Non-blocking: just a flag so we can show an info banner.
  // The user can still complete the booking — FlightCard already warned them.
  const bookedFlightIds = (() => {
    try { return JSON.parse(localStorage.getItem('skybook_flight_ids') || '[]') }
    catch { return [] }
  })()
  const isAlreadyBooked = bookedFlightIds.includes(outboundId)
    || (isRoundTrip && returnId && bookedFlightIds.includes(returnId))

  // Step indices (1-based)
  // One-way:    1=Seat, 2=Luggage, 3=Passenger, 4=Confirm
  // Round-trip: 1=OutSeat, 2=RetSeat, 3=Luggage, 4=Passenger, 5=Confirm
  const luggageStep   = isRoundTrip ? 3 : 2
  const passengerStep = isRoundTrip ? 4 : 3
  const confirmStep   = isRoundTrip ? 5 : 4

  /**
   * Stashes the booking inputs in sessionStorage and navigates to /payment.
   * The trip is NOT persisted to Supabase yet — that happens in PaymentResult.jsx
   * only after Flitt approves the payment.  This avoids stranded trip rows when
   * the user abandons or fails payment.
   */
  function handleConfirm(total) {
    setIsConfirming(true)
    setSeatError(null)
    try {
      const passengersWithLuggage = passengers.map((p, i) =>
        p.type === 'infant' ? p : {
          ...p,
          luggageOutbound: luggage[i]?.outbound ?? 'cabin_only',
          ...(isRoundTrip ? { luggageReturn: luggage[i]?.return ?? 'cabin_only' } : {}),
        }
      )

      sessionStorage.setItem('pending_booking', JSON.stringify({
        tripType,
        adults,
        children,
        infants,
        passengers:       passengersWithLuggage,
        contactEmail:     contact.email,
        contactPhone:     contact.phone,
        outboundFlightId: outboundId,
        returnFlightId:   isRoundTrip ? returnId : null,
        outboundSeatIds:  outboundSeats.map(s => s.id),
        returnSeatIds:    returnSeats.map(s => s.id),
        // Full flight/seat objects so PaymentResult can render success + email
        outboundFlight,
        returnFlight:     isRoundTrip ? returnFlight : null,
        outboundSeats,
        returnSeats,
        total,
      }))

      navigate('/payment')
    } catch (err) {
      console.error(err)
      addToast('Something went wrong. Please try again.', 'error')
      setIsConfirming(false)
    }
  }

  if (isLoadingFlight) {
    return (
      <main className="max-w-xl mx-auto px-4 py-32 flex flex-col items-center gap-4 animate-fade-in">
        <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading flight details…</p>
      </main>
    )
  }

  if (flightError || !outboundFlight) {
    return (
      <main className="max-w-xl mx-auto px-4 py-24 text-center animate-fade-in">
        <p className="text-7xl mb-5">✈️</p>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Flight not found</h1>
        <p className="text-slate-500 mb-8 text-sm">{flightError ?? "That flight ID doesn't exist in our system."}</p>
        <Link to="/" className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 btn-press transition-all">
          ← Browse Flights
        </Link>
      </main>
    )
  }

  return (
    <>
    <StickyFlightBar
      outboundFlight={outboundFlight}
      isRoundTrip={isRoundTrip}
      adults={adults}
      children={children}
      infants={infants}
      total={runningTotal}
    />
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <Link to="/results" className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors">
          ← Back to results
        </Link>

        {isAlreadyBooked && (
          <div className="mt-4 flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-100 rounded-xl animate-fade-in">
            <span className="text-base leading-none mt-0.5 select-none" aria-hidden="true">ℹ️</span>
            <p className="text-sm text-blue-700 leading-snug">
              <span className="font-semibold">You already have a seat on this flight.</span>{' '}
              You're booking an additional seat.
            </p>
          </div>
        )}

        <div className="mt-4 space-y-1.5">
          <FlightHeader flight={outboundFlight} label={isRoundTrip ? 'Outbound' : 'Flight'} accent="blue" />
          {isRoundTrip && returnFlight && (
            <FlightHeader flight={returnFlight} label="Return" accent="indigo" />
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="text-xs bg-blue-50 text-blue-600 font-semibold px-2.5 py-1 rounded-full border border-blue-100">
            {adults} adult{adults > 1 ? 's' : ''}
          </span>
          {children > 0 && (
            <span className="text-xs bg-green-50 text-green-600 font-semibold px-2.5 py-1 rounded-full border border-green-100">
              {children} child{children > 1 ? 'ren' : ''}
            </span>
          )}
          {infants > 0 && (
            <span className="text-xs bg-orange-50 text-orange-600 font-semibold px-2.5 py-1 rounded-full border border-orange-100">
              {infants} infant{infants > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <ProgressBar steps={STEPS} current={step} />

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
        <h2 className="text-base font-bold text-slate-800 mb-6 pb-4 border-b border-slate-100">
          {STEPS[step - 1]}
        </h2>

        {step === 1 && (
          <StepSeatSelection
            flight={outboundFlight}
            label={isRoundTrip ? 'Outbound' : 'Flight'}
            accent="blue"
            seatsNeeded={seatsNeeded}
            selectedSeats={outboundSeats}
            setSelectedSeats={seats => { setOutboundSeats(seats); setReturnSeats([]) }}
            onNext={() => setStep(isRoundTrip ? 2 : luggageStep)}
          />
        )}

        {isRoundTrip && step === 2 && (
          <StepSeatSelection
            flight={returnFlight}
            label="Return"
            accent="indigo"
            seatsNeeded={seatsNeeded}
            selectedSeats={returnSeats}
            setSelectedSeats={setReturnSeats}
            onNext={() => setStep(luggageStep)}
            onBack={() => setStep(1)}
          />
        )}

        {step === luggageStep && (
          <StepLuggage
            adults={adults}
            children={children}
            isRoundTrip={isRoundTrip}
            luggage={luggage}
            setLuggage={setLuggage}
            onBack={() => setStep(step - 1)}
            onNext={() => setStep(passengerStep)}
          />
        )}

        {step === passengerStep && (
          <StepPassengerInfo
            adults={adults}
            children={children}
            infants={infants}
            passengers={passengers}
            setPassengers={setPassengers}
            contact={contact}
            setContact={setContact}
            onBack={() => setStep(step - 1)}
            onNext={() => setStep(confirmStep)}
          />
        )}

        {step === confirmStep && (
          <StepConfirmation
            isRoundTrip={isRoundTrip}
            outboundFlight={outboundFlight}
            returnFlight={returnFlight}
            outboundSeats={outboundSeats}
            returnSeats={returnSeats}
            passengers={passengers}
            contact={contact}
            adults={adults}
            children={children}
            infants={infants}
            luggage={luggage}
            onBack={() => setStep(step - 1)}
            onConfirm={handleConfirm}
            confirming={isConfirming}
            seatError={seatError}
          />
        )}
      </div>
    </main>
    </>
  )
}
