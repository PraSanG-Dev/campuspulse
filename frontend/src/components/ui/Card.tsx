import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

// ── Card ──────────────────────────────────────────────────────────────────────

const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-surface-border bg-surface-card shadow-sm',
        className,
      )}
      {...props}
    />
  ),
)
Card.displayName = 'Card'

// ── Card sub-components ───────────────────────────────────────────────────────
// Splitting into Header / Content / Footer gives a consistent look everywhere.

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center justify-between px-5 pt-5 pb-3', className)}
      {...props}
    />
  ),
)
CardHeader.displayName = 'CardHeader'

const CardTitle = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-sm font-semibold text-gray-700 uppercase tracking-wide', className)}
      {...props}
    />
  ),
)
CardTitle.displayName = 'CardTitle'

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-5 pb-5', className)} {...props} />
  ),
)
CardContent.displayName = 'CardContent'

export { Card, CardHeader, CardTitle, CardContent }
