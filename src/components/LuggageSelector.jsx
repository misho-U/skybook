export const LUGGAGE_PLANS = [
  {
    id:    'cabin_only',
    name:  'Cabin Only',
    icon:  '🎒',
    desc:  'Personal item + cabin bag',
    price: 0,
  },
  {
    id:    'standard',
    name:  'Standard',
    icon:  '🧳',
    desc:  'Cabin bag + 1 checked bag (20 kg)',
    price: 35,
  },
  {
    id:    'comfort',
    name:  'Comfort',
    icon:  '🧳',
    iconSuffix: '+',
    desc:  'Cabin bag + 1 large bag (32 kg)',
    price: 55,
  },
  {
    id:    'family',
    name:  'Family',
    icon:  '🧳🧳',
    desc:  'Cabin bag + 2 checked bags (20 kg each)',
    price: 60,
  },
]

/** Returns the extra price in USD for a given luggage plan ID. */
export function luggagePrice(planId) {
  return LUGGAGE_PLANS.find(p => p.id === planId)?.price ?? 0
}

export default function LuggageSelector({ selected, onChange }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {LUGGAGE_PLANS.map(plan => {
        const active = selected === plan.id
        return (
          <button
            key={plan.id}
            type="button"
            onClick={() => onChange(plan.id)}
            className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 text-center transition-all duration-200 btn-press
              ${active
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100 shadow-md shadow-blue-200/60'
                : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50 hover:scale-[1.02]'}`}
          >
            {active && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}

            <span className="text-3xl leading-none">
              {plan.icon}
              {plan.iconSuffix && (
                <span className="text-sm font-black text-slate-500 align-super ml-0.5">{plan.iconSuffix}</span>
              )}
            </span>

            <div className="w-full">
              <p className={`text-xs font-bold leading-snug ${active ? 'text-blue-700' : 'text-slate-700'}`}>
                {plan.name}
              </p>
              <p className="text-xs text-slate-400 leading-tight mt-0.5">{plan.desc}</p>
            </div>

            <span className={`text-xs font-bold ${plan.price === 0 ? 'text-emerald-600' : 'text-blue-600'}`}>
              {plan.price === 0 ? 'Free' : `+$${plan.price}`}
            </span>
          </button>
        )
      })}
    </div>
  )
}
