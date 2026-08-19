export const NOTEBOOK_COVER_SETTINGS_ID = 'primary' as const
export const MAX_NOTEBOOK_LABEL_LENGTH = 12

const NOTEBOOK_LABEL_CONTROL_PATTERN = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}]/u

export interface NotebookCoverSettings {
  id: typeof NOTEBOOK_COVER_SETTINGS_ID
  label: string
  updatedAt: string
}

export interface NotebookCoverSettingsRepository {
  get(): Promise<NotebookCoverSettings | null>
  save(label: string): Promise<NotebookCoverSettings>
}

export class NotebookCoverLabelValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotebookCoverLabelValidationError'
  }
}

export const normalizeNotebookLabel = (label: string) => {
  const normalized = label.trim().replace(/\s+/g, ' ')
  if (normalized.length > MAX_NOTEBOOK_LABEL_LENGTH) {
    throw new NotebookCoverLabelValidationError(
      `铭牌内容不能超过 ${MAX_NOTEBOOK_LABEL_LENGTH} 个字符。`,
    )
  }
  if (NOTEBOOK_LABEL_CONTROL_PATTERN.test(normalized)) {
    throw new NotebookCoverLabelValidationError(
      '铭牌只支持中英文、数字、空格和基础标点。',
    )
  }
  return normalized
}

export const emptyNotebookCoverSettings = (): NotebookCoverSettings => ({
  id: NOTEBOOK_COVER_SETTINGS_ID,
  label: '',
  updatedAt: new Date(0).toISOString(),
})
