'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, Plus, Bookmark, User } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function BottomNav() {
  const pathname = usePathname()
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUserId(session?.user?.id ?? null)
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
    })

    return () => subscription?.unsubscribe()
  }, [supabase])

  const tabs = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/restaurants', icon: Search, label: 'Explore' },
    ...(userId ? [{ href: '/review/new', icon: Plus, label: 'Review', isAction: true }] : []),
    { href: '/feed', icon: Bookmark, label: 'Feed' },
    { href: userId ? `/profile/${userId}` : '/auth/login', icon: User, label: 'Profile' },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-gray-200" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const isActive = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
          const Icon = tab.icon

          if (tab.isAction) {
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="relative flex flex-col items-center justify-center -mt-4 z-10"
              >
                <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center shadow-lg">
                  <Icon size={24} className="text-white" strokeWidth={2.5} />
                </div>
              </Link>
            )
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative z-10 flex flex-col items-center justify-center gap-0.5 flex-1 py-2 ${
                isActive ? 'text-amber-600' : 'text-gray-400'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
