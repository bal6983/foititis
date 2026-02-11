import { Outlet } from 'react-router-dom'
import LanguageToggle from '../components/ui/LanguageToggle'

export default function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="flex h-14 items-center justify-end border-b border-slate-200 px-4">
        <LanguageToggle />
      </header>
      <main className="flex-1">
        <div className="mx-auto w-full max-w-screen-sm px-4 py-6">
          <Outlet />
        </div>
      </main>
      <footer className="h-12 border-t border-slate-200" />
    </div>
  )
}
