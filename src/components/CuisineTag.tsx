import Link from 'next/link'

interface CuisineTagProps {
  cuisine: string
  count?: number
  variant?: 'default' | 'featured'
}

export default function CuisineTag({
  cuisine,
  count,
  variant = 'default',
}: CuisineTagProps) {
  const baseClasses =
    'inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all'

  const variantClasses = {
    default: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    featured: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm',
  }

  return (
    <Link
      href={`/search?cuisine=${encodeURIComponent(cuisine)}`}
      className={`${baseClasses} ${variantClasses[variant]}`}
    >
      <span>{cuisine}</span>
      {count != null && <span className="text-sm opacity-75">({count})</span>}
    </Link>
  )
}
