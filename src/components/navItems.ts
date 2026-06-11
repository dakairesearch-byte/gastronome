import { Home, Compass, Bookmark, Users, ListChecks, type LucideIcon } from 'lucide-react'

/**
 * Single source of truth for the primary navigation spine, shared by the
 * desktop header (Navigation.tsx) and the mobile bottom bar (BottomNav.tsx)
 * so the two surfaces never drift apart.
 *
 * `/profile` is intentionally NOT in this list: it requires auth and bounces
 * anonymous users to /onboarding. Each surface appends it conditionally when
 * a user is signed in.
 *
 * The `/cities` PAGE was removed (city remains a filter on /discover via
 * ?city=), so it no longer appears here. Reformulation Wave 2 merged the old
 * Explore + Search surfaces into ONE `/discover` destination (List/Map/Grid
 * over a single filtered result set), so the spine now carries a single
 * Discover entry instead of the two parallel ones. Community stays.
 *
 * `/saved` (NV7) is a primary destination — the bookmarks/collections
 * surface backed by src/lib/collections.ts. It is intentionally public
 * (anonymous users get localStorage-backed favorites), so unlike /profile
 * it lives directly in the shared spine. With Home/Discover/Saved/Community
 * /Lists the spine fills the bottom bar's 5-tab budget exactly — do NOT add
 * a sixth entry without removing one. The desktop header keeps Profile out
 * of the primary row in a top-right account control so the cluster stays
 * uncrowded.
 */
export type NavItem = {
  path: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/discover', label: 'Discover', icon: Compass },
  { path: '/saved', label: 'Saved', icon: Bookmark },
  { path: '/community', label: 'Community', icon: Users },
  { path: '/checklists', label: 'Lists', icon: ListChecks },
]
