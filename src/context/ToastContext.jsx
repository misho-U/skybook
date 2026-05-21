import { createContext, useCallback, useContext, useState } from 'react'

const ToastContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}

const TYPE_STYLES = {
  success: { bar: 'bg-emerald-500', icon: 'text-emerald-500' },
  error:   { bar: 'bg-red-500',     icon: 'text-red-500'     },
  info:    { bar: 'bg-blue-500',    icon: 'text-blue-500'    },
}

function CheckIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}
function XIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
function InfoIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

const ICONS = {
  success: <CheckIcon className="w-5 h-5" />,
  error:   <XIcon    className="w-5 h-5" />,
  info:    <InfoIcon className="w-5 h-5" />,
}

function ToastItem({ id, message, type, onDismiss }) {
  const { bar, icon } = TYPE_STYLES[type] ?? TYPE_STYLES.info
  return (
    <div className="pointer-events-auto w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-slide-in-right">
      {/* colour bar */}
      <div className={`h-1 w-full ${bar}`} />
      <div className="flex items-start gap-3 px-4 py-3">
        <span className={`${icon} shrink-0 mt-0.5`}>{ICONS[type]}</span>
        <p className="flex-1 text-sm text-slate-700 font-medium leading-snug">{message}</p>
        <button
          onClick={() => onDismiss(id)}
          aria-label="Dismiss"
          className="text-slate-400 hover:text-slate-600 transition-colors shrink-0 -mr-1 btn-press"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }].slice(-3))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[300] flex flex-col gap-2.5 pointer-events-none">
        {toasts.map(t => (
          <ToastItem key={t.id} {...t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
