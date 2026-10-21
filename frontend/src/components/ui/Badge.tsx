import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const variants = {
  default:  'bg-gray-100 text-gray-700',
  brand:    'bg-brand-100 text-brand-700',
  success:  'bg-green-100 text-green-700',
  warning:  'bg-amber-100 text-amber-700',
  danger:   'bg-red-100 text-red-700',
  pending:  'bg-yellow-100 text-yellow-700',
} as const

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants
}

export function Badge({ variant = 'default', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
