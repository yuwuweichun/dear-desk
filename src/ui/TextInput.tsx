import { Input, type InputProps } from 'animal-island-ui'
import classNames from 'classnames'

export function TextInput({ className, ...props }: InputProps) {
  return (
    <Input
      {...props}
      className={classNames('dd-text-input', className)}
      shadow
    />
  )
}
