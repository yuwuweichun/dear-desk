interface ManagedAnimationFrameLoop {
  stop: () => void
}

export function getPageFlipTimingSetting(
  durationMs: number,
  pageWidth: number,
  pageHeight: number,
) {
  const cornerInset = pageHeight / 10
  const pathLength = Math.max(1, 2 * pageWidth - cornerInset, cornerInset)

  // StPageFlip scales its setting by path pixels, so compensate for responsive page widths.
  return Math.round(durationMs * 1000 / pathLength)
}

/**
 * StPageFlip starts an endless requestAnimationFrame loop without exposing a
 * stop method. Capture that one recursive loop so the React owner can cancel it.
 */
export function startManagedAnimationFrameLoop(
  start: () => void,
): ManagedAnimationFrameLoop {
  const requestFrame = window.requestAnimationFrame.bind(window)
  const cancelFrame = window.cancelAnimationFrame.bind(window)
  const previousRequestFrame = window.requestAnimationFrame
  let active = true
  let scheduledFrame: number | null = null
  let loopCallback: FrameRequestCallback | null = null

  const runManagedFrame: FrameRequestCallback = (time) => {
    if (!active || !loopCallback) return

    const callback = loopCallback
    const requestDuringFrame = window.requestAnimationFrame
    window.requestAnimationFrame = (nextCallback) => {
      if (nextCallback === callback) {
        scheduledFrame = requestFrame(runManagedFrame)
        return scheduledFrame
      }
      return requestFrame(nextCallback)
    }

    try {
      callback(time)
    } finally {
      window.requestAnimationFrame = requestDuringFrame
    }
  }

  window.requestAnimationFrame = (callback) => {
    loopCallback = callback
    scheduledFrame = requestFrame(runManagedFrame)
    return scheduledFrame
  }

  try {
    start()
  } finally {
    window.requestAnimationFrame = previousRequestFrame
  }

  if (!loopCallback) {
    throw new Error('page-flip did not start its render loop')
  }

  return {
    stop: () => {
      active = false
      if (scheduledFrame !== null) cancelFrame(scheduledFrame)
      scheduledFrame = null
      loopCallback = null
    },
  }
}
