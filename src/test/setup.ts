import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

Object.defineProperties(window.HTMLMediaElement.prototype, {
  load: { configurable: true, value: vi.fn() },
  pause: { configurable: true, value: vi.fn() },
  play: { configurable: true, value: vi.fn().mockResolvedValue(undefined) },
})

afterEach(() => {
  cleanup()
})
