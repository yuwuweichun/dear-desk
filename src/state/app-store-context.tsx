import { createContext, type ReactNode, useContext } from 'react'
import { useStore } from 'zustand'

import type { AppState, AppStore } from './app-store'

const AppStoreContext = createContext<AppStore | null>(null)

interface AppStoreProviderProps {
  children: ReactNode
  store: AppStore
}

export function AppStoreProvider({ children, store }: AppStoreProviderProps) {
  return (
    <AppStoreContext.Provider value={store}>
      {children}
    </AppStoreContext.Provider>
  )
}

export function useAppStore<T>(selector: (state: AppState) => T) {
  const store = useContext(AppStoreContext)

  if (!store) {
    throw new Error('useAppStore must be used inside AppStoreProvider')
  }

  return useStore(store, selector)
}
