import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import AdminInstagramForm from '@/components/admin/AdminInstagramForm'
import { requireAdminUser } from '@/lib/auth/admin'

// Admin-only: gated on the ADMIN_USER_IDS allowlist. We deliberately
// 404 rather than redirect to login so non-admins don't learn the
// route exists.
export default async function RestaurantAdminPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const admin = await requireAdminUser(supabase)
  if (!admin) notFound()

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('id, name, city, instagram_handle, instagram_url, instagram_last_fetched_at')
    .eq('id', id)
    .single()

  if (error || !restaurant) notFound()

  const { count: instagramVideoCount } = await supabase
    .from('restaurant_videos')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', id)
    .eq('platform', 'instagram')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <Link
          href={`/restaurants/${restaurant.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 font-medium mb-6 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to {restaurant.name}
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{restaurant.name} — Admin</h1>
          <p className="text-sm text-gray-500 mt-1">
            {restaurant.city ?? 'Unknown city'}
          </p>
        </div>

        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Instagram</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Paste an Instagram handle and optionally a list of reel URLs
              (one per line). Reels are embedded directly via Instagram&apos;s
              public iframe — no API token required.
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">
                Current handle
              </dt>
              <dd className="text-gray-900 font-medium mt-0.5">
                {restaurant.instagram_handle ? `@${restaurant.instagram_handle}` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">
                Instagram videos on file
              </dt>
              <dd className="text-gray-900 font-medium mt-0.5">
                {instagramVideoCount ?? 0}
              </dd>
            </div>
          </dl>

          <AdminInstagramForm
            restaurantId={restaurant.id}
            initialHandle={restaurant.instagram_handle}
          />
        </section>
      </div>
    </div>
  )
}
