# the-chef — RE-SWEEP v3 (restaurant owner/chef lens)

Subject: **JoJo** (Jean-Georges, 1 Michelin star, Lenox Hill NYC).
Question: is my house represented fairly, dishes attributed right, would I
be embarrassed if a guest's expectations were set here?

Verdict: the page no longer looks *broken* (score, map, dishes-block all
render), but for a Michelin one-star it still reads thin and a touch
misleading. The empty dish list and prominent low Yelp are the
embarrassing bits.

---

## Top 5

**1. [STILL-OPEN] Signature Dishes is EMPTY for a Michelin restaurant — [P0] — S (data)**
restaurant-mobile m1 / d1-hero: "Menu coming soon — we're still gathering
them for JoJo." JoJo's famous plates (goat-cheese & potato terrine, soy-
glazed chicken, chickpea fries) are nowhere. The block renders gracefully
now (v2 fix worked) but for a Jean-Georges 1-star an empty menu reads
"they don't actually know this place." The whole product promise collapses
on its flagship example. Backfill dishes for starred rooms before launch.

**2. [NEW] Yelp 3.7/5 shown at equal visual weight to Google 4.3 — [P1] — S**
d2-numbers / mh1 ("By the Numbers"): a 3.7 Yelp sat beside a 4.3 Google,
same size, no context. For a Michelin house that 3.7 (Yelp skews harsh on
fine dining) drags the read down and undersells the room. Either de-
emphasize Yelp for starred venues or pair each source with its review
count so a 705-vs-tiny-sample gap is visible.

**3. [NEW] "Similar Restaurants" look fake / mis-attributed — [P1] — M**
d3-sidebar: "Le Restaurant" (listed 3 Michelin stars!) and "Maison Close"
are not real NYC restaurants — they read as placeholder seed data. Putting
invented peers next to a real Michelin house damages every restaurant's
credibility by association. Audit the related-set source data.

**4. [STILL-OPEN] "On Social" leads with the venue's own promo reel — [P2] — S**
d0-top / m1: the one IG tile is "JoJo | Welcome in ✨" — the restaurant's
own marketing, not independent diner buzz. As an owner I don't mind, but
it makes the "social proof" section look like an ad, not a signal. Prefer
third-party creator videos; fall back to own only if none exist.

**5. [NEW] Cuisine flattened to "FRENCH" — [P2] — S**
hero tag + similar cards: JoJo is French-American bistro under Jean-
Georges; the bare "FRENCH" chip mis-sets the vibe (guests expect formal
Lyonnaise, get a townhouse bistro). Minor, but attribution precision is
the brand. Allow a sub-cuisine / descriptor.

---

## Quick wins (≤5)
- Show review counts on EVERY source cell in "By the Numbers" (Yelp had
  none visible) so a 3.7 from few reviews isn't read as gospel (d2-numbers).
- Address line is good ("Lenox Hill · 160 East 64th St") — keep; add a
  hours / "Open now" chip so guests don't arrive at a closed kitchen.
- Sidebar map tile says only "Lenox Hill" — add the street so it's a real
  wayfinding aid, not just a neighborhood label (mh0).
- "Similar Restaurants" Michelin badge on a peer shows "3 Michelin Stars"
  for a $$ spot — sanity-check accolade↔price coherence (d3-sidebar).
- Dish empty-state CTA "View the menu on the restaurant's site" is the
  right instinct — keep it visible even once dishes load (as a footer link).

## Two bigger bets
- **Per-source weighting for fine dining.** A flat Google+Yelp average
  misrepresents starred rooms (Yelp penalizes formality, no-substitutions,
  price). Let the Gastronome Score down-weight Yelp when Michelin/JBF
  present, and say so in the methodology tooltip — that's a defensible
  editorial stance owners would respect.
- **Owner-verified dish list.** Let a restaurant confirm/supply its
  signature dishes so the flagship example is never empty and attribution
  is authoritative, with social mention-counts layered on top as proof.

## Alarming
- **community-desktop**: "Coming Soon / Members Only — exclusive community
  for discerning food enthusiasts." A live nav tab leading to a permanent
  empty promise reads as vaporware; either hide the tab or gate it behind a
  waitlist. Not my page, but it colors how a guest trusts my profile.
- Fabricated peer names (#3) is the genuinely alarming one — invented data
  on a public profile is a reputational and possibly legal risk per the
  house rule "never invent."
