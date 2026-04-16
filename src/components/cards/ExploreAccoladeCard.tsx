import Link from 'next/link'

interface ExploreAccoladeCardProps {
  title: string
  description: string
  image: string
  count: number
  href: string
}

/**
 * Figma accolade card: photo + title + description + restaurant count.
 * Used on the Explore page's "Acclaimed Dining" section.
 */
export default function ExploreAccoladeCard({
  title,
  description,
  image,
  count,
  href,
}: ExploreAccoladeCardProps) {
  return (
    <Link
      href={href}
      className="group block rounded-sm shadow-md overflow-hidden transition-all hover:shadow-2xl cursor-pointer"
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      <div className="overflow-hidden relative rounded-sm" style={{ height: '180px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt=""
          className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700"
        />
      </div>
      <div className="p-5">
        <h3
          className="text-xl mb-3"
          style={{
            color: 'var(--color-text)',
            fontFamily: "'Spectral', serif",
            fontWeight: 500,
          }}
        >
          {title}
        </h3>
        <p
          className="text-sm leading-relaxed mb-4"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: "'DM Sans', sans-serif",
            lineHeight: '1.6',
          }}
        >
          {description}
        </p>
        <div className="pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <span
            className="text-sm"
            style={{
              color: 'var(--color-accent)',
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
            }}
          >
            {count} {count === 1 ? 'restaurant' : 'restaurants'}
          </span>
        </div>
      </div>
    </Link>
  )
}
