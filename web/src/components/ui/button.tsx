import * as React from "react"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = 'primary', size = 'md', children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
    
    const variants = {
      primary: "bg-primary text-primary-foreground shadow-sm hover:shadow-md hover:-translate-y-0.5",
      secondary: "bg-secondary text-secondary-foreground shadow-sm hover:shadow-md hover:-translate-y-0.5",
      accent: "bg-accent text-accent-foreground shadow-sm hover:shadow-md hover:-translate-y-0.5",
      outline: "border border-border bg-transparent hover:bg-muted",
      ghost: "hover:bg-muted"
    }
    
    const sizes = {
      sm: "px-4 py-2 text-sm",
      md: "px-5 py-2.5 text-sm",
      lg: "px-6 py-3 text-base"
    }
    
    return (
      <button
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }

