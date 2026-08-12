import {
  Button as AnimalButton,
  type ButtonProps as AnimalButtonProps,
} from 'animal-island-ui'
import classNames from 'classnames'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'

export interface ButtonProps
  extends Omit<AnimalButtonProps, 'danger' | 'ghost' | 'type'> {
  variant?: ButtonVariant
}

export function Button({
  className,
  disabled,
  htmlType = 'button',
  loading,
  variant = 'secondary',
  ...props
}: ButtonProps) {
  return (
    <AnimalButton
      {...props}
      className={classNames('dd-button', `dd-button--${variant}`, className)}
      danger={variant === 'danger'}
      disabled={disabled || loading}
      ghost={variant === 'quiet'}
      htmlType={htmlType}
      loading={loading}
      type={variant === 'primary' || variant === 'danger' ? 'primary' : 'default'}
    />
  )
}
