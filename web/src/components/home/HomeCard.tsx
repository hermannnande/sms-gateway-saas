'use client'

import { type ReactNode } from 'react'

interface HomeCardProps {
  title: string
  description: string
  icon?: ReactNode
  variant?: 'default' | 'elevated' | 'glass'
  className?: string
}

const variantStyles = {
  default: 'bg-card border border-border/60 shadow-sm hover:shadow-xl hover:border-primary/20',
  elevated: 'bg-gradient-to-br from-card to-card/80 border border-border/60 shadow-lg hover:shadow-2xl hover:-translate-y-2 hover:border-primary/30',
  glass: 'bg-card/60 backdrop-blur-md border border-border/40 shadow-md hover:shadow-xl hover:bg-card/80 hover:border-primary/20',
}

export function HomeCard({
  title,
  description,
  icon,
  variant = 'default',
  className = '',
}: HomeCardProps) {
  return (
    <div
      className={`
        group relative overflow-hidden rounded-2xl p-7 transition-all duration-500 ease-out
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {/* Subtle glow effect on hover */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      
      <div className="relative z-10">
        {icon && (
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 text-3xl shadow-sm ring-1 ring-primary/10 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-md">
            {icon}
          </div>
        )}
        <h3 className="mb-3 text-xl font-black leading-tight tracking-tight transition-colors duration-300 group-hover:text-primary">
          {title}
        </h3>
        <p className="text-sm leading-[1.7] text-muted-foreground transition-colors duration-300 group-hover:text-foreground/70">
          {description}
        </p>
      </div>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-primary to-secondary transition-all duration-500 group-hover:w-full" />
    </div>
  )
}

