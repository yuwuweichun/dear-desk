declare module 'page-flip' {
  export type PageFlipCorner = 'top' | 'bottom'

  export interface PageFlipEvent<T = unknown> {
    data: T
    object: PageFlip
  }

  export interface PageFlipSettings {
    startPage: number
    size: 'fixed' | 'stretch'
    width: number
    height: number
    minWidth: number
    maxWidth: number
    minHeight: number
    maxHeight: number
    drawShadow: boolean
    flippingTime: number
    usePortrait: boolean
    startZIndex: number
    autoSize: boolean
    maxShadowOpacity: number
    showCover: boolean
    mobileScrollSupport: boolean
    clickEventForward: boolean
    useMouseEvents: boolean
    swipeDistance: number
    showPageCorners: boolean
    disableFlipByClick: boolean
  }

  export class PageFlip {
    constructor(element: HTMLElement, settings: Partial<PageFlipSettings>)
    destroy(): void
    flipNext(corner?: PageFlipCorner): void
    flipPrev(corner?: PageFlipCorner): void
    getRender(): { finishAnimation(): void }
    loadFromHTML(items: NodeListOf<HTMLElement> | HTMLElement[]): void
    off(eventName: string): void
    on<T = unknown>(
      eventName: string,
      callback: (event: PageFlipEvent<T>) => void,
    ): PageFlip
  }
}
