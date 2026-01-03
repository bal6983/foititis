import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const navItems = [
  { to: '/dashboard', label: 'Πίνακας' },
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
  const [userLabel, setUserLabel] = useState('')
  const [isVerifiedStudent, setIsVerifiedStudent] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadUser = async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (!isMounted) return

      if (userError || !userData.user) {
        return
      }

      const email = userData.user.email ?? ''

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, is_verified_student')
        .eq('id', userData.user.id)
        .maybeSingle()

      if (!isMounted) return

      setUserLabel(profile?.display_name || email)
      setIsVerifiedStudent(Boolean(profile?.is_verified_student))
    }

    loadUser()

    return () => {
      isMounted = false
    }
  }, [])

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
            {userLabel ? (
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span className="max-w-[140px] truncate">{userLabel}</span>
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center border border-slate-300/70 bg-transparent text-[9px] font-semibold leading-none [clip-path:polygon(25%_6%,_75%_6%,_100%_50%,_75%_94%,_25%_94%,_0%_50%)] ${
                    isVerifiedStudent ? 'text-purple-500' : 'text-red-500'
                  }`}
                  aria-hidden="true"
                >
                  {isVerifiedStudent ? '✓' : 'pS'}
                </span>
              </span>
            ) : null}
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
