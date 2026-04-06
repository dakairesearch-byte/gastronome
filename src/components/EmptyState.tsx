import Link from 'next/link'
import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  ctaText?: string
  ctaHref?: string
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  ctaText,
  ctaHref,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="bg-emerald-50 p-4 rounded-full mb-6">
        <Icon size={32} className="text-emerald-600" />
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-2 text-center">
        {title}
      </h3>
      <p className="text-gray-600 text-center mb-6 max-w-md">
        {description}
      </p>
      {ctaText && ctaHref && (
        <Link
          href={ctaHref}
          className="px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-semibold"
        >
          {ctaText}
        </Link>
      )}
    </div>
  )
}
