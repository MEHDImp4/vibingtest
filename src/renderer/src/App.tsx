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
    return <div className="bg-[var(--bg-primary)] min-h-[100dvh]" />
  }

  return (
    <div className="relative grid h-[100dvh] grid-cols-[256px_minmax(0,1fr)] max-md:grid-cols-1 bg-[var(--bg-primary)] overflow-hidden">
      <aside className="drag app-sidebar flex h-full flex-col px-4 py-6 max-md:h-auto max-md:border-b max-md:border-r-0">
        <div className="flex items-start justify-between gap-3 px-2">
          <div>
            <div className="brand-mark w-10 h-10 panel-base flex items-center justify-center overflow-hidden">
              <img src={logo} alt="VoxFlow" className="w-full h-full object-contain p-1.5" />
            </div>
            <div className="mt-6 text-[1.25rem] font-bold tracking-tight text-[var(--text-primary)]">VoxFlow</div>
            <div className="mt-2 max-w-[12rem] text-[0.75rem] leading-snug text-[var(--text-secondary)]">A compact voice console for dictation and translation.</div>
          </div>
          <div className="flex gap-2 no-drag pt-1">
            <button 
              className="w-3 h-3 rounded-full bg-[var(--bg-accent)] hover:bg-[var(--text-tertiary)] transition-colors" 
              onClick={() => window.voxflow.minimizeWindow()} 
              aria-label="Minimize" 
            />
            <button 
              className="w-3 h-3 rounded-full bg-[var(--bg-accent)] hover:bg-[var(--color-error)] transition-colors" 
              onClick={() => window.voxflow.closeWindow()} 
              aria-label="Close" 
            />
          </div>
        </div>

        <nav className="no-drag mt-10 space-y-1">
          {NAV.map((item, index) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`nav-item w-full animate-reveal stagger-${index + 1} ${view === item.id ? 'nav-item-active' : ''}`}
            >
              <span className="nav-mark" />
              <div className="flex flex-col items-start min-w-0">
                <span className="text-sm font-semibold">{item.label}</span>
                <span className="label-mono text-[9px] mt-0.5 opacity-60">{item.eyebrow}</span>
              </div>
            </button>
          ))}
        </nav>

        <div className="mt-auto no-drag animate-reveal stagger-4 max-md:hidden">
          <div className="panel-base p-4">
            <div className="label-mono opacity-60 mb-4">Pipeline</div>
            <div className="space-y-3">
              {['Hotkey', 'Audio', 'Transcript', 'Paste'].map((item, index) => (
                <div className="flex items-center justify-between text-[11px] font-medium" key={item}>
                  <span className="label-mono opacity-40">{String(index + 1).padStart(2, '0')}</span>
                  <span className="text-[var(--text-primary)]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <main className="no-drag relative min-w-0 overflow-y-auto">
        {!settings.onboardingCompleted && (
          <OnboardingPage settings={settings} onComplete={completeOnboarding} />
        )}
        {settings.onboardingCompleted && (
          <>
            {view === 'home' && <Dashboard settings={settings} />}
            {view === 'settings' && (
              <SettingsPage
                settings={settings}
                onUpdate={(next) => setSettings(next)}
              />
            )}
            {view === 'history' && <HistoryPage />}
          </>
        )}
      </main>
    </div>
  )
}
