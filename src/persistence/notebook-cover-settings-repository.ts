import {
  normalizeNotebookLabel,
  NOTEBOOK_COVER_SETTINGS_ID,
  type NotebookCoverSettings,
  type NotebookCoverSettingsRepository,
} from '../domain/notebook-cover-settings'
import { database, type DearDeskDatabase } from './database'

export class DexieNotebookCoverSettingsRepository implements NotebookCoverSettingsRepository {
  constructor(
    private readonly db: DearDeskDatabase = database,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async get() {
    return (await this.db.notebookCoverSettings.get(NOTEBOOK_COVER_SETTINGS_ID)) ?? null
  }

  async save(label: string): Promise<NotebookCoverSettings> {
    const normalized = normalizeNotebookLabel(label)
    const settings: NotebookCoverSettings = {
      id: NOTEBOOK_COVER_SETTINGS_ID,
      label: normalized,
      updatedAt: this.now().toISOString(),
    }
    await this.db.notebookCoverSettings.put(settings)
    return settings
  }
}

export const notebookCoverSettingsRepository =
  new DexieNotebookCoverSettingsRepository()
