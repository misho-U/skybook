import SeatMap, { getSeatDisplay, getSeatLabel, getSeatSurcharge } from '../SeatMap'
import FlightHeader from './FlightHeader'
import { formatPrice } from '../../utils/format'

export default function StepSeatSelection({
  flight, label, accent, seatsNeeded,
  selectedSeats, setSelectedSeats,
  onNext, onBack,
}) {
  function handleToggle(seat) {
    setSelectedSeats(prev =>
      prev.some(s => s.id === seat.id)
        ? prev.filter(s => s.id !== seat.id)
        : [...prev, seat],
    )
  }

  const surcharge  = selectedSeats.reduce((s, seat) => s + getSeatSurcharge(seat), 0)
  const remaining  = seatsNeeded - selectedSeats.length
  const canProceed = remaining === 0

  return (
    <div>
      <FlightHeader flight={flight} label={label} accent={accent} />

      <p className={`text-xs mt-3 mb-5 font-medium ${canProceed ? 'text-emerald-600' : 'text-slate-400'}`}>
        {canProceed
          ? `✓ All ${seatsNeeded} seat${seatsNeeded > 1 ? 's' : ''} selected`
          : `Select ${remaining} more seat${remaining > 1 ? 's' : ''} (${seatsNeeded} total)`}
      </p>

      <SeatMap
        flightId={flight.id}
        passengerCount={seatsNeeded}
        selectedSeats={selectedSeats}
        onSeatToggle={handleToggle}
      />

      {selectedSeats.length > 0 && (
        <div className="mt-5 p-4 bg-blue-50 border border-blue-100 rounded-2xl text-sm animate-fade-in">
          <p className="font-semibold text-slate-700 mb-2">Selected</p>
          <div className="space-y-1">
            {selectedSeats.map(seat => (
              <div key={seat.id} className="flex justify-between text-slate-600">
                <span>Seat {getSeatDisplay(seat)} · {getSeatLabel(seat)}</span>
                <span className="font-medium">
                  {getSeatSurcharge(seat) > 0 ? `+${formatPrice(getSeatSurcharge(seat))}` : 'Included'}
                </span>
              </div>
            ))}
            {surcharge > 0 && (
              <div className="border-t border-blue-200 mt-2 pt-2 flex justify-between font-bold text-slate-700">
                <span>Seat upgrades</span>
                <span>+{formatPrice(surcharge)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-between">
        {onBack
          ? <button type="button" onClick={onBack}
              className="px-6 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 btn-press transition-all">
              ← Back
            </button>
          : <div />}
        <button type="button" onClick={onNext} disabled={!canProceed}
          className="px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-blue-200 btn-press transition-all">
          Continue →
        </button>
      </div>
    </div>
  )
}
