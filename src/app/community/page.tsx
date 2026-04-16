import { Users } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import SectionHeader from '@/components/SectionHeader'
import VideoCard from '@/components/cards/VideoCard'

export const revalidate = 60

export default async function CommunityPage() {
  const supabase = await createServerSupabaseClient()

  // Top videos by engagement, joined to restaurants for the name
  const { data: rawVideos } = await supabase
    .from('restaurant_videos')
    .select('*, restaurants!inner(id, name)')
    .order('like_count', { ascending: false, nullsFirst: false })
    .limit(12)

  const videos = (rawVideos ?? []).map((v) => {
    // Supabase nested relation shape: object for many-to-one
    const restaurant = Array.isArray(v.restaurants) ? v.restaurants[0] : v.restaurants
    return {
      id: v.id as string,
      videoUrl: (v.video_url ?? '') as string,
      platform: (v.platform ?? 'tiktok') as 'tiktok' | 'instagram',
      authorUsername: v.author_username as string | null,
      likeCount: v.like_count as number | null,
      viewCount: v.view_count as number | null,
      restaurantName: (restaurant?.name ?? 'Unknown') as string,
      restaurantId: (restaurant?.id ?? '') as string,
    }
  })

  return (
    <div style={{ backgroundColor: 'var(--color-background)', minHeight: '100vh' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Hero header */}
        <div className="mb-10">
          <h1
            className="text-4xl sm:text-5xl mb-3"
            style={{
              color: 'var(--color-text)',
              fontFamily: "'Spectral', serif",
              fontWeight: 400,
              letterSpacing: '-0.01em',
            }}
          >
            Community
          </h1>
          <p
            className="text-lg"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 300,
            }}
          >
            See what food lovers are discovering
          </p>
        </div>

        {/* Trending Videos */}
        {videos.length > 0 && (
          <section className="mb-20">
            <SectionHeader label="On Social" title="Trending Videos" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {videos.map((v) => (
                <VideoCard key={v.id} {...v} />
              ))}
            </div>
          </section>
        )}

        {/* Coming Soon — Reviews */}
        <section className="mb-20">
          <div
            className="flex items-center justify-center py-24 border rounded-sm"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="text-center px-6 max-w-2xl">
              <div
                className="inline-flex items-center justify-center w-24 h-24 mb-8 border rounded-sm"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-accent)',
                }}
              >
                <Users className="w-12 h-12" style={{ color: 'var(--color-accent)' }} />
              </div>
              <h2
                className="text-4xl sm:text-5xl mb-4"
                style={{
                  color: 'var(--color-text)',
                  fontFamily: "'Spectral', serif",
                  fontWeight: 400,
                  letterSpacing: '-0.01em',
                }}
              >
                Reviews Coming Soon
              </h2>
              <p
                className="text-lg leading-relaxed"
                style={{
                  color: 'var(--color-text-secondary)',
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 300,
                }}
              >
                An exclusive community for discerning food enthusiasts.
                <br />
                Connect, share, and discover exceptional dining experiences.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
