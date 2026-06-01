import { Home, Compass, Search, Users, type LucideIcon } from 'lucide-react'

/**
 * Single source of truth for the primary navigation spine, shared by the
 * desktop header (Navigation.tsx) and the mobile bottom bar (BottomNav.tsx)
 * so the two surfaces never drift apart.
 *
 * `/profile` is intentionally NOT in this list: it requires auth and bounces
 * anonymous users to /onboarding. Each surface appends it conditionally when
 * a user is signed in.
 *
 * The `/cities` PAGE was removed (city remains a filter on /explore via
 * ?city=), so it no longer appears here. Search is included so it is
 * reachable on desktop, not just the mobile bottom nav. Community stays.
 */
export type NavItem = {
  path: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/explore', label: 'Explore', icon: Compass },
  { path: '/search', label: 'Search', icon: Search },
  { path: '/community', label: 'Community', icon: Users },
]
