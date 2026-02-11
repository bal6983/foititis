import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n, type LocalizedMessage } from '../lib/i18n'
import { supabase } from '../lib/supabaseClient'

type ConversationRow = {
  id: string
  last_message_at: string | null
}

type ParticipantRow = {
  conversation_id: string
  user_id: string
}

type LastMessageRow = {
  conversation_id: string
  content: string | null
  created_at: string
}

type ProfileSummary = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

type ConversationSummary = {
  id: string
  title: string
  avatarUrl: string
  lastMessage: string
  lastMessageAt: string
}

const getAvatarInitial = (value: string) =>
  value.trim().charAt(0).toUpperCase() || '-'

const getTimestamp = (value: string) => {
  if (!value) {
    return 0
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

export default function Chats() {
  const { t, formatDateTime } = useI18n()
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<LocalizedMessage | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadInbox = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (!isMounted) return

      if (userError || !userData.user) {
        console.error('Auth error while loading chats:', userError)
        setErrorMessage({
          en: 'Unable to load conversations.',
          el: 'Δεν ήταν δυνατή η φόρτωση των συνομιλιών.',
        })
        setIsLoading(false)
        return
      }

      const currentUserId = userData.user.id

      const { data: participantRows, error: participantsError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', currentUserId)

      if (!isMounted) return

      if (participantsError) {
        console.error(
          'Conversation participants error:',
          participantsError,
        )
        setErrorMessage({
          en: 'Unable to load conversations.',
          el: 'Δεν ήταν δυνατή η φόρτωση των συνομιλιών.',
        })
        setIsLoading(false)
        return
      }

      const conversationIds =
        participantRows?.map((row) => row.conversation_id) ?? []

      if (conversationIds.length === 0) {
        setConversations([])
        setIsLoading(false)
        return
      }

      const { data: conversationsData, error: conversationsError } =
        await supabase
          .from('conversations')
          .select('id, last_message_at')
          .in('id', conversationIds)
          .order('last_message_at', { ascending: false })

      if (!isMounted) return

      if (conversationsError) {
        console.error('Conversations query error:', conversationsError)
      }

      const resolvedConversations: ConversationRow[] =
        (conversationsData as ConversationRow[] | null) ??
        conversationIds.map((id) => ({ id, last_message_at: null }))

      const { data: otherParticipants, error: otherParticipantsError } =
        await supabase
          .from('conversation_participants')
          .select('conversation_id, user_id')
          .in('conversation_id', conversationIds)
          .neq('user_id', currentUserId)

      if (!isMounted) return

      if (otherParticipantsError) {
        console.error(
          'Other participants query error:',
          otherParticipantsError,
        )
      }

      const otherByConversation = new Map<string, string>()
      ;(otherParticipants as ParticipantRow[] | null)?.forEach((row) => {
        if (!otherByConversation.has(row.conversation_id)) {
          otherByConversation.set(row.conversation_id, row.user_id)
        }
      })

      const otherUserIds = Array.from(
        new Set(Array.from(otherByConversation.values())),
      )

      let profilesById: Record<string, ProfileSummary> = {}
      if (otherUserIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('public_profiles')
          .select('id, display_name, avatar_url')
          .in('id', otherUserIds)

        if (!isMounted) return

        if (profilesError) {
          console.error('Public profiles query error:', profilesError)
        } else {
          profilesData?.forEach((profile) => {
            profilesById[profile.id] = profile
          })
        }
      }

      const lastMessageByConversation = new Map<string, LastMessageRow>()
      await Promise.all(
        resolvedConversations.map(async (conversation) => {
          const { data: lastMessage, error: lastMessageError } =
            await supabase
              .from('messages')
              .select('conversation_id, content, created_at')
              .eq('conversation_id', conversation.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

          if (lastMessageError) {
            console.error(
              `Last message query error (${conversation.id}):`,
              lastMessageError,
            )
            return
          }

          if (lastMessage) {
            lastMessageByConversation.set(conversation.id, lastMessage)
          }
        }),
      )

      if (!isMounted) return

      const summaries = resolvedConversations
        .map((conversation) => {
          const lastMessage = lastMessageByConversation.get(conversation.id)
          const otherUserId = otherByConversation.get(conversation.id) ?? ''
          const otherProfile = profilesById[otherUserId]
          const title =
            otherProfile?.display_name?.trim() || t({ en: 'User', el: 'Χρήστης' })
          const avatarUrl = otherProfile?.avatar_url ?? ''
          const lastMessageAt =
            conversation.last_message_at ?? lastMessage?.created_at ?? ''
          const lastMessageText =
            lastMessage?.content?.trim() || t({ en: 'No message', el: 'Χωρίς μήνυμα' })

          return {
            id: conversation.id,
            title,
            avatarUrl,
            lastMessage: lastMessageText,
            lastMessageAt,
          }
        })
        .sort(
          (a, b) => getTimestamp(b.lastMessageAt) - getTimestamp(a.lastMessageAt),
        )

      setConversations(summaries)
      setIsLoading(false)
    }

    loadInbox()

    return () => {
      isMounted = false
    }
  }, [t])

  if (isLoading) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">{t({ en: 'Chats', el: 'Συνομιλίες' })}</h1>
        <p className="text-sm text-slate-600">
          {t({ en: 'Loading conversations...', el: 'Φορτώνουμε τις συνομιλίες...' })}
        </p>
      </section>
    )
  }

  if (errorMessage) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">{t({ en: 'Chats', el: 'Συνομιλίες' })}</h1>
        <p className="text-sm text-rose-600">{t(errorMessage)}</p>
      </section>
    )
  }

  if (conversations.length === 0) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">{t({ en: 'Chats', el: 'Συνομιλίες' })}</h1>
        <p className="text-sm text-slate-600">
          {t({ en: 'No conversations yet.', el: 'Δεν υπάρχουν συνομιλίες ακόμη.' })}
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">{t({ en: 'Chats', el: 'Συνομιλίες' })}</h1>
      <div className="space-y-3">
        {conversations.map((conversation) => {
          const initials = getAvatarInitial(conversation.title || '-')
          const formattedDate = conversation.lastMessageAt
            ? formatDateTime(conversation.lastMessageAt)
            : ''

          return (
            <Link
              key={conversation.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 hover:bg-slate-50"
              to={`/chat/${conversation.id}`}
            >
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                <span className="absolute inset-0 flex items-center justify-center">
                  {initials}
                </span>
                {conversation.avatarUrl ? (
                  <img
                    alt={conversation.title}
                    className="relative h-10 w-10 rounded-full object-cover"
                    src={conversation.avatarUrl}
                    onError={(event) => {
                      event.currentTarget.style.display = 'none'
                    }}
                  />
                ) : null}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {conversation.title}
                  </p>
                  {formattedDate ? (
                    <span className="text-xs text-slate-500">
                      {formattedDate}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-slate-600">
                  {conversation.lastMessage}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
