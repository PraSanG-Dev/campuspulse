import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

/**
 * EmptyState — shown when a list has no items.
 *
 * Every feature that shows a list must have one of these.
 * It makes the app feel polished and guides the user on what to do next.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-brand-50">
        <Icon className="size-7 text-brand-400" strokeWidth={1.5} />
      </div>
      <h3 className="mb-1 text-sm font-semibold text-gray-900">{title}</h3>
      <p className="max-w-xs text-sm text-gray-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
