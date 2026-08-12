import type { ReactNode } from 'react'

import { Button, type ButtonProps } from './Button'

interface IconButtonProps extends Omit<ButtonProps, 'children' | 'icon'> {
  children: ReactNode
  label: string
}

export function IconButton({ children, label, title = label, ...props }: IconButtonProps) {
  return (
    <Button
      {...props}
      aria-label={label}
      className={`dd-icon-button ${props.className ?? ''}`.trim()}
      title={title}
    >
      {children}
    </Button>
  )
}
