-- video-data lane: QUEUED actions (needsOwnerApproval) - 2026-06-09
-- Run each backup SELECT and save output before its action statement.

-- ============================================================
-- Q1. DELETE 74 Instagram PROFILE-LINK rows masquerading as videos.
-- video_id like 'oldsportfood_profile', video_url is a profile page, not a post.
-- They pass the API filter (platform='instagram' unconditional) and render as
-- non-playable "videos". Judgment: delete vs keep-as-link, so owner-gated.
-- Backup:
SELECT * FROM restaurant_videos
WHERE video_id LIKE '%\_profile' AND video_url ~ 'instagram\.com/[A-Za-z0-9_.]+/?$';
-- Action (74 rows expected; verify count matches backup before COMMIT):
-- DELETE FROM restaurant_videos
-- WHERE video_id LIKE '%\_profile' AND video_url ~ 'instagram\.com/[A-Za-z0-9_.]+/?$';

-- ============================================================
-- Q2. NEW cross-restaurant duplicate attributions (beyond the known
-- Utopia Bagels / Villa's Tacos restaurant-level dupes). Same (platform,video_id)
-- attached to DIFFERENT venues - at least one attribution is likely wrong, but
-- multi-restaurant roundup videos can be legitimate. Review, do not bulk-delete:
--   tiktok 7513297640524762414 -> Atelier Crenn, Birdsong, Ssal (3 restaurants)
--   tiktok 7075397603218771243 -> Smyth, The Loyalist
--   tiktok 7299153206590885163 -> Atelier, Indienne
--   tiktok 7475723621747543327 -> La Latina, Tina in the Gables
--   tiktok 7484262997922254126 -> Chongqing Lao Zao, YingTao
--   tiktok 7546347055602584887 -> Parachute, Sorrel
--   instagram DFAxy2bxkZl -> Chubby Boys, Haru Haru
--   instagram DWFVVJfDlEU -> Ramen Wasabi, Ricobene's
-- Also restaurant-level (videos fine, fix restaurants table, NOT this lane):
--   instagram C38W4btP3Ia, CuadH9pJHrK -> "Chichen Itza" vs "Chichen Itza Restaurant"
-- Review query:
SELECT v.id, v.platform, v.video_id, r.name, v.caption
FROM restaurant_videos v JOIN restaurants r ON r.id=v.restaurant_id
WHERE (v.platform,v.video_id) IN (
 ('tiktok','7513297640524762414'),('tiktok','7075397603218771243'),
 ('tiktok','7299153206590885163'),('tiktok','7475723621747543327'),
 ('tiktok','7484262997922254126'),('tiktok','7546347055602584887'),
 ('instagram','DFAxy2bxkZl'),('instagram','DWFVVJfDlEU'));

-- ============================================================
-- Q3. 2 rows where author_username is a display string, not a handle
-- ("Lucali Miami Beach & @bayclubmiami"). Correct handle unknown without
-- IG oEmbed lookup; fix during engagement refresh:
-- ids: 49cf6ebe-fe5a-4344-b414-00bb2b821daa, fe65fa41-3d28-4f1d-90f2-9daa6b3306e3
