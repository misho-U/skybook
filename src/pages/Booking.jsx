import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { FLIGHT_SELECT, getLocalTrips } from '../lib/queries'
import { useRequireAuth } from '../hooks/useRequireAuth'
import ProgressBar      from '../components/booking/ProgressBar'
import FlightHeader     from '../components/booking/FlightHeader'
import StepSeatSelection  from '../components/booking/StepSeatSelection'
import StepLuggage        from '../components/booking/StepLuggage'
import StepPassengerInfo  from '../components/booking/StepPassengerInfo'
import StepConfirmation   from '../components/booking/StepConfirmation'

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

  const isAlreadyBooked = getLocalTrips().some(t => t.outboundFlightId === outboundId)

  // Step indices (1-based)
  // One-way:    1=Seat, 2=Luggage, 3=Passenger, 4=Confirm
  // Round-trip: 1=OutSeat, 2=RetSeat, 3=Luggage, 4=Passenger, 5=Confirm
  const luggageStep   = isRoundTrip ? 3 : 2
  const passengerStep = isRoundTrip ? 4 : 3
  const confirmStep   = isRoundTrip ? 5 : 4

  /**
   * Submits the booking as a single atomic Postgres transaction via the book_trip RPC.
   * Merges luggage selections into the passengers payload before sending.
   * On SEAT_TAKEN error, surfaces a user-facing message without navigating away.
   */
  async function handleConfirm() {
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

      const { data: tripId, error } = await supabase.rpc('book_trip', {
        p_trip_type:     tripType,
        p_adults:        adults,
        p_children:      children,
        p_infants:       infants,
        p_passengers:    passengersWithLuggage,
        p_contact_email: contact.email,
        p_contact_phone: contact.phone,
        p_user_id:       user?.id ?? null,
        p_bookings: [
          ...outboundSeats.map(seat => ({ flight_id: outboundId, seat_id: seat.id, direction: 'outbound' })),
          ...returnSeats.map(seat  => ({ flight_id: returnId,    seat_id: seat.id, direction: 'return'   })),
        ],
      })

      if (error) {
        if (error.message?.includes('SEAT_TAKEN')) {
          setSeatError('This seat was just booked by someone else. Please go back and select another.')
        } else {
          addToast('Something went wrong. Please try again.', 'error')
        }
        setIsConfirming(false)
        return
      }

      const tripRef = 'SKY' + Math.random().toString(36).slice(2, 7).toUpperCase()
      localStorage.setItem('skybook_trips', JSON.stringify([
        ...getLocalTrips(),
        { tripRef, tripId, outboundFlightId: outboundId, returnFlightId: returnId || null },
      ]))

      addToast(`Trip confirmed${isRoundTrip ? ' (round trip)' : ''}! 🎉`)
      navigate('/my-bookings')
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

  if (isAlreadyBooked) {
    return (
      <main className="max-w-xl mx-auto px-4 py-24 text-center animate-fade-in">
        <p className="text-7xl mb-5">✅</p>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Already booked!</h1>
        <p className="text-slate-500 text-sm mb-8">You have an existing booking for this flight.</p>
        <Link to="/my-bookings" className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 btn-press transition-all">
          View My Bookings →
        </Link>
      </main>
    )
  }

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <Link to="/results" className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors">
          ← Back to results
        </Link>
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
  )
}
