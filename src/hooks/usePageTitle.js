import { useEffect } from 'react'

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — SkyBook ✈️` : 'SkyBook ✈️'
    return () => {
      document.title = 'SkyBook ✈️'
    }
  }, [title])
}
