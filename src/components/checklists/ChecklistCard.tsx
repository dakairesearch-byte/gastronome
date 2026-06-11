import Link from 'next/link'
import ProgressRing from './ProgressRing'
import type { ChecklistMeta } from '@/lib/checklists'

interface ChecklistCardProps {
  meta: ChecklistMeta
  total: number
  /** null when user is anonymous */
  tried: number | null
}

export default function ChecklistCard({ meta, total, tried }: ChecklistCardProps) {
  return (
    <Link
      href={`/checklists/${meta.slug}`}
      className="group flex items-start gap-4 p-5 rounded-[var(--r-card)] transition-shadow hover:shadow-[var(--shadow-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-1)',
      }}
    >
      {/* Progress ring — shown for authed users; simple total pill for anon */}
      <div className="flex-shrink-0 mt-0.5">
        {tried !== null ? (
          <ProgressRing tried={tried} total={total} color={meta.color} size={64} />
        ) : (
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              border: '2px solid var(--color-border)',
            }}
          >
            <span
              className="text-sm font-semibold tabular-nums"
              style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)' }}
            >
              {total}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              className="text-base font-semibold leading-snug group-hover:underline"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}
            >
              {meta.title}
            </h2>
            <p
              className="mt-1 text-sm leading-relaxed"
              style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)' }}
            >
              {meta.subtitle}
            </p>
          </div>
          <span
            className={`flex-shrink-0 mt-0.5 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${meta.bgClass} ${meta.textClass}`}
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {total}
          </span>
        </div>

        {tried !== null && (
          <div className="mt-2.5">
            <div
              className="h-1 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--color-border)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: total > 0 ? `${Math.round((tried / total) * 100)}%` : '0%',
                  backgroundColor: meta.color,
                }}
              />
            </div>
            <p
              className="mt-1 text-xs"
              style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)' }}
            >
              {tried === 0
                ? 'Start exploring'
                : tried === total
                  ? 'Complete!'
                  : `${tried} tried · ${total - tried} to go`}
            </p>
          </div>
        )}
      </div>
    </Link>
  )
}
