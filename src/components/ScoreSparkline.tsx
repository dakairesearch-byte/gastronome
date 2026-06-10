'use client'

/**
 * ScoreSparkline — tiny inline trend line of a restaurant's rating history.
 *
 * DISABLED: the backing table `restaurant_rating_snapshots` does not exist in
 * the live DB (it was documented but never deployed), so it is absent from the
 * generated Database types and any query against it fails both at runtime and
 * at typecheck. The component renders nothing until the table + a nightly
 * snapshot job ship.
 *
 * To restore: recreate the fetch-and-draw implementation from git history
 * (commit e9f0a48, this file) once `restaurant_rating_snapshots` exists with
 * `restaurant_id`, `snapshot_date`, and `google_rating` columns — the
 * regenerated types will then accept the query.
 */
export default function ScoreSparkline({
  restaurantId: _restaurantId,
  className: _className,
}: {
  restaurantId: string
  className?: string
}) {
  return null
}
