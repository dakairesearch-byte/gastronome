# Gastronome Notification Policy

**Rule:** Every push notification must contain new information about a restaurant
the user has a *specific existing relationship* with (saved, visited, rated, on Hit List).
If the sentence cannot contain a proper noun that is meaningful to THIS user, it does not send.

## The "news about YOUR world" test

Before any notification template ships, apply this test:

> Replace the restaurant/user noun with a random one the recipient has never heard of.
> If the notification would still make sense, it fails the test — it is generic news,
> not personal news.

Passing example: "Lilia — on your Hit List — just made the new Eater 38."
Failing example: "3 people near you tried something new this week."

## Permitted notification types

| Type | Trigger | Frequency cap |
|---|---|---|
| Accolade alert | A saved/visited restaurant earns a new Michelin star, JBF nod, or Eater 38 placement | Immediate; uncapped (rare by nature) |
| Score movement | A saved/visited restaurant's Gastronome Score moves ≥0.5 points | At most 1/restaurant/month |
| Hit List prompt | A Hit List restaurant is trending significantly in the user's home metro | At most 1/week total |
| Weekly digest | Top mover + one "you might like" from taste vector | 1/week; single digest, not separate pushes |
| Taste milestone | User's own milestone (Taste Profile unlocked, checklist complete) | Event-driven; once per milestone |

**Absolute weekly cap:** ≤2 push notifications + ≤1 digest email per user per week.
Per-category opt-outs required at onboarding and in settings — no single "all or nothing" toggle.

## Banned forever (Engagement Gate enforces these)

These templates never ship under any opt-in. The Engagement Gate's opt-in bypass applies to
mechanic *defaults* (a user may enable an optional streak), not to these framings — a user
cannot consent their way into receiving them, and no QUESTIONS.md entry can approve them
short of amending this policy itself (owner-only).

- Streak-guilt pushes ("Your streak expires tonight", "Don't break your streak")
- Re-engagement bait without a specific noun ("We miss you", "It's been a while")
- Interpersonal FOMO ("3 friends ate here without you", "[User] just rated this place you saved")
- Generic social proof ("This place is trending near you" without a personal relationship)
- Countdown / scarcity theater with no real scarcity ("Only 2 spots left in your Hit List")
- Any push whose primary purpose is session re-engagement rather than information delivery

## Why this matters for the brand

Gastronome's value proposition is the calibrated, trustworthy score — the opposite of
engagement-bait. Every unwanted notification trains users that Gastronome is noise.
Notification trust is a battery: we spend it only on genuinely useful signal so it
retains its value when we do fire. A user who never gets a useless push will read every
push. A user who gets three junk pushes has notifications off before month two.
