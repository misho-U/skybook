import { useState } from 'react'

export const TYPE_LABEL = { adult: 'Adult', child: 'Child', infant: 'Infant' }
export const TYPE_BADGE = {
  adult:  'bg-blue-100 text-blue-800 ring-1 ring-blue-200',
  child:  'bg-green-100 text-green-800 ring-1 ring-green-200',
  infant: 'bg-orange-100 text-orange-800 ring-1 ring-orange-200',
}

const CARD_ACCENT = {
  adult:  'border-l-blue-400 bg-blue-50/40',
  child:  'border-l-green-400 bg-green-50/40',
  infant: 'border-l-orange-400 bg-orange-50/40',
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function DobSelect({ value, passengerType, onChange, error }) {
  const thisYear  = new Date().getFullYear()
  // Initialise from a pre-existing value (e.g. navigating back through steps)
  const initParts = value?.split('-') ?? []

  // Own state so each dropdown retains its value independently of the others.
  // Deriving from props caused the bug: build() returned '' when any field was
  // missing, wiping already-selected values on the next render.
  const [selY, setSelY] = useState(initParts[0] || '')
  const [selM, setSelM] = useState(initParts[1] ? Number(initParts[1]) : '')
  const [selD, setSelD] = useState(initParts[2] ? Number(initParts[2]) : '')

  const yearMin = passengerType === 'infant' ? thisYear - 2 : 1930
  const years   = Array.from({ length: thisYear - yearMin + 1 }, (_, i) => thisYear - i)

  function emit(y, m, d) {
    onChange(
      y && m && d
        ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        : ''
    )
  }

  const cls = [
    'py-3 rounded-xl border text-sm text-slate-800 bg-white',
    'focus:outline-none focus:ring-2 transition-all duration-200',
    error
      ? 'border-red-400 focus:ring-red-300 bg-red-50/60'
      : 'border-slate-200 focus:ring-blue-500 focus:border-transparent',
  ].join(' ')

  return (
    <div className="flex gap-2">
      <select value={selD}
        onChange={e => { setSelD(e.target.value); emit(selY, selM, e.target.value) }}
        className={`${cls} w-20 px-2`}>
        <option value="">Day</option>
        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <select value={selM}
        onChange={e => { setSelM(e.target.value); emit(selY, e.target.value, selD) }}
        className={`${cls} flex-1 px-2`}>
        <option value="">Month</option>
        {MONTH_NAMES.map((name, i) => (
          <option key={i} value={i + 1}>{name}</option>
        ))}
      </select>
      <select value={selY}
        onChange={e => { setSelY(e.target.value); emit(e.target.value, selM, selD) }}
        className={`${cls} w-24 px-2`}>
        <option value="">Year</option>
        {years.map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  )
}

function Field({ label, id, type = 'text', value, onChange, error, placeholder }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      <input
        id={id} type={type} value={value} onChange={onChange} placeholder={placeholder}
        className={`w-full px-4 py-3 rounded-xl border text-sm text-slate-800 transition-all duration-200 focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-400 focus:ring-red-300 bg-red-50/60'
            : 'border-slate-200 focus:ring-blue-500 focus:border-transparent bg-white'
        }`}
      />
      {error && <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><span>⚠</span> {error}</p>}
    </div>
  )
}

export default function StepPassengerInfo({
  adults, children, infants,
  passengers, setPassengers,
  contact, setContact,
  onBack, onNext,
}) {
  const [errors, setErrors] = useState({})

  function clearErr(key) {
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  function handlePassengerField(i, field, value) {
    setPassengers(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
    clearErr(`${i}.${field}`)
  }

  function isValidDob(dob) {
    return dob && dob.length === 10 && !dob.includes('undefined') && !dob.includes('NaN')
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = {}
    passengers.forEach((p, i) => {
      if (!p.firstName.trim()) errs[`${i}.firstName`] = 'Required'
      if (!p.lastName.trim())  errs[`${i}.lastName`]  = 'Required'
      if (!isValidDob(p.dob))  errs[`${i}.dob`]       = 'Please select a complete date of birth'
      if (p.type !== 'infant' && !p.passport.trim()) errs[`${i}.passport`] = 'Required'
    })
    if (!contact.email.trim())
      errs['contact.email'] = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email))
      errs['contact.email'] = 'Enter a valid email address'
    if (!contact.phone.trim())
      errs['contact.phone'] = 'Phone number is required'
    else if (!/^\+?[\d\s\-()\\.]{7,}$/.test(contact.phone))
      errs['contact.phone'] = 'Enter a valid phone number'
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    onNext()
  }

  const typeIndex = passengers.map((() => {
    const counts = {}
    return p => { counts[p.type] = (counts[p.type] ?? 0) + 1; return counts[p.type] }
  })())

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-5">
        {passengers.map((p, i) => (
          <div key={i} className={`border border-slate-100 border-l-4 rounded-2xl p-4 ${CARD_ACCENT[p.type]}`}>
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${TYPE_BADGE[p.type]}`}>
                {TYPE_LABEL[p.type]} {typeIndex[i]}
              </span>
              {p.type === 'infant' && (
                <span className="text-xs text-slate-400">Lap infant · no seat required</span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="First name" id={`p${i}-fn`} value={p.firstName}
                onChange={e => handlePassengerField(i, 'firstName', e.target.value)}
                error={errors[`${i}.firstName`]} placeholder="Jane" />
              <Field label="Last name" id={`p${i}-ln`} value={p.lastName}
                onChange={e => handlePassengerField(i, 'lastName', e.target.value)}
                error={errors[`${i}.lastName`]} placeholder="Smith" />
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date of birth</label>
                <DobSelect
                  value={p.dob}
                  passengerType={p.type}
                  onChange={v => handlePassengerField(i, 'dob', v)}
                  error={errors[`${i}.dob`]}
                />
                {errors[`${i}.dob`] && (
                  <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                    <span>⚠</span> {errors[`${i}.dob`]}
                  </p>
                )}
              </div>
              {p.type !== 'infant' && (
                <Field label="Passport number" id={`p${i}-pp`} value={p.passport}
                  onChange={e => handlePassengerField(i, 'passport', e.target.value)}
                  error={errors[`${i}.passport`]} placeholder="AB123456" />
              )}
            </div>
          </div>
        ))}

        <div className="border border-slate-100 rounded-2xl p-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Contact Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Email address" id="contact-email" type="email" value={contact.email}
              onChange={e => { setContact(p => ({ ...p, email: e.target.value })); clearErr('contact.email') }}
              error={errors['contact.email']} placeholder="jane@example.com" />
            <Field label="Phone number" id="contact-phone" type="tel" value={contact.phone}
              onChange={e => { setContact(p => ({ ...p, phone: e.target.value })); clearErr('contact.phone') }}
              error={errors['contact.phone']} placeholder="+1 555 000 0000" />
          </div>
        </div>
      </div>

      <div className="flex justify-between mt-6">
        <button type="button" onClick={onBack}
          className="px-6 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 btn-press transition-all">
          ← Back
        </button>
        <button type="submit"
          className="px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 shadow-sm shadow-blue-200 btn-press transition-all">
          Review Booking →
        </button>
      </div>
    </form>
  )
}
