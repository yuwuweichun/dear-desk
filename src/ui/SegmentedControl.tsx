import type { ReactNode } from 'react'

import { Button } from './Button'

export interface SegmentedOption<T extends string> {
  icon?: ReactNode
  label: string
  value: T
}

interface SegmentedControlProps<T extends string> {
  ariaLabel: string
  className?: string
  disabled?: boolean
  onChange: (value: T) => void
  options: readonly SegmentedOption<T>[]
  value: T
}

export function SegmentedControl<T extends string>({
  ariaLabel,
  className = '',
  disabled,
  onChange,
  options,
  value,
}: SegmentedControlProps<T>) {
  return (
    <div className={`dd-segmented ${className}`.trim()} aria-label={ariaLabel} role="group">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <Button
            aria-pressed={selected}
            className={selected ? 'is-active' : undefined}
            disabled={disabled}
            icon={option.icon}
            key={option.value}
            onClick={() => onChange(option.value)}
            size="small"
            variant={selected ? 'primary' : 'secondary'}
          >
            {option.label}
          </Button>
        )
      })}
    </div>
  )
}
