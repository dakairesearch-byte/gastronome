import { redirect } from 'next/navigation'

/**
 * `/profile/edit` was the historical home of the settings form. The
 * profile route is now settings-only (`/profile`), so this page is
 * just a permanent redirect for any bookmarks, emails, or lingering
 * links pointed at the old path.
 */
export default function ProfileEditRedirect() {
  redirect('/profile')
}
