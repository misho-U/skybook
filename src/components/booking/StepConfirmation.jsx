import { LUGGAGE_PLANS, luggagePrice } from '../LuggageSelector'
import { TYPE_LABEL, TYPE_BADGE } from './StepPassengerInfo'
import { getSeatDisplay, getSeatLabel, getSeatSurcharge } from '../SeatMap'
import { formatTime, formatDayMonth, formatPrice, calcDuration } from '../../utils/format'

function SummaryBlock({ title, children }) {
  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  )
}

function FlightSummaryRow({ flight, seats }) {
  if (!flight) return null
  const dep = formatTime(flight.departure_time)
  const arr = formatTime(flight.arrival_time)
  const dur = calcDuration(flight.departure_time, flight.arrival_time)
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-semibold text-slate-800">
          {flight.origin?.code} {dep} → {flight.destination?.code} {arr}
        </span>
        <span className="text-xs text-slate-400">{dur}</span>
      </div>
      <p className="text-xs text-slate-500 mb-1.5">{flight.airline} · {formatDayMonth(flight.departure_time)}</p>
      <div className="flex flex-wrap gap-1.5">
        {seats.map(seat => (
          <span key={seat.id} className="text-xs bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-100">
            {getSeatDisplay(seat)} {getSeatLabel(seat) !== 'Economy' ? `· ${getSeatLabel(seat)}` : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function StepConfirmation({
  isRoundTrip, outboundFlight, returnFlight,
  outboundSeats, returnSeats,
  passengers, contact,
  adults, children, infants,
  luggage,
  onBack, onConfirm, confirming, seatError,
}) {
  const seatsNeeded     = adults + children
  const baseFare        = (Number(outboundFlight?.base_price ?? 0) + (isRoundTrip ? Number(returnFlight?.base_price ?? 0) : 0)) * seatsNeeded
  const outSeatExtra    = outboundSeats.reduce((s, seat) => s + getSeatSurcharge(seat), 0)
  const retSeatExtra    = returnSeats.reduce((s, seat) => s + getSeatSurcharge(seat), 0)
  const luggageOutCost  = luggage.reduce((s, l) => s + luggagePrice(l.outbound), 0)
  const luggageRetCost  = isRoundTrip ? luggage.reduce((s, l) => s + luggagePrice(l.return), 0) : 0
  const total           = baseFare + outSeatExtra + retSeatExtra + luggageOutCost + luggageRetCost

  const typeIndex = passengers.map((() => {
    const counts = {}
    return p => { counts[p.type] = (counts[p.type] ?? 0) + 1; return counts[p.type] }
  })())

  return (
    <div>
      <div className="flex flex-col items-center gap-3 mb-7 animate-scale-in">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center ring-8 ring-emerald-50">
          <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="text-center">
          <p className="font-bold text-slate-800">Looks great!</p>
          <p className="text-slate-500 text-sm">Review your trip, then confirm.</p>
        </div>
      </div>

      {seatError && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 animate-fade-in">
          ⚠️ {seatError}
        </div>
      )}

      <div className="space-y-4">
        <SummaryBlock title={isRoundTrip ? 'Outbound Flight' : 'Flight'}>
          <FlightSummaryRow flight={outboundFlight} seats={outboundSeats} />
        </SummaryBlock>

        {isRoundTrip && (
          <SummaryBlock title="Return Flight">
            <FlightSummaryRow flight={returnFlight} seats={returnSeats} />
          </SummaryBlock>
        )}

        <SummaryBlock title={`Passengers (${passengers.length})`}>
          <div className="space-y-3">
            {passengers.map((p, i) => {
              const lug     = p.type !== 'infant' ? luggage[i] : null
              const outPlan = lug ? LUGGAGE_PLANS.find(pl => pl.id === lug.outbound) : null
              const retPlan = lug && isRoundTrip ? LUGGAGE_PLANS.find(pl => pl.id === lug.return) : null
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{p.firstName} {p.lastName}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGE[p.type]}`}>
                      {TYPE_LABEL[p.type]} {typeIndex[i]}
                    </span>
                  </div>
                  {outPlan && (
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
                      <span>
                        {isRoundTrip ? <span className="text-blue-400 font-medium">Out </span> : ''}
                        {outPlan.icon}{outPlan.iconSuffix ?? ''} {outPlan.name}
                      </span>
                      {retPlan && (
                        <span>
                          <span className="text-indigo-400 font-medium">Ret </span>
                          {retPlan.icon}{retPlan.iconSuffix ?? ''} {retPlan.name}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            <div className="pt-2 border-t border-slate-100 text-xs text-slate-400 flex flex-wrap gap-x-3">
              <span>{contact.email}</span>
              <span>{contact.phone}</span>
            </div>
          </div>
        </SummaryBlock>

        <SummaryBlock title="Price Breakdown">
          <div className="space-y-1.5 text-sm text-slate-600">
            <div className="flex justify-between">
              <span>
                Base fare{isRoundTrip ? ' (both legs)' : ''} × {seatsNeeded} pax
                {infants > 0 && <span className="text-xs text-slate-400 ml-1">(+{infants} infant{infants > 1 ? 's' : ''} free)</span>}
              </span>
              <span>{formatPrice(baseFare)}</span>
            </div>
            {outSeatExtra > 0 && (
              <div className="flex justify-between">
                <span>Seat upgrades{isRoundTrip ? ' (outbound)' : ''}</span>
                <span>+{formatPrice(outSeatExtra)}</span>
              </div>
            )}
            {retSeatExtra > 0 && (
              <div className="flex justify-between">
                <span>Seat upgrades (return)</span>
                <span>+{formatPrice(retSeatExtra)}</span>
              </div>
            )}
            {luggageOutCost > 0 && (
              <div className="flex justify-between">
                <span>Luggage{isRoundTrip ? ' (outbound)' : ''}</span>
                <span>+{formatPrice(luggageOutCost)}</span>
              </div>
            )}
            {luggageRetCost > 0 && (
              <div className="flex justify-between">
                <span>Luggage (return)</span>
                <span>+{formatPrice(luggageRetCost)}</span>
              </div>
            )}
          </div>
          <div className="border-t border-slate-200 mt-3 pt-3 flex justify-between font-bold text-slate-800 text-base">
            <span>Total</span>
            <span className="text-blue-600 text-lg">{formatPrice(total)}</span>
          </div>
        </SummaryBlock>
      </div>

      <div className="flex justify-between mt-7">
        <button type="button" onClick={onBack} disabled={confirming}
          className="px-6 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 btn-press transition-all disabled:opacity-40">
          ← Back
        </button>
        <button type="button" onClick={() => onConfirm(total)} disabled={confirming}
          className="px-8 py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 shadow-md shadow-emerald-200 btn-press transition-all disabled:opacity-60 flex items-center gap-2">
          {confirming
            ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Confirming…</>
            : 'Confirm Booking ✓'}
        </button>
      </div>
    </div>
  )
}
