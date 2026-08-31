import { Canvas, extend, useThree } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import * as THREE from 'three'

import { createDeskMatModel } from './models/create-desk-mat-model'
import { createDeskModel } from './models/create-desk-model'
import { createNotebookModel } from './models/create-notebook-model'
import { createStudyRoomShellModel } from './models/create-study-room-shell-model'
import {
  createModelMaterialLibrary,
  type ModelMaterialLibrary,
} from './models/material-library'
import { SceneEnvironment } from './models/SceneEnvironment'
import {
  MODEL_BUILD_PASSES,
  type ModelBuildPass,
} from './models/model-types'

extend({
  Color: THREE.Color,
  DirectionalLight: THREE.DirectionalLight,
  HemisphereLight: THREE.HemisphereLight,
  Mesh: THREE.Mesh,
  MeshStandardMaterial: THREE.MeshStandardMaterial,
  PlaneGeometry: THREE.PlaneGeometry,
})

export type ModelReviewKind = 'desk' | 'mat' | 'notebook' | 'room'

interface ModelReviewSceneProps {
  light?: string | null
  model: ModelReviewKind
  pass?: string | null
  state?: string | null
  view?: string | null
}

type ReviewLight = 'grazing' | 'neutral' | 'reference-match'
type NotebookReviewState = 'closed' | 'open'

interface CameraPose {
  fov: number
  position: readonly [number, number, number]
  target: readonly [number, number, number]
  up?: readonly [number, number, number]
}

interface ReviewConfiguration {
  light: ReviewLight
  notebookState: NotebookReviewState
  pose: CameraPose
  view: string
}

const REVIEW_VIEWS = {
  desk: {
    'front-three-quarter': {
      fov: 33,
      position: [11.55, 2.15, 13.8],
      target: [0.75, -2.65, 0.35],
    },
    'left-three-quarter': {
      fov: 33,
      position: [-10.8, 3.75, 13.8],
      target: [0, -1.05, 0.35],
    },
    'rear-three-quarter': {
      fov: 34,
      position: [-10.4, 3.65, -13.4],
      target: [0, -1.08, -0.2],
    },
    side: {
      fov: 34,
      position: [15.5, 2.7, 0.2],
      target: [0, -1.08, 0],
    },
    'top-integration': {
      fov: 32,
      position: [0.4, 13.8, 10.4],
      target: [0, -0.55, 0.2],
    },
  },
  mat: {
    grazing: {
      fov: 32,
      position: [8.4, 2.05, 9.3],
      target: [0, 0.05, 0.15],
    },
    'left-front-grazing': {
      fov: 27,
      position: [-7.2, 1.05, 7.1],
      target: [-1.55, 0.065, 1.55],
    },
    'right-front-grazing': {
      fov: 27,
      position: [7.2, 0.88, 7.25],
      target: [1.6, 0.06, 1.55],
    },
    top: {
      fov: 32,
      position: [0, 18.5, 0.2],
      target: [0, 0.05, 0.2],
      up: [0, 0, -1],
    },
  },
  notebook: {
    'closed-three-quarter': {
      fov: 31,
      position: [4.8, 6.9, 8.4],
      target: [0, 0.16, 0],
    },
    'material-close-up': {
      fov: 29,
      position: [4.5, 3.3, 5.2],
      target: [0.45, 0.24, -0.38],
    },
    'open-top': {
      fov: 32,
      position: [-1.4, 12.2, 0.8],
      target: [-1.4, 0.18, 0],
      up: [0, 0, -1],
    },
  },
  room: {
    'concept-perspective': {
      fov: 34,
      position: [14.5, 0.5, 16],
      target: [-9.3, -2.2, -8.5],
    },
    'opposite-corner': {
      fov: 43,
      position: [-15.5, 1.8, -16.5],
      target: [8.5, -0.7, 8.5],
    },
  },
} as const satisfies Record<ModelReviewKind, Record<string, CameraPose>>

const DEFAULT_VIEWS: Record<ModelReviewKind, string> = {
  desk: 'front-three-quarter',
  mat: 'top',
  notebook: 'closed-three-quarter',
  room: 'concept-perspective',
}

const LIGHT_SETTINGS: Record<
  ReviewLight,
  {
    environmentIntensity: number
    fillColor: string
    fillIntensity: number
    keyColor: string
    keyIntensity: number
    keyPosition: readonly [number, number, number]
  }
> = {
  grazing: {
    environmentIntensity: 0.26,
    fillColor: '#8da096',
    fillIntensity: 0.15,
    keyColor: '#ffd9a0',
    keyIntensity: 2.65,
    keyPosition: [8, 4.2, 5.5],
  },
  neutral: {
    environmentIntensity: 0.38,
    fillColor: '#c1c8c1',
    fillIntensity: 0.32,
    keyColor: '#fff1d8',
    keyIntensity: 1.8,
    keyPosition: [-4.5, 9.5, 7],
  },
  'reference-match': {
    environmentIntensity: 0.32,
    fillColor: '#9daf9f',
    fillIntensity: 0.22,
    keyColor: '#ffd8a1',
    keyIntensity: 2.35,
    keyPosition: [-5.5, 10.5, 7],
  },
}

const isBuildPass = (value: string | null | undefined): value is ModelBuildPass =>
  MODEL_BUILD_PASSES.some((pass) => pass === value)

const isReviewLight = (value: string | null | undefined): value is ReviewLight =>
  value === 'neutral' || value === 'grazing' || value === 'reference-match'

const getReviewConfiguration = (
  model: ModelReviewKind,
  requestedView: string | null | undefined,
  requestedState: string | null | undefined,
  requestedLight: string | null | undefined,
): ReviewConfiguration => {
  const views = REVIEW_VIEWS[model] as Record<string, CameraPose>
  const view = requestedView && requestedView in views
    ? requestedView
    : DEFAULT_VIEWS[model]
  const notebookState = requestedState === 'open' || requestedState === 'closed'
    ? requestedState
    : view === 'open-top'
      ? 'open'
      : 'closed'
  const defaultLight = view === 'grazing' ? 'grazing' : 'reference-match'

  return {
    light: isReviewLight(requestedLight) ? requestedLight : defaultLight,
    notebookState,
    pose: views[view] ?? views[DEFAULT_VIEWS[model]]!,
    view,
  }
}

const applyCameraPose = (
  camera: THREE.PerspectiveCamera,
  pose: CameraPose,
) => {
  camera.position.set(...pose.position)
  camera.up.set(...(pose.up ?? [0, 1, 0]))
  camera.lookAt(...pose.target)
  camera.fov = pose.fov
  camera.near = 0.1
  camera.far = 100
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
}

function ReviewCamera({ pose }: { pose: CameraPose }) {
  const { camera } = useThree()

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return
    applyCameraPose(camera, pose)
  }, [camera, pose])

  return null
}

const disposeFactoryModel = (model: THREE.Group) => {
  const dispose = model.userData.dispose
  if (typeof dispose === 'function') dispose()
}

function createReviewModel(
  model: ModelReviewKind,
  materials: ModelMaterialLibrary,
  pass: ModelBuildPass,
  notebookState: NotebookReviewState,
) {
  const options = { castShadow: model !== 'room', pass, receiveShadow: true }
  const subject = model === 'desk'
    ? createDeskModel(materials, options)
    : model === 'mat'
      ? createDeskMatModel(materials, options)
      : model === 'notebook'
        ? createNotebookModel(materials, options)
        : createStudyRoomShellModel(options)

  if (model === 'notebook') {
    const setOpenProgress = subject.userData.setOpenProgress
    if (typeof setOpenProgress === 'function') {
      setOpenProgress(notebookState === 'open' ? 1 : 0)
    }
  }
  subject.updateMatrixWorld(true)
  return subject
}

function ReviewSubject({
  model,
  notebookState,
  pass,
}: {
  model: ModelReviewKind
  notebookState: NotebookReviewState
  pass: ModelBuildPass
}) {
  const [subject, setSubject] = useState<THREE.Group | null>(null)

  useEffect(() => {
    const materials = createModelMaterialLibrary()
    const nextSubject = createReviewModel(
      model,
      materials,
      pass,
      notebookState,
    )
    let disposed = false
    queueMicrotask(() => {
      if (!disposed) setSubject(nextSubject)
    })

    return () => {
      disposed = true
      disposeFactoryModel(nextSubject)
      materials.dispose()
    }
  }, [model, notebookState, pass])

  return subject ? <primitive object={subject} dispose={null} /> : null
}

function ReviewLighting({ light, model }: { light: ReviewLight; model: ModelReviewKind }) {
  const settings = LIGHT_SETTINGS[light]
  const room = model === 'room'

  return (
    <>
      <hemisphereLight
        args={[
          room ? '#d7dacb' : settings.fillColor,
          room ? '#6b5745' : '#07100b',
          room ? 0.3 : settings.fillIntensity,
        ]}
      />
      <directionalLight
        castShadow
        color={room ? '#eef0dc' : settings.keyColor}
        intensity={room ? 0.44 : settings.keyIntensity}
        position={[...settings.keyPosition]}
        shadow-bias={-0.00016}
        shadow-camera-bottom={-10}
        shadow-camera-far={30}
        shadow-camera-left={-10}
        shadow-camera-near={0.5}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-mapSize={[1536, 1536]}
        shadow-normalBias={0.025}
        shadow-radius={2.2}
      />
      <directionalLight
        color="#9eb6a8"
        intensity={room ? 0.12 : light === 'neutral' ? 0.12 : 0.16}
        position={[7, 5, -6]}
      />
    </>
  )
}

function ReviewWorld({
  configuration,
  model,
  pass,
}: {
  configuration: ReviewConfiguration
  model: ModelReviewKind
  pass: ModelBuildPass
}) {
  return (
    <>
      <color attach="background" args={[model === 'room' ? '#dbe4d6' : '#111111']} />
      <SceneEnvironment
        intensity={LIGHT_SETTINGS[configuration.light].environmentIntensity}
      />
      <ReviewCamera pose={configuration.pose} />
      <ReviewLighting light={configuration.light} model={model} />
      <ReviewSubject
        model={model}
        notebookState={configuration.notebookState}
        pass={pass}
      />
    </>
  )
}

export function ModelReviewScene({
  light,
  model,
  pass: requestedPass,
  state,
  view,
}: ModelReviewSceneProps) {
  const pass = isBuildPass(requestedPass)
    ? requestedPass
    : 'optimization-pass'
  const configuration = getReviewConfiguration(model, view, state, light)

  return (
    <main
      aria-label="Three.js 模型审查"
      data-review-light={configuration.light}
      data-review-model={model}
      data-review-pass={pass}
      data-review-state={configuration.notebookState}
      data-review-view={configuration.view}
      style={{ height: '100svh', overflow: 'hidden', width: '100vw' }}
    >
      <Canvas
        aria-label={`${model} 模型审查画布`}
        camera={{ far: 100, fov: configuration.pose.fov, near: 0.1 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace
          gl.shadowMap.type = THREE.PCFShadowMap
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 0.9
        }}
        shadows
      >
        <ReviewWorld
          configuration={configuration}
          model={model}
          pass={pass}
        />
      </Canvas>
    </main>
  )
}
