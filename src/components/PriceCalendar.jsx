import { useState } from 'react'

const DAYS   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

function pad(n) { return String(n).padStart(2, '0') }
function toYMD(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}` }

/**
 * Calendar grid with per-date price labels sourced from a flightsByDate map.
 * Cheapest date in the visible month gets a yellow/gold border.
 * Selected date is filled blue. Hover shows airline + time tooltip.
 *
 * @param {{ label?: string, flightsByDate: Map|null, selectedDate: string|null, onSelect: Function }} props
 */
export default function PriceCalendar({ label, flightsByDate, selectedDate, onSelect }) {
  const today = new Date()
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const firstDow    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  // Find cheapest date in this month
  let cheapestDate = null
  if (flightsByDate) {
    let minPrice = Infinity
    for (let d = 1; d <= daysInMonth; d++) {
      const f = flightsByDate.get(toYMD(viewYear, viewMonth, d))
      if (f && f.price < minPrice) { minPrice = f.price; cheapestDate = toYMD(viewYear, viewMonth, d) }
    }
  }

  return (
    <div className="flex-1 min-w-0">
      {label && (
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{label}</p>
      )}

      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 text-xl leading-none select-none transition-colors">
          ‹
        </button>
        <span className="text-sm font-bold text-slate-800 select-none">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button type="button" onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 text-xl leading-none select-none transition-colors">
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="h-7 flex items-center justify-center text-xs font-semibold text-slate-400 select-none">
            {d}
          </div>
        ))}
      </div>

      {flightsByDate === null ? (
        <div className="h-40 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-blue-100 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (day === null) return <div key={idx} className="h-14" />

            const ds     = toYMD(viewYear, viewMonth, day)
            const flight = flightsByDate.get(ds)

            if (!flight) {
              return (
                <div key={idx} className="flex items-center justify-center h-14">
                  <span className="text-sm text-slate-300 select-none">{day}</span>
                </div>
              )
            }

            const isSelected = ds === selectedDate
            const isCheapest = ds === cheapestDate && !isSelected

            return (
              <div key={idx} className="flex items-center justify-center h-14 relative group">
                <button
                  type="button"
                  onClick={() => onSelect(ds)}
                  className={[
                    'flex flex-col items-center justify-center w-10 h-11 rounded-xl text-xs transition-all select-none',
                    isSelected
                      ? 'bg-blue-600 text-white font-bold shadow-sm shadow-blue-200'
                      : isCheapest
                        ? 'border-2 border-yellow-400 text-slate-800 hover:bg-yellow-50'
                        : 'text-slate-800 hover:bg-blue-50 hover:text-blue-700',
                  ].join(' ')}
                >
                  <span className="font-semibold leading-none">{day}</span>
                  <span className={`text-[10px] leading-none mt-0.5 font-medium ${
                    isSelected ? 'text-blue-100' : 'text-emerald-600'
                  }`}>
                    ${flight.price}
                  </span>
                </button>

                {/* Hover tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 hidden group-hover:block pointer-events-none">
                  <div className="bg-slate-800 text-white text-[10px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                    <p className="font-semibold">{flight.airline}</p>
                    <p className="text-slate-300">
                      {new Date(flight.time).toLocaleTimeString('en-GB', {
                        hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
                      })} · ${flight.price}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
