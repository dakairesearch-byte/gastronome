import { runActor, getDatasetItems } from './client';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const MIN_LIKES = 500;

export async function fetchTikTokVideos(
  restaurantId: string,
  name: string,
  city: string
) {
  const searchQuery = `${name} ${city} restaurant`;

  const run = await runActor('apidojo/tiktok-scraper', {
    searchQueries: [searchQuery],
    maxResults: 30,
    shouldDownloadVideos: false,
  });

  const items = await getDatasetItems(run.defaultDatasetId);

  if (!items || items.length === 0) {
    return { success: false, error: 'No TikTok videos found' };
  }

  const filtered = items.filter((item) => {
    const video = item as Record<string, unknown>;
    const stats = video.stats as Record<string, unknown> | undefined;
    const likes = stats?.diggCount ?? stats?.likeCount ?? video.diggCount ?? video.likeCount;
    return typeof likes === 'number' && likes >= MIN_LIKES;
  });

  if (filtered.length === 0) {
    return { success: false, error: 'No TikTok videos met the minimum likes threshold' };
  }

  const supabase = await createServerSupabaseClient();

  const rows = filtered.map((item) => {
    const video = item as Record<string, unknown>;
    const stats = (video.stats as Record<string, unknown>) ?? {};
    const author = (video.authorMeta as Record<string, unknown>)
      ?? (video.author as Record<string, unknown>)
      ?? {};

    const videoId = String(video.id ?? video.videoId ?? '');
    const authorName = String(author.name ?? author.uniqueId ?? '');

    return {
      restaurant_id: restaurantId,
      platform: 'tiktok' as const,
      video_id: videoId,
      video_url: (video.webVideoUrl as string)
        ?? `https://www.tiktok.com/@${authorName}/video/${videoId}`,
      embed_url: `https://www.tiktok.com/embed/v2/${videoId}`,
      thumbnail_url: (video.coverUrl as string)
        ?? (video.dynamicCover as string)
        ?? null,
      caption: typeof video.text === 'string'
        ? video.text.slice(0, 2000)
        : typeof video.desc === 'string'
          ? video.desc.slice(0, 2000)
          : null,
      author_username: authorName || null,
      author_display_name: String(
        author.nickname ?? author.displayName ?? authorName ?? ''
      ) || null,
      like_count: (stats.diggCount ?? stats.likeCount ?? video.diggCount ?? 0) as number,
      view_count: (stats.playCount ?? stats.viewCount ?? video.playCount ?? 0) as number,
      comment_count: (stats.commentCount ?? video.commentCount ?? 0) as number,
      posted_at: typeof video.createTime === 'number'
        ? new Date(video.createTime * 1000).toISOString()
        : typeof video.createTime === 'string'
          ? video.createTime
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
