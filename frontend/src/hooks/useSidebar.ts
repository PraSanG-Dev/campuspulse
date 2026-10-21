import { useState, useEffect } from 'react'

const STORAGE_KEY = 'campuspulse:sidebar-open'

/**
 * Persists sidebar open/closed state to localStorage.
 * Defaults to open on desktop, closed on mobile (≤768 px).
 */
export function useSidebar() {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    // On first load: open on wide screens, closed on mobile
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) return stored === 'true'
    return window.innerWidth >= 768
  })

  // Persist preference whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isOpen))
  }, [isOpen])

  const toggle = () => setIsOpen((prev) => !prev)
  const close  = () => setIsOpen(false)

  return { isOpen, toggle, close }
}
