import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * cn() — merge Tailwind classes safely.
 *
 * Why: Tailwind generates atomic classes. If you write both "p-2" and "p-4"
 * on the same element, both exist in the DOM but only one wins (unpredictably).
 * twMerge resolves conflicts so the last one always wins.
 * clsx handles conditional classes like: cn('base', isActive && 'text-brand-600')
 *
 * Usage: className={cn('base-classes', condition && 'extra-class', props.className)}
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
