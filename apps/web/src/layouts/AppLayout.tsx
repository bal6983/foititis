import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import LevelCard from '../components/gamification/LevelCard'
import { getBadges } from '../components/gamification/gamification'
import LanguageToggle from '../components/ui/LanguageToggle'
import ThemeToggle from '../components/ui/ThemeToggle'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabaseClient'

export default function AppLayout() {
  const { locale, t } = useI18n()
  const navigate = useNavigate()
  const [universityName, setUniversityName] = useState('')
  const [userLabel, setUserLabel] = useState('')
  const [isVerifiedStudent, setIsVerifiedStudent] = useState(false)
  const [isPreStudent, setIsPreStudent] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [mobileCreateOpen, setMobileCreateOpen] = useState(false)
  const [totalXp, setTotalXp] = useState(420)

  useEffect(() => {
    let isMounted = true

    const loadUser = async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (!isMounted || userError || !userData.user) return

      const email = userData.user.email ?? ''
      const { data: profile } = await supabase
        .from('profiles')
        .select(
          'display_name, full_name, avatar_url, is_verified_student, is_pre_student, university_id',
        )
        .eq('id', userData.user.id)
        .maybeSingle()

      if (!isMounted) return

      const verified = Boolean(profile?.is_verified_student)
      const preStudent = Boolean(profile?.is_pre_student) && !verified
      setIsVerifiedStudent(verified)
      setIsPreStudent(preStudent)
      setAvatarUrl(profile?.avatar_url ?? null)
      setUserLabel(profile?.display_name || profile?.full_name || email)

      const levelSeed = (userData.user.id ?? '').length
      setTotalXp(300 + levelSeed * 23)

      if (profile?.university_id) {
        const { data: university } = await supabase
          .from('universities')
          .select('name')
          .eq('id', profile.university_id)
          .maybeSingle()
        if (isMounted && university?.name) {
          setUniversityName(university.name)
        }
      }
    }

    loadUser()

    return () => {
      isMounted = false
    }
  }, [])

  const statusText = isVerifiedStudent
    ? t({ en: 'Verified Student', el: 'Επαληθευμένος φοιτητής' })
    : isPreStudent
      ? t({ en: 'Pre-student', el: 'Pre-student' })
      : t({ en: 'Student', el: 'Φοιτητής' })

  const statusClass = isVerifiedStudent
    ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10'
    : isPreStudent
      ? 'text-amber-200 border-amber-400/40 bg-amber-500/10'
      : 'text-blue-200 border-blue-400/40 bg-blue-500/10'

  const spotlightBadge = useMemo(() => getBadges(locale)[4], [locale])

  const leftNavItems = [
    { to: '/dashboard', label: t({ en: 'University Hub', el: 'Κεντρικός Πίνακας' }) },
    { to: '/students', label: t({ en: 'My Courses', el: 'Τα Μαθήματά μου' }) },
    { to: '/marketplace', label: t({ en: 'Marketplace', el: 'Marketplace' }) },
    { to: '/events', label: t({ en: 'Events', el: 'Εκδηλώσεις' }) },
    { to: '/notes', label: t({ en: 'Notes', el: 'Σημειώσεις' }) },
    { to: '/marketplace?mine=1', label: t({ en: 'Saved Items', el: 'Αποθηκευμένα' }) },
  ]

  const upcomingEvents = [
    t({ en: 'AI Club Meetup • Fri 18:00', el: 'Συνάντηση AI Club • Παρ 18:00' }),
    t({ en: 'Exam Prep Session • Sat 11:00', el: 'Προετοιμασία Εξετάσεων • Σαβ 11:00' }),
    t({ en: 'Career Bootcamp • Tue 16:30', el: 'Career Bootcamp • Τρι 16:30' }),
  ]

  const trendingItems = [
    t({ en: 'Engineering Drawing Kit', el: 'Σετ Τεχνικού Σχεδίου' }),
    t({ en: 'Thermodynamics Notes', el: 'Σημειώσεις Θερμοδυναμικής' }),
    t({ en: 'Calculus Guide', el: 'Οδηγός Απειροστικού' }),
  ]

  const topRatedStudents = ['Elena K.', 'Dimitris P.', 'Maria T.']

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen pb-20 text-[var(--text-primary)] md:pb-6">
      <div className="mx-auto w-full max-w-[1600px] px-3 py-3 md:px-6 md:py-5">
        <div className="mb-4 flex items-center justify-between gap-3 md:hidden">
          <div>
            <p className="text-sm font-semibold">
              {universityName || t({ en: 'Campus', el: 'Πανεπιστήμιο' })}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">{statusText}</p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle showLabel={false} />
            <ThemeToggle />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)_280px]">
          <aside className="hidden md:block">
            <div className="sticky top-4 space-y-4">
              <section className="glass-card p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">
                      {universityName || t({ en: 'Campus', el: 'Πανεπιστήμιο' })}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {t({ en: 'Student Platform', el: 'Φοιτητική Πλατφόρμα' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <LanguageToggle showLabel={false} />
                    <ThemeToggle />
                  </div>
                </div>

                <nav className="space-y-2">
                  {leftNavItems.map((item) => (
                    <NavLink
                      key={item.label}
                      to={item.to}
                      className={({ isActive }) =>
                        `block rounded-xl px-3 py-2 text-sm font-medium transition ${
                          isActive
                            ? 'bg-gradient-to-r from-blue-500/80 to-cyan-400/80 text-slate-950'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </nav>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-4 w-full rounded-xl border border-[var(--border-primary)] px-3 py-2 text-left text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  {t({ en: 'Sign out', el: 'Αποσύνδεση' })}
                </button>
              </section>

              <LevelCard
                name={userLabel || t({ en: 'Student', el: 'Φοιτητής' })}
                avatarUrl={avatarUrl}
                totalXp={totalXp}
                compact
              />
            </div>
          </aside>

          <main className="min-w-0">
            <Outlet />
          </main>

          <aside className="hidden md:block">
            <div className="sticky top-4 space-y-4">
              <section className="panel-card p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                  {t({ en: 'Profile Status', el: 'Κατάσταση Προφίλ' })}
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {userLabel || t({ en: 'Student', el: 'Φοιτητής' })}
                </p>
                <span
                  className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${statusClass}`}
                >
                  {statusText}
                </span>
              </section>

              <section className="panel-card p-4">
                <h3 className="text-sm font-semibold">
                  {t({ en: 'Upcoming Events', el: 'Επερχόμενες Εκδηλώσεις' })}
                </h3>
                <ul className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">
                  {upcomingEvents.map((event) => (
                    <li key={event} className="rounded-lg bg-[var(--surface-soft)] px-2 py-2">
                      {event}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="panel-card p-4">
                <h3 className="text-sm font-semibold">
                  {t({ en: 'Trending Items', el: 'Δημοφιλή Αντικείμενα' })}
                </h3>
                <ul className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">
                  {trendingItems.map((item) => (
                    <li key={item} className="rounded-lg bg-[var(--surface-soft)] px-2 py-2">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="panel-card p-4">
                <h3 className="text-sm font-semibold">
                  {t({ en: 'Top Rated Students', el: 'Κορυφαίοι Φοιτητές' })}
                </h3>
                <ul className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">
                  {topRatedStudents.map((student) => (
                    <li key={student} className="rounded-lg bg-[var(--surface-soft)] px-2 py-2">
                      {student}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="panel-card p-4">
                <h3 className="text-sm font-semibold">
                  {t({ en: 'Badge Spotlight', el: 'Κορυφαίο Σήμα' })}
                </h3>
                <div className="mt-3 rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-3 text-xs">
                  <p className="font-semibold">{spotlightBadge.icon} {spotlightBadge.title}</p>
                  <p className="mt-1 text-[var(--text-secondary)]">{spotlightBadge.description}</p>
                </div>
              </section>
            </div>
          </aside>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border-primary)] bg-[color:var(--bg-secondary)]/90 backdrop-blur md:hidden">
        <nav className="mx-auto flex max-w-md items-center justify-around px-3 py-2">
          <NavLink to="/dashboard" className="text-xs font-semibold text-[var(--text-secondary)]">
            {t({ en: 'Home', el: 'Αρχική' })}
          </NavLink>
          <NavLink to="/marketplace" className="text-xs font-semibold text-[var(--text-secondary)]">
            {t({ en: 'Marketplace', el: 'Marketplace' })}
          </NavLink>
          <button
            type="button"
            onClick={() => setMobileCreateOpen((value) => !value)}
            className="rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 px-4 py-2 text-xs font-bold text-slate-950"
          >
            {t({ en: 'Create', el: 'Δημιουργία' })}
          </button>
          <NavLink to="/events" className="text-xs font-semibold text-[var(--text-secondary)]">
            {t({ en: 'Events', el: 'Εκδηλώσεις' })}
          </NavLink>
          <NavLink to="/profile" className="text-xs font-semibold text-[var(--text-secondary)]">
            {t({ en: 'Profile', el: 'Προφίλ' })}
          </NavLink>
        </nav>
      </div>

      {mobileCreateOpen ? (
        <div className="fixed inset-0 z-30 bg-slate-950/55 md:hidden" onClick={() => setMobileCreateOpen(false)}>
          <div
            className="absolute bottom-20 left-1/2 w-[90%] max-w-sm -translate-x-1/2 rounded-2xl border border-[var(--border-primary)] bg-[var(--surface-elevated)] p-3"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">
              {t({ en: 'Quick Create', el: 'Γρήγορη Δημιουργία' })}
            </p>
            <div className="grid gap-2">
              <Link
                to="/marketplace?create=sell"
                onClick={() => setMobileCreateOpen(false)}
                className="rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 px-3 py-2 text-center text-xs font-semibold text-slate-950"
              >
                {t({ en: 'Sell Item', el: 'Πώληση Αντικειμένου' })}
              </Link>
              <Link
                to="/marketplace?create=want"
                onClick={() => setMobileCreateOpen(false)}
                className="rounded-xl border border-[var(--border-primary)] px-3 py-2 text-center text-xs font-semibold text-[var(--text-primary)]"
              >
                {t({ en: 'Request Item', el: 'Αναζήτηση Αντικειμένου' })}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
