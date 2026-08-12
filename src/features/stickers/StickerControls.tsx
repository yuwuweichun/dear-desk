import {
  AlertCircle,
  Crosshair,
  RotateCcw,
  RotateCw,
  Trash2,
  X,
} from 'lucide-react'

import { stickerLabel } from '../../domain/sticker'
import { useAppStore } from '../../state/app-store-context'
import { IconButton } from '../../ui'

export function StickerControls() {
  const stickerWorkflow = useAppStore((state) => state.stickerWorkflow)
  const stickerStatus = useAppStore((state) => state.stickerStatus)
  const stickerErrorMessage = useAppStore((state) => state.stickerErrorMessage)
  const selectedStickerId = useAppStore((state) => state.selectedStickerId)
  const stickers = useAppStore((state) => state.stickers)
  const journalStickers = useAppStore((state) => state.journalStickers)
  const cancelStickerPlacement = useAppStore(
    (state) => state.cancelStickerPlacement,
  )
  const rotateSelectedSticker = useAppStore(
    (state) => state.rotateSelectedSticker,
  )
  const deleteSelectedSticker = useAppStore(
    (state) => state.deleteSelectedSticker,
  )
  const clearStickerError = useAppStore((state) => state.clearStickerError)
  const selected = [...stickers, ...journalStickers].find(
    (sticker) => sticker.instance.id === selectedStickerId,
  )
  const busy = stickerStatus === 'saving'
  const placing =
    stickerWorkflow === 'placingDesk' || stickerWorkflow === 'placingJournal'

  return (
    <>
      {placing ? (
        <div className="sticker-mode-bar" role="status">
          <Crosshair aria-hidden="true" size={18} strokeWidth={1.8} />
          <span>
            {stickerWorkflow === 'placingJournal'
              ? '点击纸页放置贴纸'
              : '点击桌垫放置贴纸'}
          </span>
          <IconButton
            label="取消放置"
            onClick={cancelStickerPlacement}
            variant="quiet"
          >
            <X aria-hidden="true" size={18} strokeWidth={1.8} />
          </IconButton>
        </div>
      ) : selected ? (
        <div className="sticker-selection-bar" aria-label="贴纸工具">
          <span title={stickerLabel(selected.definition)}>
            {stickerLabel(selected.definition)}
          </span>
          <IconButton
            disabled={busy}
            label="逆时针旋转贴纸"
            title="逆时针旋转"
            onClick={() => void rotateSelectedSticker(-1)}
            variant="quiet"
          >
            <RotateCcw aria-hidden="true" size={18} strokeWidth={1.8} />
          </IconButton>
          <IconButton
            disabled={busy}
            label="顺时针旋转贴纸"
            title="顺时针旋转"
            onClick={() => void rotateSelectedSticker(1)}
            variant="quiet"
          >
            <RotateCw aria-hidden="true" size={18} strokeWidth={1.8} />
          </IconButton>
          <IconButton
            className="danger"
            disabled={busy}
            label="删除贴纸"
            onClick={() => void deleteSelectedSticker()}
            variant="danger"
          >
            <Trash2 aria-hidden="true" size={18} strokeWidth={1.8} />
          </IconButton>
        </div>
      ) : null}

      {stickerErrorMessage ? (
        <div className="sticker-error-toast" role="alert">
          <AlertCircle aria-hidden="true" size={17} strokeWidth={1.8} />
          <span>{stickerErrorMessage}</span>
          <IconButton
            label="关闭错误提示"
            title="关闭"
            onClick={clearStickerError}
            variant="quiet"
          >
            <X aria-hidden="true" size={17} strokeWidth={1.8} />
          </IconButton>
        </div>
      ) : null}
    </>
  )
}
