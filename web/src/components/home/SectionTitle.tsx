interface SectionTitleProps {
  title: string
  subtitle?: string
  align?: 'left' | 'center'
  className?: string
}

export function SectionTitle({
  title,
  subtitle,
  align = 'left',
  className = '',
}: SectionTitleProps) {
  const alignClass = align === 'center' ? 'text-center mx-auto' : 'text-left'

  return (
    <div className={`space-y-4 ${alignClass} ${className}`}>
      {/* Decorative line for center alignment */}
      {align === 'center' && (
        <div className="mx-auto mb-6 flex items-center justify-center gap-3">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-primary/40" />
          <div className="h-2 w-2 rotate-45 bg-primary/40" />
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-primary/40" />
        </div>
      )}
      
      <h2 className="text-3xl font-black leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      
      {subtitle && (
        <p className="max-w-3xl text-base leading-[1.7] text-muted-foreground sm:text-lg lg:text-xl">
          {subtitle}
        </p>
      )}
    </div>
  )
}

