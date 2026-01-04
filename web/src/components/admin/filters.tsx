'use client'

interface FilterOption {
  label: string
  value: string
}

interface FiltersProps {
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  filters?: {
    label: string
    value: string
    onChange: (value: string) => void
    options: FilterOption[]
  }[]
}

export function Filters({ searchValue, onSearchChange, searchPlaceholder = 'Rechercher...', filters }: FiltersProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <div className="flex flex-wrap gap-4">
        {onSearchChange && (
          <div className="flex-1 min-w-[250px]">
            <input
              type="text"
              value={searchValue || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            />
          </div>
        )}
        {filters?.map((filter, idx) => (
          <div key={idx} className="min-w-[150px]">
            <select
              value={filter.value}
              onChange={(e) => filter.onChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors bg-white"
            >
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}

