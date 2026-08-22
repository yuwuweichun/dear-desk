import { PageFlip } from 'page-flip'
import { useEffect, useRef } from 'react'

import {
  entryTitle,
  formatLocalDate,
  type DailyEntry,
  type LocalDate,
} from '../../domain/daily-entry'
import type { PlacedSticker } from '../../domain/sticker'
import type { JournalTurnDirection } from '../../state/app-store'
import {
  getPageFlipTimingSetting,
  startManagedAnimationFrameLoop,
} from './page-flip-runtime'

const PAGE_FLIP_DURATION_MS = 720
const PAGE_FLIP_COMPLETION_GRACE_MS = 360

export interface JournalTurnSnapshot {
  date: LocalDate
  entry: DailyEntry | null
  isToday: boolean
  stickers: PlacedSticker[]
}

interface PageTurnSheetProps {
  current: JournalTurnSnapshot
  direction: JournalTurnDirection
  onComplete: () => void
  target: JournalTurnSnapshot
}

interface SnapshotPages {
  pages: HTMLElement[]
  release: () => void
}

const appendText = (
  parent: HTMLElement,
  tagName: keyof HTMLElementTagNameMap,
  className: string,
  text: string,
) => {
  const element = document.createElement(tagName)
  element.className = className
  element.textContent = text
  parent.append(element)
  return element
}

const createSnapshotHeader = (
  snapshot: JournalTurnSnapshot,
  title: string,
  status?: string,
) => {
  const header = document.createElement('header')
  header.className = 'journal-page-head'
  const heading = document.createElement('div')
  appendText(heading, 'p', 'journal-date', formatLocalDate(snapshot.date))
  appendText(heading, 'h2', '', title)
  header.append(heading)
  if (status) appendText(header, 'span', '', status)
  return header
}

const createStickerPage = (
  snapshot: JournalTurnSnapshot,
  objectUrls: string[],
) => {
  const page = document.createElement('section')
  page.className = 'journal-page journal-page-left is-sticker-page page-turn-snapshot'
  page.dataset.pageDate = snapshot.date
  page.dataset.snapshotSide = 'left'

  const body = document.createElement('div')
  body.className = 'journal-sticker-page-body'
  body.append(createSnapshotHeader(
    snapshot,
    '贴纸',
    snapshot.stickers.length > 0 ? `${snapshot.stickers.length} 张` : undefined,
  ))

  const paper = document.createElement('div')
  paper.className = 'journal-sticker-paper'
  const layer = document.createElement('div')
  layer.className = 'journal-sticker-layer'

  for (const sticker of snapshot.stickers) {
    if (sticker.instance.surface !== 'journal') continue
    const item = document.createElement('div')
    const aspect = sticker.asset.width / sticker.asset.height
    const width = aspect >= 1 ? 112 : 112 * aspect
    const height = aspect >= 1 ? 112 / aspect : 112
    item.className = 'journal-sticker is-readonly'
    item.style.left = `${sticker.instance.position.x * 100}%`
    item.style.top = `${sticker.instance.position.y * 100}%`
    item.style.width = `${width}px`
    item.style.height = `${height}px`
    item.style.transform = `translate(-50%, -50%) rotate(${sticker.instance.rotationY}rad)`

    if (typeof URL.createObjectURL === 'function') {
      const objectUrl = URL.createObjectURL(sticker.asset.blob)
      objectUrls.push(objectUrl)
      const image = document.createElement('img')
      image.alt = ''
      image.draggable = false
      image.src = objectUrl
      item.append(image)
    }
    layer.append(item)
  }

  paper.append(layer)
  if (snapshot.stickers.length === 0) {
    appendText(paper, 'p', 'journal-sticker-empty', '把今天的心情贴在这一页。')
  }
  body.append(paper)
  appendText(body, 'div', 'page-turn-snapshot-action', '贴纸工作台')
  page.append(body)
  return page
}

const createReadingPage = (snapshot: JournalTurnSnapshot) => {
  const page = document.createElement('section')
  page.className = 'journal-page journal-page-right is-current-page page-turn-snapshot'
  page.dataset.pageDate = snapshot.date
  page.dataset.snapshotSide = 'right'

  const body = document.createElement('div')
  body.className = 'journal-page-body'
  body.append(createSnapshotHeader(
    snapshot,
    entryTitle(snapshot.entry, snapshot.isToday),
  ))
  const copy = document.createElement('div')
  copy.className = 'journal-page-copy'
  appendText(
    copy,
    'p',
    snapshot.entry?.text ? '' : 'journal-page-empty',
    snapshot.entry?.text || '这一页是空白的。',
  )
  body.append(copy)
  page.append(body)
  return page
}

const createJournalSnapshotPages = (
  current: JournalTurnSnapshot,
  target: JournalTurnSnapshot,
  direction: JournalTurnDirection,
): SnapshotPages => {
  const objectUrls: string[] = []
  const orderedSnapshots = direction === 'next'
    ? [current, target]
    : [target, current]
  const pages = orderedSnapshots.flatMap((snapshot) => [
    createStickerPage(snapshot, objectUrls),
    createReadingPage(snapshot),
  ])

  return {
    pages,
    release: () => {
      for (const objectUrl of objectUrls) URL.revokeObjectURL(objectUrl)
    },
  }
}

export function PageTurnSheet({
  current,
  direction,
  onComplete,
  target,
}: PageTurnSheetProps) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let active = true
    let completed = false
    let pageFlip: PageFlip | null = null
    let managedLoop: ReturnType<typeof startManagedAnimationFrameLoop> | null = null
    let startFrame: number | null = null
    let completionTimer: number | null = null
    const snapshotPages = createJournalSnapshotPages(current, target, direction)
    const book = document.createElement('div')
    book.className = 'page-turn-book'
    book.dataset.engine = 'page-flip'
    book.append(...snapshotPages.pages)
    mount.append(book)

    const completeOnce = () => {
      if (!active || completed) return
      completed = true
      onComplete()
    }

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion || book.clientWidth === 0 || book.clientHeight === 0) {
      mount.classList.add('is-reduced-motion')
      completionTimer = window.setTimeout(completeOnce, 120)
      return () => {
        active = false
        if (completionTimer !== null) window.clearTimeout(completionTimer)
        snapshotPages.release()
        book.remove()
      }
    }

    try {
      const rect = book.getBoundingClientRect()
      pageFlip = new PageFlip(book, {
        startPage: direction === 'next' ? 0 : 2,
        size: 'stretch',
        width: Math.max(1, rect.width / 2),
        height: Math.max(1, rect.height),
        minWidth: 1,
        maxWidth: 2400,
        minHeight: 1,
        maxHeight: 2400,
        drawShadow: true,
        flippingTime: getPageFlipTimingSetting(
          PAGE_FLIP_DURATION_MS,
          rect.width / 2,
          rect.height,
        ),
        usePortrait: false,
        startZIndex: 1,
        autoSize: false,
        maxShadowOpacity: 0.34,
        showCover: false,
        mobileScrollSupport: true,
        clickEventForward: false,
        useMouseEvents: true,
        swipeDistance: 30,
        showPageCorners: false,
        disableFlipByClick: true,
      })

      let started = false
      pageFlip.on('flip', () => {
        if (!started) return
        queueMicrotask(completeOnce)
      })
      pageFlip.on('init', () => {
        if (!active) return
        startFrame = window.requestAnimationFrame(() => {
          if (!active || !pageFlip) return
          started = true
          if (direction === 'next') pageFlip.flipNext('bottom')
          else pageFlip.flipPrev('bottom')
        })
      })

      managedLoop = startManagedAnimationFrameLoop(() => {
        pageFlip?.loadFromHTML(snapshotPages.pages)
      })
      completionTimer = window.setTimeout(
        completeOnce,
        PAGE_FLIP_DURATION_MS + PAGE_FLIP_COMPLETION_GRACE_MS,
      )
    } catch (error) {
      console.error('page-flip prototype failed; completing with the static fallback.', error)
      mount.classList.add('is-reduced-motion')
      completionTimer = window.setTimeout(completeOnce, 120)
    }

    return () => {
      active = false
      if (startFrame !== null) window.cancelAnimationFrame(startFrame)
      if (completionTimer !== null) window.clearTimeout(completionTimer)
      pageFlip?.off('init')
      pageFlip?.off('flip')
      managedLoop?.stop()
      try {
        pageFlip?.getRender().finishAnimation()
        pageFlip?.destroy()
      } catch {
        book.remove()
      }
      snapshotPages.release()
    }
  }, [current, direction, onComplete, target])

  return (
    <div
      ref={mountRef}
      className={`page-turn-overlay is-${direction}`}
      data-page-turn-engine="page-flip"
      aria-hidden="true"
    />
  )
}
