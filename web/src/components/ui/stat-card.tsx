import { ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: string | number
  icon: ReactNode
  description?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  href?: string
}

export function StatCard({ title, value, icon, description, trend, href }: StatCardProps) {
  const content = (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            {title}
          </p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        <div className="text-3xl opacity-60">{icon}</div>
      </div>

      {trend && (
        <div className="flex items-center gap-1 text-xs font-medium">
          <span className={trend.isPositive ? 'text-green-600' : 'text-red-600'}>
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
          <span className="text-muted-foreground">vs. mois dernier</span>
        </div>
      )}

      {href && (
        <a
          href={href}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium mt-2"
        >
          Voir détails →
        </a>
      )}
    </>
  )

  if (href) {
    return (
      <a
        href={href}
        className="block bg-card rounded-lg p-6 border border-border shadow-sm hover:shadow-md hover:border-primary/50 transition-all"
      >
        {content}
      </a>
    )
  }

  return (
    <div className="bg-card rounded-lg p-6 border border-border shadow-sm">
      {content}
    </div>
  )
}

