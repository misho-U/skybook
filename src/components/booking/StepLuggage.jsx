import LuggageSelector, { luggagePrice } from '../LuggageSelector'
import { formatPrice } from '../../utils/format'

export default function StepLuggage({
  adults, children, isRoundTrip,
  luggage, setLuggage,
  onBack, onNext,
}) {
  const seatsNeeded = adults + children

  function handleLegChange(i, leg, planId) {
    setLuggage(prev => prev.map((l, idx) => idx === i ? { ...l, [leg]: planId } : l))
  }

  const total = luggage.reduce((sum, l) => {
    return sum + luggagePrice(l.outbound) + (isRoundTrip ? luggagePrice(l.return) : 0)
  }, 0)

  const typeLabels = [
    ...Array.from({ length: adults },   (_, i) => `Adult ${i + 1}`),
    ...Array.from({ length: children }, (_, i) => `Child ${i + 1}`),
  ]

  return (
    <div>
      <div className="space-y-8">
        {Array.from({ length: seatsNeeded }, (_, i) => (
          <div key={i}>
            {isRoundTrip ? (
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-3">
                    {typeLabels[i]}
                    <span className="text-blue-500 font-medium"> — Outbound</span>
                  </p>
                  <LuggageSelector
                    selected={luggage[i].outbound}
                    onChange={planId => handleLegChange(i, 'outbound', planId)}
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-3">
                    {typeLabels[i]}
                    <span className="text-indigo-500 font-medium"> — Return</span>
                  </p>
                  <LuggageSelector
                    selected={luggage[i].return}
                    onChange={planId => handleLegChange(i, 'return', planId)}
                  />
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-3">{typeLabels[i]}</p>
                <LuggageSelector
                  selected={luggage[i].outbound}
                  onChange={planId => handleLegChange(i, 'outbound', planId)}
                />
              </div>
            )}
            {i < seatsNeeded - 1 && <hr className="border-slate-100 mt-6" />}
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
        <span className="text-sm font-semibold text-slate-700">Luggage total</span>
        <span className={`text-sm font-bold ${total === 0 ? 'text-emerald-600' : 'text-blue-600'}`}>
          {total === 0 ? 'Free (cabin only)' : `+${formatPrice(total)}`}
        </span>
      </div>

      <div className="mt-6 flex justify-between">
        <button type="button" onClick={onBack}
          className="px-6 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 btn-press transition-all">
          ← Back
        </button>
        <button type="button" onClick={onNext}
          className="px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 shadow-sm shadow-blue-200 btn-press transition-all">
          Continue →
        </button>
      </div>
    </div>
  )
}
