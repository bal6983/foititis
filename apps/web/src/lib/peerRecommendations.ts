export type RecommendationContext = {
  universityId: string | null
  schoolId: string | null
  departmentId: string | null
  cityId: string | null
  studyYear: number | null
}

export type RecommendationCandidate = {
  university_id: string | null
  school_id: string | null
  department_id: string | null
  city_id: string | null
  study_year: number | null
  is_verified_student: boolean | null
  is_pre_student: boolean | null
  followers_count: number | null
}

export const isVerifiedCampusMember = (candidate: RecommendationCandidate) =>
  candidate.is_verified_student === true && candidate.is_pre_student !== true

export const recommendationScore = (
  candidate: RecommendationCandidate,
  context: RecommendationContext,
) => {
  let score = 0

  if (isVerifiedCampusMember(candidate)) score += 6
  if (candidate.followers_count) score += Math.min(6, Math.floor(candidate.followers_count / 20))

  if (context.universityId && candidate.university_id === context.universityId) score += 36
  if (context.schoolId && candidate.school_id === context.schoolId) score += 42
  if (context.departmentId && candidate.department_id === context.departmentId) score += 56
  if (context.cityId && candidate.city_id === context.cityId) score += 20
  if (context.studyYear !== null && candidate.study_year === context.studyYear) score += 10

  return score
}

export const sortByRecommendation = <T extends RecommendationCandidate>(
  peers: T[],
  context: RecommendationContext,
) =>
  [...peers].sort((a, b) => {
    const aScore = recommendationScore(a, context)
    const bScore = recommendationScore(b, context)
    if (aScore !== bScore) return bScore - aScore

    const aVerified = isVerifiedCampusMember(a)
    const bVerified = isVerifiedCampusMember(b)
    if (aVerified !== bVerified) return aVerified ? -1 : 1

    return (b.followers_count ?? 0) - (a.followers_count ?? 0)
  })
