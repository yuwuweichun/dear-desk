import { useEffect, useRef, useState } from 'react'

import type {
  JournalStickerInstance,
  JournalStickerPosition,
  PlacedSticker,
} from '../../domain/sticker'
import { normalizeStickerScale } from '../../domain/sticker'
import { useAppStore } from '../../state/app-store-context'

interface JournalStickerItemProps {
  interactive: boolean
  instance: JournalStickerInstance
  onCommit: (id: string, position: JournalStickerPosition) => void
  onPreview: (id: string, position: JournalStickerPosition) => void
  onSelect: (id: string) => void
  selected: boolean
  sticker: PlacedSticker
}

function JournalStickerItem({
  interactive,
  instance,
  onCommit,
  onPreview,
  onSelect,
  selected,
  sticker,
}: JournalStickerItemProps) {
  const [src, setSrc] = useState<string | null>(null)
  const dragRef = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const reader = new FileReader()
    let active = true
    reader.addEventListener('load', () => {
      if (active && typeof reader.result === 'string') setSrc(reader.result)
    })
    reader.addEventListener('error', () => {
      if (active) setSrc(null)
    })
    reader.readAsDataURL(sticker.asset.blob)
    return () => {
      active = false
      if (reader.readyState === FileReader.LOADING) reader.abort()
    }
  }, [sticker.asset.blob])

  const aspect = sticker.asset.width / sticker.asset.height
  const maxEdge = 112 * normalizeStickerScale(instance.scale)
  const width = aspect >= 1 ? maxEdge : maxEdge * aspect
  const height = aspect >= 1 ? maxEdge / aspect : maxEdge

  const positionFromPointer = (event: React.PointerEvent<HTMLElement>) => {
    const layer = event.currentTarget.parentElement
    if (!layer) return instance.position
    const rect = layer.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    }
  }

  return (
    <button
      type="button"
      className={`${selected ? 'journal-sticker is-selected animal-cursor animal-cursor--force' : 'journal-sticker'}${interactive ? '' : ' is-readonly'}`}
      style={{
        left: `${instance.position.x * 100}%`,
        top: `${instance.position.y * 100}%`,
        width,
        height,
        transform: `translate(-50%, -50%) rotate(${instance.rotationY}rad)`,
      }}
      aria-hidden={!interactive}
      aria-label={interactive ? `选择贴纸 ${sticker.definition.kind === 'text' ? sticker.definition.source.text : sticker.definition.source.name}` : undefined}
      tabIndex={interactive ? 0 : -1}
      onClick={(event) => {
        if (!interactive) return
        event.stopPropagation()
        onSelect(instance.id)
      }}
      onPointerDown={(event) => {
        if (!interactive) return
        event.stopPropagation()
        dragRef.current = true
        const point = positionFromPointer(event)
        dragOffset.current = {
          x: instance.position.x - point.x,
          y: instance.position.y - point.y,
        }
        onSelect(instance.id)
        event.currentTarget.setPointerCapture?.(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!interactive || !dragRef.current) return
        event.stopPropagation()
        const point = positionFromPointer(event)
        onPreview(instance.id, {
          x: point.x + dragOffset.current.x,
          y: point.y + dragOffset.current.y,
        })
      }}
      onPointerUp={(event) => {
        if (!interactive || !dragRef.current) return
        event.stopPropagation()
        dragRef.current = false
        event.currentTarget.releasePointerCapture?.(event.pointerId)
        const point = positionFromPointer(event)
        onCommit(instance.id, {
          x: point.x + dragOffset.current.x,
          y: point.y + dragOffset.current.y,
        })
        dragOffset.current = { x: 0, y: 0 }
      }}
      onPointerCancel={() => {
        dragRef.current = false
        dragOffset.current = { x: 0, y: 0 }
      }}
    >
      {src ? <img src={src} alt="" draggable={false} /> : <span className="sr-only">正在读取贴纸图片</span>}
    </button>
  )
}

interface JournalStickerLayerProps {
  interactive?: boolean
  stickers?: PlacedSticker[]
}

export function JournalStickerLayer({
  interactive = true,
  stickers: providedStickers,
}: JournalStickerLayerProps = {}) {
  const storedStickers = useAppStore((state) => state.journalStickers)
  const stickerWorkflow = useAppStore((state) => state.stickerWorkflow)
  const selectedStickerId = useAppStore((state) => state.selectedStickerId)
  const placePendingJournalSticker = useAppStore(
    (state) => state.placePendingJournalSticker,
  )
  const selectSticker = useAppStore((state) => state.selectSticker)
  const previewJournalStickerPosition = useAppStore(
    (state) => state.previewJournalStickerPosition,
  )
  const commitJournalStickerPosition = useAppStore(
    (state) => state.commitJournalStickerPosition,
  )
  const stickers = providedStickers ?? storedStickers
  const placing = interactive && stickerWorkflow === 'placingJournal'

  return (
    <div
      className={placing ? 'journal-sticker-layer is-placing' : 'journal-sticker-layer'}
      aria-label={placing ? '点击纸页放置贴纸' : '日记贴纸层'}
      onClick={(event) => {
        if (!placing || event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        void placePendingJournalSticker({
          x: (event.clientX - rect.left) / rect.width,
          y: (event.clientY - rect.top) / rect.height,
        })
      }}
    >
      {stickers.map((sticker) => {
        if (sticker.instance.surface !== 'journal') return null
        return (
          <JournalStickerItem
            key={sticker.instance.id}
            sticker={sticker}
            interactive={interactive}
            instance={sticker.instance}
            selected={sticker.instance.id === selectedStickerId}
            onSelect={selectSticker}
            onPreview={previewJournalStickerPosition}
            onCommit={(id, position) => {
              void commitJournalStickerPosition(id, position)
            }}
          />
        )
      })}
    </div>
  )
}
