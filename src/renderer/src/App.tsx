import { useEffect, useState } from 'react'
import logo from './assets/logo.png'
import type { CSSProperties } from 'react'
import { AppSettings, DEFAULT_SETTINGS } from '../../shared/types'
import { Dashboard } from './pages/Dashboard'
import { OnboardingPage } from './pages/OnboardingPage'
import { SettingsPage } from './pages/SettingsPage'
import { HistoryPage } from './pages/HistoryPage'
import { OverlayApp } from './pages/OverlayApp'

type View = 'home' | 'settings' | 'history'

const NAV: { id: View; label: string; eyebrow: string }[] = [
  { id: 'home', label: 'Capture', eyebrow: 'Live' },
  { id: 'settings', label: 'Settings', eyebrow: 'Local' },
  { id: 'history', label: 'History', eyebrow: 'Archive' }
]

export default function App(): JSX.Element {
  const windowType = window.voxflow.getWindowType()

  if (windowType === 'overlay') {
    return <OverlayApp />
  }

  return <MainApp />
}

function MainApp(): JSX.Element {
  const [view, setView] = useState<View>('home')
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    window.voxflow.getSettings().then(setSettings).catch(() => setSettings(DEFAULT_SETTINGS))
  }, [])

  const completeOnboarding = async (nextSettings: AppSettings): Promise<void> => {
    await window.voxflow.saveSettings(nextSettings)
    setSettings(nextSettings)
    setView('settings')
  }

  if (!settings) {
    return <div className="app-surface min-h-[100dvh]" />
  }

  return (
    <div className="app-surface min-h-[100dvh] overflow-hidden text-stone-100">
      <div className="ambient-field pointer-events-none fixed inset-0" />
      <div className="grain" />

      <div className="relative grid min-h-[100dvh] grid-cols-[256px_minmax(0,1fr)] max-md:grid-cols-1">
        <aside className="drag app-sidebar flex min-h-[100dvh] flex-col px-4 py-4 max-md:min-h-0 max-md:border-b max-md:border-r-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="brand-mark overflow-hidden">
                <img src={logo} alt="VoxFlow" className="w-full h-full object-contain p-1.5" />
              </div>
              <div className="mt-4 text-[1.35rem] font-semibold leading-none tracking-tight">VoxFlow</div>
              <div className="mt-2 max-w-[12rem] text-xs leading-5 text-stone-500">A compact voice console for dictation, translation, and paste-ready text.</div>
            </div>
            <div className="flex gap-2 no-drag">
              <button className="window-dot" onClick={() => window.voxflow.minimizeWindow()} aria-label="Minimize" />
              <button className="window-dot window-dot-close" onClick={() => window.voxflow.closeWindow()} aria-label="Close" />
            </div>
          </div>

          <nav className="no-drag mt-8 grid gap-2">
            {NAV.map((item, index) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`nav-item ${view === item.id ? 'nav-item-active' : ''}`}
                style={{ '--index': index } as CSSProperties}
              >
                <span className="nav-mark" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-stone-500">{item.eyebrow}</span>
                </span>
              </button>
            ))}
          </nav>

          <div className="mt-auto grid gap-3 pt-8 max-md:hidden">
            <div className="micro-panel">
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-300/70">Pipeline</div>
              <div className="mt-3 grid gap-2">
                {['Hotkey', 'Audio', 'Transcript', 'Paste'].map((item, index) => (
                  <div className="pipeline-row" key={item}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{item}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="no-drag relative min-w-0 overflow-y-auto">
          {!settings.onboardingCompleted && <OnboardingPage settings={settings} onComplete={completeOnboarding} />}
          {settings.onboardingCompleted && view === 'home' && <Dashboard />}
          {settings.onboardingCompleted && view === 'settings' && <SettingsPage />}
          {settings.onboardingCompleted && view === 'history' && <HistoryPage />}
        </main>
      </div>
    </div>
  )
}
