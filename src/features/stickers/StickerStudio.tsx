import { Check, Sticker, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  MAX_STICKER_TEXT_LENGTH,
  normalizeStickerText,
  type StickerMaterial,
} from '../../domain/sticker'
import {
  createStickerForgeSession,
  type ForgeAppearance,
  type StickerForgeSession,
} from '../../integrations/sticker-forge'
import { useAppStore } from '../../state/app-store-context'

const FONT_FAMILY = 'Arial Rounded MT Bold, Arial Black, sans-serif'
const INITIAL_COLOR = '#19191d'
const colorOptions = ['#19191d', '#b43f50', '#2b6f68', '#315fa8', '#a56b12']
const materialOptions: Array<{ label: string; value: StickerMaterial }> = [
  { label: '原纸', value: 'original' },
  { label: '镭射', value: 'holographic' },
  { label: '闪粉', value: 'glitter' },
  { label: '反光', value: 'reflective' },
]

const defaultAppearance: ForgeAppearance = {
  material: 'original',
  materialIntensity: 0.86,
  outlineColor: '#ffffff',
  outlineWidth: 14,
}

export function StickerStudio() {
  const initialText = useAppStore((state) => state.stickerDraftText) ?? ''
  const selectedDate = useAppStore((state) => state.selectedDate)
  const cancelStickerComposer = useAppStore(
    (state) => state.cancelStickerComposer,
  )
  const prepareStickerPlacement = useAppStore(
    (state) => state.prepareStickerPlacement,
  )
  const mountRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<StickerForgeSession | null>(null)
  const initialTextRef = useRef(initialText)
  const [text, setText] = useState(initialText)
  const [color, setColor] = useState(INITIAL_COLOR)
  const [appearance, setAppearance] = useState(defaultAppearance)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const target = mountRef.current
    if (!target) return
    let cancelled = false

    const start = async () => {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
      if (cancelled) return
      const session = await createStickerForgeSession(
        target,
        {
          type: 'text',
          text: initialTextRef.current,
          color: INITIAL_COLOR,
          fontFamily: FONT_FAMILY,
          fontWeight: 900,
        },
        defaultAppearance,
      )
      if (cancelled) {
        session.destroy()
        return
      }
      sessionRef.current = session
      setReady(true)
    }
    void start().catch((caught) => {
      if (!cancelled) {
        setError(caught instanceof Error ? caught.message : '贴纸制作器无法启动。')
      }
    })

    return () => {
      cancelled = true
      sessionRef.current?.destroy()
      sessionRef.current = null
    }
  }, [])

  const closeSession = () => {
    sessionRef.current?.destroy()
    sessionRef.current = null
  }

  const updateSource = async (nextText: string, nextColor = color) => {
    setText(nextText)
    setError(null)
    const session = sessionRef.current
    if (!session) return
    try {
      await session.setText({
        type: 'text',
        text: nextText || ' ',
        color: nextColor,
        fontFamily: FONT_FAMILY,
        fontWeight: 900,
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '贴纸文字没有更新。')
    }
  }

  const updateAppearance = (next: ForgeAppearance) => {
    setAppearance(next)
    sessionRef.current?.setAppearance(next)
  }

  const confirm = async () => {
    const session = sessionRef.current
    if (!session) return
    setSaving(true)
    setError(null)
    try {
      const normalizedText = normalizeStickerText(text)
      const preview = await session.capture()
      closeSession()
      prepareStickerPlacement({
        source: {
          text: normalizedText,
          color,
          fontFamily: FONT_FAMILY,
          fontWeight: 900,
        },
        forge: appearance,
        preview,
        sourceEntryDate: selectedDate,
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '贴纸快照没有生成。')
      setSaving(false)
    }
  }

  return (
    <section className="sticker-studio" aria-labelledby="sticker-studio-title">
      <div className="sticker-stage">
        <div className="sticker-stage-head">
          <Sticker aria-hidden="true" size={18} strokeWidth={1.8} />
          <span>Sticker Forge</span>
        </div>
        <div
          ref={mountRef}
          className="sticker-forge-mount"
          aria-label="贴纸预览"
        />
        <span className="studio-status" role="status">
          {ready ? '已就绪' : '正在准备'}
        </span>
      </div>

      <aside className="sticker-studio-controls">
        <header>
          <div>
            <p>文字贴纸</p>
            <h1 id="sticker-studio-title">制作</h1>
          </div>
          <button
            className="studio-icon-button"
            type="button"
            aria-label="取消制作"
            title="取消制作"
            onClick={() => {
              closeSession()
              cancelStickerComposer()
            }}
          >
            <X aria-hidden="true" size={20} strokeWidth={1.8} />
          </button>
        </header>

        <label className="studio-field">
          <span>文字</span>
          <input
            type="text"
            value={text}
            maxLength={MAX_STICKER_TEXT_LENGTH}
            onChange={(event) => void updateSource(event.target.value)}
          />
        </label>

        <fieldset className="studio-field">
          <legend>颜色</legend>
          <div className="color-swatches">
            {colorOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={option === color ? 'color-swatch is-active' : 'color-swatch'}
                style={{ backgroundColor: option }}
                aria-label={`选择颜色 ${option}`}
                aria-pressed={option === color}
                onClick={() => {
                  setColor(option)
                  void updateSource(text, option)
                }}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="studio-field">
          <legend>材质</legend>
          <div className="material-control">
            {materialOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={option.value === appearance.material ? 'is-active' : ''}
                aria-pressed={option.value === appearance.material}
                onClick={() =>
                  updateAppearance({ ...appearance, material: option.value })
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        {error ? <p className="studio-error" role="alert">{error}</p> : null}

        <button
          className="studio-confirm"
          type="button"
          disabled={!ready || saving || !text.trim()}
          onClick={() => void confirm()}
        >
          <Check aria-hidden="true" size={18} strokeWidth={1.9} />
          <span>{saving ? '正在生成' : '放到桌面'}</span>
        </button>
      </aside>
    </section>
  )
}
