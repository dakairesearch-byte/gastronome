'use client'

import { useState } from 'react'
import { Sparkles, Mail } from 'lucide-react'

export default function ComingSoon() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email.trim()) {
      setSubmitted(true)
    }
  }

  return (
    <section className="w-full bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 py-20 px-6">
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 backdrop-blur-sm rounded-full text-emerald-100 text-sm font-medium mb-6">
          <Sparkles size={16} />
          <span>Coming Soon</span>
        </div>

        <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
          More cities. More ratings. More sources.
        </h2>

        <p className="mt-4 text-lg text-emerald-100 leading-relaxed max-w-xl mx-auto">
          We&apos;re expanding to cover every major dining city and adding new rating sources so you always get the full picture.
        </p>

        {/* Email signup */}
        <div className="mt-8 max-w-md mx-auto">
          {submitted ? (
            <div className="flex items-center justify-center gap-2 px-6 py-4 bg-white/20 backdrop-blur-sm rounded-2xl text-white font-medium">
              <Mail size={18} />
              <span>Thanks! We&apos;ll keep you posted.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="flex-1 relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-white/50 shadow-lg text-sm"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3.5 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors shadow-lg whitespace-nowrap"
              >
                Get Notified
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
