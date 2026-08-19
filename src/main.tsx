import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App'
import { toLocalDate } from './domain/daily-entry'
import { dailyEntryRepository } from './persistence/daily-entry-repository'
import { stickerRepository } from './persistence/sticker-repository'
import { notebookCoverSettingsRepository } from './persistence/notebook-cover-settings-repository'
import { createAppStore } from './state/app-store'
import { AppStoreProvider } from './state/app-store-context'
import 'animal-island-ui/style'
import './styles.css'
import './sticker-workbench.css'
import './ui/theme.css'

const appStore = createAppStore(
  dailyEntryRepository,
  toLocalDate(),
  stickerRepository,
  notebookCoverSettingsRepository,
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppStoreProvider store={appStore}>
      <App />
    </AppStoreProvider>
  </StrictMode>,
)
