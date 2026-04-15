/**
 * Pagination helper for unbounded PostgREST selects.
 *
 * Supabase/PostgREST silently caps `SELECT` responses at 1000 rows by
 * default, which turns full-table reads into silent correctness bugs once
 * a table crosses that threshold. Any caller that wants "every row" (e.g.
 * to compute a city histogram or a per-restaurant trending score) must
 * fan out over `.range()` pages and stitch them together.
 *
 * Usage:
 *
 *   const all = await paginateSelect((from, to) =>
 *     supabase.from('restaurants').select('id, city').range(from, to)
 *   )
 *
 * The builder callback receives the inclusive `[from, to]` window for one
 * page. The helper stops when a page returns fewer rows than `pageSize`.
 */

import type { PostgrestSingleResponse } from '@supabase/supabase-js'

const DEFAULT_PAGE_SIZE = 1000
// Safety cap so a rogue caller can't pull millions of rows into memory.
// 50k rows at ~200 bytes each ≈ 10 MB — generous for our use case and
// still bounded.
const MAX_ROWS = 50_000

export async function paginateSelect<T>(
  buildQuery: (from: number, to: number) => PromiseLike<PostgrestSingleResponse<T[]>>,
  options: { pageSize?: number; maxRows?: number } = {}
): Promise<T[]> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE
  const maxRows = options.maxRows ?? MAX_ROWS
  const out: T[] = []
  let from = 0
  while (out.length < maxRows) {
    const to = from + pageSize - 1
    const { data, error } = await buildQuery(from, to)
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return out
}
