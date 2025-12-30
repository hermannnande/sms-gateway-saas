'use client'

import Link from 'next/link'
import { type ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'outline'
type ButtonSize = 'sm' | 'md' | 'lg'

interface HomeButtonProps {
  href: string
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  ariaLabel?: string
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-brutal-primary hover:shadow-glow hover:from-primary/95 hover:to-primary/85 relative overflow-hidden group',
  secondary: 'bg-gradient-to-r from-secondary to-secondary/90 text-secondary-foreground shadow-sm hover:from-secondary/95 hover:to-secondary/85 relative overflow-hidden group',
  outline: 'border-2 border-border bg-background/50 hover:bg-card hover:border-primary/40 backdrop-blur-sm relative overflow-hidden group',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-5 py-2.5 text-sm',
  md: 'px-7 py-3.5 text-base',
  lg: 'px-9 py-4 text-lg font-bold',
}

export function HomeButton({
  href,
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ariaLabel,
}: HomeButtonProps) {
  return (
    <Link
      href={href}
      className={`
        inline-flex items-center justify-center gap-2 rounded-xl font-semibold
        transition-all duration-300 ease-out
        hover:-translate-y-1 hover:scale-[1.02] active:translate-y-0 active:scale-100
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      aria-label={ariaLabel}
    >
      {/* Shine effect on hover (for primary/secondary) */}
      {(variant === 'primary' || variant === 'secondary') && (
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      )}
      
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </Link>
  )
}

