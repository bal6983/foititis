import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function AuthCallback() {
  const navigate = useNavigate()
  const hasExchangedRef = useRef(false)

  useEffect(() => {
    if (hasExchangedRef.current) return
    hasExchangedRef.current = true

    const exchange = async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href,
      )

      if (error) {
        navigate('/login', { replace: true })
        return
      }

      navigate('/dashboard', { replace: true })
    }

    void exchange()
  }, [navigate])

  return <p className="text-sm text-slate-600">Loading...</p>
}
