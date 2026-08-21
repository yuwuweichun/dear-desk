import {
  getPageFlipTimingSetting,
  startManagedAnimationFrameLoop,
} from './page-flip-runtime'

describe('getPageFlipTimingSetting', () => {
  it('normalizes responsive page widths to the requested duration', () => {
    expect(getPageFlipTimingSetting(720, 576, 766.5)).toBe(670)
    expect(getPageFlipTimingSetting(720, 149, 635.28125)).toBe(3071)
  })
})

describe('startManagedAnimationFrameLoop', () => {
  it('cancels the recursive frame scheduled by page-flip', () => {
    const frames = new Map<number, FrameRequestCallback>()
    let nextFrameId = 1
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      const id = nextFrameId++
      frames.set(id, callback)
      return id
    })
    const cancelAnimationFrame = vi.fn((id: number) => {
      frames.delete(id)
    })
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame)

    let renderedFrames = 0
    const managedLoop = startManagedAnimationFrameLoop(() => {
      const pageFlipLoop: FrameRequestCallback = () => {
        renderedFrames += 1
        window.requestAnimationFrame(pageFlipLoop)
      }
      window.requestAnimationFrame(pageFlipLoop)
    })

    const firstFrame = frames.get(1)
    expect(firstFrame).toBeDefined()
    frames.delete(1)
    firstFrame?.(16)
    expect(renderedFrames).toBe(1)
    expect(frames.has(2)).toBe(true)

    managedLoop.stop()
    expect(cancelAnimationFrame).toHaveBeenCalledWith(2)
    expect(frames.size).toBe(0)

    vi.unstubAllGlobals()
  })
})
