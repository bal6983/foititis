import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Avatar } from '../components/ui/Avatar'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabaseClient'

type ConversationMember = {
  conversation_id: string
  last_read_at?: string | null
}

type ConversationRow = {
  id: string
  last_message_at: string | null
}

type ConversationUser = {
  conversation_id: string
  user_id: string
}

type PeerProfile = {
  id: string
  display_name: string | null
  avatar_url: string | null
  last_seen_at: string | null
}

type MessageRow = {
  id: string
  conversation_id: string
  sender_id: string
  content: string | null
  image_url: string | null
  is_seen: boolean
  created_at: string
  optimistic?: boolean
}

type MessageReactionRow = {
  message_id: string
  user_id: string
}

type ReactionSummary = {
  count: number
  userReacted: boolean
}

type ConversationSummary = {
  id: string
  otherUserId: string
  title: string
  avatarUrl: string | null
  online: boolean
  lastMessage: string
  lastMessageAt: string
  unreadCount: number
}

type PostgrestErrorLike = {
  message?: string | null
  details?: string | null
  hint?: string | null
}

const ONLINE_WINDOW_MS = 8 * 60 * 1000
const CONVERSATION_BATCH = 12

const toTs = (value: string | null) => {
  if (!value) return 0
  const ts = new Date(value).getTime()
  return Number.isNaN(ts) ? 0 : ts
}

const compact = (value: string | null) => {
  const ts = toTs(value)
  if (!ts) return ''
  const mins = Math.max(1, Math.floor((Date.now() - ts) / 60000))
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

const snippet = (message?: MessageRow) => {
  if (!message) return 'No messages yet'
  if (message.content?.trim()) return message.content.trim()
  if (message.image_url) return 'Image'
  return 'New message'
}

const sortConversations = (rows: ConversationSummary[]) =>
  [...rows].sort((a, b) => toTs(b.lastMessageAt) - toTs(a.lastMessageAt))

const hasMissingSchemaError = (error: PostgrestErrorLike | null | undefined, token?: string) => {
  if (!error) return false
  const joined = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
  if (token && !joined.includes(token.toLowerCase())) return false
  return (
    joined.includes('does not exist') ||
    joined.includes('could not find the table') ||
    joined.includes('schema cache')
  )
}

export default function Chats() {
  const { t } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const [currentUserId, setCurrentUserId] = useState('')
  const [currentUserName, setCurrentUserName] = useState('')
  const [allConversations, setAllConversations] = useState<ConversationSummary[]>([])
  const [conversationLimit, setConversationLimit] = useState(CONVERSATION_BATCH)
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [conversationError, setConversationError] = useState('')
  const [supportsLastReadAt, setSupportsLastReadAt] = useState(true)

  const [messageLimit, setMessageLimit] = useState(30)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [messageError, setMessageError] = useState('')

  const [messageInput, setMessageInput] = useState('')
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [composerError, setComposerError] = useState('')
  const [isSending, setIsSending] = useState(false)

  const [messageReactions, setMessageReactions] = useState<Record<string, ReactionSummary>>({})
  const [typingLabel, setTypingLabel] = useState('')
  const [supportsMessageImages, setSupportsMessageImages] = useState(true)

  const selectedConversationId = searchParams.get('c') ?? ''

  const typingStopTimeoutRef = useRef<number | null>(null)
  const typingHideTimeoutRef = useRef<number | null>(null)
  const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const visibleConversations = useMemo(
    () => allConversations.slice(0, conversationLimit),
    [allConversations, conversationLimit],
  )

  const selectedConversation = useMemo(
    () => allConversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [allConversations, selectedConversationId],
  )

  const unreadTotal = useMemo(
    () => allConversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0),
    [allConversations],
  )

  const onlineConversations = useMemo(
    () => allConversations.filter((conversation) => conversation.online).length,
    [allConversations],
  )

  const loadConversations = useCallback(async () => {
    setIsLoadingConversations(true)
    setConversationError('')

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      const details = authError?.message ? ` (${authError.message})` : ''
      setConversationError(`Unable to load conversations${details}.`)
      setIsLoadingConversations(false)
      return
    }

    const userId = authData.user.id
    setCurrentUserId(userId)

    const { data: me } = await supabase
      .from('profiles')
      .select('display_name, full_name')
      .eq('id', userId)
      .maybeSingle()
    setCurrentUserName(
      me?.display_name || me?.full_name || authData.user.email || t({ en: 'Student', el: 'Φοιτητης' }),
    )

    await supabase
      .from('profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', userId)

    const memberWithReadRes = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', userId)

    let members: ConversationMember[] = []
    let lastReadSupported = true

    if (memberWithReadRes.error && hasMissingSchemaError(memberWithReadRes.error, 'last_read_at')) {
      const memberLegacyRes = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId)

      if (memberLegacyRes.error) {
        const details = memberLegacyRes.error.message ? ` (${memberLegacyRes.error.message})` : ''
        setConversationError(`Unable to load conversations${details}.`)
        setIsLoadingConversations(false)
        return
      }

      lastReadSupported = false
      members = ((memberLegacyRes.data ?? []) as Array<{ conversation_id: string }>).map((member) => ({
        conversation_id: member.conversation_id,
        last_read_at: null,
      }))
    } else if (memberWithReadRes.error) {
      const details = memberWithReadRes.error.message ? ` (${memberWithReadRes.error.message})` : ''
      setConversationError(`Unable to load conversations${details}.`)
      setIsLoadingConversations(false)
      return
    } else {
      members = (memberWithReadRes.data ?? []) as ConversationMember[]
    }

    setSupportsLastReadAt(lastReadSupported)
    const conversationIds = members.map((item) => item.conversation_id)

    if (conversationIds.length === 0) {
      setAllConversations([])
      setIsLoadingConversations(false)
      return
    }

    const [conversationRes, participantsRes] = await Promise.all([
      supabase
        .from('conversations')
        .select('id, last_message_at')
        .in('id', conversationIds)
        .order('last_message_at', { ascending: false }),
      supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', conversationIds)
        .neq('user_id', userId),
    ])

    const conversationRows = (conversationRes.data ?? []) as ConversationRow[]
    const participantRows = (participantsRes.data ?? []) as ConversationUser[]

    const peerByConversation = new Map<string, string>()
    for (const row of participantRows) {
      if (!peerByConversation.has(row.conversation_id)) {
        peerByConversation.set(row.conversation_id, row.user_id)
      }
    }

    const peerIds = Array.from(new Set(Array.from(peerByConversation.values())))

    let peerMap = new Map<string, PeerProfile>()
    if (peerIds.length > 0) {
      const { data: peerData } = await supabase
        .from('public_profiles')
        .select('id, display_name, avatar_url, last_seen_at')
        .in('id', peerIds)

      peerMap = new Map(((peerData ?? []) as PeerProfile[]).map((peer) => [peer.id, peer]))
    }

    let imageSupport = supportsMessageImages
    if (imageSupport) {
      const probeRes = await supabase
        .from('messages')
        .select('id, image_url')
        .limit(1)

      if (probeRes.error && hasMissingSchemaError(probeRes.error, 'image_url')) {
        imageSupport = false
      }
    }
    setSupportsMessageImages(imageSupport)

    const selectColumns = imageSupport
      ? 'id, conversation_id, sender_id, content, image_url, is_seen, created_at'
      : 'id, conversation_id, sender_id, content, is_seen, created_at'

    const lastMessageByConversation = new Map<string, MessageRow>()
    await Promise.all(
      conversationRows.map(async (conversation) => {
        const { data: lastMessage } = await supabase
          .from('messages')
          .select(selectColumns)
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (lastMessage) {
          const typed = lastMessage as unknown as Omit<MessageRow, 'image_url'> & { image_url?: string | null }
          lastMessageByConversation.set(conversation.id, {
            ...typed,
            image_url: typed.image_url ?? null,
          })
        }
      }),
    )

    const unreadMap = new Map<string, number>()
    if (lastReadSupported) {
      await Promise.all(
        members.map(async (member) => {
          let query = supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', member.conversation_id)
            .neq('sender_id', userId)

          if (member.last_read_at) {
            query = query.gt('created_at', member.last_read_at)
          }

          const { count } = await query
          unreadMap.set(member.conversation_id, count ?? 0)
        }),
      )
    } else {
      members.forEach((member) => unreadMap.set(member.conversation_id, 0))
    }

    const summaries: ConversationSummary[] = conversationRows.map((conversation) => {
      const peerId = peerByConversation.get(conversation.id) ?? ''
      const peer = peerMap.get(peerId)
      const lastMessage = lastMessageByConversation.get(conversation.id)

      return {
        id: conversation.id,
        otherUserId: peerId,
        title: peer?.display_name?.trim() || t({ en: 'Student', el: 'Φοιτητης' }),
        avatarUrl: peer?.avatar_url ?? null,
        online: Boolean(peer?.last_seen_at && Date.now() - toTs(peer.last_seen_at) <= ONLINE_WINDOW_MS),
        lastMessage: snippet(lastMessage),
        lastMessageAt: conversation.last_message_at || lastMessage?.created_at || new Date().toISOString(),
        unreadCount: unreadMap.get(conversation.id) ?? 0,
      }
    })

    setAllConversations(sortConversations(summaries))
    setIsLoadingConversations(false)
  }, [supportsMessageImages, t])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadConversations()
    }, 0)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [loadConversations])

  useEffect(() => {
    if (!currentUserId) return

    const intervalId = window.setInterval(() => {
      supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', currentUserId)
    }, 60000)

    return () => window.clearInterval(intervalId)
  }, [currentUserId])

  useEffect(() => {
    if (!allConversations.length) return

    const current = searchParams.get('c')
    if (!current || !allConversations.some((conversation) => conversation.id === current)) {
      const next = new URLSearchParams(searchParams)
      next.set('c', allConversations[0].id)
      setSearchParams(next, { replace: true })
    }
  }, [allConversations, searchParams, setSearchParams])
  const loadMessages = useCallback(async () => {
    if (!selectedConversationId) {
      setMessages([])
      setMessageError('')
      return
    }

    setIsLoadingMessages(true)
    setMessageError('')

    const withImage = 'id, conversation_id, sender_id, content, image_url, is_seen, created_at'
    const withoutImage = 'id, conversation_id, sender_id, content, is_seen, created_at'
    let imageSupport = supportsMessageImages

    let messagesRes = await supabase
      .from('messages')
      .select(imageSupport ? withImage : withoutImage)
      .eq('conversation_id', selectedConversationId)
      .order('created_at', { ascending: false })
      .limit(messageLimit)

    if (messagesRes.error && imageSupport && hasMissingSchemaError(messagesRes.error, 'image_url')) {
      imageSupport = false
      setSupportsMessageImages(false)
      messagesRes = (await supabase
        .from('messages')
        .select(withoutImage)
        .eq('conversation_id', selectedConversationId)
        .order('created_at', { ascending: false })
        .limit(messageLimit)) as unknown as typeof messagesRes
    }

    if (messagesRes.error) {
      const details = messagesRes.error.message ? ` (${messagesRes.error.message})` : ''
      setMessageError(`Unable to load messages${details}.`)
      setIsLoadingMessages(false)
      return
    }

    const normalized = ((messagesRes.data ?? []) as unknown as Array<
      Omit<MessageRow, 'image_url'> & { image_url?: string | null }
    >).map((message) => ({
      ...message,
      image_url: message.image_url ?? null,
    }))

    setMessages(normalized.reverse())
    setIsLoadingMessages(false)
  }, [messageLimit, selectedConversationId, supportsMessageImages])

  const refreshReactions = useCallback(async () => {
    if (!currentUserId || messages.length === 0) {
      setMessageReactions({})
      return
    }

    const messageIds = messages.map((message) => message.id).filter((id) => !id.startsWith('temp-'))
    if (messageIds.length === 0) {
      setMessageReactions({})
      return
    }

    const { data: reactionData } = await supabase
      .from('message_reactions')
      .select('message_id, user_id')
      .eq('reaction_type', 'like')
      .in('message_id', messageIds)

    const summary: Record<string, ReactionSummary> = {}
    for (const row of (reactionData ?? []) as MessageReactionRow[]) {
      const existing = summary[row.message_id] ?? { count: 0, userReacted: false }
      summary[row.message_id] = {
        count: existing.count + 1,
        userReacted: existing.userReacted || row.user_id === currentUserId,
      }
    }

    setMessageReactions(summary)
  }, [currentUserId, messages])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setMessageLimit(30)
    }, 0)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [selectedConversationId])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadMessages()
    }, 0)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [loadMessages])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void refreshReactions()
    }, 0)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [refreshReactions])

  useEffect(() => {
    if (!selectedConversationId || !currentUserId) return

    const markSeen = async () => {
      await supabase
        .from('messages')
        .update({ is_seen: true })
        .eq('conversation_id', selectedConversationId)
        .neq('sender_id', currentUserId)
        .eq('is_seen', false)

      if (supportsLastReadAt) {
        await supabase
          .from('conversation_participants')
          .update({ last_read_at: new Date().toISOString() })
          .eq('conversation_id', selectedConversationId)
          .eq('user_id', currentUserId)
      }

      setAllConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === selectedConversationId
            ? { ...conversation, unreadCount: 0 }
            : conversation,
        ),
      )
    }

    markSeen()
  }, [selectedConversationId, currentUserId, messages.length, supportsLastReadAt])

  useEffect(() => {
    if (!selectedConversationId) return

    const channel = supabase
      .channel(`chat:${selectedConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as MessageRow

          setMessages((previous) => {
            if (previous.some((message) => message.id === newMessage.id)) return previous

            const withoutOptimistic = previous.filter((message) => {
              if (!message.optimistic) return true
              if (message.sender_id !== newMessage.sender_id) return true
              if ((message.content ?? '') !== (newMessage.content ?? '')) return true
              return (message.image_url ?? '') !== (newMessage.image_url ?? '')
            })

            return [...withoutOptimistic, newMessage]
          })

          setAllConversations((previous) =>
            sortConversations(
              previous.map((conversation) => {
                if (conversation.id !== selectedConversationId) return conversation
                return {
                  ...conversation,
                  lastMessage: snippet(newMessage),
                  lastMessageAt: newMessage.created_at,
                  unreadCount:
                    newMessage.sender_id === currentUserId ? 0 : conversation.unreadCount + 1,
                }
              }),
            ),
          )
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as MessageRow
          setMessages((previous) =>
            previous.map((message) =>
              message.id === updatedMessage.id
                ? { ...message, is_seen: updatedMessage.is_seen }
                : message,
            ),
          )
        },
      )
      .on('broadcast', { event: 'typing' }, (event) => {
        const payload = event.payload as {
          conversationId?: string
          userId?: string
          name?: string
          isTyping?: boolean
        }

        if (
          payload.conversationId !== selectedConversationId ||
          !payload.userId ||
          payload.userId === currentUserId
        ) {
          return
        }

        if (!payload.isTyping) {
          setTypingLabel('')
          return
        }

        const name = payload.name || t({ en: 'Student', el: 'Φοιτητης' })
        setTypingLabel(`${name} is typing...`)

        if (typingHideTimeoutRef.current) {
          window.clearTimeout(typingHideTimeoutRef.current)
        }

        typingHideTimeoutRef.current = window.setTimeout(() => setTypingLabel(''), 1500)
      })
      .subscribe()

    chatChannelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      chatChannelRef.current = null
      setTypingLabel('')
    }
  }, [selectedConversationId, currentUserId, t])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!chatChannelRef.current || !selectedConversationId || !currentUserId) return

      chatChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          conversationId: selectedConversationId,
          userId: currentUserId,
          name: currentUserName || t({ en: 'Student', el: 'Φοιτητης' }),
          isTyping,
        },
      })
    },
    [currentUserId, currentUserName, selectedConversationId, t],
  )

  const onInputChange = (value: string) => {
    setMessageInput(value)
    sendTyping(true)

    if (typingStopTimeoutRef.current) {
      window.clearTimeout(typingStopTimeoutRef.current)
    }

    typingStopTimeoutRef.current = window.setTimeout(() => sendTyping(false), 900)
  }

  const openConversation = (conversationId: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('c', conversationId)
    setSearchParams(next, { replace: true })
  }

  const onImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!supportsMessageImages) {
      setComposerError('Image uploads are unavailable until chat migration is applied.')
      return
    }

    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    if (file.size > 1500000) {
      setComposerError('Image must be smaller than 1.5MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const data = typeof reader.result === 'string' ? reader.result : null
      if (!data) return
      setComposerError('')
      setSelectedImage(data)
    }

    reader.readAsDataURL(file)
  }
  const onSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedConversationId || !currentUserId) {
      setComposerError('Select a conversation first.')
      return
    }

    const text = messageInput.trim()
    if (!text && !selectedImage) return
    if (selectedImage && !supportsMessageImages) {
      setComposerError('Image uploads are unavailable until chat migration is applied.')
      return
    }

    setIsSending(true)
    setComposerError('')

    const optimisticId = `temp-${Date.now()}`
    const optimisticMessage: MessageRow = {
      id: optimisticId,
      conversation_id: selectedConversationId,
      sender_id: currentUserId,
      content: text || null,
      image_url: supportsMessageImages ? selectedImage : null,
      is_seen: false,
      created_at: new Date().toISOString(),
      optimistic: true,
    }

    setMessages((previous) => [...previous, optimisticMessage])
    setMessageInput('')
    setSelectedImage(null)
    sendTyping(false)

    const insertPayload: {
      conversation_id: string
      sender_id: string
      content: string | null
      image_url?: string | null
    } = {
      conversation_id: selectedConversationId,
      sender_id: currentUserId,
      content: optimisticMessage.content,
    }
    if (supportsMessageImages) {
      insertPayload.image_url = optimisticMessage.image_url
    }

    const withImage = 'id, conversation_id, sender_id, content, image_url, is_seen, created_at'
    const withoutImage = 'id, conversation_id, sender_id, content, is_seen, created_at'

    let insertedRes = await supabase
      .from('messages')
      .insert(insertPayload)
      .select(supportsMessageImages ? withImage : withoutImage)
      .single()

    if (
      insertedRes.error &&
      supportsMessageImages &&
      hasMissingSchemaError(insertedRes.error, 'image_url')
    ) {
      setSupportsMessageImages(false)
      insertedRes = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversationId,
          sender_id: currentUserId,
          content: optimisticMessage.content,
        })
        .select(withoutImage)
        .single()
    }

    if (insertedRes.error || !insertedRes.data) {
      setMessages((previous) => previous.filter((message) => message.id !== optimisticId))
      const details = insertedRes.error?.message ? ` (${insertedRes.error.message})` : ''
      setComposerError(`Unable to send${details}.`)
      setIsSending(false)
      return
    }

    const typedResult = insertedRes.data as unknown as Omit<MessageRow, 'image_url'> & { image_url?: string | null }
    const typedMessage: MessageRow = {
      ...typedResult,
      image_url: typedResult.image_url ?? null,
    }
    setMessages((previous) =>
      previous.map((message) => (message.id === optimisticId ? typedMessage : message)),
    )

    setAllConversations((previous) =>
      sortConversations(
        previous.map((conversation) =>
          conversation.id === selectedConversationId
            ? {
                ...conversation,
                lastMessage: snippet(typedMessage),
                lastMessageAt: typedMessage.created_at,
                unreadCount: 0,
              }
            : conversation,
        ),
      ),
    )

    setIsSending(false)
  }

  const onToggleReaction = async (messageId: string) => {
    if (!currentUserId || messageId.startsWith('temp-')) return

    const current = messageReactions[messageId] ?? { count: 0, userReacted: false }
    const nextReacted = !current.userReacted

    setMessageReactions((previous) => ({
      ...previous,
      [messageId]: {
        count: Math.max(0, current.count + (nextReacted ? 1 : -1)),
        userReacted: nextReacted,
      },
    }))

    if (nextReacted) {
      const { error } = await supabase.from('message_reactions').insert({
        message_id: messageId,
        user_id: currentUserId,
        reaction_type: 'like',
      })

      if (error) refreshReactions()
      return
    }

    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', currentUserId)
      .eq('reaction_type', 'like')

    if (error) refreshReactions()
  }

  if (isLoadingConversations) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t({ en: 'Messages', el: 'Μηνυματα' })}</h1>
        <p className="text-sm text-[var(--text-secondary)]">{t({ en: 'Loading chats...', el: 'Φορτωση συνομιλιων...' })}</p>
      </section>
    )
  }

  if (conversationError) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t({ en: 'Messages', el: 'Μηνυματα' })}</h1>
        <p className="rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{conversationError}</p>
      </section>
    )
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="social-card overflow-hidden">
        <header className="border-b border-[var(--border-primary)] bg-gradient-to-r from-cyan-500/10 via-transparent to-blue-500/10 p-4">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t({ en: 'Messages', el: 'Μηνυματα' })}</h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{t({ en: 'Your conversations', el: 'Οι συνομιλιες σου' })}</p>
        </header>
        {!supportsLastReadAt ? (
          <p className="border-b border-[var(--border-primary)] bg-cyan-500/10 px-4 py-2 text-[11px] text-cyan-100">
            {t({
              en: 'Legacy mode: unread counters are disabled until chat migration is applied.',
              el: 'Legacy mode: τα unread counters ειναι απενεργοποιημενα μεχρι να εφαρμοστει το chat migration.',
            })}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2 border-b border-[var(--border-primary)] px-3 py-3">
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] px-2.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              {t({ en: 'Unread', el: 'Unread' })}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">{unreadTotal}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] px-2.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              {t({ en: 'Online', el: 'Online' })}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">{onlineConversations}</p>
          </div>
        </div>

        {allConversations.length === 0 ? (
          <p className="p-4 text-sm text-[var(--text-secondary)]">{t({ en: 'No conversations yet.', el: 'Δεν υπαρχουν συνομιλιες ακομα.' })}</p>
        ) : (
          <>
            <ul className="max-h-[68vh] space-y-1 overflow-y-auto p-2">
              {visibleConversations.map((conversation) => {
                const active = conversation.id === selectedConversationId
                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => openConversation(conversation.id)}
                      className={`w-full rounded-xl border px-2 py-2 text-left transition ${
                        active
                          ? 'border-cyan-300/35 bg-gradient-to-r from-cyan-500/20 to-blue-500/15'
                          : 'border-transparent hover:border-[var(--border-primary)] hover:bg-[var(--surface-soft)]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar name={conversation.title} url={conversation.avatarUrl} size="md" online={conversation.online} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{conversation.title}</p>
                            <span className="text-[11px] text-[var(--text-secondary)]">{compact(conversation.lastMessageAt)}</span>
                          </div>
                          <p className="truncate text-xs text-[var(--text-secondary)]">{conversation.lastMessage}</p>
                        </div>
                        {conversation.unreadCount > 0 ? (
                          <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-semibold text-slate-950">{conversation.unreadCount}</span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>

            {allConversations.length > visibleConversations.length ? (
              <div className="border-t border-[var(--border-primary)] p-2">
                <button
                  type="button"
                  onClick={() => setConversationLimit((previous) => previous + CONVERSATION_BATCH)}
                  className="w-full rounded-xl border border-[var(--border-primary)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]"
                >
                  {t({ en: 'Load older conversations', el: 'Φορτωσε παλιοτερες συνομιλιες' })}
                </button>
              </div>
            ) : null}
          </>
        )}
      </aside>

      <section className="social-card flex min-h-[70vh] flex-col overflow-hidden">
        {selectedConversation ? (
          <>
            <header className="border-b border-[var(--border-primary)] bg-gradient-to-r from-blue-500/10 via-transparent to-cyan-400/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <Avatar name={selectedConversation.title} url={selectedConversation.avatarUrl} size="md" online={selectedConversation.online} showRing />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{selectedConversation.title}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{selectedConversation.online ? t({ en: 'Online now', el: 'Online τωρα' }) : t({ en: 'Offline', el: 'Offline' })}</p>
                </div>
              </div>
            </header>

            <div className="chat-surface flex-1 overflow-y-auto px-3 py-3">
              {isLoadingMessages ? <p className="text-sm text-[var(--text-secondary)]">{t({ en: 'Loading messages...', el: 'Φορτωση μηνυματων...' })}</p> : null}
              {messageError ? <p className="rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{messageError}</p> : null}

              {!isLoadingMessages && messages.length >= messageLimit ? (
                <button
                  type="button"
                  onClick={() => setMessageLimit((previous) => previous + 20)}
                  className="mb-3 rounded-full border border-[var(--border-primary)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]"
                >
                  {t({ en: 'Load older messages', el: 'Φορτωσε παλιοτερα μηνυματα' })}
                </button>
              ) : null}

              <div className="space-y-3">
                {messages.map((message) => {
                  const mine = message.sender_id === currentUserId
                  const reaction = messageReactions[message.id] ?? { count: 0, userReacted: false }

                  return (
                    <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[78%] rounded-[1.25rem] px-3 py-2 shadow-[0_10px_24px_rgba(7,19,43,0.18)] ${mine ? 'bg-gradient-to-r from-blue-500/90 to-cyan-400/90 text-slate-950' : 'border border-[var(--border-primary)] bg-[var(--surface-soft)] text-[var(--text-primary)]'}`}>
                        {message.content ? <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p> : null}
                        {message.image_url ? <img src={message.image_url} alt="Shared" className="mt-2 max-h-64 w-full rounded-xl object-cover" /> : null}

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onToggleReaction(message.id)}
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${reaction.userReacted ? 'bg-slate-950/15' : 'border border-[var(--border-primary)]'}`}
                            >
                              {`${t({ en: 'Like', el: 'Like' })}${reaction.count > 0 ? ` (${reaction.count})` : ''}`}
                            </button>
                            <span className="text-[10px] opacity-70">{compact(message.created_at)}</span>
                          </div>
                          {mine ? <span className="text-[10px] opacity-80">{message.is_seen ? t({ en: 'Seen', el: 'Seen' }) : t({ en: 'Delivered', el: 'Delivered' })}</span> : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div ref={messagesEndRef} />
            </div>

            <footer className="border-t border-[var(--border-primary)] p-3">
              {typingLabel ? <p className="mb-2 text-xs text-[var(--text-secondary)]">{typingLabel}</p> : null}

              {selectedImage ? (
                <div className="mb-2 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] p-2">
                  <img src={selectedImage} alt={t({ en: 'Selected', el: 'Επιλεγμενο' })} className="max-h-40 rounded-lg object-cover" />
                  <button type="button" onClick={() => setSelectedImage(null)} className="mt-2 rounded-full border border-[var(--border-primary)] px-2 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                    {t({ en: 'Remove image', el: 'Αφαιρεση εικονας' })}
                  </button>
                </div>
              ) : null}

              <form onSubmit={onSend} className="space-y-2">
                {!supportsMessageImages ? (
                  <p className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
                    {t({
                      en: 'Images are temporarily disabled until chat migrations are applied.',
                      el: 'Οι εικονες ειναι προσωρινα απενεργοποιημενες μεχρι να εφαρμοστουν τα chat migrations.',
                    })}
                  </p>
                ) : null}
                <div className="flex items-center gap-2">
                  {supportsMessageImages ? (
                    <label className="rounded-xl border border-[var(--border-primary)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">
                      {t({ en: 'Image', el: 'Εικονα' })}
                      <input type="file" accept="image/*" className="hidden" onChange={onImageChange} />
                    </label>
                  ) : null}

                  <input
                    type="text"
                    value={messageInput}
                    onChange={(event) => onInputChange(event.target.value)}
                    placeholder={t({ en: 'Write a message...', el: 'Γραψε μηνυμα...' })}
                    className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />

                  <button
                    type="submit"
                    disabled={isSending || (!messageInput.trim() && !selectedImage)}
                    className="rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-60"
                  >
                    {isSending
                      ? t({ en: 'Sending...', el: 'Αποστολη...' })
                      : t({ en: 'Send', el: 'Αποστολη' })}
                  </button>
                </div>

                {composerError ? <p className="text-xs text-rose-300">{composerError}</p> : null}
              </form>
            </footer>
          </>
        ) : (
          <div className="grid flex-1 place-items-center px-4">
            <p className="text-sm text-[var(--text-secondary)]">{t({ en: 'Select a conversation to start chatting.', el: 'Επιλεξε συνομιλια για να ξεκινησεις chat.' })}</p>
          </div>
        )}
      </section>
    </section>
  )
}
