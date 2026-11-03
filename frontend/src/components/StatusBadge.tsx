interface StatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
}

const statusStyles: Record<string, string> = {
  online: 'badge-success',
  offline: 'badge-error',
  error: 'badge-error',
  completed: 'badge-success',
  partial: 'badge-warning',
  new: 'badge-info',
  analyzed: 'badge-info',
  approved: 'badge-success',
  rejected: 'badge-error',
  queued: 'badge-warning',
  generating_script: 'badge-warning',
  rendering: 'badge-warning',
  failed: 'badge-error',
  scheduled: 'badge-info',
  published: 'badge-success',
  cancelled: 'badge-neutral',
  cancelling: 'badge-warning',
  interested: 'badge-info',
  researching: 'badge-warning',
  promoting: 'badge-success',
  archived: 'badge-neutral',
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const style = statusStyles[status] || 'badge-neutral'
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <span className={`${style} ${size === 'md' ? 'text-sm px-3 py-1' : ''}`}>
      {label}
    </span>
  )
}
