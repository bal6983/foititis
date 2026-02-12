import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

type ProfileData = {
  id: string
  display_name: string | null
  full_name: string | null
  email: string | null
  avatar_url: string | null
  is_verified_student: boolean
  is_pre_student: boolean
  university_id: string | null
  school_id: string | null
  city_id: string | null
  onboarding_completed: boolean
  followers_count: number
  following_count: number
}

type CurrentUserData = {
  userId: string
  profile: ProfileData
  universityName: string | null
  isVerified: boolean
  isPreStudent: boolean
}

type PostgrestErrorLike = {
  message?: string | null
  details?: string | null
  hint?: string | null
}

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

async function fetchCurrentUser(): Promise<CurrentUserData | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileWithSocialRes = await supabase
    .from('profiles')
    .select('id, display_name, full_name, email, avatar_url, is_verified_student, is_pre_student, university_id, school_id, city_id, onboarding_completed, followers_count, following_count')
    .eq('id', user.id)
    .maybeSingle()

  let profile = profileWithSocialRes.data as ProfileData | null
  if (profileWithSocialRes.error && hasMissingSchemaError(profileWithSocialRes.error)) {
    const profileLegacyRes = await supabase
      .from('profiles')
      .select('id, display_name, full_name, email, avatar_url, is_verified_student, is_pre_student, university_id, school_id, city_id, onboarding_completed')
      .eq('id', user.id)
      .maybeSingle()

    profile = profileLegacyRes.data
      ? ({
          ...profileLegacyRes.data,
          followers_count: 0,
          following_count: 0,
        } as ProfileData)
      : null
  }

  if (!profile) return null

  let universityName: string | null = null
  if (profile.university_id) {
    const { data: uni } = await supabase
      .from('universities')
      .select('name')
      .eq('id', profile.university_id)
      .maybeSingle()
    universityName = uni?.name ?? null
  }

  return {
    userId: user.id,
    profile: profile as ProfileData,
    universityName,
    isVerified: profile.is_verified_student ?? false,
    isPreStudent: profile.is_pre_student ?? false,
  }
}

export function useCurrentUser() {
  const query = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  })

  return {
    user: query.data,
    profile: query.data?.profile ?? null,
    userId: query.data?.userId ?? null,
    universityName: query.data?.universityName ?? null,
    isVerified: query.data?.isVerified ?? false,
    isPreStudent: query.data?.isPreStudent ?? false,
    isLoading: query.isLoading,
    refetch: query.refetch,
  }
}
