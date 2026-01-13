import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type ListingItem = {
  id: string
  title: string
  created_at: string
}

type WantedItem = {
  id: string
  title: string
  created_at: string
}

type ProfileRecord = {
  display_name: string | null
  is_verified_student: boolean | null
  city_id: string | null
  university_id: string | null
  school_id: string | null
  universities: { name: string } | null
  schools: { name: string } | null
}

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleDateString('el-GR')
}

export default function Profile() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [universityEmail, setUniversityEmail] = useState('')
  const [universityName, setUniversityName] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [isVerifiedStudent, setIsVerifiedStudent] = useState(false)
  const [listings, setListings] = useState<ListingItem[]>([])
  const [wantedListings, setWantedListings] = useState<WantedItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [isVerificationLoading, setIsVerificationLoading] = useState(false)
  const [verificationSuccess, setVerificationSuccess] = useState('')
  const [verificationError, setVerificationError] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      setIsLoading(true)
      setErrorMessage('')

      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (!isMounted) return

      if (userError || !userData.user) {
        const details = userError?.message ? ` (${userError.message})` : ''
        setErrorMessage(`Δεν ήταν δυνατή η φόρτωση του χρήστη.${details}`)
        setIsLoading(false)
        return
      }

      setEmail(userData.user.email ?? '')

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(
          'display_name, is_verified_student, city_id, university_id, school_id, universities(name), schools(name)',
        )
        .eq('id', userData.user.id)
        .maybeSingle()

      if (!isMounted) return

      if (profileError) {
        const details = profileError.message ? ` (${profileError.message})` : ''
        setErrorMessage(`Δεν ήταν δυνατή η φόρτωση του προφίλ.${details}`)
      }

      const typedProfile = profile as ProfileRecord | null

      setDisplayName(typedProfile?.display_name ?? '')
      setUniversityName(typedProfile?.universities?.name ?? '')
      setSchoolName(typedProfile?.schools?.name ?? '')
      setIsVerifiedStudent(Boolean(typedProfile?.is_verified_student))

      const [listingsResult, wantedResult] = await Promise.all([
        supabase
          .from('listings')
          .select('id, title, created_at')
          .eq('seller_id', userData.user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('wanted_listings')
          .select('id, title, created_at')
          .eq('user_id', userData.user.id)
          .order('created_at', { ascending: false }),
      ])

      if (!isMounted) return

      if (listingsResult.error || wantedResult.error) {
        setErrorMessage('Δεν ήταν δυνατή η φόρτωση της δραστηριότητάς σου.')
      }

      setListings(listingsResult.data ?? [])
      setWantedListings(wantedResult.data ?? [])
      setIsLoading(false)
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [])


  const handleVerificationRequest = async () => {
    setVerificationError('')
    setVerificationSuccess('')
    setIsVerificationLoading(true)

    const { error } = await supabase.rpc(
      'request_university_verification',
      { p_university_email: universityEmail },
    )

    if (error) {
      setVerificationError(error.message)
      setIsVerificationLoading(false)
      return
    }

    setVerificationSuccess(
      'Σου στείλαμε email επιβεβαίωσης. Έλεγξε το inbox σου.',
    )
    setIsVerificationLoading(false)
  }

  const name = displayName || email
  const metaParts = [universityName, schoolName].filter((value) =>
    value.trim(),
  )
  const metaLine = metaParts.join(' / ')

  if (isLoading) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">Φόρτωση προφίλ...</h1>
        <p className="text-sm text-slate-600">
          Ετοιμάζουμε τα στοιχεία και τη δραστηριότητά σου.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold flex flex-wrap items-center gap-2">
            <span className="break-all">{name || 'Χρήστης'}</span>
            <span
              className={`inline-flex h-5 w-5 items-center justify-center border border-slate-300/70 bg-transparent text-[9px] font-semibold leading-none [clip-path:polygon(25%_6%,_75%_6%,_100%_50%,_75%_94%,_25%_94%,_0%_50%)] ${
                isVerifiedStudent ? 'text-purple-500' : 'text-red-500'
              }`}
              aria-hidden="true"
            >
              {isVerifiedStudent ? '✓' : 'pS'}
            </span>
          </h1>
          {metaLine ? (
            <p className="text-sm text-slate-600">{metaLine}</p>
          ) : null}
        </div>
        <Link
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          to="/profile/edit"
        >
          Επεξεργασία προφίλ
        </Link>
      </header>

      {errorMessage ? (
        <p className="text-sm text-rose-600">{errorMessage}</p>
      ) : null}

      {!isVerifiedStudent ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Pre-student προφίλ</p>
          <p className="mt-1 text-amber-800">
            Εφόσον αποκτήσεις φοιτητικό mail, επεξεργάσου το προφίλ σου και
            ανανέωσε το mail σου ώστε πλέον να γίνεται verified.
          </p>
        </div>
      ) : null}

      {!isVerifiedStudent ? (
        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
          <label className="block space-y-1 text-sm font-medium">
            University email
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              type="email"
              value={universityEmail}
              onChange={(event) => setUniversityEmail(event.target.value)}
            />
          </label>

          <button
            className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={handleVerificationRequest}
            disabled={isVerificationLoading}
          >
            {isVerificationLoading ? 'Verify...' : 'Verify'}
          </button>

          {verificationSuccess ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {verificationSuccess}
            </p>
          ) : null}

          {verificationError ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {verificationError}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-4">
        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Οι αγγελίες μου</h2>
          {listings.length > 0 ? (
            <ul className="space-y-2">
              {listings.map((listing) => (
                <li
                  key={listing.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="font-medium text-slate-900">
                    {listing.title}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatDate(listing.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">
              Δεν έχεις καταχωρίσει αγγελίες ακόμη.
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Οι ζητήσεις μου</h2>
          {wantedListings.length > 0 ? (
            <ul className="space-y-2">
              {wantedListings.map((wanted) => (
                <li
                  key={wanted.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="font-medium text-slate-900">
                    {wanted.title}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatDate(wanted.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">
              Δεν έχεις καταχωρίσει ζητήσεις ακόμη.
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Οι ομάδες μου</h2>
          <p className="text-sm text-slate-600">
            Σύντομα θα βλέπεις τις ομάδες που συμμετέχεις.
          </p>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Οι εκδηλώσεις μου</h2>
          <p className="text-sm text-slate-600">
            Σύντομα θα βλέπεις τις εκδηλώσεις που παρακολουθείς.
          </p>
        </section>
      </div>
    </section>
  )
}
