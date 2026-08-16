import type { ReactNode } from 'react'

import { Button, type ButtonProps } from './Button'

interface IconButtonProps extends Omit<ButtonProps, 'children' | 'icon'> {
  children: ReactNode
  label: string
  showTitle?: boolean
}

export function IconButton({
  children,
  label,
  showTitle = true,
  title,
  ...props
}: IconButtonProps) {
  return (
    <Button
      {...props}
      aria-label={label}
      className={`dd-icon-button ${props.className ?? ''}`.trim()}
      title={showTitle ? title ?? label : undefined}
    >
      {children}
    </Button>
  )
}
