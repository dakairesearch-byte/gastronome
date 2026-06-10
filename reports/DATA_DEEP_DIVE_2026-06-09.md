# Data Deep Dive — Epicurious Restaurant DB — 2026-06-09

Adversarial verification pass over two analyst agents' findings (core + derived), project `trwdqzsfgeydafojajbh`, read-only. Every P0/P1 was independently re-run and sharpened; 5 of 11 P2s spot-checked. **Result: 0 findings refuted, 0 downgraded.** Two precision corrections were made (derived-04 count, derived-08 fix predicate). All fix SQL below is QUEUED ONLY — nothing has been executed.

## Executive summary

- **3,340 restaurants.** The dominant contamination event is a **6/2–6/4 insert wave** that created unenriched clone rows (0 reviews, no `google_place_id`) beside already-enriched rows — ~23 same-venue duplicate pairs confirmed row-by-row, each with a verified surviving counterpart.
- **Five geo P0/P1s confirmed by raw coordinates**: a London restaurant on the NYC page (Dishoom), a 2014-closed NYC venue enriched with a London UK address (Gordon Ramsay at The London), 3 rows geocoded to same-name restaurants 2,000–3,800 km away, 4 "Los Angeles" rows actually in Palm Springs/Dana Point/Montecito, and a Brooklyn bakery pinned to Long Island.
- **Accolade integrity is the largest derived problem**: 104 of 272 Michelin-starred flags have no 2026-guide corroboration (the 2026 scrape demonstrably covered every metro — NY 63, SF 25, Chicago 20, LA 17, Miami 8 starred rows have 2026 history), 9 of them on permanently closed venues; 67 restaurants keep stale Michelin claims in the `accolades` jsonb after their flag columns were cleared.
- **2,992 top_dishes rows (883 restaurants, 21% of the table) have zero supporting evidence in any of 7 source tables** — strictly larger than the analyst's 2,645 estimate even after adding `video_dish_mentions` as an extra evidence source. These look LLM/seed-fabricated; recommend recompute, not SQL surgery.
- Lower-grade but confirmed: Yelp half-fetches (146+36 rows), one wrong Yelp listing (Manny's, 1.7★ over 1,461 reviews from a `-3` alternate slug), 8 date-junk `hours` rows, 706 duplicate external reviews, 44 cross-venue review misattachments.

---

## CONFIRMED — P0

### core-dupe-01 — ~23 same-venue duplicate pairs (6/2–6/4 clone wave) — CONFIRMED
Re-ran the 23-pair predicate: matches **exactly 23 rows** (one per pair, no over-match). Independently confirmed a better counterpart for every flagged row, including the three I challenged:
- `Pizzeria Bianco` (LA, 0 rev, no place_id, created 6/4) duplicates **Pizzeria Bianco Los Angeles** (685 rev, 1320 E 7th St).
- `Tev's Kitchen` (0 rev) duplicates **Tev’s & Family Kitchen** — identical address `1905 W 48th St, Los Angeles`.
- `Northern Thai Food Club` duplicates **Amphai Northern Thai Food Club** (full legal name; survivor also unenriched — both created 6/4).
- Klaw/Klaw Rooftop, Lafayette/Lafayette Bakery (5,439 vs 5,424 rev, same addr), Wallsé/The Wallace (same addr+phone), Hopleaf (3,827)/Hopleaf Bar (0), Cote (3,999)/Cote 550 (136), El Turco (4,276)/El Turco Miami (460), Royal Crown Bakery (2,586)/Royal Crown (0), etc. all reproduced.

Caveats (do not block the fix):
- **Ramen Del Barrio (city='Pecos', 201 rev, has place_id)** is *more* enriched than its survivor (Austin row, 0 rev). Before flagging, consider merging its Google data onto the Austin row, or instead fix `city` on the enriched row and flag the empty Austin row.
- `Magie` survivor (Miami) and `Amphai Northern Thai Food Club` are themselves unenriched — queue them for enrichment after dedupe.
- `Ichimura at Uchu` has no live counterpart (closest address match is Muku); removal is justified on closed-venue grounds, not duplication.

```sql
UPDATE restaurants SET flagged_for_removal=true WHERE (name,city) IN (('Klaw Restaurant & Rooftop Bar','Miami'),('El Turco Miami','Miami'),('Cote 550','New York'),('Lafayette Bakery','New York'),('The Wallace','New York'),('Ichimura at Uchu','New York'),('Magie','Coconut Grove'),('PNK Surinamese Cuisine','Queens'),('Recoveco','Miami'),('Saltie Girl','West Hollywood'),('John''s Food & Wine','Chicago'),('Hopleaf Bar','Chicago'),('Hometown Bar B Que New York','Brooklyn'),('Tev''s Kitchen','Los Angeles'),('Jyan Isaac Bread','Santa Monica'),('Saranrom','Queens'),('Royal Crown','Staten Island'),('Pizzeria Bianco','Los Angeles'),('Hwa Yuan','New York'),('Manna Korean','Austin'),('True Loaf','Miami'),('Ramen Del Barrio','Pecos'),('Northern Thai Food Club','Los Angeles'));
-- reverse: SET flagged_for_removal=false on same set
```

### core-geo-01 — Dishoom "New York" is the London restaurant — CONFIRMED
Row `49b1038b-f306-45b4-bf1a-413b3bb4040b`: city='New York', neighborhood='Lower Manhattan', lat/lng **51.5125176, -0.1268291** (Covent Garden), phone `020 7420 9320` (UK), 28,969 Google reviews. Re-ran US-bounds check (24–49 / -125–-66): **exactly 1 row out of bounds — this one** (38 rows have null coords).

```sql
UPDATE restaurants SET flagged_for_removal=true WHERE id='49b1038b-f306-45b4-bf1a-413b3bb4040b'; -- reverse: SET flagged_for_removal=false
```

### core-geo-02 — Gordon Ramsay at The London: UK enrichment on a 2014-closed NYC venue — CONFIRMED
Single row matches the predicate: city='New York', neighborhood='Chelsea', address=`68 Royal Hospital Rd, London SW3 4HP, UK`, phone `020 7352 4441`, `business_status=CLOSED_PERMANENTLY`, lat/lng null.

```sql
UPDATE restaurants SET flagged_for_removal=true WHERE name='Gordon Ramsay at The London' AND city='New York'; -- reverse: SET flagged_for_removal=false
```

### core-geo-03 — 3 rows geocoded to same-name restaurants in other states — CONFIRMED
Coordinates re-verified; predicate matches exactly 3 rows:
- Rumi's Kitchen (city='Los Angeles', neighborhood='Century City'): **38.9039336, -77.0209499** = Washington DC; phone `(202) 900-9106` is also DC.
- Ode by Jont (city='Los Angeles', neighborhood='Beverly Hills'): **28.5950735, -81.3504745** = Orlando FL (Ômo by Jônt); phone `(321)` is also FL.
- Garage Pizza (city='Austin'): **34.0956283, -118.2834273** = Silver Lake LA; phone `(323) 668-1190` is LA.

Note: phones (and likely all Google enrichment) on these rows belong to the wrong venue — coords-null is the minimum fix; consider full re-enrichment.

```sql
UPDATE restaurants SET latitude=NULL,longitude=NULL WHERE (name,city) IN (('Rumi''s Kitchen','Los Angeles'),('Ode by Jont','Los Angeles'),('Garage Pizza','Austin'));
-- old values: 38.9039336/-77.0209499, 28.5950735/-81.3504745, 34.0956283/-118.2834273
```

### core-geo-04 — 4 "Los Angeles" rows are 79–153 km outside LA — CONFIRMED (owner decision; no fix queued)
- Bar Cecil LA (33.8042842, -116.5461046) and Beaton's at Bar Cecil (33.8044478, -116.5462511): Palm Springs — Bar Cecil's only real location. Both carry neighborhood='West Hollywood' (wrong). Beaton's phone `0000000000` (see core-cont-02); its website `beatonsps.com` literally says Palm Springs.
- Truly Pizza (33.4652738, -117.7039688): Dana Point, neighborhood='Venice' (wrong).
- Little Mountain (34.437381, -119.6313138): Montecito.

Owner decision: re-city these to their true markets, or flag for removal as out-of-market.

### derived-01 — 104 Michelin-star flags with no 2026 corroboration; 9 permanently closed — CONFIRMED
Reproduced exactly: 272 flagged rows; **168 with a 2026 star history row, 104 without** (7 latest=2025, 97 latest<2025, 0 with no history at all); **9 of the 104 are CLOSED_PERMANENTLY**. Sharpened the scrape-coverage objection: 366 restaurants have 2026 history rows, and every metro has flagged rows *with* 2026 stars (NY 63, SF 25, Chicago 20, LA 17, Miami 8, Austin 4, Brooklyn 6) — so the 2026 scrape covered all markets and absence of a 2026 row is meaningful. Residual caution only for small wine-country towns (Healdsburg 1-with/3-without, Yountville 1/2).

```sql
UPDATE restaurants r SET michelin_stars=NULL, michelin_designation=NULL WHERE coalesce(michelin_stars,0)>0 AND NOT EXISTS (SELECT 1 FROM restaurant_michelin_history h WHERE h.restaurant_id=r.id AND h.year>=2026 AND h.designation LIKE '%star');
-- 104 rows; reversible via restaurant_michelin_history + accolades_prev_snapshot
-- spot-confirm a few wine-country rows (Healdsburg/Yountville) against the 2026 guide before running
```

### derived-02 — Evidence-free top_dishes — CONFIRMED, larger than reported
Re-ran the anti-join with a STRICTER evidence set (added `video_dish_mentions` as a 7th source alongside chips, dish_signals, highlighted_dishes, menu_items, external_review_dish_mentions, and `restaurant_videos.dishes`): **2,992 rows across 883 restaurants** (vs analyst's 2,645/728) out of 13,924 total top_dishes rows — **21% of the table**. All have `total_mentions>0`. Epochs: 1,769 computed 2026-05-09 (exact match to analyst), 981 on 2026-06-01. Examples re-verified: Moreno Barbecue 'Triple Smash Burger' (1 mention, no trace), Brasero 'Grilled Half Lobster' (3 mentions, no trace).

**No SQL queued — correct remedy is a recompute of top_dishes from actual signals** (the 5/9 and 6/1 compute runs fabricated or carried over mention counts). Snapshot exists at `_top_dishes_backup_20260601` / `_top_dishes_pre_llm_20260601` for diffing.

---

## CONFIRMED — P1

### core-geo-05 — Sweet & Savory (Bed-Stuy) geocoded to Port Jefferson LI — CONFIRMED
40.9464718, -73.0692114 with address `101 Jefferson Ave`. Sharpened: phone `(631) 828-6053` is a **Suffolk County area code** — the phone (and likely the whole Google enrichment) also belongs to the Long Island business. Consider nulling phone and re-enriching, not just coords.

```sql
UPDATE restaurants SET latitude=NULL,longitude=NULL WHERE name='Sweet & Savory' AND city='Brooklyn'; -- old values 40.9464718,-73.0692114
```

### core-rate-01 — Yelp half-fetches — CONFIRMED (exact counts)
`yelp_rating IS NULL AND yelp_review_count>0`: **146**. `yelp_rating NOT NULL AND coalesce(yelp_review_count,0)=0`: **36**. Google equivalents clean. No fix queued — refetch Yelp for these 182 rows.

### core-rate-02 — Manny's wrong Yelp listing — CONFIRMED
Row verified: `Manny’s Cafeteria & Delicatessen` (Chicago), yelp 1.7/1,461, slug `mannys-cafeteria-and-delicatessen-chicago-3`. Predicate check passed: the DB name uses the **curly apostrophe (U+2019)**, and so does the queued fix — it matches exactly 1 row. (A straight-apostrophe predicate would match 0 rows.)

```sql
UPDATE restaurants SET yelp_rating=NULL,yelp_review_count=NULL,yelp_url=NULL WHERE name='Manny’s Cafeteria & Delicatessen' AND city='Chicago';
-- old: 1.7, 1461, https://www.yelp.com/biz/mannys-cafeteria-and-delicatessen-chicago-3
```

### core-cont-01 — Corrupt hours jsonb — CONFIRMED (predicate exact)
26 rows with exactly one weekday key; **the month-name fix predicate matches exactly 8 rows across the whole table** — all date-junk, zero false positives on normal hours strings.

```sql
UPDATE restaurants SET hours=NULL WHERE hours IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_each_text(hours) e WHERE e.value ~ '^(January|February|March|April|May|June|July|August|September|October|November|December)'); -- 8 rows; refetch later
```
The other 18 single-day-fragment rows (e.g., Cuerno Wednesday-only) are left for refetch, not nulled.

### core-cont-02 — Placeholder/foreign phones — CONFIRMED
Lo Scalco (New York) `349 374 7958` (Italian mobile; website is `.it`) and Beaton's at Bar Cecil `0000000000` both verified; (name,phone) pairs match exactly (Beaton's name uses a straight apostrophe in DB, matching the fix).

```sql
UPDATE restaurants SET phone=NULL WHERE (name,phone) IN (('Lo Scalco','349 374 7958'),('Beaton''s at Bar Cecil','0000000000'));
```

### derived-03 — Stale Michelin claims in accolades jsonb — CONFIRMED, fix safe
Exactly **67 restaurants** with flag columns clear but `michelin`/`michelin_year` entries in `accolades`. Adversarial cross-check: **0 of the 67 have a 2026 star history row** — so in no case is the jsonb right and the flag wrong; deleting the jsonb entries is safe. 60/67 appear in `accolades_michelin_audit` (202 rows); originals preserved in `accolades_prev_snapshot`.

```sql
UPDATE restaurants r SET accolades=(SELECT coalesce(jsonb_agg(e),'[]'::jsonb) FROM jsonb_array_elements(r.accolades) e WHERE e->>'type' NOT IN ('michelin','michelin_year')) WHERE coalesce(michelin_stars,0)=0 AND michelin_designation IS NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(r.accolades) e WHERE e->>'type' IN ('michelin','michelin_year'));
-- 67 rows; old values preserved in accolades_prev_snapshot
```

### derived-04 — JBF winner history without flag — CONFIRMED, count corrected to 11 restaurants (12 winner rows)
52 winner rows total, verified. The flag-false set is **11 restaurants spanning 12 winner rows** (Next has two: 2012 New Restaurant + 2014 Great Lakes Chef): Avec, Birdie's, Coi, Michael's Genuine, Next, North Pond, Per Se, Quince, Terroir, The Modern, Uchiko. Reverse direction clean. Policy check still needed: 5 of the awards are service/beverage-category (Per Se Service 2011, The Modern Wine Service 2011, Birdie's Beverage Service 2025, Terroir Wine & Spirits 2012) — confirm those should set `james_beard_winner` before running.

```sql
UPDATE restaurants r SET james_beard_winner=true WHERE coalesce(james_beard_winner,false)=false AND EXISTS (SELECT 1 FROM restaurant_jbf_history h WHERE h.restaurant_id=r.id AND h.status='winner'); -- 11 rows; reverse: set false for these ids
```

### derived-05 — Shion 69 Leonard Street flag desync — CONFIRMED
`d0500ef4-8cca-4e21-ace8-daecf8558af5`: history = one_star 2022, 2023, 2024, 2025; `michelin_stars=0`, designation null. No 2026 history row — the hold-for-2026-confirmation caveat stands.

```sql
UPDATE restaurants SET michelin_stars=1, michelin_designation='one_star' WHERE id='d0500ef4-8cca-4e21-ace8-daecf8558af5'; -- only after confirming 2026 guide status
```

### derived-06 — Same-venue duplicate external_reviews — CONFIRMED (exact)
349 groups / 706 rows / 357 deletable, reproduced exactly.

```sql
CREATE TABLE _extrev_dup_backup_20260609 AS SELECT a.* FROM external_reviews a JOIN external_reviews b ON a.restaurant_id=b.restaurant_id AND a.text=b.text AND a.id>b.id WHERE length(a.text)>20;
DELETE FROM external_reviews a USING external_reviews b WHERE a.restaurant_id=b.restaurant_id AND a.text=b.text AND a.id>b.id AND length(a.text)>20;
```

### derived-07 — Cross-venue identical review texts — CONFIRMED (exact)
22 texts (len>=60) on >1 restaurant, 44 review rows. No fix queued — each pair needs manual judgment on which attachment is wrong (e.g., Hellbender vs S&P Lunch). Note: deleting blindly would remove the *correct* copy half the time.

### derived-08 — Wrong top_dishes→menu_item links — CONFIRMED, queued fix AMENDED
Reproduced: 4,782 linked rows, **168 share no >=4-char word** with the linked item. However, **17 of the 168 are short-name dishes with no >=4-char word at all** — and on inspection nearly all are *correct exact-match links* the original fix would wrongly null: 'Pad See Ew'='Pad See Ew', 'Pho'='Pho', 'Uni'='Uni', 'Hot Dog'='HOT DOG', 'Coq au Vin', 'Bún Bò Huế'='Bun Bo Hue' (accent variant). Only 'BLT'→'Barbecue' is genuinely wrong in that subset. Amended fix excludes short-name dishes (touches **151 rows**; sacrifices the one BLT row for safety):

```sql
CREATE TABLE _top_dishes_backup_20260609 AS SELECT * FROM restaurant_top_dishes;
UPDATE restaurant_top_dishes t SET menu_item_id=NULL FROM restaurant_menu_items m
WHERE m.id=t.menu_item_id
  AND EXISTS (SELECT 1 FROM regexp_split_to_table(lower(t.display_name),'\W+') w WHERE length(w)>3)
  AND NOT EXISTS (SELECT 1 FROM regexp_split_to_table(lower(t.display_name),'\W+') w WHERE length(w)>3 AND lower(m.item_name) LIKE '%'||w||'%');
-- 151 rows; re-run matcher after
```

---

## CONFIRMED — P2 (5 of 11 spot-checked; rest accepted as reported)

- **core-cont-03 (checked)** — Fairfax (NYC) carries `josephleonard.com` and a byte-identical description with Joseph Leonard. Confirmed.
  ```sql
  UPDATE restaurants SET website=NULL,description=NULL WHERE name='Fairfax' AND city='New York'; -- old website http://www.josephleonard.com/
  ```
- **core-cont-04 (checked)** — state NULL: 21 rows (Alhambra 11, Coral Gables 9, +1 other). Exact.
  ```sql
  UPDATE restaurants SET state='CA' WHERE city='Alhambra' AND state IS NULL;
  UPDATE restaurants SET state='FL' WHERE city='Coral Gables' AND state IS NULL;
  -- 20 of 21 rows; reverse: SET state=NULL on same predicates
  ```
- **core-cont-06 (checked)** — 10 non-canonical phones; the regexp fix matches exactly 8 (the other 2 are the foreign/placeholder numbers handled by core-cont-02). Predicate scope exact.
  ```sql
  UPDATE restaurants SET phone=regexp_replace(phone,'^\+?1?\s*\(?(\d{3})\)?[\s.-]*(\d{3})[\s.-]*(\d{4})$','(\1) \2-\3') WHERE phone !~ '^\(\d{3}\) \d{3}-\d{4}$' AND phone ~ '^\+?1?\s*\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}$';
  ```
- **core-cont-07 (checked)** — business_status census exact: OPERATIONAL 3,278 / CLOSED_TEMPORARILY 37 / CLOSED_PERMANENTLY 25. App-side filter decision; no SQL.
- **derived-09 (checked)** — all 8 junk chip keywords exist (9 rows total: '4 course menu' covers Saint Urban + Sepia; '5 course tasting menu' is at The Tasting Kitchen). All venue-descriptor/course-count phrases, none plausibly dishes.
  ```sql
  DELETE FROM restaurant_google_chips WHERE keyword IN ('4 floors','4 levels','3 michelin star restaurant','2 michelin star','4 course menu','5 and 9 courses','5 course tasting menu','10 course menu'); -- 9 rows
  ```
- **Accepted as reported (not re-run)**: core-cont-05 (45+ social/ordering URLs as website), derived-10 (Agrodolce rank inversion), derived-11 (19 highlighted-vs-top disagreements), derived-12 (30 empty google reviews, 2 mojibake), derived-13 (117 all-self-promo video cohorts), derived-14 (1,907-row estimated-engagement cohort).

## REFUTED / DOWNGRADED

None. All 18 P0/P1 findings reproduced; counts matched exactly in 14 of 18, within drift/methodology tolerance in the rest (derived-02 larger than claimed; derived-04 is 11 restaurants not 12).

---

## Queued fixes — run order

Take one full-table snapshot of `restaurants` first; per-statement backups listed inline. Run in this order (flags before field-nulls; derived after core; holds last):

1. **Backup**: `CREATE TABLE _restaurants_backup_20260609 AS SELECT * FROM restaurants;` — covers steps 2–10.
2. **core-dupe-01** flag 23 dupes — backup: covered by step 1. (Owner: decide Ramen Del Barrio merge first.)
3. **core-geo-01** flag Dishoom — covered by step 1.
4. **core-geo-02** flag Gordon Ramsay at The London — covered by step 1.
5. **core-geo-03** null coords (3 rows) — covered by step 1; old values in comment.
6. **core-geo-05** null Sweet & Savory coords — covered by step 1.
7. **core-rate-02** null Manny's Yelp fields — covered by step 1.
8. **core-cont-01** null 8 date-junk hours — covered by step 1.
9. **core-cont-02** null 2 bogus phones — covered by step 1.
10. **P2 batch**: core-cont-03 (Fairfax), core-cont-04 (states), core-cont-06 (phone format, 8 rows) — covered by step 1.
11. **derived-09** delete 9 junk chips — backup: `CREATE TABLE _chips_junk_backup_20260609 AS SELECT * FROM restaurant_google_chips WHERE keyword IN (…same list…);`
12. **derived-06** dedupe external_reviews — backup built into the statement (`_extrev_dup_backup_20260609`).
13. **derived-08 (amended)** unlink 151 bad menu links — backup: `CREATE TABLE _top_dishes_backup_20260609 AS SELECT * FROM restaurant_top_dishes;` (also serves derived-02 recompute).
14. **derived-03** strip stale Michelin jsonb (67 rows) — backup: `accolades_prev_snapshot` already exists; optionally `CREATE TABLE _accolades_backup_20260609 AS SELECT id,accolades FROM restaurants WHERE jsonb_typeof(accolades)='array';`
15. **derived-01** clear 104 stale star flags — backup: covered by step 1 + `restaurant_michelin_history` is the source of truth. HOLD until owner spot-confirms 2–3 wine-country rows against the 2026 guide.
16. **derived-04** set james_beard_winner on 11 rows — covered by step 1. HOLD for policy on service/beverage-category awards.
17. **derived-05** restore Shion's star — covered by step 1. HOLD until 2026 guide status confirmed.

Not queued (recompute/manual): derived-02 (recompute top_dishes), derived-07 (manual review of 22 cross-venue texts), core-geo-04 (owner re-city or remove), core-rate-01 (Yelp refetch), core-cont-05/07, derived-10–14.

---

## Appendix A — Clean checks (verified by analysts; spot-consistent with this pass)

Core: Google rating/count pairing clean (0/0); all ratings in range and on 0.1 steps; name hygiene clean (no untrimmed/double-space/non-printable/HTML entities); no junk cuisine sentinels; 0 duplicate `google_place_id`; all 2,455 hours values are jsonb objects; famous-neighborhood scan all legitimate; US bounds — exactly 1 offender (Dishoom, re-verified this pass); upstate-NY outliers are real destination restaurants.

Derived: Eater 38 flag↔history fully consistent both directions; 0 flag-true JBF without winner history; 0 star-count mismatches vs 2026 history; all 360 michelin_urls on guide.michelin.com; external review ratings in range; all 21,613 dish_mentions verbatim in parent review text (full census); video URL liveness 25/25 TikTok + 15/15 IG sampled live; google chips junk-free post-6/1 except the 9 rows in derived-09.

Verifier additions: dupe predicate matches exactly 23 rows (no same-name over-match); hours fix predicate matches exactly 8 rows table-wide; Manny's fix predicate apostrophe verified; derived-03 fix cannot delete any current (2026) star claim.

## Appendix B — Scrape / owner-decision suggestions

1. **Recompute top_dishes** for the 883 affected restaurants from real signals (chips, dish_mentions, video mentions); diff against `_top_dishes_pre_llm_20260601` to identify the fabrication mechanism (5/9 and 6/1 compute runs).
2. **Re-enrich, don't just null**: Rumi's Kitchen, Ode by Jont, Garage Pizza, and Sweet & Savory all carry wrong-venue phones (DC/FL/LA/Long Island area codes) — full Google re-fetch with city-biased place search.
3. **Insert-wave guardrail**: the 6/2–6/4 ingestion created rows without place_id dedupe. Add a pre-insert check: reject/queue rows whose name has >0.5 trigram similarity to an existing row within 50 m or same normalized phone/address.
4. **Yelp refetch** for the 182 half-fetched rows; validate the listing slug isn't a `-2`/`-3` alternate when |google−yelp| > 2.0 with both counts > 200.
5. **2026 Michelin confirmations**: Shion (restore?), Healdsburg/Yountville stragglers, and the 9 closed+starred rows (flag for removal as well as star-clear).
6. **Policy decisions**: JBF service/beverage awards → flag or not; business_status filter in app for 62 closed venues; Bar Cecil/Truly Pizza/Little Mountain market assignment.
7. **Enrich the unenriched survivors** after dedupe: Magie (Miami), Amphai Northern Thai Food Club, Ramen del Barrio (Austin) — all currently 0-review shells.
