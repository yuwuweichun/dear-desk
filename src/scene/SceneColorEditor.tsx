import { Copy, ImageOff, Palette, RotateCcw, Save, Trash2, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

import {
  MAX_SCENE_COLOR_PRESET_NAME_LENGTH,
  sceneColorsEqual,
  type SceneColorPreset,
} from '../domain/scene-color-preset'
import { Button, IconButton } from '../ui'
import type { SceneColorConfig } from './models/material-library'
import { getSceneColorConfig } from './models/material-library'
import { isSceneHexColor, serializeSceneColors } from './scene-color'

const DEFAULT_PRESET_PREVIEW = '/assets/scene-color-presets/default-v11.webp'

const colorGroups: Array<{
  label: string
  fields: Array<{ key: keyof SceneColorConfig; label: string }>
}> = [
  { label: '环境', fields: [{ key: 'background', label: '背景' }] },
  {
    label: '桌子',
    fields: [
      { key: 'deskTop', label: '桌面' },
      { key: 'deskFrame', label: '桌框与围板' },
      { key: 'deskLegs', label: '桌腿与支撑' },
      { key: 'deskInset', label: '抽屉面' },
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
  loadingPresets?: boolean
  onChange: (colors: SceneColorConfig) => void
  onClose: () => void
  onDeletePreset?: (id: string) => Promise<void>
  onReset: () => void
  onSavePreset?: (name: string) => Promise<{
    preset: SceneColorPreset
    previewCaptured: boolean
  }>
  presets?: SceneColorPreset[]
  presetsError?: string | null
}

interface PresetPreviewProps {
  alt: string
  blob?: Blob
  src?: string
}

function PresetPreview({ alt, blob, src: staticSrc }: PresetPreviewProps) {
  const [src, setSrc] = useState<string | null>(staticSrc ?? null)

  useEffect(() => {
    if (!blob || typeof URL.createObjectURL !== 'function') return
    const objectUrl = URL.createObjectURL(blob)
    let active = true
    queueMicrotask(() => {
      if (active) setSrc(objectUrl)
    })
    return () => {
      active = false
      URL.revokeObjectURL(objectUrl)
    }
  }, [blob, staticSrc])

  return (
    <span className="scene-preset-card__preview">
      {src ? (
        <img
          alt={alt}
          onError={() => setSrc(null)}
          src={src}
        />
      ) : (
        <span className="scene-preset-card__fallback" aria-hidden="true">
          <ImageOff size={22} strokeWidth={1.8} />
        </span>
      )}
    </span>
  )
}

interface PresetCardProps {
  active: boolean
  builtIn?: boolean
  deleting?: boolean
  name: string
  onApply: () => void
  onDelete?: () => void
  previewBlob?: Blob
  previewSrc?: string
}

function PresetCard({
  active,
  builtIn = false,
  deleting = false,
  name,
  onApply,
  onDelete,
  previewBlob,
  previewSrc,
}: PresetCardProps) {
  return (
    <article className="scene-preset-card" data-active={active}>
      <button
        aria-pressed={active}
        className="scene-preset-card__apply"
        onClick={onApply}
        type="button"
      >
        <PresetPreview
          alt={`${name}场景预览`}
          blob={previewBlob}
          src={previewSrc}
        />
        <span className="scene-preset-card__meta">
          <strong>{name}</strong>
          <span>{builtIn ? '内置预设' : '自定义预设'}</span>
        </span>
      </button>
      {onDelete ? (
        <IconButton
          className="scene-preset-card__delete"
          disabled={deleting}
          label={`删除预设 ${name}`}
          onClick={onDelete}
          variant="quiet"
        >
          <Trash2 aria-hidden="true" size={16} />
        </IconButton>
      ) : null}
    </article>
  )
}

export function SceneColorEditor({
  colors,
  loadingPresets = false,
  onChange,
  onClose,
  onDeletePreset,
  onReset,
  onSavePreset,
  presets = [],
  presetsError = null,
}: SceneColorEditorProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [resetRevision, setResetRevision] = useState(0)
  const [activeTab, setActiveTab] = useState<'colors' | 'presets'>('colors')
  const [presetName, setPresetName] = useState('')
  const [presetStatus, setPresetStatus] = useState<string | null>(null)
  const [presetError, setPresetError] = useState<string | null>(null)
  const [savingPreset, setSavingPreset] = useState(false)
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null)
  const defaultColors = getSceneColorConfig()
  const matchingPreset = presets.find((preset) => sceneColorsEqual(colors, preset.colors))
  const defaultActive = !matchingPreset && sceneColorsEqual(colors, defaultColors)

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

  const savePreset = async (event: FormEvent) => {
    event.preventDefault()
    if (!onSavePreset) return
    setPresetError(null)
    setPresetStatus(null)
    setSavingPreset(true)
    try {
      const result = await onSavePreset(presetName)
      setPresetName('')
      setPresetStatus(result.previewCaptured
        ? `已保存“${result.preset.name}”`
        : `已保存“${result.preset.name}”，场景图未生成`)
    } catch (error) {
      setPresetError(error instanceof Error ? error.message : '颜色预设保存失败。')
    } finally {
      setSavingPreset(false)
    }
  }

  const deletePreset = async (preset: SceneColorPreset) => {
    if (!onDeletePreset) return
    setPresetError(null)
    setPresetStatus(null)
    setDeletingPresetId(preset.id)
    try {
      await onDeletePreset(preset.id)
      setPresetStatus(`已删除“${preset.name}”`)
    } catch (error) {
      setPresetError(error instanceof Error ? error.message : '颜色预设删除失败。')
    } finally {
      setDeletingPresetId(null)
    }
  }

  return (
    <aside
      className="scene-color-editor"
      id="scene-color-editor"
      aria-label="场景颜色编辑器"
      role="dialog"
    >
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

      <div className="scene-color-editor__tabs" aria-label="场景颜色面板" role="tablist">
        <button
          aria-controls="scene-colors-panel"
          aria-selected={activeTab === 'colors'}
          id="scene-colors-tab"
          onClick={() => setActiveTab('colors')}
          role="tab"
          type="button"
        >
          颜色
        </button>
        <button
          aria-controls="scene-presets-panel"
          aria-selected={activeTab === 'presets'}
          id="scene-presets-tab"
          onClick={() => setActiveTab('presets')}
          role="tab"
          type="button"
        >
          预设
        </button>
      </div>

      {activeTab === 'colors' ? (
        <div
          aria-labelledby="scene-colors-tab"
          className="scene-color-editor__body"
          id="scene-colors-panel"
          role="tabpanel"
        >
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
      ) : (
        <div
          aria-labelledby="scene-presets-tab"
          className="scene-color-editor__body scene-color-editor__presets"
          id="scene-presets-panel"
          role="tabpanel"
        >
          <form className="scene-preset-form" onSubmit={(event) => void savePreset(event)}>
            <label htmlFor="scene-preset-name">预设名称</label>
            <div>
              <input
                autoComplete="off"
                id="scene-preset-name"
                maxLength={MAX_SCENE_COLOR_PRESET_NAME_LENGTH}
                onChange={(event) => setPresetName(event.target.value)}
                placeholder="例如 雨天书桌"
                value={presetName}
              />
              <Button
                disabled={!onSavePreset}
                htmlType="submit"
                icon={<Save aria-hidden="true" size={16} />}
                loading={savingPreset}
                variant="primary"
              >
                保存
              </Button>
            </div>
          </form>

          <div className="scene-preset-list" aria-label="颜色预设列表">
            <PresetCard
              active={defaultActive}
              builtIn
              name="默认配色"
              onApply={() => onChange(defaultColors)}
              previewSrc={DEFAULT_PRESET_PREVIEW}
            />
            {loadingPresets ? <p className="scene-preset-list__empty">正在读取预设...</p> : null}
            {presets.map((preset) => (
              <PresetCard
                active={matchingPreset?.id === preset.id}
                deleting={deletingPresetId === preset.id}
                key={preset.id}
                name={preset.name}
                onApply={() => onChange({ ...preset.colors })}
                onDelete={onDeletePreset ? () => void deletePreset(preset) : undefined}
                previewBlob={preset.previewBlob}
              />
            ))}
            {!loadingPresets && presets.length === 0 ? (
              <p className="scene-preset-list__empty">还没有自定义预设</p>
            ) : null}
          </div>

          {presetError || presetsError || presetStatus ? (
            <p
              className="scene-color-editor__status scene-color-editor__status--inline"
              aria-live="polite"
              role={presetError || presetsError ? 'alert' : undefined}
            >
              {presetError ?? presetsError ?? presetStatus}
            </p>
          ) : null}
        </div>
      )}
      {activeTab === 'colors' && copyState !== 'idle' ? (
        <p className="scene-color-editor__status" aria-live="polite">
          {copyState === 'copied' ? '颜色配置已复制' : '复制失败'}
        </p>
      ) : null}
    </aside>
  )
}

interface SceneColorEditorButtonProps {
  expanded?: boolean
  onClick: () => void
}

export function SceneColorEditorButton({
  expanded = false,
  onClick,
}: SceneColorEditorButtonProps) {
  return (
    <IconButton
      aria-controls="scene-color-editor"
      aria-expanded={expanded}
      aria-haspopup="dialog"
      className="scene-color-editor-button"
      label="打开场景颜色编辑器"
      onClick={onClick}
      showTitle={false}
      variant="secondary"
    >
      <Palette aria-hidden="true" size={20} />
    </IconButton>
  )
}
