import { Time } from 'animal-island-ui'
import { Archive, BookOpen, Camera, CameraOff, Eye, EyeOff, Pencil, Sticker, X } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'

import { createAudioController } from '../audio/audio-controller'
import {
  readAudioPreferences,
  writeAudioPreferences,
  type AudioPreferences,
} from '../audio/audio-preferences'
import { AudioRuntime } from '../audio/AudioRuntime'
import {
  readContentFontPreference,
  writeContentFontPreference,
  type ContentFontId,
} from '../domain/journal-font'
import { JournalPanel } from '../features/journal/JournalPanel'
import { PastTracesPanel } from '../features/history/PastTracesPanel'
import { ContentFontControl } from '../features/settings/ContentFontControl'
import { AudioSettingsControl } from '../features/settings/AudioSettingsControl'
import { StickerControls } from '../features/stickers/StickerControls'
import { StickerStudio } from '../features/stickers/StickerStudio'
import { DeskScene } from '../scene/DeskScene'
import { SceneColorEditor, SceneColorEditorButton } from '../scene/SceneColorEditor'
import {
  getSceneColorConfig,
  getScenePalette,
  resolveScenePaletteVersion,
} from '../scene/models/material-library'
import { useAppStore } from '../state/app-store-context'
import { Button, IconButton } from '../ui'
import {
  MAX_NOTEBOOK_LABEL_LENGTH,
  normalizeNotebookLabel,
} from '../domain/notebook-cover-settings'
import type {
  SceneColorPreset,
  SceneColorPresetRepository,
} from '../domain/scene-color-preset'
import type { CaptureScenePreview } from '../scene/capture-scene-preview'

type ModelReviewKind = 'desk' | 'mat' | 'notebook' | 'room'
type OpenSettingsPanel = 'audio' | 'colors' | 'font' | null

const emptySceneColorPresetRepository: SceneColorPresetRepository = {
  list: async () => [],
  create: async () => {
    throw new Error('颜色预设存储暂时不可用。')
  },
  delete: async () => undefined,
}

const DevModelReviewScene = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import('../scene/ModelReviewScene')
      return { default: module.ModelReviewScene }
    })
  : null

function SceneFallback() {
  const openNotebookWithoutScene = useAppStore(
    (state) => state.openNotebookWithoutScene,
  )
  const openPastTracesWithoutScene = useAppStore(
    (state) => state.openPastTracesWithoutScene,
  )

  return (
    <div className="scene-fallback" role="status">
      <span>3D 桌面暂时不可用</span>
      <Button
        icon={<BookOpen aria-hidden="true" size={18} />}
        onClick={openNotebookWithoutScene}
        variant="primary"
      >
        打开本子
      </Button>
      <Button
        icon={<Archive aria-hidden="true" size={18} />}
        onClick={openPastTracesWithoutScene}
        variant="secondary"
      >
        旧痕迹
      </Button>
    </div>
  )
}

interface ProductAppProps {
  sceneColorPresetRepository: SceneColorPresetRepository
}

function ProductApp({ sceneColorPresetRepository }: ProductAppProps) {
  const [sceneColors, setSceneColors] = useState(() => getSceneColorConfig(
    getScenePalette(resolveScenePaletteVersion(window.location.search, import.meta.env.DEV)),
  ))
  const [openSettingsPanel, setOpenSettingsPanel] = useState<OpenSettingsPanel>(null)
  const [sceneColorPresets, setSceneColorPresets] = useState<SceneColorPreset[]>([])
  const [sceneColorPresetsLoading, setSceneColorPresetsLoading] = useState(true)
  const [sceneColorPresetsError, setSceneColorPresetsError] = useState<string | null>(null)
  const [captureScene, setCaptureScene] = useState<CaptureScenePreview | null>(null)
  const [showRoomBackground, setShowRoomBackground] = useState(true)
  const [showNameplateEditor, setShowNameplateEditor] = useState(false)
  const [nameplateDraft, setNameplateDraft] = useState('')
  const [nameplateValidationError, setNameplateValidationError] = useState<string | null>(null)
  const [contentFont, setContentFont] = useState<ContentFontId>(() =>
    readContentFontPreference(window.localStorage))
  const [audioPreferences, setAudioPreferences] = useState(() =>
    readAudioPreferences(window.localStorage))
  const [audioController] = useState(() => createAudioController(audioPreferences))
  const cycleDeskCameraPreset = useAppStore(
    (state) => state.cycleDeskCameraPreset,
  )
  const deskCameraPreset = useAppStore((state) => state.deskCameraPreset)
  const deskCameraTransitioning = useAppStore(
    (state) => state.deskCameraTransitioning,
  )
  const disableFreeCamera = useAppStore((state) => state.disableFreeCamera)
  const freeCameraEnabled = useAppStore((state) => state.freeCameraEnabled)
  const loadToday = useAppStore((state) => state.loadToday)
  const loadStickers = useAppStore((state) => state.loadStickers)
  const loadNotebookCoverSettings = useAppStore((state) => state.loadNotebookCoverSettings)
  const notebookCoverSettings = useAppStore((state) => state.notebookCoverSettings)
  const notebookCoverStatus = useAppStore((state) => state.notebookCoverStatus)
  const notebookCoverErrorMessage = useAppStore((state) => state.notebookCoverErrorMessage)
  const saveNotebookCoverLabel = useAppStore((state) => state.saveNotebookCoverLabel)
  const notebookPhase = useAppStore((state) => state.notebookPhase)
  const journalTurnPhase = useAppStore((state) => state.journalTurnPhase)
  const pastTracesPhase = useAppStore((state) => state.pastTracesPhase)
  const requestNotebookOpen = useAppStore((state) => state.requestNotebookOpen)
  const openStickerStudio = useAppStore((state) => state.openStickerStudio)
  const requestPastTracesOpen = useAppStore(
    (state) => state.requestPastTracesOpen,
  )
  const settleNotebookTransition = useAppStore(
    (state) => state.settleNotebookTransition,
  )
  const stickerWorkflow = useAppStore((state) => state.stickerWorkflow)
  const selectedStickerId = useAppStore((state) => state.selectedStickerId)
  const toggleFreeCamera = useAppStore((state) => state.toggleFreeCamera)

  useEffect(() => {
    void loadToday()
    void loadStickers()
    void loadNotebookCoverSettings()
  }, [loadNotebookCoverSettings, loadStickers, loadToday])

  useEffect(() => {
    let active = true
    void sceneColorPresetRepository.list()
      .then((presets) => {
        if (active) setSceneColorPresets(presets)
      })
      .catch(() => {
        if (active) setSceneColorPresetsError('颜色预设暂时无法读取。')
      })
      .finally(() => {
        if (active) setSceneColorPresetsLoading(false)
      })
    return () => {
      active = false
    }
  }, [sceneColorPresetRepository])

  const handleCaptureReady = useCallback((capture: CaptureScenePreview | null) => {
    setCaptureScene(() => capture)
  }, [])

  const saveSceneColorPreset = async (name: string) => {
    let preview
    let previewCaptured = false
    if (captureScene) {
      try {
        preview = await captureScene()
        previewCaptured = true
      } catch {
        preview = undefined
      }
    }
    const preset = await sceneColorPresetRepository.create(name, sceneColors, preview)
    setSceneColorPresets((presets) => [preset, ...presets])
    return { preset, previewCaptured }
  }

  const deleteSceneColorPreset = async (id: string) => {
    await sceneColorPresetRepository.delete(id)
    setSceneColorPresets((presets) => presets.filter((preset) => preset.id !== id))
  }

  useEffect(() => {
    audioController.setPreferences(audioPreferences)
  }, [audioController, audioPreferences])

  useEffect(() => () => audioController.dispose(), [audioController])

  useEffect(() => {
    const settleWhenHidden = () => {
      if (document.visibilityState === 'hidden') settleNotebookTransition()
    }
    document.addEventListener('visibilitychange', settleWhenHidden)
    return () => document.removeEventListener('visibilitychange', settleWhenHidden)
  }, [settleNotebookTransition])

  const showDeskActions =
    notebookPhase === 'desk' &&
    pastTracesPhase === 'closed' &&
    stickerWorkflow === 'idle' &&
    !selectedStickerId
  const showAudioSettings =
    stickerWorkflow !== 'composing' &&
    !showNameplateEditor
  const showColorEditor = openSettingsPanel === 'colors'

  const updateAudioPreferences = (preferences: AudioPreferences) => {
    setAudioPreferences(preferences)
    writeAudioPreferences(window.localStorage, preferences)
  }

  const cameraPresetLabels = {
    far: '远处',
    front: '正面',
    near: '近处',
  } as const
  const nextCameraPreset = {
    far: 'front',
    front: 'near',
    near: 'far',
  } as const

  return (
    <main
      className="app-shell"
      data-camera-preset={deskCameraPreset}
      data-camera-transitioning={deskCameraTransitioning}
      data-free-camera-enabled={freeCameraEnabled}
      data-notebook-phase={notebookPhase}
      data-past-traces-phase={pastTracesPhase}
      data-sticker-workflow={stickerWorkflow}
    >
      <AudioRuntime
        controller={audioController}
        journalTurnPhase={journalTurnPhase}
        notebookPhase={notebookPhase}
        pastTracesPhase={pastTracesPhase}
      />
      {stickerWorkflow === 'composing' ? (
        <StickerStudio />
      ) : (
        <div className="scene-shell">
          <DeskScene
            colors={sceneColors}
            contentFont={contentFont}
            fallback={<SceneFallback />}
            onCaptureReady={handleCaptureReady}
            showRoomBackground={showRoomBackground}
          />
        </div>
      )}

      {showDeskActions ? <Time className="desk-time-hud" type="hud" /> : null}

      {showAudioSettings ? (
        <AudioSettingsControl
          onChange={updateAudioPreferences}
          onOpenChange={(open) => setOpenSettingsPanel(open ? 'audio' : null)}
          open={openSettingsPanel === 'audio'}
          preferences={audioPreferences}
        />
      ) : null}

      {showDeskActions ? (
        <div className="desk-actions">
          <Button
            aria-label={`当前${cameraPresetLabels[deskCameraPreset]}，切换到${cameraPresetLabels[nextCameraPreset[deskCameraPreset]]}`}
            className="camera-preset-button"
            disabled={deskCameraTransitioning || freeCameraEnabled}
            icon={<Camera aria-hidden="true" size={19} strokeWidth={1.8} />}
            onClick={cycleDeskCameraPreset}
            title={`切换到${cameraPresetLabels[nextCameraPreset[deskCameraPreset]]}`}
            variant="secondary"
          >
            <span>{cameraPresetLabels[deskCameraPreset]}</span>
          </Button>
          <Button
            className="notebook-button"
            icon={<BookOpen aria-hidden="true" size={19} strokeWidth={1.8} />}
            onClick={() => {
              setOpenSettingsPanel(null)
              requestNotebookOpen()
            }}
            variant="primary"
          >
            <span>打开本子</span>
          </Button>
          <Button
            className="past-traces-button"
            icon={<Archive aria-hidden="true" size={19} strokeWidth={1.8} />}
            onClick={() => {
              setOpenSettingsPanel(null)
              setShowNameplateEditor(false)
              requestPastTracesOpen()
            }}
            variant="secondary"
          >
            <span>旧痕迹</span>
          </Button>
          <Button
            aria-label="编辑铭牌"
            className="nameplate-editor-button"
            disabled={notebookCoverStatus === 'loading' || notebookCoverStatus === 'saving'}
            icon={<Pencil aria-hidden="true" size={18} strokeWidth={1.9} />}
            onClick={() => {
              setOpenSettingsPanel(null)
              setNameplateDraft(notebookCoverSettings?.label ?? '')
              setNameplateValidationError(null)
              setShowNameplateEditor(true)
            }}
            variant="secondary"
          >
            <span>编辑铭牌</span>
          </Button>
          <Button
            className="sticker-workbench-button"
            icon={<Sticker aria-hidden="true" size={19} strokeWidth={1.8} />}
            onClick={() => {
              setOpenSettingsPanel(null)
              openStickerStudio()
            }}
            variant="secondary"
          >
            <span>贴纸工作台</span>
          </Button>
        </div>
      ) : null}

      {showNameplateEditor ? (
        <div
          aria-labelledby="nameplate-dialog-title"
          aria-modal="true"
          className="nameplate-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowNameplateEditor(false)
          }}
          role="dialog"
        >
          <form
            className="nameplate-dialog"
            onSubmit={(event) => {
              event.preventDefault()
              try {
                const normalized = normalizeNotebookLabel(nameplateDraft)
                void saveNotebookCoverLabel(normalized).then((saved) => {
                  if (saved) setShowNameplateEditor(false)
                })
                setNameplateValidationError(null)
              } catch (error) {
                setNameplateValidationError(error instanceof Error ? error.message : '请输入有效铭牌内容。')
              }
            }}
          >
            <div className="nameplate-dialog__header">
              <div>
                <p className="nameplate-dialog__eyebrow">NOTEBOOK COVER</p>
                <h2 id="nameplate-dialog-title">编辑铭牌</h2>
              </div>
              <IconButton
                aria-label="取消编辑铭牌"
                label="取消编辑铭牌"
                onClick={() => setShowNameplateEditor(false)}
                variant="quiet"
              >
                <X aria-hidden="true" size={18} />
              </IconButton>
            </div>
            <label className="nameplate-dialog__label" htmlFor="notebook-nameplate-input">
              铭牌文字
              <input
                autoFocus
                id="notebook-nameplate-input"
                maxLength={MAX_NOTEBOOK_LABEL_LENGTH}
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                onChange={(event) => setNameplateDraft(event.target.value)}
                placeholder="例如 DEAR DESK"
                value={nameplateDraft}
                name="notebook-nameplate"
                spellCheck={false}
              />
            </label>
            <div className="nameplate-dialog__meta">
              <span>最多 {MAX_NOTEBOOK_LABEL_LENGTH} 个中英文字符</span>
              <output>{nameplateDraft.length}/{MAX_NOTEBOOK_LABEL_LENGTH}</output>
            </div>
            {nameplateValidationError || notebookCoverErrorMessage ? (
              <p className="nameplate-dialog__error" role="alert">
                {nameplateValidationError ?? notebookCoverErrorMessage}
              </p>
            ) : null}
            <div className="nameplate-dialog__actions">
              <Button onClick={() => setShowNameplateEditor(false)} variant="quiet">
                取消
              </Button>
              <Button htmlType="submit" loading={notebookCoverStatus === 'saving'} variant="primary">
                保存铭牌
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {showDeskActions ? (
        <div className="scene-tool-stack">
          <div className="scene-color-control">
            <SceneColorEditorButton
              expanded={showColorEditor}
              onClick={() => {
                disableFreeCamera()
                setOpenSettingsPanel((panel) => panel === 'colors' ? null : 'colors')
              }}
            />
            {showColorEditor ? (
              <SceneColorEditor
                colors={sceneColors}
                loadingPresets={sceneColorPresetsLoading}
                onChange={setSceneColors}
                onClose={() => setOpenSettingsPanel(null)}
                onDeletePreset={deleteSceneColorPreset}
                onReset={() => setSceneColors(getSceneColorConfig())}
                onSavePreset={saveSceneColorPreset}
                presets={sceneColorPresets}
                presetsError={sceneColorPresetsError}
              />
            ) : null}
          </div>
          <ContentFontControl
            font={contentFont}
            onChange={(font) => {
              setContentFont(font)
              writeContentFontPreference(window.localStorage, font)
            }}
            onOpenChange={(open) => setOpenSettingsPanel(open ? 'font' : null)}
            open={openSettingsPanel === 'font'}
          />
          <IconButton
            aria-pressed={showRoomBackground}
            className="room-background-button"
            label={showRoomBackground ? '隐藏房间背景' : '显示房间背景'}
            onClick={() => setShowRoomBackground((visible) => !visible)}
            showTitle={false}
            variant="secondary"
          >
            {showRoomBackground ? (
              <Eye aria-hidden="true" size={20} strokeWidth={1.8} />
            ) : (
              <EyeOff aria-hidden="true" size={20} strokeWidth={1.8} />
            )}
          </IconButton>
          <IconButton
            aria-pressed={freeCameraEnabled}
            className="free-camera-button"
            disabled={deskCameraTransitioning}
            label={freeCameraEnabled ? '关闭自由视角' : '开启自由视角'}
            onClick={toggleFreeCamera}
            showTitle={false}
            variant="secondary"
          >
            {freeCameraEnabled ? (
              <Camera aria-hidden="true" size={20} strokeWidth={1.8} />
            ) : (
              <CameraOff aria-hidden="true" size={20} strokeWidth={1.8} />
            )}
          </IconButton>
        </div>
      ) : null}

      {notebookPhase === 'editing' ? <JournalPanel contentFont={contentFont} /> : null}
      <PastTracesPanel />
      {stickerWorkflow !== 'composing' ? <StickerControls /> : null}
    </main>
  )
}

const getDevModelReview = () => {
  if (!import.meta.env.DEV) return null
  const query = new URLSearchParams(window.location.search)
  const review = query.get('review')
  if (review !== 'desk' && review !== 'mat' && review !== 'notebook' && review !== 'room') {
    return null
  }
  const model: ModelReviewKind = review

  return {
    light: query.get('light'),
    model,
    pass: query.get('pass'),
    state: query.get('state'),
    view: query.get('view'),
  }
}

interface AppProps {
  sceneColorPresetRepository?: SceneColorPresetRepository
}

export function App({
  sceneColorPresetRepository = emptySceneColorPresetRepository,
}: AppProps = {}) {
  const review = getDevModelReview()
  if (review && DevModelReviewScene) {
    return (
      <Suspense fallback={null}>
        <DevModelReviewScene {...review} />
      </Suspense>
    )
  }
  return <ProductApp sceneColorPresetRepository={sceneColorPresetRepository} />
}
