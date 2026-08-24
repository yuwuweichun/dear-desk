import { StrictMode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'

import type { DailyEntryRepository, LocalDate } from '../../domain/daily-entry'
import type { PlacedSticker } from '../../domain/sticker'
import { createAppStore } from '../../state/app-store'
import { AppStoreProvider } from '../../state/app-store-context'
import { JournalStickerLayer } from './JournalStickerLayer'

const date = '2026-08-08' as LocalDate

const repository: DailyEntryRepository = {
  getByDate: vi.fn().mockResolvedValue(null),
  listEntries: vi.fn().mockResolvedValue([]),
  listDates: vi.fn().mockResolvedValue([]),
  save: vi.fn(),
}

const journalSticker: PlacedSticker = {
  definition: {
    id: 'definition-journal-image',
    kind: 'image',
    source: {
      assetId: 'source-journal-image',
      cutoutMode: 'automatic',
      name: '日记图片',
    },
    forge: {
      material: 'original',
      materialIntensity: 0.86,
      outlineColor: '#ffffff',
      outlineWidth: 14,
    },
    previewAssetId: 'preview-journal-image',
    createdAt: '2026-08-08T01:00:00.000Z',
  },
  asset: {
    id: 'preview-journal-image',
    blob: new Blob(['png'], { type: 'image/png' }),
    height: 80,
    mimeType: 'image/png',
    width: 120,
    upstreamCommit: '068caa49eef69745564a5debbc01bab3fcd31042',
  },
  instance: {
    id: 'instance-journal-image',
    definitionId: 'definition-journal-image',
    surface: 'journal',
    journalDate: date,
    position: { x: 0.5, y: 0.5 },
    rotationY: 0,
    createdAt: '2026-08-08T01:00:00.000Z',
    updatedAt: '2026-08-08T01:00:00.000Z',
  },
}

describe('JournalStickerLayer', () => {
  it('keeps a persisted PNG visible through React Strict Mode effect replay', async () => {
    const store = createAppStore(repository, date)
    store.setState({ journalStickers: [journalSticker] })

    render(
      <StrictMode>
        <AppStoreProvider store={store}>
          <JournalStickerLayer />
        </AppStoreProvider>
      </StrictMode>,
    )

    const sticker = screen.getByRole('button', { name: '选择贴纸 日记图片' })
    await waitFor(() => {
      expect(sticker.querySelector('img')).toHaveAttribute(
        'src',
        expect.stringMatching(/^data:image\/png;base64,/),
      )
    })
  })
})
