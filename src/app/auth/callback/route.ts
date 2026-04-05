import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const url = request.nextUrl.clone()
      url.pathname = next
      return NextResponse.redirect(url)
    }
  }

  // return the user to an error page with instructions
  const url = request.nextUrl.clone()
  url.pathname = '/auth/auth-code-error'
  return NextResponse.redirect(url)
}
