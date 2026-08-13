import { Time } from 'animal-island-ui'
import { BookOpen, Camera, Sticker } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'

import { JournalPanel } from '../features/journal/JournalPanel'
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
import { Button } from '../ui'

type ModelReviewKind = 'desk' | 'mat' | 'notebook'

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
    </div>
  )
}

function ProductApp() {
  const [sceneColors, setSceneColors] = useState(() => getSceneColorConfig(
    getScenePalette(resolveScenePaletteVersion(window.location.search, import.meta.env.DEV)),
  ))
  const [showColorEditor, setShowColorEditor] = useState(false)
  const cycleDeskCameraPreset = useAppStore(
    (state) => state.cycleDeskCameraPreset,
  )
  const deskCameraPreset = useAppStore((state) => state.deskCameraPreset)
  const deskCameraTransitioning = useAppStore(
    (state) => state.deskCameraTransitioning,
  )
  const loadToday = useAppStore((state) => state.loadToday)
  const loadStickers = useAppStore((state) => state.loadStickers)
  const notebookPhase = useAppStore((state) => state.notebookPhase)
  const requestNotebookOpen = useAppStore((state) => state.requestNotebookOpen)
  const openStickerStudio = useAppStore((state) => state.openStickerStudio)
  const settleNotebookTransition = useAppStore(
    (state) => state.settleNotebookTransition,
  )
  const stickerWorkflow = useAppStore((state) => state.stickerWorkflow)
  const selectedStickerId = useAppStore((state) => state.selectedStickerId)

  useEffect(() => {
    void loadToday()
    void loadStickers()
  }, [loadStickers, loadToday])

  useEffect(() => {
    const settleWhenHidden = () => {
      if (document.visibilityState === 'hidden') settleNotebookTransition()
    }
    document.addEventListener('visibilitychange', settleWhenHidden)
    return () => document.removeEventListener('visibilitychange', settleWhenHidden)
  }, [settleNotebookTransition])

  const showDeskActions =
    notebookPhase === 'desk' &&
    stickerWorkflow === 'idle' &&
    !selectedStickerId

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
      data-notebook-phase={notebookPhase}
      data-sticker-workflow={stickerWorkflow}
    >
      {stickerWorkflow === 'composing' ? (
        <StickerStudio />
      ) : (
        <div className="scene-shell">
          <DeskScene colors={sceneColors} fallback={<SceneFallback />} />
        </div>
      )}

      {showDeskActions ? <Time className="desk-time-hud" type="hud" /> : null}

      {showDeskActions ? (
        <div className="desk-actions">
          <Button
            aria-label={`当前${cameraPresetLabels[deskCameraPreset]}，切换到${cameraPresetLabels[nextCameraPreset[deskCameraPreset]]}`}
            className="camera-preset-button"
            disabled={deskCameraTransitioning}
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
              setShowColorEditor(false)
              requestNotebookOpen()
            }}
            variant="primary"
          >
            <span>打开本子</span>
          </Button>
          <Button
            className="sticker-workbench-button"
            icon={<Sticker aria-hidden="true" size={19} strokeWidth={1.8} />}
            onClick={() => {
              setShowColorEditor(false)
              openStickerStudio()
            }}
            variant="secondary"
          >
            <span>贴纸工作台</span>
          </Button>
        </div>
      ) : null}

      {showDeskActions ? (
        showColorEditor ? (
          <SceneColorEditor
            colors={sceneColors}
            onChange={setSceneColors}
            onClose={() => setShowColorEditor(false)}
            onReset={() => setSceneColors(getSceneColorConfig())}
          />
        ) : (
          <SceneColorEditorButton onClick={() => setShowColorEditor(true)} />
        )
      ) : null}

      <JournalPanel />
      {stickerWorkflow !== 'composing' ? <StickerControls /> : null}
    </main>
  )
}

const getDevModelReview = () => {
  if (!import.meta.env.DEV) return null
  const query = new URLSearchParams(window.location.search)
  const review = query.get('review')
  if (review !== 'desk' && review !== 'mat' && review !== 'notebook') {
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

export function App() {
  const review = getDevModelReview()
  if (review && DevModelReviewScene) {
    return (
      <Suspense fallback={null}>
        <DevModelReviewScene {...review} />
      </Suspense>
    )
  }
  return <ProductApp />
}
