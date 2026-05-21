import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const todayStr = new Date().toISOString().split('T')[0]

function pad(n) { return String(n).padStart(2, '0') }
function toYMD(year, month0, day) { return `${year}-${pad(month0 + 1)}-${pad(day)}` }
function parseYMD(s) {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  return { year: y, month: m - 1, day: d }
}
function formatDisplay(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function DatePicker({
  value,
  availableDates, // Set<'YYYY-MM-DD'> | null  (null = loading)
  onSelect,
  placeholder = 'Select date',
}) {
  const start = parseYMD(value) ?? parseYMD(todayStr)
  const [open,      setOpen]      = useState(false)
  const [viewYear,  setViewYear]  = useState(start.year)
  const [viewMonth, setViewMonth] = useState(start.month)
  const [dropPos,   setDropPos]   = useState({ top: 0, left: 0, width: 288 })

  const triggerRef  = useRef(null)  // the wrapper div / trigger button area
  const dropdownRef = useRef(null)  // the portal dropdown div

  // Sync calendar view when value is set externally
  useEffect(() => {
    const p = parseYMD(value)
    if (p) { setViewYear(p.year); setViewMonth(p.month) }
  }, [value])

  // When open: compute position, watch scroll/resize, handle outside clicks
  useEffect(() => {
    if (!open) return

    function reposition() {
      if (!triggerRef.current) return
      const rect     = triggerRef.current.getBoundingClientRect()
      const calWidth = Math.max(rect.width, 288)
      // keep calendar inside the right edge of the viewport
      const left = Math.min(rect.left, window.innerWidth - calWidth - 8)
      setDropPos({ top: rect.bottom + 6, left: Math.max(4, left), width: calWidth })
    }

    function onDown(e) {
      const inTrigger  = triggerRef.current?.contains(e.target)
      const inDropdown = dropdownRef.current?.contains(e.target)
      if (!inTrigger && !inDropdown) setOpen(false)
    }

    reposition()
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)

    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  // Build the 7-column grid
  const firstDow    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function isSelectable(dateStr) {
    if (availableDates === null) return true  // still loading: optimistic
    return availableDates.has(dateStr)
  }

  function handleDayClick(dateStr) {
    onSelect(dateStr)
    setOpen(false)
  }

  const hasData = availableDates !== null && availableDates.size > 0

  // ── Calendar panel (rendered via portal at document.body) ──────────────────
  const dropdown = open && createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top:      dropPos.top,
        left:     dropPos.left,
        width:    dropPos.width,
        zIndex:   9999,
      }}
      className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 animate-fade-in"
    >
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          aria-label="Previous month"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors text-xl leading-none select-none"
        >
          ‹
        </button>
        <span className="text-sm font-bold text-slate-800 select-none">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          aria-label="Next month"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors text-xl leading-none select-none"
        >
          ›
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="h-8 flex items-center justify-center text-xs font-semibold text-slate-400 select-none">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (day === null) return <div key={idx} className="h-9" />

          const dateStr    = toYMD(viewYear, viewMonth, day)
          const selectable = isSelectable(dateStr)
          const selected   = dateStr === value
          const isToday    = dateStr === todayStr

          let cls = 'w-8 h-8 flex items-center justify-center rounded-full text-xs font-medium transition-colors select-none '
          if (selected) {
            cls += 'bg-blue-600 text-white font-bold shadow-sm shadow-blue-200'
          } else if (selectable) {
            cls += 'text-slate-800 hover:bg-blue-50 hover:text-blue-700 cursor-pointer'
            if (isToday) cls += ' ring-2 ring-blue-300'
          } else {
            cls += 'text-slate-300 cursor-not-allowed'
          }

          return (
            <div key={idx} className="flex items-center justify-center h-9">
              <button
                type="button"
                disabled={!selectable}
                onClick={() => handleDayClick(dateStr)}
                className={cls}
              >
                {day}
              </button>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      {hasData && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-800 inline-block" />
            Available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
            Unavailable
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-blue-600 inline-block" />
            Selected
          </span>
        </div>
      )}
    </div>,
    document.body
  )

  return (
    <div ref={triggerRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={[
          'w-full px-4 py-3 rounded-xl border text-sm text-left flex items-center justify-between gap-2 bg-white transition-all duration-200',
          open
            ? 'border-blue-500 ring-2 ring-blue-500'
            : 'border-slate-200 hover:border-slate-300',
          value ? 'text-slate-800' : 'text-slate-400',
        ].join(' ')}
      >
        <span>{formatDisplay(value) || placeholder}</span>
        <svg
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {dropdown}
    </div>
  )
}
