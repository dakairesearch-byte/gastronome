'use client'

/**
 * ProgressRing — SVG donut ring showing X/N progress.
 *
 * Goal-gradient only: shows how far along you are, never how far behind.
 * No streaks, no XP, no loss-framing.
 */

interface ProgressRingProps {
  tried: number
  total: number
  /** Hex or CSS color for the filled arc */
  color: string
  /** Diameter in pixels. Default 64. */
  size?: number
  /** Show the fraction label inside? Default true. */
  showLabel?: boolean
  className?: string
}

export default function ProgressRing({
  tried,
  total,
  color,
  size = 64,
  showLabel = true,
  className = '',
}: ProgressRingProps) {
  const r = (size - 8) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const pct = total > 0 ? Math.min(tried / total, 1) : 0
  const dash = pct * circumference
  const gap = circumference - dash

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-label={`${tried} of ${total} tried`}
      role="img"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={5}
        />
        {/* Progress arc */}
        {pct > 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
            style={{ transition: 'stroke-dasharray 0.4s ease' }}
          />
        )}
      </svg>
      {showLabel && (
        <span
          className="absolute inset-0 flex flex-col items-center justify-center leading-none"
          aria-hidden="true"
        >
          <span
            className="font-semibold tabular-nums"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: size >= 64 ? '1rem' : '0.7rem',
              color: tried > 0 ? color : 'var(--color-text-secondary)',
            }}
          >
            {tried}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: size >= 64 ? '0.6rem' : '0.55rem',
              color: 'var(--color-text-secondary)',
            }}
          >
            / {total}
          </span>
        </span>
      )}
    </div>
  )
}
