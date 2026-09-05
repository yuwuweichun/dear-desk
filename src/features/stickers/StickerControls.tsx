import {
  AlertCircle,
  Check,
  Crosshair,
  RotateCcw,
  RotateCw,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

import {
  normalizeStickerScale,
  stickerLabel,
  STICKER_SCALE_MAX,
  STICKER_SCALE_MIN,
  WALL_STICKER_SCALE_MAX,
} from '../../domain/sticker'
import { useAppStore } from '../../state/app-store-context'
import { IconButton } from '../../ui'

export function StickerControls() {
  const stickerWorkflow = useAppStore((state) => state.stickerWorkflow)
  const stickerStatus = useAppStore((state) => state.stickerStatus)
  const stickerErrorMessage = useAppStore((state) => state.stickerErrorMessage)
  const selectedStickerId = useAppStore((state) => state.selectedStickerId)
  const selectSticker = useAppStore((state) => state.selectSticker)
  const stickers = useAppStore((state) => state.stickers)
  const journalStickers = useAppStore((state) => state.journalStickers)
  const wallStickers = useAppStore((state) => state.wallStickers)
  const cancelStickerPlacement = useAppStore(
    (state) => state.cancelStickerPlacement,
  )
  const rotateSelectedSticker = useAppStore(
    (state) => state.rotateSelectedSticker,
  )
  const resizeSelectedSticker = useAppStore(
    (state) => state.resizeSelectedSticker,
  )
  const deleteSelectedSticker = useAppStore(
    (state) => state.deleteSelectedSticker,
  )
  const clearStickerError = useAppStore((state) => state.clearStickerError)
  const selected = [...stickers, ...journalStickers, ...wallStickers].find(
    (sticker) => sticker.instance.id === selectedStickerId,
  )
  const busy = stickerStatus === 'saving'
  const scaleMax = selected?.instance.surface === 'wall'
    ? WALL_STICKER_SCALE_MAX
    : STICKER_SCALE_MAX
  const placing =
    stickerWorkflow === 'placingDesk' ||
    stickerWorkflow === 'placingJournal' ||
    stickerWorkflow === 'placingWall'

  return (
    <>
      {placing ? (
        <div className="sticker-mode-bar" role="status">
          <Crosshair aria-hidden="true" size={18} strokeWidth={1.8} />
          <span>
            {stickerWorkflow === 'placingJournal'
              ? '点击纸页放置装饰'
              : stickerWorkflow === 'placingWall'
                ? '点击墙面放置装饰'
                : '点击桌面放置装饰'}
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
            disabled={busy || normalizeStickerScale(selected.instance.scale, scaleMax) <= STICKER_SCALE_MIN}
            label="缩小贴纸"
            title="缩小"
            onClick={() => void resizeSelectedSticker(-1)}
            variant="quiet"
          >
            <ZoomOut aria-hidden="true" size={18} strokeWidth={1.8} />
          </IconButton>
          <IconButton
            disabled={busy || normalizeStickerScale(selected.instance.scale, scaleMax) >= scaleMax}
            label="放大贴纸"
            title="放大"
            onClick={() => void resizeSelectedSticker(1)}
            variant="quiet"
          >
            <ZoomIn aria-hidden="true" size={18} strokeWidth={1.8} />
          </IconButton>
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
            disabled={busy}
            label="完成贴纸调整"
            title="完成"
            onClick={() => selectSticker(null)}
            variant="primary"
          >
            <Check aria-hidden="true" size={18} strokeWidth={1.8} />
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
