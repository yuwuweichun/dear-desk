import {
  normalizeSceneColorPresetName,
  normalizeSceneColors,
  SceneColorPresetNameConflictError,
  type SceneColorConfig,
  type SceneColorPreset,
  type SceneColorPresetPreview,
  type SceneColorPresetRepository,
} from '../domain/scene-color-preset'
import { database, type DearDeskDatabase } from './database'

export class DexieSceneColorPresetRepository implements SceneColorPresetRepository {
  constructor(
    private readonly db: DearDeskDatabase = database,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = () => crypto.randomUUID(),
  ) {}

  async list(): Promise<SceneColorPreset[]> {
    return this.db.sceneColorPresets.orderBy('createdAt').reverse().toArray()
  }

  async create(
    name: string,
    colors: SceneColorConfig,
    preview?: SceneColorPresetPreview,
  ): Promise<SceneColorPreset> {
    const normalizedName = normalizeSceneColorPresetName(name)
    const timestamp = this.now().toISOString()
    const preset: SceneColorPreset = {
      id: this.createId(),
      name: normalizedName,
      colors: normalizeSceneColors(colors),
      ...(preview ? {
        previewBlob: preview.blob,
        previewMimeType: preview.mimeType,
      } : {}),
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    try {
      await this.db.sceneColorPresets.add(preset)
    } catch (error) {
      if (error instanceof Error && error.name === 'ConstraintError') {
        throw new SceneColorPresetNameConflictError()
      }
      throw error
    }
    return preset
  }

  async delete(id: string): Promise<void> {
    await this.db.sceneColorPresets.delete(id)
  }
}

export const sceneColorPresetRepository = new DexieSceneColorPresetRepository()
