import { render } from '@testing-library/react'

import type { JournalTurnDirection } from '../../state/app-store'
import { PageTurnSheet } from './PageTurnSheet'

describe('PageTurnSheet', () => {
  it.each(['previous', 'next'] as JournalTurnDirection[])('does not render date text while turning %s', (direction) => {
    const { container } = render(
      <PageTurnSheet
        direction={direction}
        onComplete={vi.fn()}
      />,
    )

    expect(container.querySelector('.page-turn-sheet')?.textContent?.trim()).toBe('')
  })
})
