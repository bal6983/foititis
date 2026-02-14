import type { Locale, LocalizedMessage } from '../../lib/i18n'

export type BadgeCategory = 'academic' | 'community' | 'marketplace'
export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'cyan'

export type BadgeItem = {
  id: string
  title: string
  description: string
  category: BadgeCategory
  tier: BadgeTier
  icon: string
}

type LocalizedBadgeItem = Omit<BadgeItem, 'title' | 'description'> & {
  title: LocalizedMessage
  description: LocalizedMessage
}

export type LevelInfo = {
  level: number
  title: string
  currentXp: number
  nextLevelXp: number
  progressPercent: number
}

const resolveMessage = (locale: Locale, message: LocalizedMessage) =>
  message[locale] ?? message.en

const levelTitles: Array<{ min: number; title: LocalizedMessage }> = [
  { min: 30, title: { en: 'Campus Legend', el: 'Θρύλος Πανεπιστημίου' } },
  { min: 20, title: { en: 'Campus Pro', el: 'Campus Pro' } },
  { min: 10, title: { en: 'Campus Insider', el: 'Campus Insider' } },
  { min: 5, title: { en: 'Active Student', el: 'Ενεργός Φοιτητής' } },
  { min: 1, title: { en: 'Freshman', el: 'Πρωτοετής' } },
]

const xpForLevel = (level: number) => level * 150

const badgeDefinitions: LocalizedBadgeItem[] = [
  {
    id: 'notes-master',
    title: { en: 'Notes Master', el: 'Δάσκαλος Σημειώσεων' },
    description: {
      en: 'Consistent note-sharing and organized materials.',
      el: 'Συνεπής διαμοιρασμός σημειώσεων και οργανωμένο υλικό.',
    },
    category: 'academic',
    tier: 'silver',
    icon: 'π“',
  },
  {
    id: 'problem-solver',
    title: { en: 'Problem Solver', el: 'Επίλυση Προβλημάτων' },
    description: {
      en: 'Helpful solutions across university courses.',
      el: 'Χρήσιμες λύσεις σε πανεπιστημιακά μαθήματα.',
    },
    category: 'academic',
    tier: 'gold',
    icon: 'π§ ',
  },
  {
    id: 'senior-student',
    title: { en: 'Senior Student', el: 'Ανώτερος Φοιτητής' },
    description: {
      en: 'Advanced academic consistency and attendance.',
      el: 'Προχωρημένη συνέπεια και παρουσία στις σπουδές.',
    },
    category: 'academic',
    tier: 'bronze',
    icon: 'π“',
  },
  {
    id: 'helpful-member',
    title: { en: 'Helpful Member', el: 'Υποστηρικτικό Μέλος' },
    description: {
      en: 'Strong participation in peer support.',
      el: 'Ισχυρή συμμετοχή στην υποστήριξη συμφοιτητών.',
    },
    category: 'community',
    tier: 'silver',
    icon: 'π¤',
  },
  {
    id: 'active-this-month',
    title: { en: 'Active This Month', el: 'Ενεργός Αυτόν τον Μήνα' },
    description: {
      en: 'Daily useful actions across the platform.',
      el: 'Καθημερινές χρήσιμες ενέργειες σε όλη την πλατφόρμα.',
    },
    category: 'community',
    tier: 'cyan',
    icon: 'β΅',
  },
  {
    id: 'verified-student',
    title: { en: 'Verified Student', el: 'Επαληθευμένος Φοιτητής' },
    description: {
      en: 'University email verified successfully.',
      el: 'Το πανεπιστημιακό email επαληθεύτηκε επιτυχώς.',
    },
    category: 'community',
    tier: 'gold',
    icon: 'β…',
  },
  {
    id: 'trusted-seller',
    title: { en: 'Trusted Seller', el: 'Έμπιστος Πωλητής' },
    description: {
      en: 'Reliable marketplace activity and response rate.',
      el: 'Αξιόπιστη δραστηριότητα και ανταπόκριση στο marketplace.',
    },
    category: 'marketplace',
    tier: 'silver',
    icon: 'π›οΈ',
  },
  {
    id: 'ten-trades',
    title: { en: '10 Successful Trades', el: '10 Επιτυχημένες Συναλλαγές' },
    description: {
      en: 'Completed ten successful marketplace trades.',
      el: 'Ολοκλήρωσε δέκα επιτυχημένες συναλλαγές.',
    },
    category: 'marketplace',
    tier: 'bronze',
    icon: 'π”',
  },
  {
    id: 'five-star-rated',
    title: { en: '5-Star Rated', el: 'Βαθμολογία 5 Αστέρων' },
    description: {
      en: 'Received excellent ratings from peers.',
      el: 'Έλαβε εξαιρετικές αξιολογήσεις από συμφοιτητές.',
    },
    category: 'marketplace',
    tier: 'gold',
    icon: 'β­',
  },
]

export const getBadges = (locale: Locale): BadgeItem[] =>
  badgeDefinitions.map((badge) => ({
    ...badge,
    title: resolveMessage(locale, badge.title),
    description: resolveMessage(locale, badge.description),
  }))

export const getLevelTitle = (locale: Locale, level: number) => {
  const match = levelTitles.find((item) => level >= item.min)
  const fallback = levelTitles[levelTitles.length - 1]
  return match
    ? resolveMessage(locale, match.title)
    : resolveMessage(locale, fallback.title)
}

export const getLevelInfo = (locale: Locale, totalXp: number): LevelInfo => {
  const safeXp = Math.max(0, totalXp)
  let level = 1

  while (safeXp >= xpForLevel(level + 1)) {
    level += 1
  }

  const currentXpFloor = xpForLevel(level)
  const nextLevelXp = xpForLevel(level + 1)
  const inLevelProgress = safeXp - currentXpFloor
  const levelSpan = Math.max(1, nextLevelXp - currentXpFloor)
  const progressPercent = Math.min(100, Math.max(0, (inLevelProgress / levelSpan) * 100))

  return {
    level,
    title: getLevelTitle(locale, level),
    currentXp: safeXp,
    nextLevelXp,
    progressPercent,
  }
}

export const tierClassMap: Record<BadgeTier, string> = {
  bronze: 'from-amber-700/30 to-amber-500/20 text-amber-100 border-amber-500/40',
  silver: 'from-slate-500/30 to-slate-300/20 text-slate-100 border-slate-300/40',
  gold: 'from-yellow-500/30 to-amber-300/20 text-yellow-50 border-yellow-300/40',
  cyan: 'from-cyan-500/30 to-sky-300/20 text-cyan-50 border-cyan-300/40',
}
