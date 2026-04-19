/**
 * Brand marks for rating and accolade sources. Each is an inline SVG so
 * it renders at any size without a network request and can be recolored
 * via props. These are small icon-scale approximations of the source's
 * official mark — intended for use as recognition badges inside a pill
 * or next to a numeric rating. For full-size uses (hero art, marketing
 * pages) consult each brand's media kit for the canonical asset.
 *
 * IDs used by <defs> are scoped with React.useId() so rendering the same
 * icon twice in one page doesn't collide on the gradient identifier.
 */

import { useId } from 'react'
import type { SVGProps } from 'react'

type IconProps = Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> & {
  size?: number
  title?: string
}

/* -------------------------------------------------------------------- */
/*  Google "G" — official 4-color mark.                                  */
/* -------------------------------------------------------------------- */
export function GoogleGIcon({ size = 14, title, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

/* -------------------------------------------------------------------- */
/*  Yelp — red burst with stylized "y".                                  */
/* -------------------------------------------------------------------- */
export function YelpIcon({ size = 14, title, ...props }: IconProps) {
  // Simplified Yelp burst: six red petals radiating from center. Drawn
  // at 48x48 so stroking stays crisp when scaled down into a 14px pill.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <rect width="48" height="48" rx="10" fill="#D32323" />
      <g fill="#FFFFFF">
        {/* Stylized "y" — a Y-shaped glyph inspired by the Yelp mark. */}
        <path d="M22.3 10.5c0-1.2 1-2 2.2-1.9 1.4.1 4.6 1 5.6 1.6.9.5 1.2 1.5.7 2.3-.4.7-5.3 8-5.9 8.7-.5.6-1.5.9-2.2.3-.6-.5-.6-1.1-.6-1.7l.2-9.3z" />
        <path d="M30.5 22.8c-.6-.3-1.5 0-1.9.6-.4.6-2 4.2-2.3 5-.3.8.2 1.7 1 1.9.8.2 5.4 0 6.1-.2.9-.3 1.3-1 1.2-1.8-.1-.8-3-4.8-4.1-5.5z" />
        <path d="M16.6 29.5c-.5-.8-1.5-1-2.3-.5-.8.6-4.5 4.3-4.9 4.9-.5.8-.3 1.8.4 2.2.6.4 5.2 2.3 6.1 2.4.9.1 1.7-.4 1.9-1.3.1-.8-.3-6.3-1.2-7.7z" />
        <path d="M18.7 22.9c.7-.3.9-1.2.5-1.9-.4-.7-5.8-7.2-6.4-7.6-.7-.5-1.7-.3-2.1.4-.4.6-1.8 5.2-2 6.1-.1.9.4 1.7 1.3 1.8.8.1 7.3 1.5 8.7 1.2z" />
      </g>
    </svg>
  )
}

/* -------------------------------------------------------------------- */
/*  Michelin rosette — red 6-petal flower used for the Guide's stars.    */
/* -------------------------------------------------------------------- */
export function MichelinStarIcon({
  size = 14,
  title,
  color = '#C8102E',
  ...props
}: IconProps & { color?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <g fill={color}>
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <ellipse
            key={angle}
            cx="16"
            cy="8"
            rx="3.4"
            ry="6"
            transform={`rotate(${angle} 16 16)`}
          />
        ))}
        <circle cx="16" cy="16" r="3.8" />
      </g>
    </svg>
  )
}

/* -------------------------------------------------------------------- */
/*  Bib Gourmand — a tiny Bibendum-like silhouette in Michelin red.       */
/* -------------------------------------------------------------------- */
export function BibGourmandIcon({ size = 14, title, ...props }: IconProps) {
  const id = useId()
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <radialGradient id={`${id}-bib`} cx="0.5" cy="0.45" r="0.55">
          <stop offset="0" stopColor="#F5B4A1" />
          <stop offset="0.6" stopColor="#E85D4C" />
          <stop offset="1" stopColor="#C8102E" />
        </radialGradient>
      </defs>
      {/* Stacked tire-man silhouette: rounded head, torso, chin. */}
      <g fill={`url(#${id}-bib)`}>
        <ellipse cx="16" cy="10" rx="7" ry="6" />
        <ellipse cx="16" cy="19" rx="9" ry="5" />
        <ellipse cx="16" cy="26" rx="7" ry="4" />
      </g>
      {/* Eyes + smile. */}
      <g fill="#3A0D13">
        <circle cx="13.5" cy="9" r="0.9" />
        <circle cx="18.5" cy="9" r="0.9" />
        <path
          d="M13 11.5 Q 16 13.5 19 11.5"
          stroke="#3A0D13"
          strokeWidth="0.7"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </svg>
  )
}

/* -------------------------------------------------------------------- */
/*  James Beard Foundation — bronze medallion with "JB".                  */
/* -------------------------------------------------------------------- */
export function JamesBeardIcon({ size = 14, title, ...props }: IconProps) {
  const id = useId()
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EED37A" />
          <stop offset="0.5" stopColor="#C89644" />
          <stop offset="1" stopColor="#8B5A2B" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill={`url(#${id}-gold)`} />
      <circle
        cx="16"
        cy="16"
        r="15"
        fill="none"
        stroke="#5A3A16"
        strokeWidth="1"
      />
      <circle
        cx="16"
        cy="16"
        r="12"
        fill="none"
        stroke="#5A3A16"
        strokeWidth="0.6"
      />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fill="#3A2810"
        fontFamily="Georgia, serif"
        fontWeight="700"
        fontSize="13"
        letterSpacing="-0.5"
      >
        JB
      </text>
    </svg>
  )
}

/* -------------------------------------------------------------------- */
/*  Eater 38 — Eater red "E" wordmark.                                    */
/* -------------------------------------------------------------------- */
export function EaterIcon({ size = 14, title, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <rect width="32" height="32" rx="3" fill="#E85D1A" />
      <text
        x="16"
        y="22"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="'Helvetica Neue', Arial, sans-serif"
        fontWeight="900"
        fontSize="18"
        letterSpacing="-1"
      >
        E
      </text>
      <text
        x="24.5"
        y="10"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="'Helvetica Neue', Arial, sans-serif"
        fontWeight="800"
        fontSize="7"
      >
        38
      </text>
    </svg>
  )
}
