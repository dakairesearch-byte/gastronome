import { type NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Launch waitlist signup.
 *
 * Accepts { email } and inserts a row into `waitlist_signups` using the
 * server (anon) Supabase client. The table has an insert-only RLS policy
 * (created by a separate DB migration) so the anon key can append rows but
 * cannot read the list back — we never expose the service role here.
 *
 * Duplicate emails are treated as success: the column is UNIQUE, so a
 * second signup raises a Postgres unique-violation (23505). That's not a
 * user-facing error — they're already on the list — so we swallow it and
 * return ok.
 *
 * The `waitlist_signups` table is not yet in the generated `Database`
 * types (the migration lands separately), so the typed client would reject
 * `.from('waitlist_signups')` at compile time. We narrow the cast to this
 * single call rather than untyping the whole client.
 */

// Server-side mirror of the client validation. Deliberately permissive but
// enough to reject the obvious garbage before it hits the DB.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const rawEmail = typeof (body as { email?: unknown }).email === 'string'
      ? ((body as { email: string }).email)
      : ''
    const email = rawEmail.trim().toLowerCase()

    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // `waitlist_signups` is not in the generated Database types yet — see
    // the file-level note. Cast to a minimal insert-capable shape.
    const table = (supabase as unknown as {
      from: (t: string) => {
        insert: (rows: Record<string, unknown>) => Promise<{
          error: { code?: string; message: string } | null
        }>
      }
    }).from('waitlist_signups')

    const { error } = await table.insert({ email, source: 'community' })

    if (error) {
      // 23505 = unique_violation: they're already signed up. Idempotent
      // success rather than leaking that the email exists.
      if (error.code === '23505') {
        return NextResponse.json({ success: true, alreadyJoined: true })
      }
      console.error('waitlist insert failed:', error)
      return NextResponse.json(
        { error: 'Something went wrong. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('waitlist error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
