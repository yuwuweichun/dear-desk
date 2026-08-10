import {
  createBackgroundRemovalSession,
  type ProcessedImage,
} from './image-processing'

class FakeWorker extends EventTarget {
  static instances: FakeWorker[] = []
  static respond = true
  messages: Array<{ id: number }> = []
  terminated = false

  constructor() {
    super()
    FakeWorker.instances.push(this)
  }

  postMessage(message: { id: number }) {
    this.messages.push(message)
    if (!FakeWorker.respond) return
    queueMicrotask(() => {
      this.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'result',
            id: message.id,
            pixels: new Uint8ClampedArray([20, 40, 60, 255]).buffer,
            width: 1,
            height: 1,
          },
        }),
      )
    })
  }

  terminate() {
    this.terminated = true
  }
}

const image: ProcessedImage = {
  blob: new Blob(['png'], { type: 'image/png' }),
  height: 1,
  mimeType: 'image/png',
  width: 1,
}

describe('background removal session', () => {
  beforeEach(() => {
    FakeWorker.instances = []
    FakeWorker.respond = true
    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal(
      'ImageData',
      class ImageDataStub {
        constructor(
          public data: Uint8ClampedArray,
          public width: number,
          public height: number,
        ) {}
      },
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['result'], { type: 'image/png' }))
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('reuses one worker and its loaded model for repeated successful cutouts', async () => {
    const session = createBackgroundRemovalSession()

    await session.remove(image, vi.fn())
    await session.remove(image, vi.fn())

    expect(FakeWorker.instances).toHaveLength(1)
    expect(FakeWorker.instances[0]?.messages).toHaveLength(2)
    session.destroy()
    expect(FakeWorker.instances[0]?.terminated).toBe(true)
  })

  it('terminates active inference immediately when cancellation is requested', async () => {
    FakeWorker.respond = false
    const session = createBackgroundRemovalSession()
    const controller = new AbortController()
    const result = session.remove(image, vi.fn(), controller.signal)

    await vi.waitFor(() => expect(FakeWorker.instances[0]?.messages).toHaveLength(1))
    controller.abort()

    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
    expect(FakeWorker.instances[0]?.terminated).toBe(true)
    session.destroy()
  })
})
