import { Outlet } from 'react-router-dom'
import LanguageToggle from '../components/ui/LanguageToggle'
import { useI18n } from '../lib/i18n'

export default function AuthLayout() {
  const { t } = useI18n()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-4 flex justify-end">
          <LanguageToggle />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Outlet />
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          {t({
            en: 'Local Supabase sign-in UI.',
            el: 'Τοπικό UI σύνδεσης Supabase.',
          })}
        </p>
      </main>
    </div>
  )
}
