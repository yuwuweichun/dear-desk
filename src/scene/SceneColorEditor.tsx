import { Copy, Palette, RotateCcw, X } from 'lucide-react'
import { useState } from 'react'

import { IconButton } from '../ui'
import type { SceneColorConfig } from './models/material-library'
import { isSceneHexColor, serializeSceneColors } from './scene-color'

const colorGroups: Array<{
  label: string
  fields: Array<{ key: keyof SceneColorConfig; label: string }>
}> = [
  { label: '环境', fields: [{ key: 'background', label: '背景与雾' }] },
  {
    label: '桌子',
    fields: [
      { key: 'deskTop', label: '桌面' },
      { key: 'deskFrame', label: '桌框与围板' },
      { key: 'deskLegs', label: '桌腿与支撑' },
      { key: 'deskInset', label: '支撑嵌板' },
    ],
  },
  {
    label: '桌垫',
    fields: [
      { key: 'matField', label: '工作面' },
      { key: 'matBinding', label: '垫体与包边' },
    ],
  },
  {
    label: '本子',
    fields: [
      { key: 'notebookCover', label: '外壳' },
      { key: 'notebookJoint', label: '书脊与接缝' },
    ],
  },
]

interface ColorFieldProps {
  colorKey: keyof SceneColorConfig
  label: string
  onChange: (key: keyof SceneColorConfig, value: string) => void
  value: string
}

function ColorField({ colorKey, label, onChange, value }: ColorFieldProps) {
  const [draft, setDraft] = useState(value.toUpperCase())

  return (
    <label className="scene-color-field">
      <span>{label}</span>
      <input
        aria-label={`${label}颜色`}
        className="scene-color-swatch"
        type="color"
        value={value}
        onChange={(event) => {
          setDraft(event.target.value.toUpperCase())
          onChange(colorKey, event.target.value)
        }}
      />
      <input
        aria-invalid={!isSceneHexColor(draft)}
        aria-label={`${label} HEX`}
        className="scene-color-hex"
        inputMode="text"
        maxLength={7}
        spellCheck={false}
        value={draft}
        onChange={(event) => {
          const next = event.target.value.toUpperCase()
          setDraft(next)
          if (isSceneHexColor(next)) onChange(colorKey, next.toLowerCase())
        }}
      />
    </label>
  )
}

interface SceneColorEditorProps {
  colors: SceneColorConfig
  onChange: (colors: SceneColorConfig) => void
  onClose: () => void
  onReset: () => void
}

export function SceneColorEditor({ colors, onChange, onClose, onReset }: SceneColorEditorProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [resetRevision, setResetRevision] = useState(0)

  const changeColor = (key: keyof SceneColorConfig, value: string) => {
    onChange({ ...colors, [key]: value })
  }

  const copyColors = async () => {
    try {
      await navigator.clipboard.writeText(serializeSceneColors(colors))
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <aside className="scene-color-editor" aria-label="场景颜色编辑器">
      <header className="scene-color-editor__header">
        <div>
          <strong>场景颜色</strong>
        </div>
        <div className="scene-color-editor__commands">
          <IconButton
            label="恢复运行回退颜色"
            onClick={() => {
              onReset()
              setResetRevision((revision) => revision + 1)
            }}
            variant="quiet"
          >
            <RotateCcw aria-hidden="true" size={17} />
          </IconButton>
          <IconButton label="复制颜色配置" onClick={() => void copyColors()} variant="quiet">
            <Copy aria-hidden="true" size={17} />
          </IconButton>
          <IconButton label="关闭颜色面板" onClick={onClose} variant="quiet">
            <X aria-hidden="true" size={18} />
          </IconButton>
        </div>
      </header>

      <div className="scene-color-editor__body">
        {colorGroups.map((group) => (
          <fieldset key={group.label}>
            <legend>{group.label}</legend>
            {group.fields.map((field) => (
              <ColorField
                key={`${field.key}-${resetRevision}`}
                colorKey={field.key}
                label={field.label}
                onChange={changeColor}
                value={colors[field.key]}
              />
            ))}
          </fieldset>
        ))}
      </div>
      {copyState !== 'idle' ? (
        <p className="scene-color-editor__status" aria-live="polite">
          {copyState === 'copied' ? '颜色配置已复制' : '复制失败'}
        </p>
      ) : null}
    </aside>
  )
}

export function SceneColorEditorButton({ onClick }: { onClick: () => void }) {
  return (
    <IconButton
      className="scene-color-editor-button"
      label="打开场景颜色编辑器"
      onClick={onClick}
      variant="secondary"
    >
      <Palette aria-hidden="true" size={20} />
    </IconButton>
  )
}
