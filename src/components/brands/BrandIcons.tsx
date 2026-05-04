/**
 * Brand marks for rating and accolade sources.
 *
 * Most marks now ship as official SVG assets in `/public/logos/` and
 * render via <img>. The remaining icons (Bib Gourmand, Yelp) keep an
 * inline SVG approximation since no canonical free asset is available.
 *
 * IDs used by <defs> on inline-SVG icons are scoped with React.useId()
 * so rendering the same icon twice in one page doesn't collide on the
 * gradient identifier.
 */

import Image from 'next/image'
import { useId } from 'react'
import type { SVGProps } from 'react'

type IconProps = Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> & {
  size?: number
  title?: string
}

function LogoImg({
  src,
  alt,
  size = 14,
  className,
}: {
  src: string
  alt: string
  size?: number
  className?: string
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain', display: 'inline-block' }}
      unoptimized
    />
  )
}

/* -------------------------------------------------------------------- */
/*  Google "G" — official 4-color mark, served from /public/logos/.       */
/* -------------------------------------------------------------------- */
export function GoogleGIcon({ size = 14, title }: IconProps) {
  return <LogoImg src="/logos/google-g.svg" alt={title ?? 'Google'} size={size} />
}

/* -------------------------------------------------------------------- */
/*  Yelp — red burst with stylized "y".                                  */
/* -------------------------------------------------------------------- */
export function YelpIcon({ size = 14, title, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <rect width="48" height="48" rx="10" fill="#D32323" />
      <g fill="#FFFFFF">
        <path d="M22.3 10.5c0-1.2 1-2 2.2-1.9 1.4.1 4.6 1 5.6 1.6.9.5 1.2 1.5.7 2.3-.4.7-5.3 8-5.9 8.7-.5.6-1.5.9-2.2.3-.6-.5-.6-1.1-.6-1.7l.2-9.3z" />
        <path d="M30.5 22.8c-.6-.3-1.5 0-1.9.6-.4.6-2 4.2-2.3 5-.3.8.2 1.7 1 1.9.8.2 5.4 0 6.1-.2.9-.3 1.3-1 1.2-1.8-.1-.8-3-4.8-4.1-5.5z" />
        <path d="M16.6 29.5c-.5-.8-1.5-1-2.3-.5-.8.6-4.5 4.3-4.9 4.9-.5.8-.3 1.8.4 2.2.6.4 5.2 2.3 6.1 2.4.9.1 1.7-.4 1.9-1.3.1-.8-.3-6.3-1.2-7.7z" />
        <path d="M18.7 22.9c.7-.3.9-1.2.5-1.9-.4-.7-5.8-7.2-6.4-7.6-.7-.5-1.7-.3-2.1.4-.4.6-1.8 5.2-2 6.1-.1.9.4 1.7 1.3 1.8.8.1 7.3 1.5 8.7 1.2z" />
      </g>
    </svg>
  )
}

/* -------------------------------------------------------------------- */
/*  Michelin rosette — official SVG from /public/logos.                   */
/* -------------------------------------------------------------------- */
export function MichelinStarIcon({
  size = 14,
  title,
  count = 1,
}: IconProps & { color?: string; count?: 1 | 2 | 3 }) {
  const file =
    count === 3
      ? '/logos/michelin-3-stars.svg'
      : count === 2
      ? '/logos/michelin-2-stars.svg'
      : '/logos/michelin-1-star.svg'
  const widthMultiplier = count === 3 ? 3 : count === 2 ? 2 : 1
  return (
    <LogoImg
      src={file}
      alt={title ?? `${count} Michelin star${count === 1 ? '' : 's'}`}
      size={size * widthMultiplier}
    />
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
      aria-label={title}
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
      <g fill={`url(#${id}-bib)`}>
        <ellipse cx="16" cy="10" rx="7" ry="6" />
        <ellipse cx="16" cy="19" rx="9" ry="5" />
        <ellipse cx="16" cy="26" rx="7" ry="4" />
      </g>
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
/*  James Beard Foundation — official logo from /public/logos.            */
/* -------------------------------------------------------------------- */
export function JamesBeardIcon({ size = 14, title }: IconProps) {
  return <LogoImg src="/logos/james-beard.svg" alt={title ?? 'James Beard Foundation'} size={size} />
}

/* -------------------------------------------------------------------- */
/*  Eater — official Eater logo from /public/logos.                      */
/* -------------------------------------------------------------------- */
export function EaterIcon({ size = 14, title }: IconProps) {
  return <LogoImg src="/logos/eater.svg" alt={title ?? 'Eater'} size={size} />
}
