import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type MessageRecord = {
  id: string
  sender_id: string
  content: string | null
  created_at: string
  optimistic?: boolean
}

type ProfileSummary = {
  display_name: string | null
  avatar_url: string | null
}

const getAvatarInitial = (value: string) =>
  value.trim().charAt(0).toUpperCase() || '—'

export default function ChatThread() {
  const { conversationId } = useParams()
  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [profilesById, setProfilesById] = useState<
    Record<string, ProfileSummary>
  >({})
  const [currentUserId, setCurrentUserId] = useState('')
  const [messageInput, setMessageInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const isMountedRef = useRef(true)

  const loadThread = async () => {
    setIsLoading(true)
    setErrorMessage('')

    if (!conversationId) {
      setErrorMessage('Δεν βρέθηκε συνομιλία.')
      setIsLoading(false)
      return
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (!isMountedRef.current) return

    const resolvedUserId = !userError && userData.user ? userData.user.id : ''
    setCurrentUserId(resolvedUserId)

    const [{ data: messagesData, error: messagesError }, participantsResult] =
      await Promise.all([
        supabase
          .from('messages')
          .select('id, sender_id, content, created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true }),
        supabase
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', conversationId),
      ])

    if (!isMountedRef.current) return

    if (messagesError) {
      const details = messagesError.message
        ? ` (${messagesError.message})`
        : ''
      setErrorMessage(
        `Δεν ήταν δυνατή η φόρτωση των μηνυμάτων.${details}`,
      )
      setIsLoading(false)
      return
    }

    setMessages((messagesData as MessageRecord[]) ?? [])

    const participantIds =
      participantsResult.data?.map((participant) => participant.user_id) ?? []

    if (participantIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('public_profiles')
        .select('id, display_name, avatar_url')
        .in('id', participantIds)

      if (!isMountedRef.current) return

      const nextProfiles: Record<string, ProfileSummary> = {}
      profilesData?.forEach((profile) => {
        nextProfiles[profile.id] = {
          display_name: profile.display_name ?? null,
          avatar_url: profile.avatar_url ?? null,
        }
      })
      setProfilesById(nextProfiles)
    } else {
      setProfilesById({})
    }

    setIsLoading(false)
  }

  useEffect(() => {
    isMountedRef.current = true
    loadThread()

    return () => {
      isMountedRef.current = false
    }
  }, [conversationId])

  useEffect(() => {
    if (!conversationId || !currentUserId) {
      return
    }

    supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', currentUserId)
  }, [conversationId, currentUserId])

  useEffect(() => {
    if (!conversationId) {
      return
    }

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as MessageRecord
          setMessages((prev) => {
            if (prev.some((message) => message.id === newMessage.id)) {
              return prev
            }

            const nextMessages = prev.filter((message) => {
              if (!message.optimistic) {
                return true
              }
              if (message.sender_id !== newMessage.sender_id) {
                return true
              }
              if ((message.content ?? '') !== (newMessage.content ?? '')) {
                return true
              }
              const diff =
                Math.abs(
                  new Date(message.created_at).getTime() -
                    new Date(newMessage.created_at).getTime(),
                ) || 0
              return diff > 5000
            })

            return [...nextMessages, newMessage]
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedMessage = messageInput.trim()

    if (!trimmedMessage) {
      return
    }

    if (!conversationId) {
      setSendError('Δεν βρέθηκε συνομιλία.')
      return
    }

    setIsSending(true)
    setSendError('')

    let senderId = currentUserId

    if (!senderId) {
      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (userError || !userData.user) {
        setSendError('Δεν ήταν δυνατή η αποστολή.')
        setIsSending(false)
        return
      }

      senderId = userData.user.id
      setCurrentUserId(senderId)
    }

    const optimisticId = `temp-${Date.now()}`
    const optimisticMessage: MessageRecord = {
      id: optimisticId,
      sender_id: senderId,
      content: trimmedMessage,
      created_at: new Date().toISOString(),
      optimistic: true,
    }

    setMessages((prev) => [...prev, optimisticMessage])
    setMessageInput('')

    const { data: insertData, error: insertError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content: trimmedMessage,
      })
      .select('id, sender_id, content, created_at')
      .single()

    if (insertError) {
      setMessages((prev) => prev.filter((message) => message.id !== optimisticId))
      setSendError('Δεν ήταν δυνατή η αποστολή.')
      setIsSending(false)
      return
    }

    if (insertData) {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === optimisticId
            ? (insertData as MessageRecord)
            : message,
        ),
      )
    }

    setIsSending(false)
  }

  const renderAvatar = (profile: ProfileSummary | undefined) => {
    const displayName = profile?.display_name?.trim() || 'Χρήστης'
    const avatarUrl = profile?.avatar_url ?? ''
    const initials = getAvatarInitial(displayName)

    return (
      <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500">
        <span className="absolute inset-0 flex items-center justify-center">
          {initials}
        </span>
        {avatarUrl ? (
          <img
            alt={displayName}
            className="relative h-8 w-8 rounded-full object-cover"
            src={avatarUrl}
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
        ) : null}
      </div>
    )
  }

  if (isLoading) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">Συνομιλία</h1>
        <p className="text-sm text-slate-600">Φορτώνουμε τα μηνύματα...</p>
      </section>
    )
  }

  if (errorMessage) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">Συνομιλία</h1>
        <p className="text-sm text-rose-600">{errorMessage}</p>
      </section>
    )
  }

  const canSend = messageInput.trim().length > 0 && !isSending
  const messageComposer = (
    <form className="space-y-2" onSubmit={handleSendMessage}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          placeholder="Γράψε μήνυμα..."
          type="text"
          value={messageInput}
          onChange={(event) => setMessageInput(event.target.value)}
        />
        <button
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={!canSend}
        >
          {isSending ? 'Αποστολή...' : 'Αποστολή'}
        </button>
      </div>
      {sendError ? <p className="text-sm text-rose-600">{sendError}</p> : null}
    </form>
  )

  if (messages.length === 0) {
    return (
      <section className="space-y-4">
        <h1 className="text-xl font-semibold">Συνομιλία</h1>
        <p className="text-sm text-slate-600">
          Δεν υπάρχουν μηνύματα ακόμη
        </p>
        {messageComposer}
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Συνομιλία</h1>
      <div className="space-y-3">
        {messages.map((message) => {
          const isOwnMessage = message.sender_id === currentUserId
          const profile = profilesById[message.sender_id]
          const avatar = renderAvatar(profile)

          return (
            <div
              key={message.id}
              className={`flex items-end gap-2 ${
                isOwnMessage ? 'justify-end' : 'justify-start'
              }`}
            >
              {!isOwnMessage ? avatar : null}
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  isOwnMessage
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                {message.content || '—'}
              </div>
              {isOwnMessage ? avatar : null}
            </div>
          )
        })}
      </div>
      {messageComposer}
    </section>
  )
}
