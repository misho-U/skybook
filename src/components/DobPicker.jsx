import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const DAYS         = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS       = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const TODAY_STR = new Date().toISOString().split('T')[0]

function pad(n)                 { return String(n).padStart(2, '0') }
function toYMD(year, month0, d) { return `${year}-${pad(month0 + 1)}-${pad(d)}` }
function parseYMD(s) {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return { year: y, month: m - 1, day: d }
}

/** "1995-05-07" → "07 May 1995". Returns '' for falsy input. */
function formatDisplay(dateStr) {
  if (!dateStr) return ''
  const p = parseYMD(dateStr)
  if (!p) return ''
  return `${pad(p.day)} ${MONTHS_SHORT[p.month]} ${p.year}`
}

/**
 * Custom date-of-birth picker.
 *
 * Props:
 *   value                 'YYYY-MM-DD' or ''
 *   onChange              (newValue: 'YYYY-MM-DD') => void
 *   min                   'YYYY-MM-DD' (inclusive lower bound, optional)
 *   max                   'YYYY-MM-DD' (inclusive upper bound, optional)
 *   placeholder           string shown when no value
 *   defaultViewYearsAgo   when no value, open the calendar at "today − N years"
 *   hasError              red border state
 *   id                    DOM id for label association
 */
export default function DobPicker({
  value,
  onChange,
  min,
  max,
  placeholder         = 'Select date',
  defaultViewYearsAgo = 25,
  hasError            = false,
  id,
}) {
  // ── Initial calendar view ────────────────────────────────────────────────
  const initView = (() => {
    const p = parseYMD(value)
    if (p) return { year: p.year, month: p.month }
    const now = new Date()
    return {
      year:  now.getFullYear() - defaultViewYearsAgo,
      month: now.getMonth(),
    }
  })()

  const [open,      setOpen]      = useState(false)
  const [viewYear,  setViewYear]  = useState(initView.year)
  const [viewMonth, setViewMonth] = useState(initView.month)
  const [dropPos,   setDropPos]   = useState({ top: 0, left: 0, width: 320 })

  const triggerRef  = useRef(null)
  const dropdownRef = useRef(null)

  // Sync the visible month when value changes externally (e.g. nav back through steps)
  useEffect(() => {
    const p = parseYMD(value)
    if (p) { setViewYear(p.year); setViewMonth(p.month) }
  }, [value])

  // While open: position the dropdown, handle outside clicks + scroll/resize
  useEffect(() => {
    if (!open) return

    function reposition() {
      if (!triggerRef.current) return
      const rect            = triggerRef.current.getBoundingClientRect()
      const width           = Math.max(rect.width, 320)
      const approxHeight    = 380          // matches the dropdown's rendered height
      const spaceBelow      = window.innerHeight - rect.bottom
      const spaceAbove      = rect.top
      const openUp          = spaceBelow < approxHeight && spaceAbove > spaceBelow
      const top             = openUp ? rect.top - approxHeight - 6 : rect.bottom + 6
      const left            = Math.min(rect.left, window.innerWidth - width - 8)
      setDropPos({ top, left: Math.max(4, left), width })
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

  // ── Calendar navigation ──────────────────────────────────────────────────
  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }
  function prevYear() { setViewYear(y => y - 1) }
  function nextYear() { setViewYear(y => y + 1) }

  // ── Build the 7-column grid ──────────────────────────────────────────────
  const firstDow    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function isInRange(dateStr) {
    if (min && dateStr < min) return false
    if (max && dateStr > max) return false
    return true
  }

  function handleDayClick(dateStr) {
    onChange(dateStr)
    setOpen(false)
  }

  // Disable arrows that would jump beyond min/max — visual nicety
  const firstOfMonth = toYMD(viewYear, viewMonth, 1)
  const lastOfMonth  = toYMD(viewYear, viewMonth, daysInMonth)
  const cantGoPrevM  = min && firstOfMonth <= min
  const cantGoNextM  = max && lastOfMonth >= max
  const cantGoPrevY  = min && `${viewYear}-01-01` <= min
  const cantGoNextY  = max && `${viewYear}-12-31` >= max

  // ── Calendar panel (rendered via portal at document.body) ────────────────
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
      {/* Header — « ‹  Month Year  › » */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-0.5">
          <NavBtn onClick={prevYear}  disabled={cantGoPrevY} aria-label="Previous year">«</NavBtn>
          <NavBtn onClick={prevMonth} disabled={cantGoPrevM} aria-label="Previous month">‹</NavBtn>
        </div>
        <span className="text-sm font-bold text-slate-800 select-none">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <div className="flex items-center gap-0.5">
          <NavBtn onClick={nextMonth} disabled={cantGoNextM} aria-label="Next month">›</NavBtn>
          <NavBtn onClick={nextYear}  disabled={cantGoNextY} aria-label="Next year">»</NavBtn>
        </div>
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

          const dateStr   = toYMD(viewYear, viewMonth, day)
          const inRange   = isInRange(dateStr)
          const selected  = dateStr === value
          const isToday   = dateStr === TODAY_STR

          let cls = 'w-8 h-8 flex items-center justify-center rounded-full text-xs font-medium transition-colors select-none '
          if (selected) {
            cls += 'bg-blue-600 text-white font-bold shadow-sm shadow-blue-200'
          } else if (inRange) {
            cls += 'text-slate-800 hover:bg-blue-50 hover:text-blue-700 cursor-pointer'
            if (isToday) cls += ' ring-2 ring-blue-300'
          } else {
            cls += 'text-slate-300 cursor-not-allowed'
          }

          return (
            <div key={idx} className="flex items-center justify-center h-9">
              <button type="button" disabled={!inRange} onClick={() => handleDayClick(dateStr)} className={cls}>
                {day}
              </button>
            </div>
          )
        })}
      </div>
    </div>,
    document.body,
  )

  return (
    <div ref={triggerRef}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen(o => !o)}
        className={[
          'w-full px-4 py-3 rounded-xl border text-sm text-left flex items-center justify-between gap-2 transition-all duration-200',
          open
            ? 'border-blue-500 ring-2 ring-blue-500 bg-white'
            : hasError
              ? 'border-red-400 ring-2 ring-red-300 bg-red-50/60'
              : 'border-slate-200 hover:border-slate-300 bg-white',
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

/** Header chevron / double-chevron button. */
function NavBtn({ children, onClick, disabled, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors text-lg leading-none select-none disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-500"
      {...rest}
    >
      {children}
    </button>
  )
}
