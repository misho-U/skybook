export default function ProgressBar({ steps, current }) {
  return (
    <div className="flex items-center justify-center mb-10 select-none">
      {steps.map((label, i) => {
        const n      = i + 1
        const done   = n < current
        const active = n === current
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center
                font-bold text-sm border-2 transition-all duration-300
                ${done   ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-300/50'
                : active ? 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-200 scale-110 shadow-lg shadow-blue-400/50'
                :          'bg-slate-100 border-slate-200 text-slate-400'}
              `}>
                {done
                  ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  : n}
              </div>
              <span className={`mt-2 text-xs font-semibold hidden sm:block transition-colors ${
                active ? 'text-blue-600' : done ? 'text-blue-400' : 'text-slate-400'
              }`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-10 sm:w-14 mx-2 rounded-full transition-all duration-500 ${
                n < current ? 'bg-gradient-to-r from-blue-500 to-blue-400' : 'bg-slate-200'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
