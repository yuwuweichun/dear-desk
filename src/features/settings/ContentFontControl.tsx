import { Check, Type } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  CONTENT_FONT_OPTIONS,
  type ContentFontId,
} from '../../domain/journal-font'
import { IconButton } from '../../ui'

interface ContentFontControlProps {
  font: ContentFontId
  onChange: (font: ContentFontId) => void
}

export function ContentFontControl({ font, onChange }: ContentFontControlProps) {
  const [open, setOpen] = useState(false)
  const controlRef = useRef<HTMLDivElement>(null)
  const currentLabel = CONTENT_FONT_OPTIONS.find((option) => option.id === font)?.label
    ?? '纸页宋体'

  useEffect(() => {
    if (!open) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!controlRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div className="content-font-control" ref={controlRef}>
      <IconButton
        aria-expanded={open}
        aria-haspopup="menu"
        className="content-font-button"
        label={`更换内容字体，当前${currentLabel}`}
        onClick={() => setOpen((value) => !value)}
        showTitle={false}
        variant="secondary"
      >
        <Type aria-hidden="true" size={20} strokeWidth={1.9} />
      </IconButton>
      {open ? (
        <div className="content-font-menu" role="menu" aria-label="选择内容字体">
          {CONTENT_FONT_OPTIONS.map((option) => (
            <button
              aria-checked={font === option.id}
              className="content-font-option"
              data-font-preview={option.id}
              key={option.id}
              onClick={() => {
                onChange(option.id)
                setOpen(false)
              }}
              role="menuitemradio"
              type="button"
            >
              <span className="content-font-option__sample" aria-hidden="true">
                {option.sample}
              </span>
              <span>{option.label}</span>
              {font === option.id ? <Check aria-hidden="true" size={16} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
