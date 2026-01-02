# Foititis Web

Developer guide for the web app in `apps/web`.

## Requirements
- Node.js LTS (20+)
- pnpm 10.x

## Setup
1. Install dependencies: `pnpm install`
2. Create `apps/web/.env.local` with:
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key

## Development
- `pnpm dev` (from repo root)
- or `pnpm -C apps/web dev`

## Useful scripts
- `pnpm build`
- `pnpm preview`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm format`

## Structure
- `apps/web/src/pages`: route-level pages
- `apps/web/src/components`: shared UI
- `apps/web/src/lib/supabaseClient.ts`: Supabase client configuration

## Marketplace behavior
- Listing creation is restricted to verified students (enforced by Supabase/RLS).
- Listing detail contact CTA is visible to all authenticated users.
- Verification states: idle, pending, approved, rejected.

## Future scope (not implemented)
- Keyword search for Marketplace
- "Looking for" listings