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
    default: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
    featured: 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm',
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
