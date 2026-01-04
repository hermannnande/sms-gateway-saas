'use client'

import { ReactNode } from 'react'

interface ChartWrapperProps {
  title: string
  subtitle?: string
  children: ReactNode
  action?: ReactNode
}

export function ChartWrapper({ title, subtitle, children, action }: ChartWrapperProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="w-full h-80">
        {children}
      </div>
    </div>
  )
}

