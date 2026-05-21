import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import FlightResultCard from '../components/FlightResultCard'
import DatePicker from '../components/DatePicker'
import { supabase } from '../lib/supabase'
import { formatSearchDate, formatDayMonth, normalizeDbFlight } from '../utils/format'
import { usePageTitle } from '../hooks/usePageTitle'

const SORT_OPTIONS = [
  { value: 'price-asc',  label: 'Price: low → high' },
  { value: 'price-desc', label: 'Price: high → low' },
  { value: 'duration',   label: 'Shortest duration'  },
]

function sortFlights(flights, sort) {
  return [...flights].sort((a, b) => {
    if (sort === 'price-asc')  return a.price - b.price
    if (sort === 'price-desc') return b.price - a.price
    if (sort === 'duration') {
      const da = new Date(a.arrival_time) - new Date(a.departure_time)
      const db = new Date(b.arrival_time) - new Date(b.departure_time)
      return da - db
    }
    return 0
  })
}

function matchesCity(flight, query, field) {
  if (!query) return true
  const q = query.toLowerCase().trim()
  const airport = flight[field]
  return (
    airport?.city?.toLowerCase().includes(q) ||
    airport?.code?.toLowerCase().includes(q) ||
    airport?.country?.toLowerCase().includes(q)
  )
}

function Spinner({ label = 'Searching flights…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-slate-400 text-sm font-medium">{label}</p>
    </div>
  )
}

function EmptyColumn({ label }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <p className="text-4xl mb-3">🗓️</p>
      <p className="font-semibold text-slate-600 mb-1">{label}</p>
      <p className="text-slate-400 text-sm">Try a different date or route.</p>
    </div>
  )
}

function FlightColumn({ title, subtitle, flights, selected, onSelect, sort, emptyLabel }) {
  const sorted = useMemo(() => sortFlights(flights, sort), [flights, sort])
  return (
    <div className="flex-1 min-w-0">
      <div className="mb-4">
        <h2 className="text-base font-bold text-slate-800">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {sorted.length === 0
        ? <EmptyColumn label={emptyLabel} />
        : (
          <div className="space-y-3">
            {sorted.map(flight => (
              <FlightResultCard
                key={flight.id}
                flight={flight}
                selected={selected?.id === flight.id}
                onSelect={() => onSelect(flight)}
              />
            ))}
          </div>
        )}
    </div>
  )
}

// Sticky selection summary bar
function SelectionBar({ tripType, outbound, returnFlight, adults, children, infants, navigate, searchParams }) {
  const isOneWay   = tripType === 'one_way'
  const canContinue = isOneWay ? !!outbound : (!!outbound && !!returnFlight)

  function handleContinue() {
    const params = new URLSearchParams()
    if (outbound)      params.set('outbound',  outbound.id)
    if (returnFlight)  params.set('return',    returnFlight.id)
    params.set('adults',    adults)
    params.set('children',  children)
    params.set('infants',   infants)
    params.set('tripType',  tripType)
    navigate(`/booking?${params.toString()}`)
  }

  if (!outbound && !returnFlight) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-xl px-4 py-3 animate-fade-in">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Selected summaries */}
        <div className="flex flex-wrap gap-3 flex-1 min-w-0">
          {outbound && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">Out</span>
              <span className="text-sm font-semibold text-slate-700">
                {outbound.origin?.code} → {outbound.destination?.code}
              </span>
              <span className="text-xs text-slate-400">
                {outbound.airline} · {new Date(outbound.departure_time).toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit',timeZone:'UTC'})}
              </span>
            </div>
          )}
          {returnFlight && (
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-1.5">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide">Ret</span>
              <span className="text-sm font-semibold text-slate-700">
                {returnFlight.origin?.code} → {returnFlight.destination?.code}
              </span>
              <span className="text-xs text-slate-400">
                {returnFlight.airline} · {new Date(returnFlight.departure_time).toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit',timeZone:'UTC'})}
              </span>
            </div>
          )}
          {!isOneWay && outbound && !returnFlight && (
            <span className="text-sm text-slate-400 self-center">← Now select a return flight</span>
          )}
        </div>

        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className="shrink-0 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-blue-200 btn-press transition-all"
        >
          Continue to Booking →
        </button>
      </div>
    </div>
  )
}

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [sort,         setSort]         = useState('price-asc')
  const [allFlights,   setAllFlights]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [selectedOut,  setSelectedOut]  = useState(null)
  const [selectedRet,  setSelectedRet]  = useState(null)

  const origin      = searchParams.get('origin')      || ''
  const destination = searchParams.get('destination') || ''
  const departure   = searchParams.get('departure')   || ''
  const returnDate  = searchParams.get('return')      || ''
  const adults      = parseInt(searchParams.get('adults')   || '1', 10)
  const children    = parseInt(searchParams.get('children') || '0', 10)
  const infants     = parseInt(searchParams.get('infants')  || '0', 10)
  const tripType    = searchParams.get('tripType')    || 'one_way'
  const isRoundTrip = tripType === 'round_trip'

  usePageTitle(destination ? `Flights to ${destination}` : 'Search Results')

  // Fetch flights covering both the departure date and (if round-trip) return date
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setSelectedOut(null)
    setSelectedRet(null)

    // Build a date range that covers departure through return (or just departure day)
    const rangeStart = departure  ? `${departure}T00:00:00+00`  : null
    const rangeEnd   = returnDate ? `${returnDate}T23:59:59+00` : departure ? `${departure}T23:59:59+00` : null

    let query = supabase
      .from('flights')
      .select(`
        *,
        origin:airports!fk_origin(*),
        destination:airports!fk_destination(*)
      `)
      .order('departure_time')

    if (rangeStart) query = query.gte('departure_time', rangeStart)
    if (rangeEnd)   query = query.lte('departure_time', rangeEnd)

    query.then(({ data, error: err }) => {
      if (cancelled) return
      if (err) { setError(err.message); setLoading(false); return }
      setAllFlights((data ?? []).map(normalizeDbFlight))
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [departure, returnDate])

  function handleDateParam(key, value) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })
  }

  // Outbound: destination matches search dest, origin matches search origin
  const outboundFlights = useMemo(() => {
    return allFlights.filter(f => {
      const onDate = !departure || f.departure_time.slice(0, 10) === departure
      const destOk = matchesCity(f, destination, 'destination')
      const origOk = matchesCity(f, origin, 'origin')
      return onDate && destOk && (origin ? origOk : true)
    })
  }, [allFlights, departure, destination, origin])

  // Return: origin/destination are swapped
  const returnFlights = useMemo(() => {
    if (!isRoundTrip) return []
    return allFlights.filter(f => {
      const onDate = !returnDate || f.departure_time.slice(0, 10) === returnDate
      const destOk = matchesCity(f, origin, 'destination')
      const origOk = matchesCity(f, destination, 'origin')
      return onDate && destOk && (destination ? origOk : true)
    })
  }, [allFlights, returnDate, origin, destination, isRoundTrip])

  const departureLbl  = departure  ? formatSearchDate(departure)  : null
  const returnLbl     = returnDate ? formatSearchDate(returnDate)  : null
  const summaryTitle  = [
    destination ? `Flights to ${destination}` : 'All flights',
    departureLbl && returnLbl ? `${departureLbl} → ${returnLbl}` : departureLbl || returnLbl,
    [
      `${adults} adult${adults !== 1 ? 's' : ''}`,
      children > 0 ? `${children} child${children !== 1 ? 'ren' : ''}` : null,
      infants  > 0 ? `${infants} infant${infants !== 1 ? 's' : ''}` : null,
    ].filter(Boolean).join(', '),
  ].filter(Boolean).join(' · ')

  return (
    <>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-28">
        {/* Back + header */}
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium mb-7 group"
        >
          <span className="transition-transform group-hover:-translate-x-0.5">←</span>
          New search
        </a>

        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">{summaryTitle}</h1>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
              isRoundTrip
                ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                : 'bg-blue-50 text-blue-600 border-blue-200'
            }`}>
              {isRoundTrip ? '↔ Round Trip' : '→ One Way'}
            </span>
          </div>
          {origin && (
            <p className="text-slate-500 text-sm">
              From <span className="font-semibold text-slate-700">{origin}</span>
            </p>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            Failed to load flights: {error}
          </div>
        )}

        {loading ? (
          <Spinner />
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* ── Sidebar ── */}
            <aside className="lg:w-52 shrink-0">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sticky top-20 space-y-5">
                {/* Sort */}
                <div>
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Sort by</h2>
                  <div className="space-y-1">
                    {SORT_OPTIONS.map(({ value, label }) => (
                      <label
                        key={value}
                        className={`flex items-center gap-2.5 cursor-pointer px-3 py-2.5 rounded-xl text-sm transition-colors ${
                          sort === value
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="sort"
                          value={value}
                          checked={sort === value}
                          onChange={() => setSort(value)}
                          className="accent-blue-600"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Date filter */}
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dates</h2>
                    {(departure || returnDate) && (
                      <button
                        onClick={() => { handleDateParam('departure', ''); handleDateParam('return', '') }}
                        className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-400 font-medium mb-1">Departure</label>
                      <DatePicker
                        value={departure}
                        availableDates={null}
                        onSelect={v => handleDateParam('departure', v)}
                        placeholder="Any date"
                      />
                    </div>
                    {isRoundTrip && (
                      <div>
                        <label className="block text-xs text-slate-400 font-medium mb-1">Return</label>
                        <DatePicker
                          value={returnDate}
                          availableDates={null}
                          onSelect={v => handleDateParam('return', v)}
                          placeholder="Any date"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Count */}
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-400 font-medium">
                    {outboundFlights.length} outbound{isRoundTrip ? ` · ${returnFlights.length} return` : ''}
                  </p>
                </div>
              </div>
            </aside>

            {/* ── Flight columns ── */}
            {isRoundTrip ? (
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                <FlightColumn
                  title="Outbound"
                  subtitle={departureLbl ? `${origin || '—'} → ${destination || '—'} · ${departureLbl}` : `${origin || '—'} → ${destination || '—'}`}
                  flights={outboundFlights}
                  selected={selectedOut}
                  onSelect={setSelectedOut}
                  sort={sort}
                  emptyLabel="No outbound flights found"
                />
                <FlightColumn
                  title="Return"
                  subtitle={returnLbl ? `${destination || '—'} → ${origin || '—'} · ${returnLbl}` : `${destination || '—'} → ${origin || '—'}`}
                  flights={returnFlights}
                  selected={selectedRet}
                  onSelect={setSelectedRet}
                  sort={sort}
                  emptyLabel="No return flights found"
                />
              </div>
            ) : (
              <div className="flex-1">
                <FlightColumn
                  title=""
                  subtitle={departureLbl
                    ? `${origin || '—'} → ${destination || '—'} · ${departureLbl}`
                    : `${origin || '—'} → ${destination || '—'}`}
                  flights={outboundFlights}
                  selected={selectedOut}
                  onSelect={setSelectedOut}
                  sort={sort}
                  emptyLabel="No flights found for this route"
                />
              </div>
            )}
          </div>
        )}
      </main>

      <SelectionBar
        tripType={tripType}
        outbound={selectedOut}
        returnFlight={selectedRet}
        adults={adults}
        children={children}
        infants={infants}
        navigate={navigate}
        searchParams={searchParams}
      />
    </>
  )
}
