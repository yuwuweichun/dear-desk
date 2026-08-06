import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App'
import { toLocalDate } from './domain/daily-entry'
import { dailyEntryRepository } from './persistence/daily-entry-repository'
import { createAppStore } from './state/app-store'
import { AppStoreProvider } from './state/app-store-context'
import './styles.css'

const appStore = createAppStore(dailyEntryRepository, toLocalDate())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppStoreProvider store={appStore}>
      <App />
    </AppStoreProvider>
  </StrictMode>,
)
