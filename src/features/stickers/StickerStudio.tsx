import {
  BookOpen,
  Check,
  Image as ImageIcon,
  MonitorUp,
  Scissors,
  Sticker,
  Type,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  MAX_STICKER_TEXT_LENGTH,
  normalizeStickerText,
  type ImageCutoutMode,
  type StickerMaterial,
} from '../../domain/sticker'
import {
  createBackgroundRemovalSession,
  normalizeStickerImage,
  type BackgroundRemovalProgress,
  type ProcessedImage,
} from '../../integrations/image-processing'
import {
  createStickerForgeSession,
  type ForgeAppearance,
  type StickerForgeSession,
} from '../../integrations/sticker-forge'
import { useAppStore } from '../../state/app-store-context'
import { ManualCutoutEditor } from './ManualCutoutEditor'

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

const progressLabel = (progress: BackgroundRemovalProgress | null) => {
  if (!progress) return ''
  if (progress.phase === 'processing') return '正在识别前景…'
  return `正在加载本地模型${Number.isFinite(progress.progress) ? ` ${Math.round(progress.progress ?? 0)}%` : '…'}`
}

export function StickerStudio() {
  const cancelStickerComposer = useAppStore((state) => state.cancelStickerComposer)
  const prepareStickerPlacement = useAppStore((state) => state.prepareStickerPlacement)
  const mountRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<StickerForgeSession | null>(null)
  const imageUrlRef = useRef<string | null>(null)
  const cutoutAbortRef = useRef<AbortController | null>(null)
  const cutoutSessionRef = useRef<ReturnType<typeof createBackgroundRemovalSession> | null>(null)
  const [sourceKind, setSourceKind] = useState<'text' | 'image'>('text')
  const [text, setText] = useState('')
  const [color, setColor] = useState(INITIAL_COLOR)
  const [appearance, setAppearance] = useState(defaultAppearance)
  const [originalImage, setOriginalImage] = useState<ProcessedImage | null>(null)
  const [image, setImage] = useState<ProcessedImage | null>(null)
  const [imageName, setImageName] = useState('图片贴纸')
  const [cutoutMode, setCutoutMode] = useState<ImageCutoutMode>('rectangle')
  const [manualEditing, setManualEditing] = useState(false)
  const [cutoutProgress, setCutoutProgress] = useState<BackgroundRemovalProgress | null>(null)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const target = mountRef.current
    if (!target) return
    let cancelled = false
    const cutoutSession = createBackgroundRemovalSession()
    cutoutSessionRef.current = cutoutSession
    const start = async () => {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
      if (cancelled) return
      const session = await createStickerForgeSession(
        target,
        {
          type: 'text',
          text: '贴纸',
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
      cutoutAbortRef.current?.abort()
      cutoutSession.destroy()
      if (cutoutSessionRef.current === cutoutSession) cutoutSessionRef.current = null
      sessionRef.current?.destroy()
      sessionRef.current = null
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current)
      imageUrlRef.current = null
    }
  }, [])

  const closeSession = () => {
    sessionRef.current?.destroy()
    sessionRef.current = null
  }

  const updateTextSource = async (nextText: string, nextColor = color) => {
    setText(nextText)
    setError(null)
    if (sourceKind !== 'text' || !sessionRef.current) return
    try {
      await sessionRef.current.setSource({
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

  const updateImageSource = async (nextImage: ProcessedImage, name = imageName) => {
    const nextUrl = URL.createObjectURL(nextImage.blob)
    try {
      await sessionRef.current?.setSource({ type: 'image', src: nextUrl, name })
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current)
      imageUrlRef.current = nextUrl
    } catch (caught) {
      URL.revokeObjectURL(nextUrl)
      throw caught
    }
  }

  const switchSource = async (next: 'text' | 'image') => {
    if (next === 'text') cancelAutomaticCutout()
    setSourceKind(next)
    setError(null)
    try {
      if (next === 'text') {
        await sessionRef.current?.setSource({
          type: 'text',
          text: text || '贴纸',
          color,
          fontFamily: FONT_FAMILY,
          fontWeight: 900,
        })
      } else if (image) {
        await updateImageSource(image)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '贴纸来源没有更新。')
    }
  }

  const cancelAutomaticCutout = () => {
    const controller = cutoutAbortRef.current
    if (!controller) return
    cutoutAbortRef.current = null
    controller.abort()
    cutoutSessionRef.current?.cancel()
    setCutoutProgress(null)
  }

  const chooseImage = async (file: File | undefined) => {
    if (!file) return
    cancelAutomaticCutout()
    setError(null)
    setCutoutProgress(null)
    try {
      const normalized = await normalizeStickerImage(file)
      setOriginalImage(normalized)
      setImage(normalized)
      setImageName(file.name.replace(/\.[^.]+$/, '') || '图片贴纸')
      setCutoutMode('rectangle')
      await updateImageSource(normalized, file.name)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '图片没有打开。')
    }
  }

  const automaticCutout = async () => {
    if (!originalImage || !cutoutSessionRef.current) return
    cancelAutomaticCutout()
    const controller = new AbortController()
    cutoutAbortRef.current = controller
    setError(null)
    setCutoutProgress({ phase: 'loading', progress: 0 })
    try {
      const result = await cutoutSessionRef.current.remove(
        originalImage,
        setCutoutProgress,
        controller.signal,
      )
      if (controller.signal.aborted) return
      setImage(result)
      setCutoutMode('automatic')
      setCutoutProgress(null)
      await updateImageSource(result)
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        setCutoutProgress(null)
        return
      }
      setCutoutProgress(null)
      setError(
        (caught instanceof Error ? caught.message : '自动抠图失败。') +
          ' 可保留矩形或使用手动修整。',
      )
    } finally {
      if (cutoutAbortRef.current === controller) cutoutAbortRef.current = null
    }
  }

  const updateAppearance = (next: ForgeAppearance) => {
    setAppearance(next)
    sessionRef.current?.setAppearance(next)
  }

  const confirm = async (target: 'desk' | 'journal') => {
    const session = sessionRef.current
    if (!session) return
    setSaving(true)
    setError(null)
    try {
      const preview = await session.capture()
      if (sourceKind === 'text') {
        const normalizedText = normalizeStickerText(text)
        closeSession()
        prepareStickerPlacement(
          {
            kind: 'text',
            source: {
              text: normalizedText,
              color,
              fontFamily: FONT_FAMILY,
              fontWeight: 900,
            },
            forge: appearance,
            preview,
          },
          target,
        )
      } else {
        if (!image) throw new Error('请先选择一张图片。')
        closeSession()
        prepareStickerPlacement(
          {
            kind: 'image',
            source: {
              asset: image,
              cutoutMode,
              name: imageName,
            },
            forge: appearance,
            preview,
          },
          target,
        )
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '贴纸快照没有生成。')
      setSaving(false)
    }
  }

  if (manualEditing && originalImage && image) {
    return (
      <div className="sticker-studio manual-cutout-shell">
        <ManualCutoutEditor
          original={originalImage}
          initial={image}
          onCancel={() => setManualEditing(false)}
          onConfirm={(result) => {
            setManualEditing(false)
            setImage(result)
            setCutoutMode('manual')
            void updateImageSource(result).catch((caught) => {
              setError(caught instanceof Error ? caught.message : '手动结果没有载入预览。')
            })
          }}
        />
      </div>
    )
  }

  const canConfirm = ready && !saving && !cutoutProgress && (sourceKind === 'text' ? Boolean(text.trim()) : Boolean(image))

  return (
    <section className="sticker-studio" aria-labelledby="sticker-studio-title">
      <div className="sticker-stage">
        <div className="sticker-stage-head">
          <Sticker aria-hidden="true" size={18} strokeWidth={1.8} />
          <span>Sticker Forge</span>
        </div>
        <div ref={mountRef} className="sticker-forge-mount" aria-label="贴纸预览" />
        <span className="studio-status" role="status">
          {cutoutProgress ? progressLabel(cutoutProgress) : ready ? '已就绪' : '正在准备'}
        </span>
      </div>

      <aside className="sticker-studio-controls">
        <header>
          <div>
            <p>独立贴纸工作台</p>
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

        <div className="source-tabs" aria-label="贴纸来源">
          <button
            type="button"
            className={sourceKind === 'text' ? 'is-active' : ''}
            aria-pressed={sourceKind === 'text'}
            onClick={() => void switchSource('text')}
          >
            <Type aria-hidden="true" size={17} />文字
          </button>
          <button
            type="button"
            className={sourceKind === 'image' ? 'is-active' : ''}
            aria-pressed={sourceKind === 'image'}
            onClick={() => void switchSource('image')}
          >
            <ImageIcon aria-hidden="true" size={17} />图片
          </button>
        </div>

        {sourceKind === 'text' ? (
          <>
            <label className="studio-field">
              <span>文字</span>
              <input
                type="text"
                value={text}
                maxLength={MAX_STICKER_TEXT_LENGTH}
                placeholder="写一句贴纸文字"
                onChange={(event) => void updateTextSource(event.target.value)}
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
                      void updateTextSource(text, option)
                    }}
                  />
                ))}
              </div>
            </fieldset>
          </>
        ) : (
          <div className="image-source-controls">
            <label
              className="image-upload"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                void chooseImage(event.dataTransfer.files[0])
              }}
            >
              <Upload aria-hidden="true" size={18} />
              <span>{image ? '更换图片' : '选择图片'}</span>
              <small>PNG / JPEG / WebP · 最大 15 MB</small>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => void chooseImage(event.target.files?.[0])}
              />
            </label>
            {image ? (
              <div className="cutout-actions" aria-label="图片背景处理">
                <button
                  type="button"
                  className={cutoutMode === 'rectangle' ? 'is-active' : ''}
                  onClick={() => {
                    if (!originalImage) return
                    cancelAutomaticCutout()
                    setImage(originalImage)
                    setCutoutMode('rectangle')
                    setCutoutProgress(null)
                    void updateImageSource(originalImage)
                  }}
                >
                  <ImageIcon aria-hidden="true" size={16} />保留矩形
                </button>
                <button
                  type="button"
                  disabled={Boolean(cutoutProgress)}
                  className={cutoutMode === 'automatic' ? 'is-active' : ''}
                  onClick={() => void automaticCutout()}
                >
                  <WandSparkles aria-hidden="true" size={16} />{cutoutProgress ? '处理中…' : '自动抠图'}
                </button>
                <button
                  type="button"
                  className={cutoutMode === 'manual' ? 'is-active' : ''}
                  onClick={() => {
                    cancelAutomaticCutout()
                    setManualEditing(true)
                  }}
                >
                  <Scissors aria-hidden="true" size={16} />手动修整
                </button>
                {cutoutProgress ? (
                  <button type="button" onClick={() => cancelAutomaticCutout()}>
                    <X aria-hidden="true" size={16} />取消抠图
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        <fieldset className="studio-field">
          <legend>材质</legend>
          <div className="material-control">
            {materialOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={option.value === appearance.material ? 'is-active' : ''}
                aria-pressed={option.value === appearance.material}
                onClick={() => updateAppearance({ ...appearance, material: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        {error ? <p className="studio-error" role="alert">{error}</p> : null}

        <div className="studio-target-actions">
          <button
            className="studio-confirm"
            type="button"
            disabled={!canConfirm}
            onClick={() => void confirm('desk')}
          >
            <MonitorUp aria-hidden="true" size={18} />
            <span>{saving ? '正在生成' : '放到桌面'}</span>
          </button>
          <button
            className="studio-confirm is-secondary"
            type="button"
            disabled={!canConfirm}
            onClick={() => void confirm('journal')}
          >
            {saving ? <Check aria-hidden="true" size={18} /> : <BookOpen aria-hidden="true" size={18} />}
            <span>{saving ? '正在生成' : '放到日记'}</span>
          </button>
        </div>
      </aside>
    </section>
  )
}
