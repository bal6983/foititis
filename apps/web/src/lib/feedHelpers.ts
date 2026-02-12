import type { LocalizedMessage } from './i18n'

export type PostType = 'listing_created' | 'wanted_created' | 'general' | 'badge_earned'

const postTypeLabels: Record<PostType, LocalizedMessage> = {
  listing_created: { en: 'listed a new item', el: 'ανέβασε νέα αγγελία' },
  wanted_created: { en: 'is looking for something', el: 'αναζητά κάτι' },
  badge_earned: { en: 'earned a new badge', el: 'κέρδισε νέο badge' },
  general: { en: 'shared an update', el: 'μοιράστηκε μια ενημέρωση' },
}

export function getPostTypeLabel(postType: string): LocalizedMessage {
  return postTypeLabels[postType as PostType] ?? postTypeLabels.general
}

export type FeedPostData = {
  id: string
  author_id: string
  content: string | null
  post_type: string
  related_listing_id: string | null
  related_wanted_listing_id: string | null
  visibility: string
  reactions_count: number
  comments_count: number
  created_at: string
  author_name: string | null
  author_avatar: string | null
  author_university_id: string | null
  author_is_verified: boolean
  author_is_pre_student: boolean
  user_has_reacted: boolean
}

export type FeedFilter = 'all' | 'following' | 'university'

export const feedFilterLabels: Record<FeedFilter, LocalizedMessage> = {
  all: { en: 'All', el: 'Όλα' },
  following: { en: 'Following', el: 'Ακολουθώ' },
  university: { en: 'University', el: 'Πανεπιστήμιο' },
}
