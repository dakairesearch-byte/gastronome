import { runActor, getDatasetItems } from './client';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const MIN_LIKES = 500;

export async function fetchInstagramVideos(
  restaurantId: string,
  name: string,
  city: string
) {
  const searchQuery = `${name} ${city}`;

  // Use the general Instagram scraper with place search + reels type
  const run = await runActor('apify/instagram-scraper', {
    search: searchQuery,
    searchType: 'place',
    resultsType: 'reels',
    resultsLimit: 30,
    searchLimit: 3,
  });

  const items = await getDatasetItems(run.defaultDatasetId);

  if (!items || items.length === 0) {
    return { success: false, error: 'No Instagram reels found' };
  }

  const filtered = items.filter((item) => {
    const reel = item as Record<string, unknown>;
    const likes = reel.likesCount ?? reel.likeCount;
    return typeof likes === 'number' && likes >= MIN_LIKES;
  });

  if (filtered.length === 0) {
    return { success: false, error: 'No Instagram reels met the minimum likes threshold' };
  }

  const supabase = await createServerSupabaseClient();

  const rows = filtered.map((item) => {
    const reel = item as Record<string, unknown>;
    const shortcode = String(reel.shortCode ?? reel.shortcode ?? reel.id ?? '');
    const videoId = String(reel.id ?? reel.pk ?? shortcode);

    const ownerUsername = String(
      reel.ownerUsername ?? reel.username ?? ''
    );
    const ownerDisplayName = String(
      reel.ownerFullName ?? reel.fullName ?? ownerUsername ?? ''
    );

    return {
      restaurant_id: restaurantId,
      platform: 'instagram' as const,
      video_id: videoId,
      video_url: shortcode
        ? `https://www.instagram.com/reel/${shortcode}/`
        : (reel.url as string) ?? null,
      embed_url: shortcode
        ? `https://www.instagram.com/reel/${shortcode}/embed/`
        : null,
      thumbnail_url: (reel.displayUrl as string)
        ?? (reel.thumbnailUrl as string)
        ?? null,
      caption: typeof reel.caption === 'string'
        ? reel.caption.slice(0, 2000)
        : null,
      author_username: ownerUsername || null,
      author_display_name: ownerDisplayName || null,
      like_count: (reel.likesCount ?? reel.likeCount ?? 0) as number,
      view_count: (reel.videoViewCount ?? reel.viewCount ?? reel.videoPlayCount ?? 0) as number,
      comment_count: (reel.commentsCount ?? reel.commentCount ?? 0) as number,
      posted_at: typeof reel.timestamp === 'string'
        ? reel.timestamp
        : typeof reel.takenAtTimestamp === 'number'
          ? new Date(reel.takenAtTimestamp * 1000).toISOString()
          : null,
      fetched_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from('restaurant_videos')
    .upsert(rows, {
      onConflict: 'restaurant_id,platform,video_id',
      ignoreDuplicates: false,
    });

  if (error) {
    return { success: false, error: `Supabase upsert failed: ${error.message}` };
  }

  return { success: true, count: rows.length };
}
