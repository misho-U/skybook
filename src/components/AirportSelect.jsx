import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'

export default function AirportSelect({
  airports,    // { id, city, country, code, flag }[]
  value,       // selected city string, or ''
  onChange,    // (cityString) => void
  placeholder,
  exclude,     // city string to hide from the list (the other field's selection)
}) {
  const [open,    setOpen]    = useState(false)
  const [search,  setSearch]  = useState('')
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 280 })

  const triggerRef  = useRef(null)
  const dropdownRef = useRef(null)
  const searchRef   = useRef(null)

  const selected = airports.find(a => a.city === value) ?? null

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return airports.filter(a => {
      if (a.city === exclude) return false
      if (!q) return true
      return (
        a.city.toLowerCase().includes(q)    ||
        a.code.toLowerCase().includes(q)    ||
        a.country.toLowerCase().includes(q)
      )
    })
  }, [airports, search, exclude])

  // Focus search and reset filter when opening; clear filter on close
  useEffect(() => {
    if (open) {
      // small delay so the portal is mounted before we focus
      const t = setTimeout(() => searchRef.current?.focus(), 30)
      return () => clearTimeout(t)
    } else {
      setSearch('')
    }
  }, [open])

  // Position + outside-click (same pattern as DatePicker)
  useEffect(() => {
    if (!open) return

    function reposition() {
      if (!triggerRef.current) return
      const rect  = triggerRef.current.getBoundingClientRect()
      const width = Math.max(rect.width, 280)
      const left  = Math.min(rect.left, window.innerWidth - width - 8)
      setDropPos({ top: rect.bottom + 6, left: Math.max(4, left), width })
    }

    function onDown(e) {
      if (
        !triggerRef.current?.contains(e.target) &&
        !dropdownRef.current?.contains(e.target)
      ) setOpen(false)
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

  function handleSelect(airport) {
    onChange(airport.city)
    setOpen(false)
  }

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
      className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-fade-in"
    >
      {/* Search bar */}
      <div className="p-2.5 border-b border-slate-100">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search cities or codes…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Airport list */}
      <div className="max-h-56 overflow-y-auto overscroll-contain">
        {airports.length === 0 ? (
          <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
            <div className="w-4 h-4 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-sm">Loading airports…</span>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No airports match "{search}"</p>
        ) : (
          filtered.map(airport => {
            const isSelected = airport.city === value
            return (
              <button
                key={airport.id}
                type="button"
                onClick={() => handleSelect(airport)}
                className={[
                  'w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors',
                  isSelected
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700 hover:bg-slate-50',
                ].join(' ')}
              >
                <span className="text-xl shrink-0 leading-none">{airport.flag}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold">{airport.city}</span>
                  <span className="text-xs text-slate-400 ml-1.5">{airport.country}</span>
                </div>
                <span className={`text-xs font-bold font-mono shrink-0 ${isSelected ? 'text-blue-500' : 'text-slate-400'}`}>
                  {airport.code}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>,
    document.body
  )

  return (
    <div ref={triggerRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={[
          'w-full px-4 py-3 rounded-xl border text-sm text-left flex items-center justify-between gap-2 bg-white transition-all duration-200',
          open
            ? 'border-blue-500 ring-2 ring-blue-500'
            : 'border-slate-200 hover:border-slate-300',
          selected ? 'text-slate-800' : 'text-slate-400',
        ].join(' ')}
      >
        {selected ? (
          <span className="flex items-center gap-2 truncate min-w-0">
            <span className="text-xl leading-none shrink-0">{selected.flag}</span>
            <span className="font-semibold truncate">{selected.city}</span>
            <span className="text-xs text-slate-400 font-mono shrink-0">{selected.code}</span>
          </span>
        ) : (
          <span>{placeholder ?? 'Select city'}</span>
        )}
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
