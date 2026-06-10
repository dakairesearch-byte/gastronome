# UI/UX Catalog — 2026-06-10

**Method:** 10 specialist auditors (~300k-token budgets: onboarding, home, discover-browse, discover-map, restaurant-detail, cities, profile-saved, search-nav, mobile-platform, design-system) audited code + live prod + real data. A 3-expert panel (product-conversion, visual-craft, a11y-ergonomics) reviewed all 224 candidates; items kept by >=2 of 3 experts survived.

**198 items** — P0:4 · P1:64 · P2:95 · P3:35. Panel consensus top picks: onboarding-01, cities-01, profile-saved-01, onboarding-02, rd-02, ds-01.

Platforms: {'both': 155, 'mobile': 35, 'web': 8} · Kinds: {'fix': 124, 'suggestion': 74}

Per lane: a11y-ergonomics:a11y:4, cities:12, discover-browse:19, discover-map:20, ds:22, home:17, mobile-platform:18, onboarding:21, product-conversion:pc-add:4, profile-saved:22, rd:21, search-nav:15, visual-craft:va:3

---


## P0

### onboarding-01 ⭐ — Google button navigates users to a raw JSON error page
*Sign-up wall (OnboardingFlow + SignInModal) — Google OAuth button · both · fix · effort S · panel 3/3*

**Problem:** Provider is disabled: GET /auth/v1/authorize?provider=google returns 400 JSON (verified). signInWithOAuth redirects the browser before any error returns, so the friendly fallback in OnboardingFlow.tsx:307-315 and SignInModal.tsx:330-341 never fires — users leave the app onto raw JSON.

**Fix:** Until the provider is enabled, hide both buttons behind an env flag (e.g. NEXT_PUBLIC_GOOGLE_AUTH=1), or call signInWithOAuth with skipBrowserRedirect:true, probe data.url with fetch, and only assign location on non-400 — else show the existing inline error.

### profile-saved-01 ⭐ — Collections popover clipped by card overflow-hidden
*Save-to-collection popover on restaurant cards (/saved, /discover) · both · fix · effort M · panel 3/3*

**Problem:** BookmarkButton renders its w-72 popover and toast absolutely inside card roots that set overflow-hidden (RestaurantCard.tsx:156 and :339; popover at BookmarkButton.tsx:235). On ~110px compact cards the menu is almost fully clipped — save-to-collection is unusable from /saved and Discover lists.

**Fix:** Render the popover and toast via a portal (or position:fixed anchored to the trigger) so ancestor overflow cannot clip them; alternatively remove overflow-hidden from card roots and clip only the image wrapper.

### cities-01 ⭐ — 811 borough/suburb restaurants invisible to every city-scoped surface
*Discover city scoping (browse/search/map) · both · fix · effort L · panel 2/3*

**Problem:** City filter is whole-value ilike on restaurants.city (useDiscoverResults.ts:93-99, editorial.ts:256). 811 of 3,340 rows (Brooklyn 269 incl. 7 Michelin-starred, 23 Bibs; Queens 64; Miami Beach 47; Oakland 39) never appear when browsing their metro city.

**Fix:** Add a metro mapping (metro_city column or a CITY_ALIASES map in useDiscoverResults/applyEditorialFilter) so New York matches the five boroughs, Miami matches Miami Beach/Coral Gables, etc. Backfill via one UPDATE per metro.

### onboarding-03 — Zero value before signup: entire catalog is invisible to visitors
*Anonymous-visitor gating (product-level) · both · suggestion · effort L · panel 2/3*

**Problem:** Every URL 307s to a 4-pane pitch (middleware.ts:92-97). The only 'proof' is two display-only preview cards on pane 2 (OnboardingFlow.tsx:828-847). This also nullifies the OG/sitemap SEO investment in layout.tsx — crawlers get the wizard too.

**Fix:** Let anonymous users read restaurant and city pages with a persistent sign-up banner, gating save/review/personalize actions (openSignInModal already exists for this). At minimum exempt /restaurants/* in ONBOARDING_EXEMPT_PREFIXES.


## P1

### cities-17 — Home chips drop the resolved city and assume New York
*Home search scent chips · both · fix · effort S · panel 2/3*

**Problem:** Chips link to /discover?q=… without &city= (page.tsx:252-270), so a Miami user (home correctly shows Miami) lands in New York-scoped results. The examples are also NYC-flavored ("West Village") for every city.

**Fix:** Append the resolved city to each chip href (the editorial picks loop at page.tsx:183 already does this) and key example chips per city — e.g. Miami: "Cubano", "Wynwood".

### discover-browse-02 — Discover ignores saved city; header and body disagree
*/discover shell (active city resolution) · both · fix · effort S · panel 3/3*

**Problem:** page.tsx:67 falls back to DEFAULT_CITY ('New York') when ?city= is absent, but nav links to bare /discover. A user with localStorage city Chicago sees header switcher 'Chicago' while the body browses New York.

**Fix:** In DiscoverShellContent, fall back to the useCity() resolution (localStorage gastro_city) instead of DEFAULT_CITY, or have navItems/Navigation append ?city=<active> to the Discover link. Same fix covers home's city-less ?cuisine= deep-links.

### discover-browse-03 — 'Top 10 Trending' header contradicts every row's caption
*Browse Top-10 section · both · fix · effort S · panel 3/3*

**Problem:** DiscoverBrowse.tsx:154-173 feeds gastronome-sorted rows (no trending_counts) into Top10Trending, so the header says 'Top 10 Trending' while all ten rows show the italic 'Also highly rated' fallback caption — contradictory and 10x repeated noise.

**Fix:** Either call topTrendingRestaurants for real trending data, or retitle the section 'Top 10 in {city}' / 'Ranked by Gastronome Score' and suppress the per-row fallback caption when the entire list is fallback.

### discover-browse-04 — Fake scatter pins rendered over a real map tile
*Browse Top-10 map panel · web · fix · effort S · panel 3/3*

**Problem:** Top10Trending.tsx:209-241 places coord-less restaurants at hardcoded FALLBACK_POSITIONS, drawn over a real Google Static Maps tile (line 577). LA has 14 missing-coords rows; users read a numbered pin as the restaurant's actual location.

**Fix:** When a real tile renders, skip pins for coord-less rows (and mark their list rows 'no map location'); reserve the deterministic scatter only for the no-key placeholder background where geography isn't implied.

### discover-browse-07 — Collections fetch unordered 120, then claim capped count as total
*Collection view (?preset=hidden-gems etc.) · both · fix · effort S · panel 3/3*

**Problem:** DiscoverCollection.tsx:67 runs .limit(120) with no .order(), so NY Hidden Gems (226 rows) samples an arbitrary 120 before the client-side score sort; CollectionHeader then states '48 places in New York' (the slice), under-reporting the real total.

**Fix:** Add .order('google_rating', desc) before the limit for ranked collections, fetch an exact count via { count: 'exact', head } for the header sentence, and show 'Showing top 48 of 226'.

### discover-map-03 — Hovering list rows pans the map continuously
*/discover map — desktop list↔map sync · web · fix · effort S · panel 3/3*

**Problem:** ResultRow onMouseEnter calls onSelect (DiscoverMapView.tsx:846), and the highlight effect calls panTo for the selected marker (RestaurantMap.tsx:328). Sweeping the cursor down the side panel makes the map fly pin-to-pin and (per 01) arms the search button.

**Fix:** Separate hover-highlight from selection: hover only re-icons/raises z-index of the pin; reserve panTo for explicit click/tap selection. Add a hoveredId prop alongside selectedId.

### discover-map-04 — Near-me button is buried behind the bottom sheet
*/discover map — Near me control · mobile · fix · effort S · panel 3/3*

**Problem:** NearMeButton sits at absolute bottom-4 left-3 z-10 (DiscoverMapView.tsx:407) while the sheet is z-30 and even its 'peek' detent is 4.5rem tall (DiscoverMapView.tsx:239-240, 465) — the app's only geolocation control is invisible at every detent on mobile.

**Fix:** On <lg, anchor the button above the sheet (style bottom: `calc(${sheetHeight} + 0.75rem)`) so it rides the detent transitions, or move it into the sheet header next to the count.

### discover-map-08 — Two stacked near-identical search bars in map mode
*/discover map — search inputs · both · suggestion · effort S · panel 3/3*

**Problem:** The shell's global search (src/app/discover/page.tsx:175-216) renders directly above the map's floating ?mq= bar (DiscoverMapView.tsx:267-297). Same icon, near-identical placeholders, but one silently exits map mode while the other filters the map — a trust-eroding ambiguity.

**Fix:** Hide the shell search while mode=map (render it only for browse), making the floating mq bar the single search affordance; or merge by routing the shell input to ?mq= when mode=map.

### ds-01 ⭐ — Bottom nav active tab uses brand gold, not action garnet
*BottomNav active state · mobile · fix · effort S · panel 3/3*

**Problem:** BottomNav.tsx:50 colors the active tab var(--color-primary) (gold #D4A574), violating the globals.css:13 'gold is brand-only' rule. Desktop nav uses garnet (Navigation.tsx:208). Gold on white is ~2:1 — the 10px active label fails WCAG badly.

**Fix:** Change BottomNav.tsx:50 to color: active ? 'var(--color-action)' : 'var(--color-text-secondary)' so mobile and desktop share the garnet active signal and pass contrast.

### ds-02 — Accent token's WCAG claim is false; white-on-accent fails AA
*globals.css --color-accent token · both · fix · effort S · panel 3/3*

**Problem:** globals.css:29-35 claims 'white passes WCAG AA on both accent steps' — actually #6B95A8 vs white is ~3.2:1 and hover #557D90 is ~4.45:1. Community waitlist button (community/page.tsx:118) renders 12px cream text on accent: AA fail.

**Fix:** Darken --color-accent to a ≥4.5:1 step (e.g. #4A7385) or restyle the waitlist button with .action-cta. Correct the token comment so future agents don't trust a false contrast guarantee.

### ds-04 — No danger token; community errors render in slate-blue accent
*Error color semantics · both · fix · effort S · panel 3/3*

**Problem:** community/page.tsx:102-105,131 colors the invalid-email border and error text var(--color-accent) (calm slate-blue), while BookmarkButton.tsx:310 uses text-red-600 and the detail status chip hardcodes #b91c1c. Errors aren't perceivable as errors and the palette disagrees.

**Fix:** Add --color-danger (e.g. #B91C1C) to globals.css, switch community/page.tsx error border/text and the scattered red-600/#b91c1c literals to it.

### ds-05 — Footer waitlist link is garnet-on-navy, ~1.5:1 contrast
*Footer · both · fix · effort S · panel 3/3*

**Problem:** Footer.tsx:109 colors 'Join the waitlist' var(--color-action) (#8E3B46) on the navy --color-secondary footer — ~1.5:1, effectively invisible. Body links at rgba(255,255,255,0.4) (Footer.tsx:56+) are ~3.2:1, also below AA; the 0.3-alpha copyright is worse.

**Fix:** The action token only works on light surfaces. Use a light tint (e.g. #E8B7BE or white + underline) for the waitlist link and raise footer link alpha to 0.72, copyright to 0.55.

### ds-06 — 404 primary CTA is white-on-gold; error page uses garnet
*404 page · both · fix · effort S · panel 3/3*

**Problem:** not-found.tsx:31-33 styles 'Go Home' with bg var(--color-primary) + white text (~2:1 contrast) — an interactive gold CTA the color-discipline rule forbids. The sibling error.tsx:33 correctly uses action/on-action, so the two failure pages disagree.

**Fix:** Swap the 404 CTA to the shared action-cta class (matching error.tsx and EmptyState). Keep the gold '404' numeral — that one is legitimately brand.

### home-05 — Gold "Explore" button fails contrast and breaks token discipline
*Hero search CTA · both · fix · effort S · panel 3/3*

**Problem:** SearchAutocomplete.tsx:287-299 styles the hero submit with --color-primary (#D4A574) + white 12px uppercase text — roughly 2.2:1, failing WCAG AA. globals.css:13-17 explicitly demotes gold to brand-only; the adjacent "Search by dish" chip already uses garnet, so the hero shows two competing CTA colors.

**Fix:** Switch the hero submit to the action-cta garnet token (--color-action, white passes AA) and relabel "Explore" to "Search" so the button matches the input's verb; keep gold for the Score pill only.

### home-07 — Eight full-width square cards create ~4,000px mobile scroll
*Suggestions grid · mobile · suggestion · effort S · panel 3/3*

**Problem:** page.tsx:305 uses grid-cols-1 below sm, so each SuggestionCard renders a ~375px square photo plus meta (~500px tall) × 8 cards before users reach personal rails or Editor's picks — most mobile users will never see the lower sections.

**Fix:** Use grid-cols-2 on mobile (matching the Editor's picks grid at page.tsx:342) with tightened card padding, or convert the rail to a horizontal snap-scroll row of 8; either cuts the section to under 1,200px.

### mobile-platform-02 — Bottom nav overlays and stays tappable over video modal
*Restaurant detail — video modal · mobile · fix · effort S · panel 3/3*

**Problem:** VideoGallery.tsx:358 modal is z-50; BottomNav.tsx:27 is also z-50 and later in DOM, so on mobile the tab bar paints over the 9:16 video's bottom edge and remains tappable through the backdrop.

**Fix:** Raise the video overlay to z-[100] (matching SignInModal) in VideoGallery.tsx:358 so it covers BottomNav, and add safe-area-aware padding-bottom so the close/controls clear the home indicator.

### mobile-platform-04 — Hero Save, Share, chevron and contact links under 44px
*Restaurant detail hero — Save/Share/contact actions · mobile · fix · effort S · panel 3/3*

**Problem:** Hero Save/Share pills are px-3 py-1.5 text-xs (~30px tall; BookmarkButton.tsx:166, ShareButton.tsx:106), the collections chevron is w-7 (~28px, BookmarkButton.tsx:175), and tel/website links (restaurants/[id]/page.tsx:417-437) are bare 12px text (~16px hit area).

**Fix:** Give all hero actions min-h-[44px] (py-2.5+) and the chevron min-w-[44px]; add py-3 -my-3 negative-margin hit areas to the tel/website/Instagram links so visuals stay compact but targets reach 44px.

### onboarding-05 — Confirmed users restart at pane 1 and re-walk the pitch
*OnboardingFlow.tsx — authed/unfinished entry · both · fix · effort S · panel 3/3*

**Problem:** Doc comment (OnboardingFlow.tsx:41-43) says authed users 'skip straight to pane 3', but stepIndex starts at 0 (line 59) and never jumps after the auth probe (136-149). Email-confirm returnees from /auth/callback re-read Problem/Solution before reaching 'You're all set'.

**Fix:** When authChecked && user, setStepIndex(STEPS.indexOf('city')) (or 'account' if home_city metadata exists), so confirmed users land one click from 'Start exploring'.

### onboarding-06 — Finishing onboarding wipes the city chosen at signup
*OnboardingFlow.tsx finishForAuthedUser · both · fix · effort S · panel 3/3*

**Problem:** After the email round-trip, selectedCity resets to ''. finishForAuthedUser upserts home_city: selectedCity || null and favorite_cities: [] (OnboardingFlow.tsx:263-264), overwriting the home_city the callback persisted from signup metadata (callback/route.ts:38-43).

**Fix:** Fall back to user.user_metadata.home_city when selectedCity is empty, and omit home_city/favorite_cities from the upsert entirely when neither exists, so a saved preference is never nulled.

### onboarding-07 — Modal asks for city twice in the same dialog
*SignInModal signup + OnboardingSteps modal wizard · both · fix · effort S · panel 3/3*

**Problem:** Signup form collects 'Home City (optional)' (SignInModal.tsx:807-833); seconds later the onboarding phase demands cities again from an empty selection (OnboardingSteps.tsx:47-49), and finish() overwrites home_city with selCities[0] (line 146) — the first answer is discarded.

**Fix:** Drop the Home City select from the signup form, or pre-seed OnboardingSteps selCities from the signup choice (pass homeCity into OnboardingSteps as initial state) so users never answer the same question twice.

### onboarding-08 — Modal wizard hard-blocks users outside the 6 active cities
*OnboardingSteps.tsx (modal wizard) · both · fix · effort S · panel 3/3*

**Problem:** canNext requires ≥1 city AND ≥1 cuisine (OnboardingSteps.tsx:117-121). Only 6 cities are active (verified: NY, LA, Chicago, SF, Austin, Miami) — a Boston user must lie to proceed. The page flow already received the skip fix (OnboardingFlow.tsx:202-208); the modal didn't.

**Fix:** Make both steps skippable: enable Continue with zero selections and add the same 'Not seeing your city? Continue and change it later' copy used in CityStep (OnboardingFlow.tsx:953-963).

### onboarding-10 — Onboarding signup inputs still 14px — iOS zooms on focus
*OnboardingFlow.tsx sign-up form inputs · mobile · fix · effort S · panel 3/3*

**Problem:** The earlier 16px sweep fixed SignInModal and reset-password, but OnboardingFlow's inputStyle still sets fontSize '14px' (OnboardingFlow.tsx:1431). Focusing any of the 5 fields on the conversion-critical signup pane triggers iOS viewport zoom, misaligning the fixed footer.

**Fix:** Change fontSize to '16px' in the inputStyle constant at OnboardingFlow.tsx:1425-1432, matching SignInModal.tsx:979-986.

### onboarding-12 — Onboarding errors never announced; render below the long form
*OnboardingFlow.tsx error banner · both · fix · effort S · panel 3/3*

**Problem:** The shared error div (OnboardingFlow.tsx:514-526) lacks role=alert/aria-live (SignInModal's has role=alert at line 633) and sits beneath the Terms paragraph, below the fold after submitting the 5-field form on mobile.

**Fix:** Add role="alert" and scroll the banner into view (or move it above the form) when error is set, so sighted mobile users and screen-reader users both perceive failures.

### product-conversion:pc-add-02 — Terms and Privacy links bounce signers-up back to pane 1, wiping the form
*Signup form Terms/Privacy links + lib/supabase/middleware.ts exempt list · both · fix · effort S · panel 1/3*

**Problem:** /terms and /privacy pages exist (src/app/terms, src/app/privacy) but are absent from ONBOARDING_EXEMPT_PREFIXES (src/lib/supabase/middleware.ts:17-23). The signup pane links to both (OnboardingFlow.tsx:1227,1237); an anonymous user who taps either is 307'd back to /onboarding with all five filled fields and wizard progress destroyed. Legal terms that cannot be read before consent are a trust and compliance problem at the exact conversion moment.

**Fix:** Add '/terms' and '/privacy' to ONBOARDING_EXEMPT_PREFIXES, and open both links in a new tab (target=_blank rel=noopener) from the signup form so wizard state survives even after the exemption lands.

### profile-saved-02 — Settings save silently wipes multi-city favorite_cities
*Profile > Settings save · both · fix · effort S · panel 3/3*

**Problem:** Settings submit writes favorite_cities = [homeCity] (profile/page.tsx:782) while the signup wizard collects up to 3 cities (OnboardingSteps.tsx:144). Editing a display name silently destroys the multi-city picks the wizard confirmed as 'saved'. Same single-city overwrite in OnboardingFlow.tsx:264,396.

**Fix:** Remove favorite_cities from the Settings update payload (home_city is saved separately), or add a visible favorite-cities multi-select chip control so the write matches what the user sees and edits.

### profile-saved-03 — 'Set your home city' link lands on wrong tab
*Home page personalization CTA → Profile tabs · both · fix · effort S · panel 3/3*

**Problem:** Home page fallback note links 'set your home city' to /profile (src/app/page.tsx:296), but /profile always opens the Collections tab — tab state is local useState with no URL param (profile/page.tsx:63). Users land on bookmarks, not the home-city field.

**Fix:** Initialize the tab from a ?tab= search param in profile/page.tsx, change the home page link to /profile?tab=settings, and sync tab switches to the URL so back-button and deep links work.

### profile-saved-04 — Profile page uses brand-only gold for CTAs
*Profile page CTAs and active tab · both · fix · effort S · panel 3/3*

**Problem:** globals.css:13-17 declares gold --color-primary brand-only and garnet --color-action for interactives, yet profile uses gold for the active tab underline, Add, Start exploring, and Save changes buttons (profile/page.tsx:244, 348, 408, 993) while its signed-out EmptyState uses garnet.

**Fix:** Swap those backgrounds/underline to var(--color-action) with var(--color-on-action) text (use the .action-cta helper), matching EmptyState, Navigation, and the rest of the app's action color discipline.

### rd-06 — 24% of heroes render as a blank black slab
*Hero — photo · both · fix · effort S · panel 3/3*

**Problem:** page.tsx:241 uses only photo_url || google_photo_url; 809/3,340 restaurants have neither, so the hero is a flat #1a1a1a block (page.tsx:301) — reads as broken. The cards' cuisine-keyed fallback (lib/restaurant.ts:41) and isStockFallbackPhoto helper are unused here.

**Fix:** Fall back to fallbackPhotoForCuisine() at reduced opacity with a small 'Representative photo' caption (isStockFallbackPhoto already detects it), or design a branded textured placeholder. Also fix the alt text that falsely claims 'interior or signature dish at X' (page.tsx:312).

### rd-07 — No-rating restaurants get silence instead of an explanation
*Hero + The Consensus — no-rating restaurants · both · fix · effort S · panel 3/3*

**Problem:** 813 restaurants (24%) have no rating source, so the score badge (page.tsx:409) and entire Consensus section (page.tsx:680) silently vanish. The page offers no rating signal and no reason why — users can't tell 'bad data' from 'bad restaurant'.

**Fix:** Render an honest placeholder in the hero ('No ratings yet — we're still gathering sources') plus a slim Consensus empty state linking to the restaurant's Google page so users can verify themselves. One conditional block each.

### rd-17 — Video modal lacks dialog semantics and focus management
*VideoGallery — video modal · both · fix · effort S · panel 3/3*

**Problem:** VideoGallery.tsx:356-366: the overlay div has no role="dialog"/aria-modal, focus stays on the grid button behind it, and Tab walks the obscured page. Escape works but screen-reader and keyboard users can't reliably reach the close button or 'Watch on TikTok' link.

**Fix:** Add role="dialog" aria-modal="true" aria-label={video.caption}, move focus to the close button on open, restore it to the trigger tile on close, and trap Tab within the card (small focus-trap effect, same pattern as the onboarding modal fix).

### search-nav-03 — Neighborhood suggestions route to a param Discover never reads
*SearchAutocomplete neighborhood results · both · fix · effort S · panel 3/3*

**Problem:** SearchAutocomplete.tsx:189 and :483 push /discover?nbhd=…, but discover/page.tsx only reads q/city/mode/preset/accolade/cuisine — clicking any Neighborhood suggestion lands on the unfiltered Browse view, silently dropping intent.

**Fix:** Route to /discover?q=<neighborhood>&city=<city> (the pattern DiscoverSearchResults.tsx:243 already uses), or teach the shell to read nbhd via filterState. Update the stale 'canonical param' comment.

### search-nav-04 — 'Search by dish' chip links to a mode that doesn't exist
*Home hero scent chips (src/app/page.tsx) · both · fix · effort S · panel 2/3*

**Problem:** page.tsx:242 links /discover?mode=dishes with no q; parseMode (discover/page.tsx:51-53) coerces unknown modes to 'browse', so the garnet CTA chip lands on plain Browse. SearchAutocomplete.tsx:197 also appends the same dead &mode=dishes.

**Fix:** Remove or repoint the chip (e.g. prefill a dish query, or focus the Discover search input via a real param the shell reads); strip &mode=dishes from goDish().

### search-nav-06 — Hero search Enter drops the city scope suggestions used
*Home hero search submit (SearchAutocomplete.tsx) · both · fix · effort S · panel 3/3*

**Problem:** SearchAutocomplete.tsx:165-173 submit() pushes /discover?q= without the city prop, so a Miami user's suggestions are Miami-scoped but pressing Enter or 'Search all results' lands on New York-scoped results — inconsistent and confusing.

**Fix:** In submit(), goNeighborhood() and goDish(), append &city=<city> when the prop is set so the destination matches the scope the dropdown advertised.

### search-nav-07 — Search API bills Google Places for results nobody renders
*/api/restaurants/search (route.ts) · both · fix · effort S · panel 3/3*

**Problem:** route.ts:144-155 calls searchPlaces for every authed query and returns a 'google' key, but SearchAutocomplete's SearchResponse never reads it. Pure cost plus added latency on each debounced keystroke. Also two select('*') queries feed an 8-row dropdown.

**Fix:** Delete the searchPlaces call (or actually render a 'From Google' group); change both restaurant sub-queries to select('id,name,cuisine,city,neighborhood') with smaller limits.

### search-nav-08 — A quarter of primary nav leads to a Coming Soon page
*Primary nav IA (navItems.ts, community/page.tsx) · both · suggestion · effort S · panel 3/3*

**Problem:** Community holds one of four nav slots (navItems.ts:36) on both header and bottom bar, but /community is a 'Coming Soon' waitlist (community/page.tsx:188). Every user's tab budget includes a dead-end; repeated taps erode trust.

**Fix:** Demote Community to the footer waitlist link until launch, and promote a live surface (e.g. /recent 'What's new') into the slot — or add a small 'Soon' badge to set expectations.

### cities-06 — Three unsynced sources of truth for the active city
*City state (home vs nav vs URL) · both · fix · effort M · panel 3/3*

**Problem:** Home uses profiles.home_city (page.tsx:114-128); the nav switcher uses localStorage gastro_city (useCity.ts); Discover uses the URL. A signed-in user who switches to Chicago in the header still gets "Where to eat in New York" on home indefinitely.

**Fix:** On setCity for signed-in users, also upsert profiles.home_city; for anonymous users store gastro_city in a cookie so the server-rendered home can read it. One city, everywhere.

### cities-07 — No visible city control on mobile Discover; subtitle city not tappable
*Discover header (mobile) · mobile · suggestion · effort M · panel 3/3*

**Problem:** On mobile the only city switcher is buried in the hamburger drawer (Navigation.tsx:400-449). The Discover subtitle bolds the city name (discover/page.tsx:166-170) but it's static text — users see "trending in New York" with no apparent way to change it.

**Fix:** Make the city name in the Discover subtitle a button (MapPin + chevron) that opens the existing city listbox inline, so changing city is one tap from where the city is read.

### cities-08 — Copy promises "search across everything"; results are city-locked
*Discover search · both · fix · effort M · panel 3/3*

**Problem:** Subtitle says "or search across everything" (discover/page.tsx:168-169), but DiscoverSearchResults.tsx:77-79 scopes every query to the active city. Searching a Brooklyn restaurant by name from "New York" returns "Nothing matches yet" — the AND of the two .or() clauses excludes it.

**Fix:** When the city-scoped query returns few/zero hits, run a second unscoped name-match query and render an "In other cities" section; otherwise change the copy to "search {city}".

### discover-browse-05 — Dish results capped globally before city filter, starving cities
*Search results — Dishes section · both · fix · effort M · panel 3/3*

**Problem:** useDiscoverResults.ts:415-425 fetches the global top-60 matching dishes, then post-filters by city. For 'taco' only 2 of the top 60 are city='New York' (verified via SQL), so NY users see ~2 dish hits despite hundreds existing.

**Fix:** Push the city scope into the top-dishes query server-side (inner-join filter on restaurants.city, mirroring cityIlikeClause) before the limit, or raise the limit and paginate, so dish hits reflect the active city.

### discover-browse-06 — Each keystroke blanks results to skeletons after ~550ms double debounce
*Search results loading behavior · both · fix · effort M · panel 3/3*

**Problem:** page.tsx:134-140 debounces the URL 250ms, useDiscoverResults.ts:521 debounces another 300ms, and DiscoverSearchResults.tsx:100-113 swaps the whole body to 3 skeletons whenever loading — so refining a query flashes content away repeatedly.

**Fix:** Keep previous results rendered while refetching (aria-busy + reduced opacity), only show skeletons when there are no prior results, and collapse to a single debounce by passing draft straight to the engine.

### discover-browse-08 — 'preserveOrder' lists actually render arbitrary database order
*Eater 38 / James Beard collections · both · fix · effort M · panel 3/3*

**Problem:** editorial.ts:59 promises hand-ordered lists ('work your way down it'), but DiscoverCollection.tsx:72 skips sorting and PostgREST returns unspecified row order with no .order() — Eater 38's presented sequence is meaningless while rankBasis implies curation.

**Fix:** Store list position (e.g., from restaurant_eater38_history rank) and order by it; until then sort these collections by Gastronome Score and change rankBasis copy to say so honestly.

### discover-map-01 — Search-this-area button arms on load and programmatic moves
*/discover map — Search this area · both · fix · effort M · panel 3/3*

**Problem:** Map 'idle' fires after fitBounds (RestaurantMap.tsx:303) and panTo (RestaurantMap.tsx:328), so handleBoundsChange (DiscoverMapView.tsx:166-169) sets boundsMoved=true on first load, on pin tap, and on chip filtering — the button appears without any user pan, defeating its move-to-arm design.

**Fix:** Arm only on user gestures: attach 'dragstart'/'zoom_changed' listeners that set a userMoved flag, and only emit onBoundsChange from idle when that flag is set; or compare idle bounds against last fitted/searched bounds before arming.

### discover-map-02 — Area search refits viewport away from the user's frame
*/discover map — Search this area · both · fix · effort M · panel 3/3*

**Problem:** Tapping 'Search this area' clamps `visible`, which rebuilds markers and re-runs fitBounds (RestaurantMap.tsx:299-304) — the map jumps off the viewport the user deliberately framed, and the resulting idle re-arms the button immediately.

**Fix:** Only fitBounds on the first marker build or when the unclamped result set changes; pass a `preserveViewport` flag from DiscoverMapView when the located-set change came from an areaBounds clamp.

### discover-map-05 — Pin preview card renders behind the mobile bottom sheet
*/discover map — pin preview card · mobile · fix · effort M · panel 3/3*

**Problem:** RestaurantMap renders the preview at inset-x-0 bottom-4 inside the map container (RestaurantMap.tsx:407-413), but the sheet (z-30, ≥4.5rem, 45vh default; DiscoverMapView.tsx:464-470) covers it at all detents — tapping a pin appears to do almost nothing on mobile.

**Fix:** On <lg, dock the preview above the sheet (offset by sheetHeight) or render it as a pinned first card inside the sheet and auto-set detent to 'half' on pin tap; keep the current overlay for desktop.

### discover-map-06 — Sheet drag handle fails on touch; no live drag
*/discover map — mobile bottom sheet · mobile · fix · effort M · panel 3/3*

**Problem:** The handle (DiscoverMapView.tsx:474-478) tracks only pointerdown/up with no touch-action suppression — vertical movement becomes page scroll and fires pointercancel, so pointerup never lands and detent drags silently fail on iOS/Android; the sheet also never follows the finger.

**Fix:** Add style={{ touchAction: 'none' }} to the handle, handle pointermove to resize the sheet live, snap to the nearest detent on release, and listen for pointercancel as a reset.

### ds-03 — Eyebrow labels use three different colors, two failing contrast
*Section eyebrow labels (cross-page) · both · fix · effort M · panel 3/3*

**Problem:** Same uppercase-eyebrow pattern renders in accent (restaurants/[id]/page.tsx:699, SuggestionCard.tsx:70, profile/page.tsx:151), action (SectionHeader.tsx:32, DiscoverBrowse.tsx:186), and gold (CollectionHeader.tsx:90). Accent eyebrows at 11-12px on cream are ~3.2:1 — below 4.5:1.

**Fix:** Standardize all eyebrows on var(--color-action) (7.3:1 on white) via SectionHeader; reserve gold for the dark CollectionHeader where it reads as brand on navy.

### ds-08 — Weights 300/600/800 are referenced but never loaded
*Typography weights (layout.tsx + global) · both · fix · effort M · panel 3/3*

**Problem:** layout.tsx:17-37 loads only 400/500/700, yet fontWeight:600 appears 42× (SectionHeader h2, Discover h1, decision-bar CTAs), font-semibold 64×, fontWeight:300 (community/page.tsx:64,99), font-extrabold (recent/page.tsx:85). Browsers synthesize these — blurry faux-bold, exactly what page.tsx:1132's comment already fixed once.

**Fix:** Add weight 600 to both next/font configs (cheap, self-hosted), and replace the stray 300→400 and extrabold→700 so every declared weight maps to a real font file.

### ds-12 — outline-none on key inputs defeats the global focus ring
*Form input focus states · both · fix · effort M · panel 3/3*

**Problem:** discover/page.tsx:197 (the main search input) uses focus:outline-none with no replacement; profile/page.tsx:400,528,865,916, OnboardingFlow.tsx:1121-1188, SignInModal.tsx:716,729 and community/page.tsx:94 use bare outline-none. These override globals.css :focus-visible, leaving keyboard users with zero focus indication on the app's primary inputs.

**Fix:** Create one shared input recipe (border token + focus-visible ring like GooglePlacesAutocomplete.tsx:410's focus:ring-[var(--color-action)]) and apply it to all eight sites; never ship outline-none without a visible substitute.

### home-04 — Trending rail dominated by unrated fresh-ingest restaurants
*Suggestions rail (Trending this week) · both · fix · effort M · panel 3/3*

**Problem:** Trending counts only ingest events (trending.ts:236-256, created_at of sweep rows); SQL shows ~4 of the top-12 NYC candidates have null ratings, 0 reviews, and stock photos. The homepage's first impression is "trending" places nobody has rated.

**Fix:** In page.tsx:135-139 filter the rail to restaurants with gastronomeScore != null (top up from the top-rated fallback), or rank ties by rating evidence — so every "Trending this week" card carries at least one real signal.

### mobile-platform-01 — Full-resolution photos downloaded for 80px thumbnails on cellular
*All card surfaces (RestaurantCard, SuggestionCard, map rows, photo strip) · mobile · fix · effort M · panel 3/3*

**Problem:** Cards render raw <img> with no sizing: 2,386 restaurants store full-size Supabase storage JPEGs (sample measured 938KB) and Google proxy URLs are pinned at ?w=1200. A 12-card list pulls ~10MB on cellular; next/image is configured but unused.

**Fix:** For card thumbnails request /api/photos ?w=200/400 (already in ALLOWED_WIDTHS, route.ts:38) and Supabase render API (?width=160&quality=70), or swap card <img> to next/image with sizes; keep w=1200 only for the detail hero.

### onboarding-02 ⭐ — Deep links are destroyed; users never reach the shared page
*Anonymous gate (lib/supabase/middleware.ts) + post-signup redirects · both · fix · effort M · panel 3/3*

**Problem:** middleware.ts:93-96 redirects every anon URL to /onboarding with url.search='' and no return param; after signup all paths push '/' (OnboardingFlow.tsx:273,407; SignInModal.tsx:351). A shared restaurant link converts a visitor, then strands them on home.

**Fix:** Redirect to /onboarding?next=<pathname+search>, persist it (state or sessionStorage), thread it through signup emailRedirectTo and /auth/callback, and router.push(next) on completion in both flows instead of '/'.

### onboarding-04 — Nav, footer and bottom tabs on onboarding are fake doors
*/onboarding page chrome (layout.tsx) · both · fix · effort M · panel 3/3*

**Problem:** Prod /onboarding renders header nav (Home/Discover/Saved/Community), a city selector, footer links and mobile BottomNav (layout.tsx:108-116 renders chrome globally). Every link bounces back to /onboarding, silently resetting wizard state — looks broken and erodes trust.

**Fix:** Hide Navigation, Footer and BottomNav on /onboarding (pathname check in each component or a route group with its own minimal layout), leaving only the logo and a Sign-in affordance.

### onboarding-09 — Two divergent onboarding wizards depending on entry path
*OnboardingFlow.tsx vs OnboardingSteps.tsx · both · suggestion · effort M · panel 3/3*

**Problem:** Page flow: 1 city, no cuisines, Problem/Solution pitch. Modal flow: up to 3 cities, 8 cuisines, a different welcome pitch. Profile quality (favorite_cuisines, favorite_cities) and brand voice depend on which door a user happened to enter.

**Fix:** Consolidate to one shared wizard component (the modal's city+cuisine steps are richer; the page's skip paths and a11y are better). Render it in both contexts so every account gets identical preference data.

### onboarding-11 — Taken username surfaces raw DB error after account creation
*Sign-up handlers (OnboardingFlow + SignInModal) · both · fix · effort M · panel 3/3*

**Problem:** profiles.username is UNIQUE (verified: profiles_username_key). Neither flow checks availability; SignInModal doesn't even validate charset (SignInModal.tsx:723-725). auth.signUp succeeds, then the profile upsert fails with a raw Postgres duplicate-key message; retrying yields 'user already registered' — a dead end.

**Fix:** Pre-check username with a select before signUp in both handlers, and map '23505/duplicate key' to 'That username is taken — try another' in friendlyAuthError (OnboardingFlow.tsx:1413-1423).

### product-conversion:pc-add-01 — Zero product analytics: the activation funnel is unmeasurable
*App-wide — product analytics / funnel instrumentation · both · suggestion · effort M · panel 1/3*

**Problem:** Grep-verified: no posthog/mixpanel/amplitude/gtag/@vercel-analytics anywhere in src or package.json. Onboarding pane views, signup attempts/successes, email-confirm completion, first save, and money-page CTA taps (Directions/Reserve/Call) are all untracked — drop-off points are invisible and none of this board's ~200 fixes can be validated after shipping.

**Fix:** Add lightweight event instrumentation (@vercel/analytics custom events or PostHog): wizard step views, signup submit/success, confirm-link completion, first save, first restaurant-detail view, and decision-bar CTA clicks. Use the measured funnel to sequence and validate the rest of this review.

### product-conversion:pc-add-03 — Email-confirm round trip is the structural activation cliff no candidate addresses
*Signup flow — email confirmation requirement (Supabase auth config + both wizards) · both · suggestion · effort M · panel 1/3*

**Problem:** Every email signup must leave the app, open an inbox, and click a link before receiving any value, and the middleware additionally locks authed-but-unfinished users into the wizard. Candidates fix the copy (onboarding-19) and the re-entry bugs (onboarding-05/06) but not the round trip itself — inbox detours routinely lose a large share of signups, and with Google OAuth down (onboarding-01) this is currently the only signup path.

**Fix:** For beta, disable confirm-email in Supabase so signUp returns a live session and the wizard continues uninterrupted (or implement inline 6-digit OTP via signInWithOtp). Measure signup-to-active rate before/after once pc-add-01 instrumentation lands; revisit confirmation when abuse risk warrants it.

### rd-02 ⭐ — Green 'Open' chip mislabels lifecycle status as open-now
*Decision bar — open status chip · both · fix · effort M · panel 3/3*

**Problem:** page.tsx:497-525 renders a green-dot 'Open' chip whenever business_status='OPERATIONAL' (3,278 of 3,340 rows). That field means 'not shut down', not 'open right now' — a diner at 11pm on a closed Monday still sees green 'Open'. Trust-breaking.

**Fix:** Compute open-now from restaurants.hours (per-day strings, 73% coverage) and show 'Open until 9:15 PM' / 'Closed · opens 12 PM'; where hours are missing, drop the chip or relabel 'Operating'. Keep red closed chips as-is.

### rd-03 — Opening hours never shown despite 73% data coverage
*Hours/contact — sidebar & decision bar · both · fix · effort M · panel 3/3*

**Problem:** restaurants.hours holds ready-to-render per-day strings ({"Monday":"Closed","Friday":"12 to 2:15 PM…"}) for 2,447/3,340 rows, but page.tsx renders no hours anywhere. For a dining-decision page, this is the single most-asked question after 'is it good'.

**Fix:** Add an Hours block in the sidebar above the map (page.tsx:1153): today's hours visible, other days behind a disclosure. Bold today, mark 'Closed' days. Feed the same data into the rd-02 open-now chip.

### rd-04 — 'Menu coming soon' shown to 436 restaurants whose menu exists
*Signature Dishes / menu empty state · both · fix · effort M · panel 3/3*

**Problem:** page.tsx:123-130 queries only restaurant_highlighted_dishes; restaurant_menu_items (scraped menus for 1,382 restaurants) is never rendered. 436 restaurants with a full scraped menu but no dish rollups get the 'Menu coming soon — we're still gathering' dashed empty state (page.tsx:1021-1025). False.

**Fix:** When dishes.length===0, fetch restaurant_menu_items and render a compact grouped menu (name + price, capped ~12 with 'View full menu'). Keep the 'coming soon' copy only for the true 58%-no-menu case.

### rd-10 — Flagship Critic's Note section never renders in production
*Critic's Note section · both · fix · effort M · panel 3/3*

**Problem:** page.tsx:626-672 leads the main column with the Infatuation pull-quote, called 'the single most persuasive signal' — but infatuation_review_snippet is NULL on all 3,340 rows (SQL verified). The page's designed lead element appears for zero restaurants.

**Fix:** Either backfill the snippet pipeline or restyle the existing data as the lead: promote the top dish's sample_quote or restaurant.description (1,016 rows) into the same garnet-bordered callout so the main column always opens with a voice, not a chart.

### visual-craft:va-01 — Two unrelated card systems present the same entity
*SuggestionCard vs RestaurantCard (home rail vs Discover/saved lists) · both · fix · effort M · panel 1/3*

**Problem:** Verified: SuggestionCard (src/components/cards/SuggestionCard.tsx:49-52) is rounded-sm, aspect-square, cool grey shadow-md jumping to hover:shadow-2xl; RestaurantCard (src/components/RestaurantCard.tsx:157,367) is borderRadius var(--r-card) 14px, aspect-[16/10], warm-token styling. One tap from home to Discover, the restaurant 'object' changes shape, corner radius, photo crop, and elevation language — the single biggest cohesion break in the product, beyond ds-09's radius framing.

**Fix:** Converge SuggestionCard onto the RestaurantCard contract: var(--r-card) radius, a shared media aspect (16:10), var(--shadow-1)→var(--shadow-2) elevation on hover, and the same meta-row order (ScorePill, name, cuisine, neighborhood). If a photo-forward tile is intentionally distinct, fork it deliberately from shared tokens, not ad-hoc utilities.

### cities-09 — Map panned beyond city string goes empty despite data existing
*Discover map mode · both · fix · effort L · panel 3/3*

**Problem:** DiscoverMapView.tsx:137-146 fetches by city name (cap 40); "Search this area" only filters that slice client-side (lines 171-182). Pan from Manhattan to Williamsburg and the map empties even though 269 Brooklyn restaurants have coordinates. The UI even admits it (line ~370 caveat).

**Fix:** Make "Search this area" query by viewport bbox (latitude/longitude .gte/.lte range, ignoring the city string) so the map is geography-driven; keep the city only for initial centering.

### discover-browse-16 — No way to browse a city's full restaurant list
*Browse mode information architecture · both · suggestion · effort L · panel 3/3*

**Problem:** Browse shows only 10 restaurants plus 7 collection cards; search caps at 40 (RESULT_CAP, no pagination) and collections at 48. New York's 697 restaurants are mostly unreachable as a list — 'browse' can't actually browse.

**Fix:** Add an 'All restaurants in {city}' section below collections (paginated/load-more list ordered by Gastronome Score, reusing RestaurantCard compact), and add a load-more affordance to DiscoverSearchResults instead of the 'refine your search' dead-end.

### discover-map-07 — Map mode straddles a scrolling page and the bottom nav
*/discover map — page architecture · mobile · fix · effort L · panel 3/3*

**Problem:** Wrapper height calc(100dvh − 7.5rem) (DiscoverMapView.tsx:264) ignores the ~230px Discover header above it, the fixed z-50 BottomNav (BottomNav.tsx:27, 64px+safe-area), and the footer below — the sheet lands half below the fold/behind the nav, and greedy map pan (RestaurantMap.tsx:224) fights page scroll.

**Fix:** In mode=map, pin the map between the sticky header and BottomNav (fixed inset with top-16/bottom safe-area), collapse the shell's title/search header, and suppress the footer so the page itself never scrolls.


## P2

### a11y-ergonomics:a11y-01 — Search result updates are silent for screen readers
*/discover search results (src/components/discover/DiscoverSearchResults.tsx) · both · fix · effort S · panel 1/3*

**Problem:** The results body swaps between skeletons (aria-busy at line 102, verified) and content with no live region anywhere in the tree — SR users typing in the persistent search hear nothing when counts change, when sections appear, or when 'Nothing matches yet' renders. WCAG 4.1.3 status messages.

**Fix:** Add a visually-hidden role="status" aria-live="polite" element that announces '{n} restaurants, {n} dishes, {n} neighborhoods for {q}' when loading completes, and announces the empty-state copy; pairs naturally with discover-browse-06's keep-previous-results work.

### a11y-ergonomics:a11y-02 — JS-driven motion bypasses the prefers-reduced-motion guard
*Map and scroll motion (RestaurantMap.tsx, DiscoverMapView.tsx:202, globals.css:135) · both · fix · effort S · panel 1/3*

**Problem:** globals.css:135 correctly gates CSS animation behind prefers-reduced-motion, but matchMedia appears nowhere in src (verified) — Google Maps panTo/fitBounds fly-throughs (continuous under the discover-map-03 hover bug) and smooth scrollIntoView (DiscoverMapView.tsx:202) still animate for vestibular-sensitive users. WCAG 2.3.3.

**Fix:** Add a shared prefersReducedMotion() helper using matchMedia('(prefers-reduced-motion: reduce)'); when true, use scrollIntoView({behavior:'auto'}), map.setCenter instead of panTo, and non-animated fitBounds. Apply at the three call sites.

### a11y-ergonomics:a11y-03 — Undo affordance vanishes on a fixed 3-second timer
*Save/unsave Undo toast (src/components/BookmarkButton.tsx:79-88) · both · fix · effort S · panel 1/3*

**Problem:** The only recovery for an accidental save/unsave is an Undo button inside a toast auto-dismissed after 3s (timer verified at BookmarkButton.tsx:79-88). WCAG 2.2.1 requires time limits be extendable; motor-impaired and SR users routinely need longer, and the toast is additionally clipped per profile-saved-01.

**Fix:** Extend dismissal to >=6s and pause the timer while the toast is hovered or contains focus; role="status" is already present at line 215. Apply the same timing to the profile-saved-19 collection-delete undo when built.

### cities-12 — Zero-restaurant city renders seven dead collection cards below empty state
*Discover browse (empty city) · both · fix · effort S · panel 3/3*

**Problem:** For ?city=Boston the top-10 empty state says "Browse a curated collection below" (DiscoverBrowse.tsx:304-336), yet all seven collection cards still render "Explore the list" and each dead-ends on "Nothing here yet" — a wall of broken promises.

**Fix:** When topTen is empty, replace the collections rail with an active-cities panel (6 cities + restaurant counts, one tap to switch) and suppress the collection cards for that city.

### cities-16 — Icon-only brand pills are unexplained on touch screens
*Top 10 list accolade pills · mobile · suggestion · effort S · panel 3/3*

**Problem:** Top10Trending pills are icon-only (Michelin rosette, Bibendum, 13px JBF medallion, Eater "E") with meaning carried by title/aria-label (Top10Trending.tsx:146-198). Tooltips don't exist on mobile, and the JBF medallion is illegible at 13px.

**Fix:** Add a visible 10px text label inside each pill ("2 stars", "Bib", "James Beard", "Eater 38") — the pills already flex-wrap, and labels make the cluster scannable for first-time users on any device.

### cities-20 — Sitemap advertises city pages that serve crawlers no city content
*Sitemap per-city URLs / SEO · web · suggestion · effort S · panel 3/3*

**Problem:** sitemap.ts:96-107 emits /discover?city=X at priority 0.7, but prod SSR for those URLs returns the onboarding wizard plus a client-only shimmer (verified via fetch of /discover?city=Chicago) — no city name, no restaurants, nothing indexable.

**Fix:** Until a server-rendered city landing exists, remove the ?city= entries from sitemap.ts; longer term, build a thin RSC city page (top 10 + counts server-rendered) and point the sitemap there.

### discover-browse-12 — role=img on map panel hides numbered pin links from AT
*Browse Top-10 map panel accessibility · web · fix · effort S · panel 3/3*

**Problem:** Top10Trending.tsx:569-571 puts role="img" + aria-label on the panel containing ten interactive pin <Link>s; role=img makes descendants presentational, so screen readers can't reach the pins (and may announce only the label).

**Fix:** Drop role="img" — use a plain region with aria-label (or aria-hidden the decorative tile only), leaving pin links exposed; they duplicate the list, so alternatively aria-hidden the whole panel and keep pins tabindex=-1 consistently.

### discover-browse-13 — Switching city wipes query, collection, and map mode
*City switcher × discover state · both · fix · effort S · panel 3/3*

**Problem:** useCity.ts:105 always pushes bare /discover?city=<name>. A user comparing 'Michelin Stars' or a search term across cities loses ?q/?preset/?mode on every switch and is dumped back to default Browse.

**Fix:** When already on /discover, have setCity patch only the city param (preserve q, preset, accolade, cuisine, mode) — e.g., merge into existing search params before router.push.

### discover-browse-15 — Network errors masquerade as 'Nothing here yet' empty state
*Collection view error handling · both · fix · effort S · panel 3/3*

**Problem:** DiscoverCollection.tsx:82-84 catches any fetch error and sets restaurants to [], rendering the same 'Nothing here yet' empty state as a genuinely empty collection — users can't tell failure from absence.

**Fix:** Track an error state separately; on failure show an EmptyState with attention tone, 'Something went wrong loading this list' copy and a Retry onCtaClick that re-runs the fetch.

### discover-browse-19 — Browse renders zero photography; curated collection images go unused
*Editorial collection cards · both · suggestion · effort S · panel 3/3*

**Problem:** editorial.ts defines a curated image per collection (lines 96-191) but CollectionCard (DiscoverBrowse.tsx:70-144) ignores it — the default Discover surface of a food-discovery app is entirely text, weakening scent and appetite appeal.

**Fix:** Render collection.image as a small leading thumbnail or card header band (with alt='' decorative treatment), keeping the calm layout; alternatively delete the unused field to stop carrying dead config.

### discover-browse-20 — Empty states offer advice but no actionable escape
*Search and collection empty states · both · suggestion · effort S · panel 3/3*

**Problem:** DiscoverSearchResults.tsx:117-126 says 'Try a broader term' and DiscoverCollection.tsx:141-147 says 'Try another city' — but EmptyState's supported CTA props are unused, so there's no clear-search button or city-switch affordance.

**Fix:** Pass onCtaClick='Clear search' (calls the shell's clearQuery via prop or link to /discover?city=) plus secondary 'Browse {city} top 10'; for collections add per-active-city links where the collection has results.

### discover-browse-21 — Auto-generated cuisine filters masquerade as Gastronome editorial
*?cuisine= deep-link collection header · both · suggestion · effort S · panel 3/3*

**Problem:** page.tsx:84-97 synthesizes ?cuisine=French into eyebrow 'GASTRONOME EDITORIAL', curator 'Gastronome', and literal copy 'French restaurants in this city.' — un-interpolated 'this city' plus curation claims on a raw column filter erode trust.

**Fix:** Interpolate the actual city name into description/longDescription, change eyebrow to 'CUISINE' (no curator/brand), and set rankBasis 'Ranked by Gastronome Score' so the header reads as a filter, not a hand-picked list.

### discover-browse-22 — Rows ranked by Gastronome Score but display only Google/Yelp
*Browse Top-10 list rows · both · suggestion · effort S · panel 3/3*

**Problem:** DiscoverBrowse sorts by gastronomeScore, yet Top10Trending.tsx:461-499 shows only raw Google/Yelp numbers — a 4.5 can rank above a 4.8, reading as a broken sort, and the product's namesake metric is absent from its flagship list.

**Fix:** Add the ScorePill (GastronomeScoreBadge) to each row's rating cluster — leading metric, with Google/Yelp demoted beneath — matching RestaurantCard's established hierarchy.

### discover-map-15 — Selecting a cuisine removes all other cuisine chips
*/discover map — cuisine chips · both · fix · effort S · panel 3/3*

**Problem:** cuisineOptions derive from the already-filtered result set (DiscoverMapView.tsx:243-254), so picking 'Italian' refetches Italian-only rows and every other cuisine chip vanishes — switching cuisines requires deselecting first, an invisible two-step.

**Fix:** Compute chip options from a cuisine-unfiltered memo (run the counts before applying the cuisine facet) or freeze the option list while a cuisine is active so siblings stay one tap away.

### discover-map-18 — Persistent bottom sheet misuses role=dialog
*/discover map — bottom sheet semantics · mobile · fix · effort S · panel 3/3*

**Problem:** The sheet declares role="dialog" aria-label="Map results" (DiscoverMapView.tsx:470-471) but is non-modal, always present, and has no focus management — screen readers announce a dialog that never behaves like one.

**Fix:** Change to role="region" (keep the aria-label) and expose the detent via aria-expanded on the handle button; reserve dialog semantics for true modals.

### ds-07 — Trending list hover uses gold pins and invisible white row highlight
*Top10Trending hover states · web · fix · effort S · panel 3/3*

**Problem:** Top10Trending.tsx:334 and 619 color the active rank circle and map pin var(--color-primary) with white text (~2:1) — gold as an interactive state again. The paired row highlight is var(--color-surface) (pure white) on cream, nearly imperceptible.

**Fix:** Use var(--color-action) for active pin/circle and 'color-mix(in srgb, var(--color-action) 8%, transparent)' for the row highlight — the exact selected-state recipe Navigation.tsx:286 already uses.

### ds-13 — Four different star colors for the same rating concept
*Star/rating iconography · both · fix · effort S · panel 3/3*

**Problem:** Stars render amber-400 (StarRating.tsx:35), brand gold (FavoritesSection.tsx:131), slate-blue accent fill (Top10Trending.tsx:492-494 — a blue star reads as UI, not rating), and #ca8a04 (restaurants/[id]/page.tsx:762). No token governs the most repeated glyph in a ratings product.

**Fix:** Add --color-rating-star (suggest the existing #ca8a04 amber-600 for contrast) to globals.css and use it at all four sites; never the accent blue.

### ds-22 — Compact card prints the Gastronome Score twice in two styles
*RestaurantCard score presentation · both · suggestion · effort S · panel 3/3*

**Problem:** RestaurantCard compact renders the score as a navy ScorePill in the meta row (RestaurantCard.tsx:232) AND as ConsensusMeter's headline number (line 272, ConsensusMeter.tsx:84) an inch below — same value, two visual identities (navy pill vs navy text + garnet bar), doubling number noise on every list row.

**Fix:** Drop the ScorePill from the compact meta row and let ConsensusMeter own the number (it adds the trust context anyway), or pass a `hideHeadline` prop to ConsensusMeter — one representation per card.

### home-03 — Cards show contradictory "No rating yet · 0 reviews"
*Suggestions rail card · both · fix · effort S · panel 3/3*

**Problem:** SuggestionCard.tsx:39 takes google_review_count ?? yelp_review_count and line 104 only checks != null, so fresh-sweep rows (e.g. "Sadie's", 0 reviews, null rating — verified in DB) render "No rating yet" beside "0 reviews" — nonsense on the lead rail.

**Fix:** Change the guard at SuggestionCard.tsx:104 to reviewCount > 0, and when score is null replace the footer row with a single honest line ("Too new to rate") so the card never asserts a zero count.

### home-08 — Stock Unsplash photos presented as real restaurant photos
*Suggestions rail card · both · fix · effort S · panel 3/3*

**Problem:** ~24% of the catalog resolves to cuisine-keyed stock images; Discover's RestaurantCard badges them ("stock photo" pill, RestaurantCard.tsx:143,185-190) but the homepage SuggestionCard.tsx:30-64 shows the same Unsplash shot unlabeled — users believe they're seeing the venue.

**Fix:** Import isStockFallbackPhoto in SuggestionCard.tsx and render the same bottom-left translucent "Stock photo" pill RestaurantCard uses whenever the resolved src (or onError fallback) is stock.

### home-10 — "Start here" section is the last thing on the page
*Editor's picks section · both · suggestion · effort S · panel 3/3*

**Problem:** The Editor's picks header reads "Start here" (page.tsx:338-341) yet sits below the hero, 8 trending cards, and both personal rails — on mobile that's 4,000+px down. The label contradicts its position; first-time users never reach their starting point.

**Fix:** For visitors with no favorites/recent searches, render Editor's picks directly under the hero (swap section order in page.tsx), or rename the header to "Browse by occasion" if it stays last.

### home-12 — "Set your home city" detours to a buried profile form
*Suggestions city note · both · fix · effort S · panel 2/3*

**Problem:** The fallback note (page.tsx:286-304) links to /profile, where home city is one field inside an edit form — and anonymous users (once the gate lifts) get bounced to onboarding from /profile. A header city switcher already exists one inch away.

**Fix:** Replace the /profile link with an inline city picker — reuse the useCity cities list as tappable chips that set the city immediately — or scroll-cue the existing header switcher; keep /profile only for signed-in persistence.

### home-13 — Gastronome Score appears with zero explanation on home
*Suggestions rail / ScorePill · both · suggestion · effort S · panel 3/3*

**Problem:** The navy "8.4 /10" pill is the homepage's lead metric, but its only affordance is a desktop-only title tooltip (GastronomeScoreBadge.tsx:45); the methodology popover lives solely on detail pages. First-time visitors can't tell it from a Google star.

**Fix:** Add a one-line footnote under the Suggestions SectionHeader — "Gastronome Score: Google, Yelp & critics on one 0–10 scale" — linking to the methodology, so the namesake number earns trust at first contact.

### home-14 — Favorites rail uses raw single-source stars beside Score pills
*Your favorites rail · both · fix · effort S · panel 3/3*

**Problem:** FavoritesSection.tsx:97,129-138 shows formatRating(google_rating ?? yelp_rating) with a gold star while SuggestionCard directly above leads with the Gastronome ScorePill — two rating languages and scales (5-pt vs 10-pt) on one screen.

**Fix:** Swap the star row in FavoritesSection for ScorePill fed by gastronomeScore(r) (add the rating-source columns to the select at line 50), matching the card contract used everywhere else.

### home-16 — Recent-search remove button has a ~22px tap target
*Recent searches rail · mobile · fix · effort S · panel 3/3*

**Problem:** RecentSearches.tsx:138-145 renders the X as p-1 around a 14px icon — roughly 22px square, well under the 44px minimum, and it sits beside the row's main link so mis-taps navigate to /discover instead of deleting.

**Fix:** Increase to a 44px hit area (e.g. className p-3 -m-1.5 with X size 16) and keep the visual icon small; the absolute positioning already isolates it from the row link.

### mobile-platform-05 — Two remaining sub-16px inputs trigger iOS focus zoom
*Discover map search + BookmarkButton collection input · mobile · fix · effort S · panel 3/3*

**Problem:** The 16px input sweep missed DiscoverMapView.tsx:282 ('Search the map' input is text-sm/14px) and BookmarkButton.tsx:297 ('New collection…' input is text-sm). Focusing either zooms the viewport on iOS Safari, breaking the map layout.

**Fix:** Set fontSize: '16px' (or text-base) on both inputs, matching the convention documented in community/page.tsx:97 and profile/page.tsx:1018.

### mobile-platform-07 — Sticky chips offset ignores safe-area inset in standalone
*Recent feed — sticky filter chips · mobile · fix · effort S · panel 3/3*

**Problem:** recent/page.tsx:97 pins chips at sticky top-16, but Navigation.tsx:146 adds env(safe-area-inset-top) padding to the h-16 header. In installed/standalone mode on notched iPhones the chips slide ~47px under the header while scrolling.

**Fix:** Expose the real header height as a CSS variable (e.g. --header-h: calc(4rem + env(safe-area-inset-top))) set in layout, and use top: var(--header-h) for this and any future sticky offsets.

### mobile-platform-08 — Action bar hardcodes 64px nav offset that can drift
*Restaurant detail — sticky mobile action bar · mobile · fix · effort S · panel 3/3*

**Problem:** restaurants/[id]/page.tsx:1434 pins the Reserve/Directions bar at calc(64px + inset), but BottomNav.tsx:39 uses min-h-16 — with larger text scaling the nav exceeds 64px and occludes the bar; the 60px spacer (line 1416) is also slightly shorter than the bar.

**Fix:** Have BottomNav publish its height as a CSS variable (--bottom-nav-h) and use bottom: calc(var(--bottom-nav-h) + env(safe-area-inset-bottom)); size the spacer from the same variable.

### mobile-platform-10 — Global smooth-scroll animates back-navigation scroll restoration
*Global — scroll restoration · both · fix · effort S · panel 3/3*

**Problem:** globals.css:99 (html{scroll-behavior:smooth}) plus the scroll-smooth class on <html> (layout.tsx:96) make browser history restoration animate — tapping back from a restaurant to a long Discover list visibly scroll-animates from top, feeling broken on mobile.

**Fix:** Remove the global smooth scroll and apply it only where intended (anchor jumps) via Next's data-scroll-behavior="smooth" attribute or a :target-scoped rule, keeping instant restoration for history navigation.

### mobile-platform-13 — Manifest locks installed app to portrait
*PWA manifest · mobile · suggestion · effort S · panel 3/3*

**Problem:** manifest.ts:12 sets orientation:'portrait', so the installed Android app refuses to rotate — painful on tablets and for users browsing photo strips/maps in landscape; no layout actually requires portrait.

**Fix:** Remove the orientation field (defaults to any) or set 'natural'; verify the Discover map and restaurant hero render acceptably in landscape afterwards.

### mobile-platform-15 — Search keyboards show Return instead of Search key
*Home hero & map search inputs · mobile · suggestion · effort S · panel 3/3*

**Problem:** The primary home-hero input (SearchAutocomplete.tsx:261-283) is type="text" with no enterKeyHint/inputMode, and the map input (DiscoverMapView.tsx:276) likewise — mobile keyboards show a generic return key, weakening the search affordance. Discover's shell input already does this right.

**Fix:** Add type="search", inputMode="search", enterKeyHint="search" to both inputs (mirroring discover/page.tsx:190-192); keep appearance overrides to suppress the native clear button where a custom one exists.

### mobile-platform-16 — Save action unreachable by thumb on restaurant pages
*Restaurant detail — sticky action bar · mobile · suggestion · effort S · panel 3/3*

**Problem:** Save/bookmark lives only at the top of the hero (restaurants/[id]/page.tsx:347), out of thumb reach on tall phones, while the thumb-zone sticky bar (lines 1439-1481) carries only Reserve and Directions — the app's core retention action is the hardest to reach.

**Fix:** Add a compact BookmarkButton (icon-only, 44px) as a third element in the sticky mobile action bar, reusing the existing card variant; keep the hero instance for desktop.

### mobile-platform-17 — 10px tab labels and px-locked inline font sizes
*Bottom navigation & inline type · mobile · suggestion · effort S · panel 3/3*

**Problem:** BottomNav.tsx:55 labels are text-[10px] — below the ~11pt floor — and many inline styles hardcode px (fontSize:'16px','17px','11px' across detail page/modals), so user font-size preferences (rem-scaling) never apply to them.

**Fix:** Bump tab labels to 11-12px equivalent in rem (text-[0.6875rem]) and convert inline px fontSize values to rem so browser/system text-size settings scale the UI.

### onboarding-13 — Modal wizard progress dots invisible to assistive tech
*OnboardingSteps.tsx progress dots · both · fix · effort S · panel 3/3*

**Problem:** OnboardingSteps.tsx:161-174 renders bare unlabeled spans, while the page flow's dots received role=list, aria-current and sr-only step names (OnboardingFlow.tsx:433-455). Screen-reader users in the modal get no sense of position or length.

**Fix:** Copy the OnboardingFlow markup: ol with aria-label 'Step x of 4', li per step with aria-current and sr-only labels ('Welcome', 'Cities', 'Cuisines', 'Done').

### onboarding-14 — Returning users' sign-in is a tiny footnote under the card
*/onboarding sign-in escape hatch · both · suggestion · effort S · panel 3/3*

**Problem:** Every signed-out URL lands on /onboarding, so returning users (cleared cookies, new device) are the most common visitors — yet sign-in is text-xs below the card (OnboardingFlow.tsx:609-632) while the header offers a separate modal-based 'Sign in', two inconsistent paths.

**Fix:** Promote sign-in to a visible secondary button inside the card header on pane 1, and unify both entries on one mechanism (openSignInModal or /auth/login) for a consistent returning-user path.

### onboarding-16 — Onboarding tap targets fall well below 44px
*City/cuisine chips and password toggles · mobile · fix · effort S · panel 3/3*

**Problem:** City chips py-2 ≈33px (OnboardingFlow.tsx:907), modal city/cuisine chips py-1.5 ≈29px (OnboardingSteps.tsx:358, 464), eye toggle p-1 ≈24px (OnboardingFlow.tsx:1166-1175). Primary selection controls in the funnel are easy to mis-tap.

**Fix:** Add min-h-[44px] (and min-w on the eye toggle) to the chip buttons at those lines, increasing py on mobile breakpoints; keep visual density on desktop with sm: overrides.

### onboarding-17 — Reset link declared invalid after only 1.5 seconds
*auth/reset-password/page.tsx · both · fix · effort S · panel 3/3*

**Problem:** reset-password/page.tsx:64-67 flips to the 'link is invalid or expired' screen if no session/recovery event arrives within 1500ms — slow networks or cold Supabase token exchange lose the race and show a false failure on a valid link.

**Fix:** Raise the window to ~5s and keep the existing 'Verifying link…' button state visible meanwhile; only show the invalid screen on a definitive auth error or after the longer timeout.

### product-conversion:pc-add-04 — Wizard forgets all progress on refresh or accidental navigation
*OnboardingFlow.tsx / OnboardingSteps.tsx wizard draft state · both · fix · effort S · panel 1/3*

**Problem:** Step index, selected city, and the five typed signup fields live only in component state (OnboardingFlow.tsx:59ff). A refresh, browser back, or tapping any of the chrome links flagged in onboarding-04 restarts the funnel at pane 1 with everything wiped — and mid-funnel users who lose typed work are the likeliest to abandon for good.

**Fix:** Persist draft wizard state (stepIndex, selectedCity, non-password form fields) to sessionStorage on change and rehydrate on mount; clear on completion. Cheap insurance that compounds with onboarding-04 and pc-add-02.

### profile-saved-06 — Saved, Bookmarks, and Favorites name the same list
*Saved / Profile / BookmarkButton vocabulary · both · fix · effort S · panel 3/3*

**Problem:** One list is called 'Saved' (nav), 'Bookmarks' (saved/page.tsx:158), 'Favorites' (profile/page.tsx:452, home rail), and toasts say 'Saved to favorites' (BookmarkButton.tsx:120). New users cannot tell whether these are one list or three.

**Fix:** Pick one noun (suggest 'Saved') and apply it to the /saved section heading, profile Collections tab section, home rail header, and BookmarkButton toasts/aria-labels.

### profile-saved-07 — Rename/Delete icons are ~26px tap targets
*Profile > Collections rename/delete controls · mobile · fix · effort S · panel 3/3*

**Problem:** Collection Rename and Delete are p-1.5 buttons wrapping 14px icons (~26px square) sitting adjacent at profile/page.tsx:555-576 — far below the 44px minimum, and a mis-tap hits the destructive Delete next to Rename.

**Fix:** Give both buttons min-w/min-h 44px (negative margins to preserve visual density) and increase the gap between them; optionally move Delete behind an overflow menu to separate destructive from safe actions.

### profile-saved-09 — Save confirmation renders off-screen above the form
*Profile > Settings save feedback · mobile · fix · effort S · panel 3/3*

**Problem:** Success/error banners mount at the top of the settings form (profile/page.tsx:810-836) while the Save button sits at the bottom (:988). On mobile the confirmation appears outside the viewport, so the tap feels unacknowledged.

**Fix:** Show inline status text next to the Save button (with aria-live), or scrollIntoView the banner when set; keep the 2.5s auto-dismiss.

### profile-saved-10 — 'Kept on this device' subtitle is now false
*/saved header copy · both · fix · effort S · panel 3/3*

**Problem:** Subtitle says 'Your bookmarked restaurants and lists, kept on this device' (saved/page.tsx:128), but CollectionsSync mirrors saves to Supabase for signed-in users, and anonymous users can never reach /saved (middleware gate). The device framing undermines cross-device trust.

**Fix:** Change copy to 'Saved to your account — available on all your devices' (or branch on auth state); also update the stale anonymous-localStorage claims in navItems.ts:20-22 and BookmarkButton.tsx:36-37 comments.

### profile-saved-11 — Empty collections vanish from the Saved page
*/saved collections sections · both · fix · effort S · panel 3/3*

**Problem:** /saved filters out collections with zero resolvable restaurants (saved/page.tsx:98-100), while /profile shows them with an 'Empty' hint. A just-created 'Date Night' list is invisible on the primary Saved surface — it reads as data loss.

**Fix:** Render empty collections on /saved using the same dashed 'Empty — add restaurants from any restaurant page' treatment as profile/page.tsx:621-632, with a Browse CTA into /discover.

### profile-saved-12 — Avatar initial ignores display name, never updates
*Header account avatar (identity) · both · fix · effort S · panel 3/3*

**Problem:** Navigation derives the initial from metadata full_name/name/email (Navigation.tsx:72-77), skipping the display_name metadata written at signup and profiles.display_name; renaming yourself in Settings (which updates only the profiles row) never changes the header identity.

**Fix:** Add metadata.display_name to the fallback chain, and after Settings save call supabase.auth.updateUser({ data: { display_name } }) so the header initial reflects the new name immediately.

### profile-saved-23 — Sign-out destinations inconsistent; lands on marketing wizard
*Sign out (profile header, settings footer, drawer) · both · fix · effort S · panel 3/3*

**Problem:** Profile sign-out pushes to /onboarding (profile/page.tsx:67) while the drawer pushes to / (Navigation.tsx:133); both dump users onto pane 1 of the 4-step pitch with only a small 'Sign in' link. The profile page also shows two sign-out buttons (header + settings footer).

**Fix:** Use one shared handler routing to a signed-out state with prominent sign-in (e.g., /auth/login), and keep a single sign-out placement — settings footer — removing the header duplicate.

### rd-05 — Video count header contradicts what the gallery shows
*On Social — video count header · both · fix · effort S · panel 3/3*

**Problem:** page.tsx:119-122 counts ALL restaurant_videos rows for the '{n} videos' header, but /api/restaurants/videos/route.ts:44-47 filters TikTok to like_count≥100 and limits to 20. SQL: 913 restaurants overstate the count; 34 render the header above the 'No social videos yet' empty state.

**Fix:** Apply the identical filter to the head count in getRestaurantData (.or('like_count.gte.100,platform.eq.instagram')), and cap the displayed number at the API's 20-row limit ('20+ videos').

### rd-08 — Displayed source weights don't sum to 100%
*GastronomeScoreBadge popover + ConsensusBreakdown weights · both · fix · effort S · panel 3/3*

**Problem:** GastronomeScoreBadge.tsx:195-198 and ConsensusBreakdown.tsx:204-210 print raw pre-renormalization weights: a Google-only restaurant shows '62% weight' (should be 100%), Google+Infatuation sums to 107%. Undermines the very explainability these panels exist for.

**Fix:** Display c.weight / totalWeight (sum over present sources) so weights always sum to 100%. The renormalization already happens in score.ts:234-235 — mirror it for display in both components.

### rd-11 — Breadcrumb row unreadable over bright photo tops
*Hero — breadcrumb / Save / Share row · both · fix · effort S · panel 3/3*

**Problem:** The hero gradient fades to black/5 at the top (page.tsx:321) while breadcrumbs render at rgba(255,255,255,0.6) 12px (Breadcrumb.tsx:28) directly over the brightest part of the 55%-opacity photo — white-on-sky/plate photos make the trail and chevrons illegible.

**Fix:** Add a top scrim (bg-gradient-to-b from-black/45 to-transparent over the top ~96px) or give the breadcrumb/actions row a subtle backdrop-blur pill like BookmarkButton's bg-white/10 treatment. Raise crumb alpha to 0.8.

### rd-13 — Michelin stars deserve hero placement, not a thin banner
*Accolades banner / hero · both · suggestion · effort S · panel 3/3*

**Problem:** A 3-Michelin-star restaurant's strongest trust signal renders as a text-xs pill in a faint gold band below the decision bar (page.tsx:577-590, AccoladesBadges.tsx:70). Above the fold, score and price outrank an award users explicitly seek.

**Fix:** Echo the top accolade in the hero next to the cuisine pill (red star glyphs + 'Michelin 3 Stars'), keeping the full banner below. Also migrate AccoladesBadges' hardcoded Tailwind reds/ambers/pinks to the existing --color-accolade-* tokens (globals.css:55-57).

### rd-16 — Platform tabs offer dead-end filters; sort options sort nothing
*VideoGallery — platform tabs & sort · both · fix · effort S · panel 3/3*

**Problem:** Tabs always include TikTok and Instagram (VideoGallery.tsx:241-245) even when one platform has zero rows, yielding 'No tiktok videos found' (l.349-353). 'Most Viewed' sort is offered though 2,560 videos carry zero/null counts, producing arbitrary order with no cue.

**Fix:** Hide (or disable with count badges) tabs whose platform has zero videos; hide the whole controls row when videos.length < 4. Drop 'Most Viewed' when every loaded video has view_count 0.

### rd-20 — Price glyphs invisible to screen readers and barely visible unfilled
*Decision bar — price tier · both · fix · effort S · panel 3/3*

**Problem:** page.tsx:478-495: screen readers announce '$$$$' as repeated 'dollar'; the unfilled glyphs use --color-border #EBEBEB on white (~1.2:1), effectively invisible, so '$$' and '$$$$' look identical at a glance. Explanation lives only in a hover title.

**Fix:** Add aria-label='Price level 2 of 4 — moderate' with aria-hidden on the glyphs, and darken unfilled glyphs to var(--color-text-secondary) at ~35% opacity so the scale reads on all displays.

### rd-21 — 'Reserve / Website' overpromises when no reservation link exists
*Decision bar + sticky CTA copy · both · suggestion · effort S · panel 3/3*

**Problem:** page.tsx:546 and 1456 label the generic website link 'Reserve / Website'. Many sites take no reservations; users tapping to book land on a homepage and bounce. No reservation URL column exists to back the claim.

**Fix:** Rename to 'Visit Website' (with Globe icon) until a reservations field (Resy/OpenTable/Tock URL) is ingested; then conditionally show a true 'Reserve' primary button. Slash-labels also truncate awkwardly on 320px screens.

### search-nav-10 — Arrow-key highlight invisible to screen readers in autocomplete
*SearchAutocomplete combobox a11y · both · fix · effort S · panel 3/3*

**Problem:** Input declares role=combobox + aria-controls (SearchAutocomplete.tsx:273-276) but options have no id and the input never sets aria-activedescendant, so ArrowUp/Down selection (handleKeyDown:244) is unannounced; role=option sits on Links inside role=presentation li.

**Fix:** Give each option id={`${listboxId}-opt-${i}`} and set aria-activedescendant on the input to the active option's id; keep aria-selected in sync.

### search-nav-11 — Drawer never receives focus when opened
*Mobile nav drawer (Navigation.tsx) · mobile · fix · effort S · panel 3/3*

**Problem:** Navigation.tsx:89-127 traps Tab only once focus is inside drawerRef; on open, focus stays on the hamburger behind the overlay, so the first Tab can land in the obscured page. Focus also isn't returned on close.

**Fix:** On open, focus the drawer's close button (Navigation.tsx:390); on close, restore focus to the hamburger. Two refs and a useEffect inside the existing mobileOpen effect.

### search-nav-12 — Double clear buttons on Discover search in WebKit/Chromium
*/discover search input · both · fix · effort S · panel 2/3*

**Problem:** discover/page.tsx:190 uses type="search" plus a custom X button (:205-215); Chrome/Safari add the native ::-webkit-search-cancel-button, producing two adjacent clear affordances. globals.css has no reset for it.

**Fix:** Add input[type="search"]::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; } to globals.css, keeping the custom X as the single clear control.

### search-nav-15 — Searches made on Discover never populate Recent Searches
*Recent searches pipeline · both · suggestion · effort S · panel 3/3*

**Problem:** recordSearch is only called inside SearchAutocomplete (home hero); the Discover shell's persistent input (discover/page.tsx:189-216) writes ?q= without recording, so the homepage 'Recent searches' rail misses the app's primary search surface.

**Fix:** Call recordSearch(trimmed) in DiscoverShellContent when the debounced ?q= write commits (page.tsx:134-140) or on form submit, dedupe handled by recordSearch already.

### search-nav-17 — Error boundary offers Try Again but no way out
*src/app/error.tsx · both · fix · effort S · panel 3/3*

**Problem:** error.tsx:31-36 renders only a reset button; if the error persists (e.g. bad route data), users are trapped with no nav fallback. Heading also hardcodes text-gray-900 instead of tokens, drifting from the 404 page styling.

**Fix:** Add a secondary 'Go Home' Link beside Try Again (mirror not-found.tsx button pair) and switch text colors to var(--color-text)/var(--color-text-secondary).

### visual-craft:va-03 — Accolade tokens encode pastel placeholders, not award brands
*globals.css accolade token values (--color-accolade-*) · both · fix · effort S · panel 1/3*

**Problem:** globals.css:55-57 sets --color-accolade-michelin to #f87171 (salmon red-400), JBF to #fbbf24 (amber-400), Eater 38 to #f472b6 (pink-400) — Tailwind pastels lifted from old border classes. ds-14 asks components to adopt these tokens, but adoption would lock in a salmon Michelin and a pink Eater: semantically wrong colors for the product's highest-trust signals, and the light values can't carry AA text.

**Fix:** Re-tune the token values before the ds-14/cities-15 adoption sweep: Michelin in its recognizable deep red (#C8102E family), JBF in a bronze/amber-600 medallion tone, Eater in its red-orange — each with a documented AA-checked foreground pair and a color-mix pale fill recipe like SourceBadge already uses.

### cities-15 — Two competing accolade pill systems inside one Discover shell
*Accolade pills (system-wide) · both · suggestion · effort M · panel 3/3*

**Problem:** Top10Trending.tsx:133-199 renders white pills with official brand SVGs; one click into a collection, RestaurantCard renders AccoladesBadges' colored generic pills. Same accolades, two visual vocabularies, adjacent screens — users must re-learn the iconography.

**Fix:** Extract one shared <AccoladePill> (brand mark + short label, token colors) and use it in Top10Trending, RestaurantCard, SuggestionCard, and the restaurant detail page; delete the duplicated badge logic.

### discover-browse-17 — Quick-filter chips exist only in Map mode, not Browse
*Browse filter affordances · both · suggestion · effort M · panel 3/3*

**Problem:** DiscoverMapView.tsx:299-330 gives Map users Quality/Michelin/cuisine chips; Browse offers zero filtering — cuisine or neighborhood browsing requires typing a search. Also the Quality chip blind-cycles four states per tap with no menu.

**Fix:** Extract the chip row into a shared component and render it above Browse (driving the same useDiscoverResults filters); replace the cycling Quality chip with a small popover listing Any/Good/Great/Best.

### discover-browse-18 — Collection cards promote dead-end lists with zero results
*Editorial collection cards · both · suggestion · effort M · panel 3/3*

**Problem:** All 7 cards render identically in every city, but per-city SQL shows Brunch=0 in Miami (1-3 elsewhere) and JBF=1 in Miami/Austin — 'Explore the list' lands on 'Nothing here yet'.

**Fix:** Fetch per-collection counts for the active city in DiscoverBrowse, render '12 spots' on each CollectionCard, and hide (or visibly disable with 'No picks in {city} yet') zero-count collections.

### discover-browse-23 — Dish and neighborhood hits buried under up to 40 cards
*Search results layout · both · suggestion · effort M · panel 3/3*

**Problem:** DiscoverSearchResults.tsx:141-257 always orders Restaurants (≤40 cards, ~14 grid rows) before Dishes and Neighborhoods — for dish-shaped queries like 'tacos', the most relevant section sits several screens down with no signpost.

**Fix:** Make the 'Results for…' summary line enumerate counts as in-page anchor links ('38 restaurants · 9 dishes · 2 neighborhoods'), and cap the initial restaurant grid at 12 with a 'Show all' expander.

### discover-map-10 — Single-color pins; unscored pins show a blank white disc
*/discover map — pins · both · suggestion · effort M · panel 3/3*

**Problem:** pinSvg (RestaurantMap.tsx:66-78) is constant garnet regardless of score, so a 9.4 and a 6.1 look identical; restaurants with no rating sources (83 of 697 in NYC) get no label (RestaurantMap.tsx:284-291), leaving an empty white circle that reads as a rendering bug.

**Fix:** Tier the pin fill by score band using design tokens (≥9 deep garnet, 8–9 garnet, <8 muted neutral) and render unscored places as a small labelless dot marker instead of the hollow circle.

### discover-map-11 — No clustering; 40 labelled pins collide in dense cores
*/discover map — pin density · both · suggestion · effort M · panel 3/3*

**Problem:** fitBounds over a city (RestaurantMap.tsx:303) packs up to 40 34×44px pins with 11px score labels into Manhattan/SF cores where dozens overlap — labels become unreadable and tap targets ambiguous at the default zoom.

**Fix:** Add @googlemaps/markerclusterer for zoom <13, or drop score labels and shrink pins to dots below a zoom threshold, restoring full pins as the user zooms in.

### discover-map-12 — Map implies citywide coverage but shows only top 40
*/discover map — coverage honesty · both · suggestion · effort M · panel 3/3*

**Problem:** The count chip says '40 places' (DiscoverMapView.tsx:437) and the honesty notice renders only after an area search (DiscoverMapView.tsx:372-382), so users read the map as all of NYC when it's the top 40 of 697 by score.

**Fix:** Fetch a head:true count in useDiscoverResults and render 'Top 40 of 697' in the count chip and sheet header; show the capped notice whenever restaurants.length >= RESULT_CAP, not only when areaBounds is set.

### discover-map-13 — Empty-area guidance misleads outside the six covered cities
*/discover map — empty viewport state · both · fix · effort M · panel 3/3*

**Problem:** Panning to an uncovered city and area-searching yields 'No places in view — try zooming out, clearing filters…' (DiscoverMapView.tsx:762-783), but data is city-scoped (only 6 active cities) — zooming out will never help; the advice sends users in circles.

**Fix:** When areaBounds lies far outside the active city's pin extent, swap the copy to 'Gastronome covers New York, LA, Chicago, SF, Austin and Miami so far' with a city-switch CTA chip.

### discover-map-14 — Static fallback shows one off-brand marker and no explanation
*/discover map — key-missing fallback · both · fix · effort M · panel 3/3*

**Problem:** When the Maps JS key is absent/failed, RestaurantMap (375-384) shows a StaticMapTile centered on the result centroid with a single steel-blue marker (StaticMapTile.tsx:57, color 0x6B95A8) at a meaningless average point — no restaurant pins, no notice, while search/chips still look live.

**Fix:** In the fallback branch, overlay a quiet 'Interactive map unavailable — use the list below' note, suppress area-search arming, and pass up to ~10 garnet `markers` params for top results to StaticMapTile.

### discover-map-16 — Quality chip is a blind four-state tap cycle
*/discover map — Quality chip · both · suggestion · effort M · panel 3/3*

**Problem:** Tapping 'Quality' cycles Any→Good→Great→Best with no visibility of the options or a way back one step (DiscoverMapView.tsx:302-309); aria-pressed presents a binary state for a 4-way control, so SR users get wrong semantics too.

**Fix:** Replace the cycle with a small anchored popover of four radio options (reusing the chip styling), or a segmented control on desktop; expose state via aria-haspopup + a selected radio.

### ds-10 — Skeletons don't mirror the cards they stand in for
*LoadingSkeleton vs real cards · both · fix · effort M · panel 3/3*

**Problem:** RestaurantCardSkeleton uses h-32 media + rounded-xl (LoadingSkeleton.tsx:3-4) vs the real aspect-[16/10] + 14px card; compact/hero skeletons use rounded-2xl. discover/loading.tsx paints a photo-card grid while DiscoverBrowse actually renders a ranked list + collection cards — guaranteed layout jump on load.

**Fix:** Set skeleton wrappers to borderRadius: var(--r-card) and aspect-[16/10], and replace discover/loading.tsx's grid with the TrendingSkeleton list rhythm DiscoverBrowse.tsx:240 already defines.

### ds-11 — Three loading languages: shimmer, static blocks, gold spinner
*Loading pattern consistency · both · fix · effort M · panel 3/3*

**Problem:** Route loading.tsx files use .animate-shimmer; DiscoverBrowse.tsx:257-291 uses static non-animated blocks with a wrong inline fallback (#EDEAE3 vs token #f5f0ea); profile/page.tsx:111 shows a full-page gold Loader2 spinner. Same app, three different 'wait' signals.

**Fix:** Adopt shimmer skeletons as the page-level standard: add animate-shimmer to DiscoverBrowse's TrendingSkeleton (dropping inline hex fallbacks), and replace profile's centered spinner with a header+tab skeleton. Keep Loader2 only for in-button busy states.

### ds-14 — Token sheet advertises tokens nothing uses
*globals.css dead tokens · both · fix · effort M · panel 3/3*

**Problem:** --color-accolade-michelin/eater38 are unused (AccoladesBadges.tsx:70,95,118,139 still hardcodes bg-red-600/amber-100/pink-50); --color-rating-good/warn unused (status chip hardcodes #15803d/#b91c1c at restaurants/[id]/page.tsx:505-518); .gastro-accent-cta + --color-on-accent have zero consumers; the whole @theme gastro-* block (globals.css:81-96) backs no utility usage.

**Fix:** Wire AccoladesBadges and the status chip to their tokens (color-mix for pale fills, as SourceBadge.tsx:19 demonstrates), delete .gastro-accent-cta/--color-on-accent, and either use or remove the gastro-* theme aliases.

### ds-15 — Section header is hand-rolled five times beside the shared component
*Section header pattern · both · fix · effort M · panel 3/3*

**Problem:** SectionHeader exists (action eyebrow, no divider) yet restaurants/[id]/page.tsx re-implements eyebrow+h2+48px accent hairline five times (693-733, 973-999, 1055-1096, 1104-1131) with different tracking (0.18em vs tracking-wide) and color, and DiscoverBrowse.tsx:181-216 builds a third variant. The system's most common pattern has no single owner.

**Fix:** Extend SectionHeader with optional `divider`, `meta` (right-aligned count) and `eyebrow` props, then replace the five detail-page clones and DiscoverBrowse's local header with it.

### ds-16 — h1 weight wanders 400–800 across pages; one page swaps background
*Page titles (h1) cross-page · both · fix · effort M · panel 3/3*

**Problem:** Page titles render weight 700 (page.tsx:204), 600 (discover:155), 700 (saved:116), 400 (community:176, profile:159), extrabold-800 (recent/page.tsx:85). recent/page.tsx:73 also sets bg-gray-50, abandoning the cream --color-background every other page uses. Every page restates its title styles inline.

**Fix:** Define one page-title recipe (text-3xl sm:text-4xl, Spectral 700, -0.01em) as a class or PageHeader component; apply on all seven pages and restore var(--color-background) on /recent.

### ds-20 — Empty states fork into four visual dialects; one links to a redirect
*Empty-state pattern · both · suggestion · effort M · panel 3/3*

**Problem:** Shared EmptyState (icon halo + garnet CTA) competes with DiscoverBrowse's local text-only EmptyState (DiscoverBrowse.tsx:304-337), the detail page's dashed 'Menu coming soon' box (restaurants/[id]/page.tsx:1005), and Top10's 'Map preview unavailable' panel. Saved's EmptyState CTA targets /explore (saved/page.tsx:144), a redirect stub.

**Fix:** Route DiscoverBrowse's empty state through the shared component (compact variant if needed), point saved/page.tsx:144 at /discover, and document EmptyState as the single pattern with neutral/attention tones.

### home-09 — Flagship "The Consensus" collection is absent from home
*Homepage section hierarchy · both · suggestion · effort M · panel 3/3*

**Problem:** editorial.ts defines consensus-picks as the differentiator ("the places critics, crowd, and feed all agree on"), and the hero subline promises exactly that — yet EDITORIAL_PICKS (page.tsx:57-104) hardcodes 5 filter tiles and omits it; no consensus rail exists on home.

**Fix:** Add a 3-4 card "The Consensus" rail (via topConsensusPicks in lib/ranking/consensusPicks.ts) between Suggestions and Editor's picks, or at minimum add its tile to EDITORIAL_PICKS linking to the Discover collection.

### mobile-platform-09 — Sign-in modal not keyboard-aware; fields hide behind keyboard
*Sign-in / sign-up modal · mobile · fix · effort M · panel 3/3*

**Problem:** SignInModal.tsx:387-397 centers a max-h-90vh dialog with items-center; on iOS the keyboard shrinks only the visual viewport, so the password/confirm/city fields in signup mode sit behind the keyboard and the inner scroll area (calc(90vh - 220px)) miscomputes.

**Fix:** Use dvh units, switch to items-end (bottom-sheet) below sm:, and scroll the focused input into view (focusin listener with scrollIntoView({block:'center'})) inside the dialog's scroll container.

### mobile-platform-14 — Chip-style controls across five surfaces are ~28-33px tall
*Filter chips & small controls across pages · mobile · fix · effort M · panel 3/3*

**Problem:** FeedFilterChips.tsx:49 (py-1.5, ~29px), Discover Browse|Map toggle (discover/page.tsx:257), drawer city chips (Navigation.tsx:430), map preview close (DiscoverMapView.tsx:719, 28px), hamburger (Navigation.tsx:345, 38px), and search clear buttons all miss the 44px minimum.

**Fix:** Add a shared min-h-[44px] chip utility (visual padding can stay, expand hit area with py-2.5 or before: pseudo-element); bump preview close to h-11 w-11 like NearMeButton already does.

### mobile-platform-20 — Discover results refetch on back-nav, defeating scroll restoration
*Discover — browse list back-navigation · both · suggestion · effort M · panel 3/3*

**Problem:** Browse/search/map lists are client-fetched (useDiscoverResults) with skeleton-first rendering, so returning from a restaurant detail re-runs the fetch and the browser restores scroll against a 0-height skeleton — users land at the top and lose their place.

**Fix:** Cache the last results keyed by filters/query in sessionStorage inside useDiscoverResults and hydrate synchronously on mount, so list height exists when the browser restores scroll; revalidate in background.

### onboarding-15 — Four panes plus five-field form is a long pre-value funnel
*OnboardingFlow.tsx step structure · both · suggestion · effort M · panel 3/3*

**Problem:** Pane 1 (Problem) is pure text with no product; the live preview cards — the strongest asset — only appear on pane 2 (OnboardingFlow.tsx:828-847). Visitors must click twice before seeing anything real, then face 5 fields.

**Fix:** Merge Problem+Solution into one pane led by the live preview cards (STEPS becomes 3 at OnboardingFlow.tsx:46-47), and move the source-chips row under them as supporting evidence.

### profile-saved-08 — Tab switch silently discards unsaved settings edits
*Profile > Settings form · both · fix · effort M · panel 3/3*

**Problem:** Switching from Settings to Collections unmounts SettingsPanel (profile/page.tsx:205-214), throwing away edited display name and home city with no warning; Save is always enabled so there is no dirty-state signal either.

**Fix:** Track dirty state (compare against profile), disable Save until dirty, and either confirm before tab switch when dirty or lift form state to the page so edits survive tab changes.

### profile-saved-14 — ARIA tablist without tabpanel or arrow-key support
*Profile tabs (Collections/Settings) · both · fix · effort M · panel 3/3*

**Problem:** Tabs declare role=tablist/tab with aria-selected (profile/page.tsx:191, 234) but panels lack role=tabpanel/aria-controls and there is no Left/Right arrow navigation or roving tabindex — the roles promise a pattern the keyboard cannot fulfill.

**Fix:** Add id/aria-controls/aria-labelledby pairs plus arrow-key handling with roving tabindex, or drop the ARIA tab roles and use plain buttons with aria-pressed.

### profile-saved-16 — Public profile is an orphaned marketing dead-end
*Public profile /profile/[id] content · both · suggestion · effort M · panel 3/3*

**Problem:** No inbound link to /profile/[id] exists anywhere; the page shows only an initial badge plus marketing copy 'Compare restaurant ratings from every major platform' under a stranger's name with no CTA (profile/[id]/page.tsx:100-109). The follows table (0 rows) has zero UI.

**Fix:** For beta, gate or noindex the route; or make it minimally social: member-since, home city, a Follow button writing to follows, and public collections — then link it from future review bylines and Community.

### profile-saved-17 — Onboarding preferences are write-only and uneditable
*Settings > Preferences (favorite cities/cuisines) · both · suggestion · effort M · panel 3/3*

**Problem:** The signup wizard collects up to 3 cities and 8 cuisines promising 'your feed will feel like it was made for you' (OnboardingSteps.tsx:144-146, 499), but nothing in the app reads favorite_cities/favorite_cuisines, and Settings offers no way to view or edit them.

**Fix:** Add 'Favorite cities' and 'Favorite cuisines' chip editors to the Settings Preferences section (reuse the wizard's chip toggles) and feed them into home/discover defaults — or stop collecting them at signup.

### profile-saved-18 — No change-password or account-deletion path in Settings
*Settings > Account · both · suggestion · effort M · panel 3/3*

**Problem:** Settings exposes only display name and home city; there is no change-password entry despite /auth/reset-password existing, and no account-deletion affordance — basic account control and trust signals are missing.

**Fix:** Add 'Change password' (link to the reset flow or inline supabase.auth.updateUser) and a 'Delete account' affordance with typed confirmation in the Account section, even if deletion opens a support mailto during beta.

### profile-saved-20 — Saved page is read-only; management hidden on Profile
*/saved vs /profile collections split · both · suggestion · effort M · panel 3/3*

**Problem:** Rename/delete/create live only on the /profile Collections tab while /saved — the primary nav destination — is read-only, and neither surface links to the other (saved/page.tsx vs profile/page.tsx:553-618). Users on Saved can't discover management exists.

**Fix:** Add rename/delete and 'New collection' controls to /saved by reusing CollectionSection logic, or consolidate management into /saved and make the profile tab link there — one canonical collections surface.

### rd-09 — Social boost and disagreement penalty are invisible to users
*ConsensusBreakdown — score adjustments · both · suggestion · effort M · panel 3/3*

**Problem:** score.ts computes an agreement penalty (l.242-248), evidence gates, and a socialBoost explicitly exposed 'for the tooltip' (l.299) — but neither the badge popover nor ConsensusBreakdown renders them. Users who do the weighted math get a different number than the headline; 'why 8.4?' stays unanswered.

**Fix:** Add an 'Adjustments' line in ConsensusBreakdown's footer: '+0.3 social buzz', '−0.4 sources disagree', 'capped: single source'. Data already lives on the GastronomeScore object; render only non-zero entries.

### rd-14 — Photo strip thumbnails aren't tappable — no lightbox
*Photo strip · both · suggestion · effort M · panel 3/3*

**Problem:** page.tsx:596-615 renders extra photos as static 112×160px <img> tiles. Users can't enlarge food photography — the highest-engagement content on a restaurant page — and the first tile usually duplicates the hero photo (union includes photo_url, page.tsx:284-289).

**Fix:** Exclude the hero URL from the strip, and wrap tiles in a button opening a simple lightbox (reuse the VideoGallery modal pattern: fixed overlay, Escape/outside-click close, body scroll lock). Show 'n of m' and swipe on mobile.

### rd-15 — 1,342 TikTok tiles render as near-black gradient slabs
*VideoGallery — missing TikTok thumbnails · both · suggestion · effort M · panel 3/3*

**Problem:** TikTok rows with null thumbnail_url (1,342 in DB; all fresh-sweep rows) fall to a gray-900→black gradient tile (VideoGallery.tsx:51-57). A fresh-sweep restaurant's 'On Social' grid is a wall of black rectangles — reads as broken video players.

**Fix:** Backfill thumbnails via TikTok's unauthenticated oEmbed endpoint (tiktok.com/oembed?url=) in the sweep pipeline; meanwhile brighten the fallback (teal/garnet brand gradient, larger caption, author handle prominent) so tiles look designed rather than failed.

### rd-18 — Sticky CTA duplicates decision bar while both are on screen
*Sticky mobile CTA bar · mobile · suggestion · effort M · panel 3/3*

**Problem:** On load, the decision bar (page.tsx:468-575) and the fixed bottom bar (page.tsx:1426-1483) show identical Reserve/Directions buttons simultaneously, and the bar + BottomNav stack ~124px of fixed chrome on a 667px viewport for the whole session.

**Fix:** Show the sticky bar only after the decision bar scrolls out of view (IntersectionObserver on the decision bar, translate-y transition), mirroring standard sticky-CTA behavior. Frees a quarter of the small-phone viewport above the fold.

### search-nav-18 — No persistent search entry in mobile chrome
*Mobile header / search entry points · mobile · suggestion · effort M · panel 3/3*

**Problem:** On mobile, search exists only inside the Home hero and the Discover page body. From a restaurant page or Saved, reaching search takes a tab switch plus a field tap; the header (Navigation.tsx:341-355) offers only the hamburger.

**Fix:** Add a Search icon button to the mobile header next to the hamburger linking to /discover?focus=search, and have the shell autofocus the input when that param is present.

### search-nav-22 — City dropdown listbox lacks arrow-key navigation
*Header city switcher (Navigation.tsx) · web · fix · effort M · panel 3/3*

**Problem:** Navigation.tsx:260-295 renders role=listbox/option but manages focus only via Tab; ArrowUp/Down, Home/End and typeahead do nothing, and focus doesn't move to the selected option on open — violating the ARIA listbox pattern it declares.

**Fix:** On open, focus the selected option; handle ArrowUp/Down/Home/End to move focus between options; or simplify semantics to role=menu, which matches the Tab-based behavior.

### visual-craft:va-02 — Warm shadow tokens defined but ignored; cool grey elevations on cream
*Elevation system (globals.css --shadow-1/--shadow-2 vs Tailwind shadow-*) · both · fix · effort M · panel 1/3*

**Problem:** Verified: globals.css defines warm-tinted --shadow-1/--shadow-2 'so cards sit on the cream background gently', yet only 2 usages exist while ~53 raw Tailwind shadow-sm/md/lg/xl utilities span 30 files — all neutral cool-grey, fighting the warm palette. SuggestionCard's hover leaps shadow-md→shadow-2xl, a four-step jump no token sanctions.

**Fix:** Register the two tokens in @theme as shadow-card/shadow-raised utilities, sweep card, popover, modal, and sticky-bar surfaces onto them, and cap hover elevation at --shadow-2. Mirrors the ds-09 radius sweep — do both in one pass.

### ds-09 — Radius tokens exist but 95% of components bypass them
*Border-radius scale · both · fix · effort L · panel 3/3*

**Problem:** --r-card/--r-input/--r-tag (globals.css:71-73) are used in only 6 files; meanwhile 104 rounded-sm, 35 rounded-lg, 23 rounded-xl, 15 rounded-md, 7 rounded-2xl plus inline '6px'/'8px'/'10px' (restaurants/[id]/page.tsx:371,608,798). Cards alone ship 4px (SuggestionCard:49), 14px (RestaurantCard:157), 16px (LoadingSkeleton:27).

**Fix:** Register the tokens in @theme (--radius-card etc.) so `rounded-card`/`rounded-input` utilities exist, then sweep card/input/chip surfaces onto them — starting with SuggestionCard and the skeletons that mismatch their real cards.

### ds-17 — Cool Tailwind grays undercut the warm cream token palette
*Neutral palette (Tailwind grays vs tokens) · both · fix · effort L · panel 3/3*

**Problem:** ~180 uses of cool grays (bg-gray-50/100, text-gray-400/500/900, border-gray-100/200) sit on warm-cream token surfaces — RestaurantCard.tsx:156,234, BookmarkButton popover, recent page. text-gray-400 is used for real copy (recent/page.tsx:89, profile/[id]/page.tsx:89) at ~2.8:1, below AA, despite --color-text-secondary being tuned for exactly this.

**Fix:** Map gray-X usage to tokens (text-secondary, surface-muted, border) starting with the canonical RestaurantCard; ban text-gray-400 for copy via an ESLint rule or grep gate.

### rd-19 — Money page has no user reviews or write-review entry point
*Restaurant detail — community layer · both · suggestion · effort L · panel 3/3*

**Problem:** The app ships a reviews table, review_photos, and a Community surface, yet page.tsx renders zero user reviews and no 'Write a review' CTA. The page aggregates everyone's opinions except its own community's — undercutting the social layer's flywheel.

**Fix:** Add a 'From the community' section between On Social and The Story: top 3 reviews (avatar, rating, snippet) plus a Write-a-review button (sign-in gated via openSignInModal). Empty state: 'Be the first to review'.


## P3

### a11y-ergonomics:a11y-04 — 21 new-tab links open with no accessible warning
*External links app-wide (restaurant detail x12, VideoGallery, Footer) · both · fix · effort S · panel 1/3*

**Problem:** target="_blank" is used 21 times across src — 12 on the restaurant detail page alone (website, directions, Instagram, 'Watch on TikTok') — with no 'opens in new tab' hint in labels or sr-only text (grep-verified). SR users are silently dumped into a new context where Back no longer works.

**Fix:** Create a shared ExternalLink wrapper that appends an sr-only ' (opens in new tab)' suffix and rel="noopener noreferrer", then sweep the 21 call sites onto it.

### cities-11 — Six bare city names: no counts, no state, no coming-soon story
*Navigation city dropdown · both · suggestion · effort S · panel 3/3*

**Problem:** The dropdown (Navigation.tsx:260-295) lists 6 active names sorted by restaurant_count with no counts shown, and the 14 inactive cities rows (Boston, Seattle, etc.) surface nowhere — users elsewhere get zero signal their city is planned.

**Fix:** Render "697 spots" secondary text per option and a non-selectable "Coming soon" group from cities.is_active=false, optionally with a notify-me link — the data already exists in the cities table.

### discover-browse-24 — Mode switches use replace, so Back exits Discover unexpectedly
*Shell URL/history semantics · both · suggestion · effort S · panel 3/3*

**Problem:** page.tsx:120-131 patchParams always router.replace()s; switching Browse→Map (page.tsx:244-256) leaves no history entry, so browser Back skips out of /discover entirely instead of returning to Browse.

**Fix:** Keep replace for debounced query typing, but use router.push for discrete intent changes (mode toggle, collection exit) so Back/Forward traverse Browse↔Map↔Collection states naturally.

### discover-map-20 — Generic star icon stands in for Michelin in rows
*/discover map — result rows · both · suggestion · effort S · panel 3/3*

**Problem:** ResultRow marks Michelin-starred places with a garnet-tinted lucide Star (DiscoverMapView.tsx:922-928) while the chip row uses the brand MichelinStarIcon (DiscoverMapView.tsx:312) — inconsistent accolade iconography on the same screen dilutes the badge's meaning.

**Fix:** Use MichelinStarIcon in ResultRow and PreviewCard at the same size, in Michelin red, with the existing aria-label; keep lucide Star out of accolade contexts.

### discover-map-21 — Hover-select scrolls the list under the cursor
*/discover map — desktop list scroll · web · fix · effort S · panel 3/3*

**Problem:** Any selectedId change triggers scrollIntoView (DiscoverMapView.tsx:199-203), including hover-originated ones — hovering a partially-visible row scrolls the panel, sliding a new row under the pointer and cascading selections.

**Fix:** Tag selection origin (map vs list) in handleSelect and only scrollIntoView for map-originated selections; list-originated ones are already in view by definition.

### ds-19 — No dark mode; declare color-scheme to stop UA half-inversion
*Dark mode / color-scheme · both · suggestion · effort S · panel 3/3*

**Problem:** Zero dark: classes and no prefers-color-scheme color handling exist; themeColor is fixed #FFFEFB. In OS dark mode, UA-styled form controls, scrollbars, and the type=search clear button render dark against the cream UI — a half-themed look the app never opted into.

**Fix:** Add `:root { color-scheme: light; }` to globals.css now (one line, stops UA dark widgets). The token architecture already supports a future dark palette by re-declaring the custom properties under a media query.

### ds-21 — Emoji and text glyphs leak into the lucide icon system
*Icon system · both · suggestion · effort S · panel 3/3*

**Problem:** Map fallback uses a raw 📍 emoji (restaurants/[id]/page.tsx:1319) where every other location marker is lucide MapPin; BookmarkButton uses text '▾' (BookmarkButton.tsx:210) and '×' (line 247) instead of ChevronDown/X. Emoji render inconsistently across platforms and ignore the 1.5 stroke language.

**Fix:** Replace 📍 with <MapPin>, '▾' with <ChevronDown size={12}>, '×' with <X size={16}> — matching the strokeWidth 1.5 convention Navigation already sets.

### home-15 — Empty personal rails leave doubled gap and cause pop-in shift
*Personal rails layout · both · fix · effort S · panel 3/3*

**Problem:** The wrapper grid (page.tsx:317-325) keeps mb-16 even when RecentSearches and FavoritesSection both return null, stacking with the Suggestions section's mb-16 into an 8rem void; favorites loading→content also shifts Editor's picks down after hydration (FavoritesSection.tsx:83-89).

**Fix:** Move the bottom margin into the rail components (only rendered with content), and have FavoritesSection render a fixed-height skeleton while loading when ids.length > 0 so the picks section doesn't jump.

### home-17 — Generic "Suggestions in New York" buries the trending story
*Suggestions section header · both · suggestion · effort S · panel 3/3*

**Problem:** The informative claim ("Trending this week") is the 12px eyebrow while the 24px title says "Suggestions in New York" (page.tsx:282-285) — generic, and it repeats the city already stated in the H1 two sections up.

**Fix:** Flip the hierarchy: title "Trending in {city}" (or "Top-rated in {city}" on fallback), eyebrow "Last 7 days · updated daily" — putting the freshness signal where eyes land first.

### home-18 — Trending cards never say why they're trending
*Suggestions rail card · both · suggestion · effort S · panel 3/3*

**Problem:** topTrendingRestaurants returns trending_rank and trending_counts (trending.ts:365-376) but page.tsx:306-308 passes only the Restaurant shape; cards show no rank, no "3 new videos this week", no recency cue — "Trending" is an unfalsifiable claim.

**Fix:** Extend SuggestionCard with an optional trendingMeta prop and render a small caption ("#3 this week · 3 new videos") from trending_counts, giving the rail a verifiable freshness signal.

### home-19 — Footer links duplicate /discover and pitch a waitlist
*Home footer · both · fix · effort S · panel 2/3*

**Problem:** Footer.tsx:54-69 lists "Explore" and "Search" both linking to /discover (stale pre-merge taxonomy), and the only Community link reads "Join the waitlist" (Footer.tsx:109-112) while the header nav presents Community as a live destination — mixed launch-state signals.

**Fix:** Collapse to a single "Discover" link, add "What's new" alongside, and relabel the Community link to match the live surface ("Community") unless the waitlist is genuinely the only entry point.

### home-20 — Tiles surviving the count gate can still feel threadbare
*Editor's picks tiles · both · suggestion · effort S · panel 3/3*

**Problem:** The gate only drops zero-count tiles (page.tsx:189). "Quick Lunch" maps to cuisine=Sandwiches which has exactly 4 NYC rows (verified in DB), so a curated tile proudly announces "4 spots in New York" — reading as inventory weakness, not curation.

**Fix:** Raise the gate to a minimum viable count (e.g. >= 6) in page.tsx:189, and broaden thin predicates (Quick Lunch could OR Sandwiches/Delis/Cafe cuisines) so every surviving tile lands on a satisfying results page.

### mobile-platform-11 — Pull-to-refresh disabled app-wide on Android Chrome
*Global — overscroll behavior · mobile · suggestion · effort S · panel 3/3*

**Problem:** globals.css:113-116 sets overscroll-behavior-y:none on html/body to stop standalone rubber-banding, but in regular Android Chrome this also kills pull-to-refresh on content feeds (Recent, Discover) where users expect it.

**Fix:** Scope the rule to installed mode: @media (display-mode: standalone){ html,body{ overscroll-behavior-y:none } }, leaving native pull-to-refresh available in browser tabs.

### mobile-platform-12 — theme-color and manifest theme_color disagree
*PWA meta (theme-color / manifest) · mobile · fix · effort S · panel 3/3*

**Problem:** Viewport themeColor is cream #FFFEFB (layout.tsx:85) while manifest.ts:14 declares gold #D4A574 — Android browser UI tints cream but the installed PWA title bar/splash renders brand gold, an inconsistent shell between the two contexts.

**Fix:** Pick one token (the cream background matches the in-app header) and use it in both manifest.ts theme_color and the viewport export; keep background_color cream for the splash.

### mobile-platform-19 — Fixed chrome consumes half of landscape viewport height
*Restaurant detail — landscape phones · mobile · suggestion · effort S · panel 3/3*

**Problem:** In landscape (~390px tall), the sticky header (64px), sticky action bar (~57px) and bottom nav (64px+) leave under 210px of content — restaurant pages become a letterbox; safe-area left/right insets also aren't applied to the fixed action bar (only px-4).

**Fix:** Hide the sticky action bar under @media (orientation:landscape) and (max-height:500px) (decision bar at top still covers the actions) and add paddingLeft/Right: max(1rem, env(safe-area-inset-left/right)) to it and BottomNav.

### onboarding-18 — 'Try signing in instead' error offers no sign-in action
*Sign-up error copy (both flows) · both · suggestion · effort S · panel 3/3*

**Problem:** friendlyAuthError returns 'An account with that email already exists. Try signing in instead.' (OnboardingFlow.tsx:1415-1416; SignInModal.tsx:209-211) but renders as plain text — the user must hunt for the footnote link or modal toggle themselves.

**Fix:** When this error fires, render an inline action in the banner: link to /auth/login in OnboardingFlow, and a setMode('signin') button in SignInModal, pre-filling the typed email.

### onboarding-19 — Check-your-email copy misdescribes what the link does
*Email-confirmation copy (SignInModal + OnboardingFlow) · both · fix · effort S · panel 3/3*

**Problem:** SignInModal.tsx:509-511 says 'then come back here to sign in' and OnboardingFlow.tsx:1348-1351 says 'then come right back' — but the link auto-signs the user in via /auth/callback and redirects them onward; no manual return or sign-in happens.

**Fix:** Reword both to 'Click the link — it signs you in and finishes setup automatically', preventing users from returning to a stale tab and re-entering credentials.

### onboarding-20 — No show-password toggle in the sign-in/sign-up modal
*SignInModal password fields · both · suggestion · effort S · panel 3/3*

**Problem:** SignInModal's password and confirm fields (SignInModal.tsx:773-805) have no visibility toggle, unlike OnboardingFlow (1166-1175) and reset-password (267-276) — typo lockouts are likeliest at sign-in, exactly where the aid is missing.

**Fix:** Add the same Eye/EyeOff toggle (shared showPassword state, aria-label) to the modal's password inputs, matching the pattern already used in OnboardingFlow.tsx.

### onboarding-21 — Three competing progress vocabularies in one wizard
*Progress indication across the funnel · both · suggestion · effort S · panel 3/3*

**Problem:** Page flow shows dots, a footer 'Step 2 of 4', and mixed eyebrows ('The problem', 'The solution', 'Step 3 — personalize', 'Step 4 — create account'); the modal shows '1 / 4'. Step numbers in eyebrows also break if steps are ever reordered.

**Fix:** Keep the dots plus one consistent eyebrow style ('The problem' / 'The solution' / 'Personalize' / 'Create account'); drop the numeric footer counter and hardcoded 'Step 3/4' prefixes in OnboardingFlow.tsx:873,1018.

### profile-saved-13 — Favorites silently capped at 200 saves
*Favorites store (lib/collections.ts) · both · fix · effort S · panel 3/3*

**Problem:** writeFavorites truncates to 200 ids (collections.ts:267). The 201st save shows a success toast while the oldest favorite silently drops, and the local list diverges from the unbounded user_favorites table on the server.

**Fix:** Raise or remove the cap, or block the write and toast 'Favorites is full' at the limit; whatever the limit, enforce it identically locally and in Supabase.

### profile-saved-15 — Public profile off-brand: raw grays, bare 'Loading...'
*Public profile /profile/[id] styling · both · fix · effort S · panel 3/3*

**Problem:** /profile/[id] renders plain 'Loading...' text and raw gray-900/gray-400/gray-500 utilities (profile/[id]/page.tsx:45-50, 85-96) instead of the token palette, Spectral heading font, and Loader2/skeleton loading patterns used app-wide.

**Fix:** Swap to var(--color-text)/var(--color-text-secondary) tokens, font-heading for the display name, and the shared Loader2 spinner or a header-shaped skeleton.

### profile-saved-19 — Delete confirm omits item count, offers no undo
*Profile > Collections delete confirm · both · suggestion · effort S · panel 3/3*

**Problem:** The inline confirm asks only 'Delete this collection?' (profile/page.tsx:583-588) without stating how many saved restaurants it discards, and deletion is immediate with no undo — a misclick permanently loses curation.

**Fix:** Include the count in the confirm copy ('Delete "Date Night" and its 7 saves?') and show a ~5s Undo toast that restores from the in-memory snapshot before the server delete settles.

### profile-saved-21 — Settings undiscoverable: no 'Settings' label anywhere
*Navigation account entry points · both · suggestion · effort S · panel 3/3*

**Problem:** Settings is reachable only via /profile then a second tab tap; the mobile drawer offers just 'My Profile' (Navigation.tsx:481-491) and the desktop control is an unlabeled avatar — the word 'Settings' never appears in navigation.

**Fix:** Add a 'Settings' item beneath 'My Profile' in the drawer and a small avatar dropdown (Profile / Settings / Sign out) on desktop, both linking to /profile?tab=settings once tab deep-linking lands.

### profile-saved-22 — Empty-state CTAs link to retired /explore route
*Empty-state CTAs on /saved and Profile collections · both · fix · effort S · panel 3/3*

**Problem:** Both empty-state CTAs link to /explore (saved/page.tsx:144, profile/page.tsx:344), which 308-redirects to /discover, and the 'Explore' wording no longer matches the nav vocabulary ('Discover').

**Fix:** Point both hrefs directly at /discover and align CTA labels with nav vocabulary ('Browse Discover' / 'Start discovering').

### rd-23 — Six-tile skeleton collapses to one video — layout jolt
*VideoGallery loading skeleton · both · suggestion · effort S · panel 3/3*

**Problem:** VideoGallery.tsx:204-215 always shimmer-renders six 9:16 tiles plus a fake control bar; restaurants with 1-2 videos see a tall grid snap down when data lands. The server already knows the count (page.tsx videoCount) but doesn't pass it.

**Fix:** Pass videoCount (post rd-05 filter) as a prop and render min(videoCount, 6) skeleton tiles, hiding the control-bar shimmer when count < 4 to match rd-16's control gating.

### rd-24 — Full-width square map dominates mobile scroll
*Sidebar map tile · mobile · suggestion · effort S · panel 3/3*

**Problem:** The map block is aspect-square (page.tsx:1254, 1281, 1306) — on a 390px phone that's a 358px-tall map occupying nearly half a viewport between content and Similar Restaurants, for what is functionally a single deep-link.

**Fix:** Use aspect-video on mobile, keeping aspect-square only at lg: (e.g. className="aspect-video lg:aspect-square"). The StaticMapTile's 640x400 source is already 16:10, so the mobile crop actually shows more map.

### search-nav-21 — Three unimported search components invite UX drift
*Dead search components · both · suggestion · effort S · panel 2/3*

**Problem:** GooglePlacesAutocomplete.tsx, SearchBar.tsx, and explore/ExploreSearchBar.tsx have zero importers (grep-verified). GooglePlacesAutocomplete still issues per-prediction billed getDetails calls and a divergent dropdown design if ever revived.

**Fix:** Delete all three (mirroring the known DiscoverFilters.tsx cleanup) so SearchAutocomplete remains the single search pattern; fold any wanted Google-sourcing into the API route instead.

### search-nav-23 — Global error fallback palette is off-brand emerald
*src/app/global-error.tsx · both · suggestion · effort S · panel 2/3*

**Problem:** global-error.tsx:73 falls back to #10b981 (emerald) for the button and references undefined tokens (--color-foreground, --color-muted-foreground). On a hard failure without the stylesheet, the recovery screen renders in a foreign green.

**Fix:** Inline brand hexes since no stylesheet is guaranteed: #8E3B46 action background, #FFFFFF text, #1C1C1C/#5E5E5E copy; drop the undefined var() names.

### search-nav-24 — Switching city always yanks the user to /discover
*City switcher navigation (useCity.ts) · both · suggestion · effort S · panel 3/3*

**Problem:** useCity.ts:105 router.push('/discover?city=…') on every selection, so changing city from Home, Saved, or a restaurant page navigates away from the current context instead of re-scoping it.

**Fix:** When the current route accepts ?city= (/discover, /), patch the param in place via router.replace on the current pathname; only fall back to /discover from city-less pages.

### cities-18 — Cities have zero visual identity; photo_url is null and unused
*City presentation (onboarding, switcher) · both · suggestion · effort M · panel 2/3*

**Problem:** Every cities.photo_url is null and nothing renders it — onboarding city pickers are bare text chips (OnboardingSteps.tsx:348-373) and the switcher is text-only. For a food-discovery brand, the city choice moment is visually mute.

**Fix:** Backfill 6 curated city photos into cities.photo_url and use them as small thumbnails in the onboarding city cards and the empty-city panel; drop the column if the team decides against imagery.

### discover-map-19 — Map filters and area scope are not shareable
*/discover map — URL state · both · suggestion · effort M · panel 3/3*

**Problem:** Only ?mq= persists (DiscoverMapView.tsx:117-127); quality, Michelin, cuisine, and the area clamp live in component state (DiscoverMapView.tsx:133-135, 158) — reload, share, or back/forward silently drops the filtered view the user built.

**Fix:** Mirror the chips into URL params (e.g., ?qual=, ?mcz=, ?mich=1) via the existing router.replace pattern, and seed state from searchParams on mount; area bounds can stay ephemeral.

### discover-map-22 — Near-me list box mismatches zoom; no you-are-here dot
*/discover map — Near me behavior · mobile · suggestion · effort M · panel 3/3*

**Problem:** onLocate clamps the list to a hardcoded ±0.03° box (~6.6 km, DiscoverMapView.tsx:410-423) but zooms the map to 14 (~3 km view), so the list includes places off-screen; no user-location marker is drawn, leaving 'near me' unanchored.

**Fix:** After centerOn settles, derive the box from the map's actual idle bounds instead of the constant, and drop a small pulsing location dot marker at the user's coordinates.

### ds-23 — Uppercase label tracking takes seven different values
*Micro-label letter-spacing · both · suggestion · effort M · panel 2/3*

**Problem:** Uppercase micro-labels use letterSpacing 0.04em (DiscoverBrowse.tsx:189), 0.08, 0.1, 0.12, 0.14, 0.16, and 0.18em (community:168, detail eyebrows) across the tree — the same semantic element feels subtly different on every page, and each site restates the value inline.

**Fix:** Define two steps as tokens (--tracking-label: 0.08em; --tracking-eyebrow: 0.14em), map them in @theme, and sweep the inline letterSpacing literals onto them.

### home-21 — Desktop hero leaves the right half of viewport empty
*Homepage hero · web · suggestion · effort M · panel 2/3*

**Problem:** All hero content (H1, subline max-w-36rem, search max-w-2xl, chips) is left-aligned inside the max-w-7xl container (page.tsx:198-271), leaving ~50% of a 1440px viewport as blank cream above the fold — no imagery, proof, or delight.

**Fix:** Fill the right column on lg+ with a supporting element: the #1 trending restaurant as a featured photo card, or a compact Gastronome Score explainer graphic — reinforcing the value prop without lengthening the page.

### mobile-platform-18 — Photo strip lacks scroll-snap and tap-to-view
*Restaurant detail — photo strip · mobile · suggestion · effort M · panel 2/3*

**Problem:** The horizontal photo strip (restaurants/[id]/page.tsx:596-615) free-scrolls without snap points and photos aren't tappable — on a 375px screen tiles cut mid-image and users instinctively tap them expecting a lightbox, getting nothing.

**Fix:** Add snap-x snap-mandatory + snap-start on tiles, and open a simple full-screen viewer (reuse the video modal pattern at z-[100]) on tap; request larger w only when the viewer opens.

