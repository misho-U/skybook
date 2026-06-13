import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DatePicker from '../components/DatePicker'
import AirportSelect from '../components/AirportSelect'
import FlightDateModal from '../components/FlightDateModal'
import { supabase } from '../lib/supabase'
import { AIRPORT_IMAGES, FALLBACK_IMAGE, calcDuration } from '../utils/format'
import { usePageTitle } from '../hooks/usePageTitle'
import { fetchAvailableDates } from '../lib/queries'

const FEATURES = [
  {
    icon: '✈️',
    title: 'Instant Booking',
    desc: 'Confirm your seat in under 60 seconds with real-time availability.',
  },
  {
    icon: '🛡️',
    title: 'Secure & Trusted',
    desc: 'Your payment and personal data are always encrypted and protected.',
  },
  {
    icon: '💳',
    title: 'Best Price Guarantee',
    desc: "Find a lower fare and we'll match it — no questions asked.",
  },
]

function SearchLabel({ children }) {
  return (
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-0.5">
      {children}
    </label>
  )
}

function PassengerCounter({ label, sub, value, onDecrement, onIncrement, canDecrement, canIncrement }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div>
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="text-xs text-slate-400">{sub}</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onDecrement} disabled={!canDecrement}
          className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold disabled:opacity-30 hover:bg-slate-50 transition-all btn-press flex items-center justify-center text-lg leading-none">
          −
        </button>
        <span className="w-5 text-center font-bold text-slate-800 text-sm tabular-nums">{value}</span>
        <button type="button" onClick={onIncrement} disabled={!canIncrement}
          className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold disabled:opacity-30 hover:bg-slate-50 transition-all btn-press flex items-center justify-center text-lg leading-none">
          +
        </button>
      </div>
    </div>
  )
}

function DestinationCard({ dest, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/70 hover:-translate-y-1 transition-all duration-300 w-full"
    >
      <div className="relative h-44 overflow-hidden">
        <img
          src={dest.image}
          alt={dest.city}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-3 left-3">
          <p className="text-white font-extrabold text-lg leading-tight">{dest.city}</p>
          <p className="text-white/75 text-xs">{dest.country}</p>
        </div>
      </div>
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="text-blue-600 font-extrabold text-base">from ${dest.fromPrice}</span>
        <span className="text-slate-400 text-xs">{dest.duration}</span>
      </div>
    </button>
  )
}

export default function Home() {
  usePageTitle('Home')
  const navigate = useNavigate()

  const [tripType,             setTripType]             = useState('one_way')
  const [form,                 setForm]                 = useState({ origin: '', destination: '', departure: '', returnDate: '', adults: 1, children: 0, infants: 0 })
  const [popular,              setPopular]              = useState([])
  const [kutId,                setKutId]                = useState(null)
  const [selectedDest,         setSelectedDest]         = useState(null)
  const [airports,             setAirports]             = useState([])
  const [availableDates,       setAvailableDates]       = useState(null)
  const [returnAvailableDates, setReturnAvailableDates] = useState(null)

  // Airports for the FROM/TO selectors
  useEffect(() => {
    supabase
      .from('airports')
      .select('id, city, country, code, flag')
      .order('city')
      .then(({ data }) => setAirports(data ?? []))
  }, [])

  // 6 cheapest unique destinations from Kutaisi (KUT), one card per city
  useEffect(() => {
    async function fetchPopular() {
      const { data: kut } = await supabase
        .from('airports').select('id').eq('code', 'KUT').single()
      if (!kut) return
      setKutId(kut.id)

      const { data } = await supabase
        .from('flights')
        .select('base_price, departure_time, arrival_time, destination:airports!fk_destination(*)')
        .eq('origin_id', kut.id)
        .order('base_price', { ascending: true })
      if (!data) return

      const seen   = new Set()
      const unique = []
      for (const f of data) {
        if (!seen.has(f.destination.id)) {
          seen.add(f.destination.id)
          unique.push({
            id:        f.destination.id,
            city:      f.destination.city,
            country:   f.destination.country,
            code:      f.destination.code,
            image:     AIRPORT_IMAGES[f.destination.code] ?? FALLBACK_IMAGE,
            fromPrice: Number(f.base_price),
            duration:  calcDuration(f.departure_time, f.arrival_time),
          })
          if (unique.length === 6) break
        }
      }
      setPopular(unique)
    }
    fetchPopular()
  }, [])

  // Outbound available dates — re-fetches whenever origin or destination changes.
  // 400 ms debounce so we don't fire on every keystroke.
  useEffect(() => {
    setAvailableDates(null)
    const timer = setTimeout(async () => {
      const dates = await fetchAvailableDates({
        origin:      form.origin,
        destination: form.destination,
      })
      setAvailableDates(dates)
    }, 400)
    return () => clearTimeout(timer)
  }, [form.origin, form.destination])

  // Return available dates — reverse direction, only dates after departure.
  // Only active when trip type is round_trip.
  useEffect(() => {
    if (tripType !== 'round_trip') return
    setReturnAvailableDates(null)
    const timer = setTimeout(async () => {
      const dates = await fetchAvailableDates({
        origin:      form.origin,
        destination: form.destination,
        afterDate:   form.departure || undefined,
        swapped:     true,
      })
      setReturnAvailableDates(dates)
    }, 400)
    return () => clearTimeout(timer)
  }, [form.origin, form.destination, form.departure, tripType])

  function adjustPassengers(type, delta) {
    setForm(prev => {
      let { adults, children, infants } = prev
      if (type === 'adults') {
        adults  = Math.min(9, Math.max(1, adults + delta))
        infants = Math.min(infants, adults)
      } else if (type === 'children') {
        children = Math.min(9, Math.max(0, children + delta))
      } else {
        infants = Math.min(prev.adults, Math.max(0, infants + delta))
      }
      return { ...prev, adults, children, infants }
    })
  }

  function handleOriginSelect(city) {
    setForm(prev => ({
      ...prev,
      origin: city,
      // clear destination if it's the same city (mutual exclusion)
      destination: prev.destination === city ? '' : prev.destination,
    }))
  }

  function handleDestinationSelect(city) {
    setForm(prev => ({
      ...prev,
      destination: city,
      // clear origin if it's the same city
      origin: prev.origin === city ? '' : prev.origin,
    }))
  }

  function handleDepartureSelect(dateStr) {
    setForm(prev => ({
      ...prev,
      departure: dateStr,
      // clear return if it's no longer valid after the new departure
      returnDate: prev.returnDate > dateStr ? prev.returnDate : '',
    }))
  }

  function handleReturnSelect(dateStr) {
    setForm(prev => ({ ...prev, returnDate: dateStr }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.origin || !form.destination) return
    const params = new URLSearchParams()
    params.set('origin',      form.origin)
    params.set('destination', form.destination)
    params.set('adults',      form.adults)
    params.set('children',    form.children)
    params.set('infants',     form.infants)
    params.set('tripType',    tripType)
    if (form.departure)  params.set('departure', form.departure)
    if (form.returnDate && tripType === 'round_trip') params.set('return', form.returnDate)
    navigate(`/results?${params.toString()}`)
  }

  return (
    <main>
      {/* ── Hero ── */}
      {/* Gradient is a fallback while the video downloads / if it fails to load */}
      <section className="relative min-h-screen flex items-center text-white overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800">

        {/* Fullscreen looping background video (Pexels — free / CC0) */}
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1600&q=80"
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden="true"
        >
          <source src="/hero.mp4" type="video/mp4" />
        </video>

        {/* Dark overlay so white text stays readable on top of footage */}
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />

        {/* Existing decorative texture — kept subtle, layered above the overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-60"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-900/30 rounded-full blur-3xl pointer-events-none" />

        <div className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-28 text-center">
          <p className="inline-flex items-center gap-2 text-blue-200 font-semibold text-sm tracking-widest uppercase mb-5 bg-white/10 px-4 py-1.5 rounded-full">
            <span>✈️</span> Your journey starts here
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] mb-5 tracking-tight">
            Fly Anywhere,<br />
            <span className="text-blue-200">Anytime.</span>
          </h1>
          <p className="text-blue-100 text-lg sm:text-xl max-w-xl mx-auto mb-10 leading-relaxed">
            Browse hundreds of destinations and book your next adventure in seconds.
          </p>

          {/* Search card */}
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-3xl shadow-2xl shadow-blue-900/20 p-6 max-w-3xl mx-auto text-left"
          >
            {/* Trip type toggle */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5 w-fit">
              {[['one_way', 'One Way'], ['round_trip', 'Round Trip']].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setTripType(val)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    tripType === val
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <SearchLabel>From</SearchLabel>
                <AirportSelect
                  airports={airports}
                  value={form.origin}
                  onChange={handleOriginSelect}
                  placeholder="Select city"
                  exclude={form.destination}
                />
              </div>
              <div>
                <SearchLabel>To</SearchLabel>
                <AirportSelect
                  airports={airports}
                  value={form.destination}
                  onChange={handleDestinationSelect}
                  placeholder="Select city"
                  exclude={form.origin}
                />
              </div>

              <div>
                <SearchLabel>Departure date</SearchLabel>
                <DatePicker
                  value={form.departure}
                  availableDates={availableDates}
                  onSelect={handleDepartureSelect}
                  placeholder="Choose departure"
                />
              </div>

              {tripType === 'round_trip' && (
                <div>
                  <SearchLabel>Return date</SearchLabel>
                  <DatePicker
                    value={form.returnDate}
                    availableDates={returnAvailableDates}
                    onSelect={handleReturnSelect}
                    placeholder="Choose return"
                  />
                </div>
              )}

              <div className="sm:col-span-2">
                <SearchLabel>Passengers</SearchLabel>
                <div className="rounded-xl border border-slate-200 bg-white px-4 divide-y divide-slate-100">
                  <PassengerCounter
                    label="Adults" sub="12+ years"
                    value={form.adults}
                    onDecrement={() => adjustPassengers('adults', -1)}
                    onIncrement={() => adjustPassengers('adults', +1)}
                    canDecrement={form.adults > 1}
                    canIncrement={form.adults < 9}
                  />
                  <PassengerCounter
                    label="Children" sub="2–11 years"
                    value={form.children}
                    onDecrement={() => adjustPassengers('children', -1)}
                    onIncrement={() => adjustPassengers('children', +1)}
                    canDecrement={form.children > 0}
                    canIncrement={form.children < 9}
                  />
                  <PassengerCounter
                    label="Infants" sub="Under 2 · lap seat"
                    value={form.infants}
                    onDecrement={() => adjustPassengers('infants', -1)}
                    onIncrement={() => adjustPassengers('infants', +1)}
                    canDecrement={form.infants > 0}
                    canIncrement={form.infants < form.adults}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold py-3.5 rounded-xl transition-all duration-200 text-sm shadow-lg shadow-blue-200 btn-press"
            >
              Search Flights →
            </button>
          </form>
        </div>
      </section>

      {/* ── Popular Destinations ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-1">Popular Destinations</h2>
          <p className="text-slate-500">Cheapest fares from Kutaisi — click to pick your dates</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {popular.length === 0
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
              ))
            : popular.map((dest, i) => (
                <div key={dest.id} className="animate-fade-in-up animate-stagger" style={{ animationDelay: `${i * 60}ms` }}>
                  <DestinationCard dest={dest} onClick={() => setSelectedDest(dest)} />
                </div>
              ))}
        </div>
      </section>

      {selectedDest && kutId && (
        <FlightDateModal
          destination={selectedDest}
          kutId={kutId}
          tripType={form.tripType}
          onClose={() => setSelectedDest(null)}
        />
      )}

      {/* ── Why SkyBook ── */}
      <section className="bg-slate-50 border-t border-slate-100 py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">Why SkyBook?</h2>
            <p className="text-slate-500 max-w-md mx-auto">
              We make booking your next flight fast, safe, and hassle-free.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {FEATURES.map(({ icon, title, desc }) => (
              <div
                key={title}
                className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center card-hover group"
              >
                <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-5 transition-transform duration-300 group-hover:scale-110 group-hover:bg-blue-200">
                  <span className="text-3xl">{icon}</span>
                </div>
                <h3 className="font-bold text-slate-800 text-lg mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
