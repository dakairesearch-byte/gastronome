/**
 * Gastronome "Luxe Moderne" theme — ported from Figma Make mockup (v23).
 *
 * This is the single source of truth for the design system colors,
 * typography, and component styles. CSS custom properties in globals.css
 * mirror these values so Tailwind utility classes (text-primary, bg-secondary,
 * etc.) stay in sync.
 */

export const gastronomeTheme = {
  colors: {
    primary: '#D4A574',       // warm gold/amber
    primaryHover: '#C4955F',
    secondary: '#2C3E50',     // dark navy
    accent: '#6B95A8',        // muted teal
    background: '#FFFEFB',    // warm off-white
    surface: '#FFFFFF',       // card backgrounds
    text: '#1C1C1C',          // near-black body text
    textSecondary: '#757575', // gray secondary text
    border: '#EBEBEB',        // subtle borders
  },
  fonts: {
    heading: "'Spectral', serif",
    body: "'DM Sans', sans-serif",
  },
  styles: {
    card: 'rounded-sm shadow-md border-0',
    button: 'rounded-sm',
    headerBorder: 'border-b',
  },
} as const

export type GastronomeTheme = typeof gastronomeTheme
