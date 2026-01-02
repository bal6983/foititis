import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const navItems = [
  { to: '/app', label: 'Πίνακας' },
  { to: '/marketplace', label: 'Αγορά' },
  { to: '/groups', label: 'Ομάδες' },
  { to: '/notes', label: 'Σημειώσεις' },
  { to: '/events', label: 'Εκδηλώσεις' },
  { to: '/profile', label: 'Προφίλ' },
  { to: '/verification', label: 'Επαλήθευση' },
  { to: '/wanted', label: 'Ψάχνω για' },
]

export default function AppLayout() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-screen-lg flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-semibold">Foititis</span>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <nav className="flex flex-wrap gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  className={({ isActive }) =>
                    `rounded-full px-3 py-1 text-xs font-semibold ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`
                  }
                  to={item.to}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <button
              className="rounded-full px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
              type="button"
              onClick={handleLogout}
            >
              Αποσύνδεση
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-screen-lg px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
