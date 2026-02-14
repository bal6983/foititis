export type MarketplaceType = 'sell' | 'want'

export type UnifiedMarketplaceItem = {
  id: string
  ownerId: string
  type: MarketplaceType
  title: string
  description: string
  category: string
  condition: string
  price: string | null
  universityName: string
  sellerName: string
  sellerLevel: number
  sellerVerified: boolean
  createdAt: string
  isSaved?: boolean
}

export type CreateMarketplaceItemInput = {
  type: MarketplaceType
  title: string
  description: string
  categoryId: string
  conditionRating: number | null
  price: string | null
  universityName: string
  images?: File[]
}
