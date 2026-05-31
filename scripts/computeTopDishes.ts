/**
 * computeTopDishes.ts
 *
 * The real Top Dish recommender. Replaces the old approach (promote generic
 * dish_name → menu_item_name via fuzzy match) which capped at ~8.5% coverage
 * and produced mediocre results.
 *
 * New architecture (menu-anchored, tiered fallback):
 *   Tier 1: For each restaurant, enumerate FOOD menu items. Score each by
 *           how often it's mentioned in raw evidence:
 *             - restaurant_highlighted_dishes.sample_quote (review quotes)
 *             - restaurant_videos.caption (TikTok/IG content)
 *             - highlighted_dishes rows whose dish_name matches (adds aggregate
 *               google/tiktok/instagram mention counts)
 *           Extract sentiment from the window around each match (positive
 *           words near match → +, negative/hedge → −). Top N per restaurant.
 *
 *   Tier 2: Restaurants where Tier 1 found <2 confident dishes fall through to
 *           the cleaned-up highlighted_dishes rollup (existing dish_name or
 *           promoted display_name). Same sentiment scoring where possible.
 *
 * Output table: restaurant_top_dishes. Rebuilt end-to-end each run.
 *
 * Run:
 *   npx tsx scripts/computeTopDishes.ts            # dry-run stats
 *   npx tsx scripts/computeTopDishes.ts --write    # rebuild the table
 *   npx tsx scripts/computeTopDishes.ts --sample=10 --verbose   # debug one
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ---------------- Env loading ----------------
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const sb = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

// ---------------- CLI ----------------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  })
) as Record<string, string>
const WRITE = args.write === 'true'
const SAMPLE = parseInt(args.sample || '0', 10) || 0
const VERBOSE = args.verbose === 'true'
const MAX_TOP = parseInt(args.topN || '8', 10)

// ---------------- Normalization / tokenizing ----------------
const STOP_WORDS = new Set([
  'the','a','an','of','and','or','to','at','in','on','for','with','by','from',
  'as','is','it','be','very','just','more','too','so','my','our','your','their',
  'this','that','these','those','have','had','was','were','been','being','am',
  'are','will','would','could','should','out','up','down','off','over','again',
  'de','la','le','du','des','el','los','las',
])
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^a-z0-9'\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
const IRREG: Record<string, string> = {
  fries: 'fry', frie: 'fry', leaves: 'leaf',
  wings: 'wing', wing: 'wing', ribs: 'rib', rib: 'rib',
  oysters: 'oyster', oyster: 'oyster', clams: 'clam', clam: 'clam',
  potatoes: 'potato', potato: 'potato', tomatoes: 'tomato', tomato: 'tomato',
  anchovies: 'anchovy', anchovy: 'anchovy', berries: 'berry', berry: 'berry',
  hummus: 'hummu', hummu: 'hummu', dumplings: 'dumpling', dumpling: 'dumpling',
  noodles: 'noodle', noodle: 'noodle', tacos: 'taco', taco: 'taco',
  buns: 'bun', bun: 'bun', ravioli: 'raviolo', raviolo: 'raviolo',
}
function stem(tok: string): string {
  if (tok.length <= 3) return tok
  if (IRREG[tok]) return IRREG[tok]
  if (tok.endsWith('sses')) return tok
  if (tok.endsWith('ies') && tok.length > 4) return tok.slice(0, -3) + 'y'
  if (tok.endsWith('ses') || tok.endsWith('xes') || tok.endsWith('zes') ||
      tok.endsWith('ches') || tok.endsWith('shes')) return tok.slice(0, -2)
  if (tok.endsWith('s') && !tok.endsWith('ss') && !tok.endsWith('us')) return tok.slice(0, -1)
  return tok
}
function tokens(text: string): string[] {
  return normalize(text).split(/\s+/).filter(Boolean)
    .filter((t) => !STOP_WORDS.has(t))
    .map(stem)
}
function contentTokens(text: string): string[] {
  // stems but preserve order, dedup consecutive
  const toks = tokens(text)
  const out: string[] = []
  for (const t of toks) {
    if (out.length === 0 || out[out.length - 1] !== t) out.push(t)
  }
  return out
}

// ---------------- Menu item filtering ----------------
// Reject drinks, noise headers, and PDF letter-spacing junk.
// Section-based detection is STRICT — we only drop on section when the whole
// section is clearly drinks-only. "Appetizers" that happen to contain "wine"
// in their description must survive.
const DRINK_SECTION_STRICT = /^\s*(drinks?|cocktails?|wine|wines|wine\s*list|beer|beers|spirits?|bar|beverages?|aperitifs?|digestifs?|sake|liquors?|liqueurs?|champagne|bubbles|nightcaps?|mocktails?|after\s*dinner)\s*(list|menu|program|selection|pairing)?\s*$/i
// Name-level drink detection: require the name to LOOK like a drink itself
// (not just contain a drink-related word, because "wine-braised short ribs"
// is a dish). So we anchor on specific cocktail names, bottle descriptors, and
// vintage/ABV patterns.
const DRINK_NAME_STRONG = /^(cocktails?|martinis?|margaritas?|negronis?|old\s*fashioned|manhattans?|mojitos?|daiquiris?|mai\s*tais?|sazeracs?|moscow\s*mules?|espresso\s*martinis?|aperol\s*spritz|spritzes?|gimlets?|whiskey\s*sours?|boulevardiers?|palomas?|gin\s*and\s*tonic|g\s*&\s*t|lattes?|cappuccinos?|espressos?|americanos?|macchiatos?|mochas?|flat\s*white|cortado|affogato|frappes?|milkshakes?|smoothies?|juices?|lemonades?|iced\s*(tea|coffee|latte)|boba|bubble\s*tea|hot\s*(chocolate|cocoa)|matcha(\s*latte)?|chai(\s*latte)?|mimosas?|bellinis?|sangrias?|bloody\s*marys?|pina\s*coladas?|caipirinhas?|sakes?|soju|wines?|red\s*wine|white\s*wine|rose|beers?|ales?|lagers?|stouts?|ipas?|whiskeys?|whiskies|bourbons?|scotches?|vodkas?|gins?|tequilas?|mezcals?|rums?|champagnes?|proseccos?|cavas?|highballs?)\b/i
// Full-string drink match for the rollup tier (dish_name must BE a drink).
// Declared up here so `prepareMenuItem` can also reference it.
const DRINK_DISH_NAME = /^(cocktails?|martinis?|margaritas?|negronis?|old\s*fashioned|manhattans?|mojitos?|daiquiris?|mai\s*tais?|sazeracs?|moscow\s*mules?|espresso\s*martinis?|aperol\s*spritz|spritzes?|gimlets?|whiskey\s*sours?|boulevardiers?|palomas?|gin\s*and\s*tonic|lattes?|cappuccinos?|espressos?|americanos?|macchiatos?|mochas?|flat\s*white|cortado|affogato|frappes?|milkshakes?|smoothies?|juices?|lemonades?|iced\s*(tea|coffee|latte)|boba|bubble\s*tea|hot\s*(chocolate|cocoa)|matcha(\s*latte)?|chai(\s*latte)?|mimosas?|bellinis?|sangrias?|bloody\s*marys?|pina\s*coladas?|caipirinhas?|sakes?|soju|wines?|wine\s*pairing|red\s*wine|white\s*wine|rose|beers?|ales?|lagers?|stouts?|ipas?|whiskeys?|whiskies|bourbons?|scotches?|vodkas?|gins?|tequilas?|mezcals?|rums?|champagnes?|proseccos?|cavas?|highballs?|drinks?|beverages?)\s*$/i
const VINTAGE_YEAR = /\b(19|20)\d{2}\b/
const ABV = /\b\d+(\.\d+)?\s?%\s?(abv|alc)\b/i
const NV = /\bN\.?V\.?\b/
const SIZE_ONLY = /^(bottle|glass|half\s*bottle|magnum|pint|carafe|decanter|\d+\s?(oz|ml|cl))\b/i
const JUNK_NAME_EXACT = new Set([
  'beverage menu','dinner menu','lunch menu','brunch menu','drink menu','drinks menu',
  'wine list','cocktail menu','tasting menu','chefs tasting menu','chef tasting menu',
  'adobe pdf library','3 courses','4 courses','5 courses','a la carte',
  'current slide','next slide','previous slide','menu','menus','food menu',
  'chefs table','chef table','by the bottle','by the glass','bottle','glass',
])
// "4-course dinner", "5 course tasting", "A 3 Course Menu" — tasting/prix fixe headers
const COURSE_LABEL = /(^|\s|-)\d\s*-?\s*(course|courses|cours)\b/i
// "chef's tasting", "prix fixe", "dinner for two", "pairing menu"
const TASTING_HEADER = /\b(prix\s*fixe|tasting\s*menu|pairing\s*menu|chef['\u2019]?s?\s*(tasting|table|selection|choice|menu)|dinner\s*for\s*(\d|two|three|four)|pairing\s*for)\b/i
const SECTION_HEADER_HINT = /^(appetizers?|mains?|entrees?|desserts?|starters?|sides?|specials?|sandwiches?|salads?|pizzas?|burgers?|pastas?|vegetarian|seafood|meats?|soups?|small\s*plates?|large\s*plates?|shared\s*plates?|hors\s*d'?oeuvres?)$/i

function isDrinkLikeItem(name: string, section: string | null): boolean {
  // Very strict section match (full-section-is-drinks only)
  if (section && DRINK_SECTION_STRICT.test(section)) return true
  if (DRINK_NAME_STRONG.test(name)) return true
  if (VINTAGE_YEAR.test(name)) return true
  if (ABV.test(name) || NV.test(name)) return true
  if (SIZE_ONLY.test(name)) return true
  return false
}
function isJunkItem(name: string): boolean {
  const n = name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!n) return true
  if (n.length < 3) return true
  if (JUNK_NAME_EXACT.has(n)) return true
  if (COURSE_LABEL.test(name)) return true
  if (TASTING_HEADER.test(name)) return true
  if (SECTION_HEADER_HINT.test(n)) return true
  // Letter-spaced PDF artifacts: "M A R G H E R I TA" — most tokens are 1-2 chars
  const toks = name.split(/\s+/)
  if (toks.length >= 5) {
    const tiny = toks.filter((t) => t.length <= 2).length
    if (tiny / toks.length > 0.6) return true
  }
  // PDF metadata leakage
  if (/adobe pdf/i.test(name)) return true
  if (/^menu\b/i.test(name) && toks.length <= 3) return true
  return false
}

// ---------------- Menu item name matching in evidence text ----------------
/**
 * Clean menu item name for display AND generate a compact search key.
 * Returns { display, searchKeys } where searchKeys are phrases we'll look
 * for inside evidence text.
 */
// Generic "modifier" content tokens that shouldn't be used as single-word
// search keys because they'd falsely match half the universe. "Special" or
// "House" added to a menu item name doesn't mean reviews mentioning "special"
// are about that dish.
const GENERIC_MODIFIER = new Set([
  'grilled','fried','baked','roasted','braised','seared','crispy','smoked',
  'steamed','sauteed','blackened','pulled','shredded','poached','raw','glazed',
  'house','style','signature','classic','famous','favorite','original','special',
  'regular','daily','seasonal','fresh','farm','handmade','homemade','artisan',
  'organic','local','traditional','authentic','kosher','vegan','vegetarian',
  'gluten','free','spicy','mild','sweet','salty','small','large','jumbo','mini',
  'plate','bowl','platter','combo','combination','stuffed','loaded','topped',
  'dressed','marinated','served','drizzled','buttered','breaded','pan','oven',
  'chocolate','vanilla','strawberry','cheese','butter','tomato','onion','garlic',
  'lemon','lime','olive','green','red','white','black','yellow','brown',
])

// Decode the most common HTML entities that leak into scraped menu data
// ("&amp;", "&acirc;", "&eacute;"). Full entity decoding is overkill —
// we hit the small set that actually shows up in real menus.
const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'",
  '&nbsp;':' ','&aacute;':'á','&eacute;':'é','&iacute;':'í','&oacute;':'ó',
  '&uacute;':'ú','&ntilde;':'ñ','&acirc;':'â','&ecirc;':'ê','&icirc;':'î',
  '&ocirc;':'ô','&ucirc;':'û','&auml;':'ä','&euml;':'ë','&iuml;':'ï',
  '&ouml;':'ö','&uuml;':'ü','&agrave;':'à','&egrave;':'è','&igrave;':'ì',
  '&ograve;':'ò','&ugrave;':'ù','&ccedil;':'ç','&szlig;':'ß','&atilde;':'ã',
  '&otilde;':'õ','&Aacute;':'Á','&Eacute;':'É','&Iacute;':'Í','&Oacute;':'Ó',
  '&Uacute;':'Ú','&Ntilde;':'Ñ','&Acirc;':'Â','&Ecirc;':'Ê','&Ocirc;':'Ô',
  '&mdash;':'—','&ndash;':'–','&hellip;':'…','&lsquo;':'\u2018','&rsquo;':'\u2019',
  '&ldquo;':'\u201c','&rdquo;':'\u201d',
}
function decodeEntities(s: string): string {
  if (!s.includes('&')) return s
  return s.replace(/&[a-zA-Z]+;|&#\d+;/g, (m) => HTML_ENTITY_MAP[m] ?? m)
}

function prepareMenuItem(rawName: string): { display: string; searchKeys: string[] } {
  // Reuse the cleanup from the old matcher
  let s = decodeEntities(rawName).trim()
  // Strip asterisks wherever they appear (menu footnote markers like
  // "Miso Salmon* Gf Sake" or "Orecchiette Pasta* Mushroom Ragu").
  s = s.replace(/\*+/g, ' ').replace(/\s+/g, ' ').trim()
  // Strip mid-string allergen/dietary markers that often appear between a
  // dish name and supplementary info ("Miso Salmon Gf Sake" — strip "Gf").
  s = s.replace(
    /\s+\(?(?:gf|df|v|vg|vgn|vegan|vegetarian|nf|gluten[-\s]?free|dairy[-\s]?free|halal|kosher|nut[-\s]?free)\)?\b/gi,
    ' '
  ).replace(/\s+/g, ' ').trim()
  // Strip a leading allergen/dietary-label prefix: "gf,", "gf, vegan",
  // "gf, halal", "(gf) ", "(v)", "vg:", "vegetarian - ". These appear as
  // marketing fluff at the start of menu item names.
  s = s.replace(
    /^\s*\(?\s*(?:gf|df|v|ve|vg|vgn|vegan|vegetarian|nf|gluten[-\s]?free|dairy[-\s]?free|halal|kosher|nut[-\s]?free)\s*\)?(?:\s*,\s*(?:gf|df|v|ve|vg|vgn|vegan|vegetarian|nf|gluten[-\s]?free|dairy[-\s]?free|halal|kosher|nut[-\s]?free))*\s*[,:\-–—|]?\s*/i,
    ''
  ).trim()
  // Split on bullet/middot separators (·), forward slashes used as descriptor
  // separators ("A Simple Salad / herby vinaigrette, cucumbers"), and em/en
  // dashes with spaces. Take the first chunk.
  s = s.split(/\s*[·•]\s*/)[0].trim()
  s = s.split(/\s+\/\s+/)[0].trim()
  s = s.split(/\s+[—–|]\s+/)[0].trim()
  // Strip trailing comma-separated description if present after the core dish name
  // "Steak Tartare with Cornichon salad, croutons and quail egg" → keep core
  // Only strip if the core before comma is 1-4 words
  const commaMatch = s.match(/^([^,]{3,40}?)\s*,/)
  if (commaMatch && commaMatch[1].split(/\s+/).length <= 5) {
    s = commaMatch[1].trim()
  }
  // Strip "with ..." suffixes when they make the item too long (keep "Fish with Chips"
  // but drop "Burger with caramelized onions, aged cheddar, and brioche bun")
  const withMatch = s.match(/^(.+?)\s+with\s+/i)
  if (withMatch && s.length > 35 && withMatch[1].split(/\s+/).length >= 2) {
    s = withMatch[1].trim()
  }
  s = s.replace(/[\s*\-—–|·•]+$/g, '').trim()
  // Strip trailing "N for" (truncated "N for $X" pricing like "Shrimp Cocktail 5 for")
  s = s.replace(/\s+\d+\s+for\s*$/i, '').trim()
  // Strip trailing "per N"
  s = s.replace(/\s+per\s+(piece|dozen|order|half|oz|lb|person|\d+)\s*$/i, '').trim()
  s = s.replace(/\s*\$?\s?\d{1,3}(\.\d{2})?\s*$/g, '').trim()
  s = s.replace(/\s*\((?:gf|df|v|ve|vg|vegan|vegetarian|nf|gluten[-\s]?free|dairy[-\s]?free)\)\s*$/gi, '').trim()
  s = s.replace(/\s*\*+\s*$/g, '').trim()
  // Strip any remaining trailing preposition/article/conjunction residue after
  // prior cleanups (English + common Italian/French/Spanish short prepositions)
  s = s.replace(/\s+(for|of|with|and|or|the|a|an|to|at|in|on|by|con|di|da|del|della|de|des|du|la|le|el|al|au|aux|avec|sur|sous)\s*$/i, '').trim()
  s = s.replace(/\s+/g, ' ').trim()
  if (!s) s = rawName.trim()
  // Truncate on any bracket (open OR close) — ASCII parens, square brackets,
  // and CJK full-width brackets (（）「」【】〈〉). Menu items like
  // "Pork Chashu (3) 630 Bean Sprouts", "Pandan Chicken （斑斓鸡）",
  // "Curry Puff )（咖喱角）", "Pickle Bag /gf)" leave garbage / bilingual
  // tails. Take the pre-bracket portion.
  const parenMatch = s.match(/^([^()\[\]（）「」【】〈〉]{3,60}?)\s*[()\[\]（）「」【】〈〉]/)
  if (parenMatch && parenMatch[1].trim().split(/\s+/).length >= 1) {
    s = parenMatch[1].trim()
  }
  // Strip trailing punctuation clusters ("Spicy!!", "Salmon?!", "Burger.",
  // "Pickle Bag /gf", residual slashes)
  s = s.replace(/[!?./\\;:]+\s*$/, '').trim()
  // Truncate on smart quotes / straight quotes used as in-line descriptor
  // delimiters (e.g. "Filet de sole meunière "Tradition"...").
  s = s.split(/[""\u201c\u201d]/)[0].trim()
  // If still > 5 words after cleanup, take the first 4 words (menu items
  // longer than this are almost always descriptions, not dish names).
  {
    const sw = s.split(/\s+/)
    if (sw.length > 5) {
      s = sw.slice(0, 4).join(' ')
    }
  }
  s = s.replace(/[\s*\-—–|·•,]+$/g, '').trim()
  if (!s) return { display: rawName.trim(), searchKeys: [] }
  // Reject menu items that start with a preposition/auxiliary or article —
  // these are fragments of descriptions ("With Pork", "With Soup", "With
  // Verlasso Salmon (Medium)", "The Signature Burger") rather than dish names.
  // Return empty searchKeys so callers skip the item.
  const firstWord = s.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  const LEADING_PREP_MENU = new Set([
    'with','for','of','from','to','at','on','in','out','by','into','onto','upon',
    'plus','served','topped','comes','includes','including','available','add','w/',
    // Articles/possessives — "The Story of the Spaniard", "Our House Specialty",
    // "A Simple Salad", "The quick delicious lunch..."
    'the','a','an','his','her','my','our','your','their','its',
  ])
  if (LEADING_PREP_MENU.has(firstWord)) return { display: s, searchKeys: [] }
  // Reject if first character isn't a letter (punctuation/digit leads)
  if (!/^[A-Za-z]/.test(s)) return { display: s, searchKeys: [] }
  // Reject drink-like dish names that slipped past isDrinkLikeItem (Latte,
  // Cappuccino, Espresso, etc. — common Cafe synthesized signatures).
  if (DRINK_DISH_NAME.test(s)) return { display: s, searchKeys: [] }
  // Title-case uniformly. Even when the input is mixed-case ("daikon CAKES",
  // "charcuterie Board"), lowercase then recapitalize every word so the output
  // is consistently Title Case.
  s = s.toLowerCase().split(/(\s+)/).map((w) =>
    /^[a-z]/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w
  ).join('')
  const display = s

  // Search keys: full clean name, plus content-token core phrases.
  const normed = normalize(display)
  const ctoks = contentTokens(display)  // stems, no stopwords
  const keys = new Set<string>()
  if (ctoks.length >= 1 && ctoks.length <= 4) keys.add(normed)
  // Take the last 2-3 content tokens (often the noun core: "braised short ribs")
  if (ctoks.length >= 2) {
    keys.add(ctoks.slice(-2).join(' '))
    if (ctoks.length >= 3) keys.add(ctoks.slice(-3).join(' '))
  }
  if (ctoks.length === 1) keys.add(ctoks[0])
  // Secondary keys: individual content tokens ≥4 chars that aren't generic
  // modifiers. These let "Grilled Chicken Caesar" match a review mention of
  // just "chicken" or "caesar". Prefixed with @ so match scoring treats them
  // as lower quality than phrase matches.
  for (const t of ctoks) {
    if (t.length < 4) continue
    if (GENERIC_MODIFIER.has(t)) continue
    keys.add('@' + t)
  }
  return { display, searchKeys: [...keys].filter(Boolean) }
}

/**
 * Does this evidence text mention the menu item?
 * Returns match quality 0..1 (0 = no match).
 * Uses word-aligned substring of any searchKey. Single-token items require
 * at least 4 letters to avoid matching noise like "tart" inside "tartare".
 */
function matchItemInText(item: { display: string; searchKeys: string[] }, textNorm: string, textTokenStems: string[]): number {
  let best = 0
  for (const rawKey of item.searchKeys) {
    if (!rawKey) continue
    const isSecondary = rawKey.startsWith('@')
    const key = isSecondary ? rawKey.slice(1) : rawKey
    const keyToks = key.split(/\s+/)
    // Single token key: require >=4 chars and word-aligned.
    // Secondary keys (content words extracted from multi-token menu items)
    // match at lower quality since they risk overcrediting generic mentions.
    if (keyToks.length === 1) {
      if (key.length < 4) continue
      const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`(^|\\W)${esc}s?(\\W|$)`, 'i')
      if (re.test(textNorm)) best = Math.max(best, isSecondary ? 0.4 : 0.65)
      continue
    }
    // Multi-token key: check word-aligned phrase first
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(^|\\W)${esc}(\\W|$)`, 'i')
    if (re.test(textNorm)) {
      best = Math.max(best, 0.9 + Math.min(keyToks.length - 2, 2) * 0.03)
      continue
    }
    // Otherwise: token-overlap with proximity (all key tokens appear within a
    // 7-token window in the text). This catches "pork belly" when the text
    // says "crispy pork belly with glaze".
    const stemSet = new Set(keyToks.map(stem))
    let hits: number[] = []
    for (let i = 0; i < textTokenStems.length; i++) {
      if (stemSet.has(textTokenStems[i])) hits.push(i)
    }
    if (hits.length >= keyToks.length) {
      // is there a window of size <=7 containing all distinct key tokens?
      for (let i = 0; i < hits.length; i++) {
        const distinct = new Set<string>()
        for (let j = i; j < hits.length && hits[j] - hits[i] < 7; j++) {
          distinct.add(textTokenStems[hits[j]])
          if (distinct.size === stemSet.size) {
            best = Math.max(best, 0.7)
            break
          }
        }
      }
    }
  }
  return best
}

// ---------------- Sentiment ----------------
const POS_WORDS = /\b(amazing|delicious|best|favorite|favourite|incredible|phenomenal|perfect|perfection|loved|love|must|fantastic|excellent|outstanding|heavenly|awesome|terrific|killer|epic|wonderful|divine|superb|crispy|tender|juicy|fresh|flavou?rful|hearty|legendary|standout|stellar|exceptional|worth|obsessed|craving|crave)\b/i
const NEG_WORDS = /\b(bland|mediocre|disappointing|disappointed|overcooked|undercooked|dry|soggy|greasy|stale|awful|terrible|bad|meh|skip|tough|chewy|forgettable|lacklustre|lackluster|underwhelm|rubbery|cold|salty|sour|overpriced|watered|watery)\b/i
const HEDGE_NEG = /\b(not|hardly|barely|wasn't|wasnt|weren't|werent|didn't|didnt)\b/i
const HEDGE_POS_FLIP = /\b(not\s+(bad|terrible|awful|mediocre|disappointing))\b/i

/**
 * Sentiment of a single match window: look at ±35 chars around the match.
 * Returns 'positive' | 'negative' | 'neutral'.
 */
function windowSentiment(window: string): 'positive' | 'negative' | 'neutral' {
  if (HEDGE_POS_FLIP.test(window)) return 'positive'
  // If "not" precedes a positive word, flip
  const negHedge = HEDGE_NEG.test(window)
  const pos = POS_WORDS.test(window)
  const neg = NEG_WORDS.test(window)
  if (negHedge && pos && !neg) return 'negative'
  if (pos && !neg) return 'positive'
  if (neg && !pos) return 'negative'
  if (pos && neg) {
    // Tiebreak: pick whichever word is closer to window center
    return 'neutral'
  }
  return 'neutral'
}

function findMatchWindow(text: string, key: string): string {
  const norm = text.toLowerCase()
  const keyNorm = key.toLowerCase()
  const i = norm.indexOf(keyNorm.split(' ')[0])
  if (i < 0) return text.slice(0, 120)
  const start = Math.max(0, i - 35)
  const end = Math.min(text.length, i + keyNorm.length + 35)
  return text.slice(start, end)
}

// ---------------- Types & loading ----------------
type MenuItemRow = {
  id: string
  restaurant_id: string
  item_name: string
  section: string | null
  price_cents: number | null
}
type DishRow = {
  restaurant_id: string
  dish_name: string
  sample_quote: string | null
  sample_quote_source: string | null
  google_mentions: number
  tiktok_mentions: number
  instagram_mentions: number
  mention_count: number
}
type VideoRow = {
  restaurant_id: string
  caption: string | null
  platform: string
  like_count: number | null
  view_count: number | null
  posted_at: string | null
}

async function loadAll<T>(table: string, select: string): Promise<T[]> {
  const out: T[] = []
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await sb.from(table).select(select).range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...(data as T[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return out
}

// ---------------- Evidence & scoring per restaurant ----------------
type Evidence = {
  text: string
  source: 'google' | 'tiktok' | 'instagram' | 'other'
  weight: number  // how much one match in this piece is worth (1.0 default)
  postedAt: number | null
}

type PreparedItem = {
  id: string
  raw: string
  display: string
  searchKeys: string[]
  section: string | null
  price_cents: number | null
}

type DishScore = {
  menu_item_id: string | null
  display_name: string
  score: number
  positive_count: number
  negative_count: number
  neutral_count: number
  google_mentions: number
  tiktok_mentions: number
  instagram_mentions: number
  total_mentions: number
  sample_quote: string | null
  sample_quote_source: string | null
  tier: 'menu_anchored' | 'rollup_fallback'
  price_cents: number | null
}

// Cuisine → canonical signature dishes. When a restaurant has cuisine X,
// these terms are treated as synthetic menu items so reviewer mentions of
// "great pizza" at a pizzeria upgrade to menu_anchored, even if the actual
// menu failed to scrape or was too sparse/junk to match specifically.
// Display names use title case; search keys are lowercase.
const CUISINE_SIGNATURES: Record<string, string[]> = {
  'Pizza':        ['Pizza', 'Margherita', 'Pepperoni Pizza', 'Pie', 'Slice'],
  'Steak':        ['Steak', 'Ribeye', 'Filet Mignon', 'New York Strip', 'Porterhouse', 'Tomahawk', 'Wagyu'],
  'Burger':       ['Burger', 'Cheeseburger', 'Smash Burger'],
  'Sushi':        ['Sushi', 'Nigiri', 'Sashimi', 'Maki', 'Roll', 'Omakase', 'Chirashi'],
  'Japanese':     ['Sushi', 'Nigiri', 'Ramen', 'Udon', 'Tempura', 'Yakitori', 'Gyoza', 'Donburi'],
  'Mexican':      ['Tacos', 'Burrito', 'Quesadilla', 'Nachos', 'Ceviche', 'Guacamole', 'Enchilada'],
  'Chinese':      ['Dumplings', 'Noodles', 'Dim Sum', 'Xiao Long Bao', 'Bao', 'Peking Duck'],
  'Italian':      ['Pasta', 'Pizza', 'Lasagna', 'Carbonara', 'Risotto', 'Gnocchi', 'Tiramisu', 'Burrata'],
  'Thai':         ['Pad Thai', 'Curry', 'Tom Yum', 'Larb', 'Som Tum', 'Drunken Noodle', 'Massaman'],
  'French':       ['Steak Frites', 'Coq au Vin', 'Duck Confit', 'Cassoulet', 'Soufflé', 'Escargot'],
  'Korean':       ['KBBQ', 'Bibimbap', 'Bulgogi', 'Galbi', 'Kimchi', 'Tteokbokki', 'Japchae', 'Mandu'],
  'Indian':       ['Curry', 'Tikka Masala', 'Naan', 'Biryani', 'Dosa', 'Samosa', 'Vindaloo'],
  'Seafood':      ['Oysters', 'Lobster', 'Crab', 'Scallops', 'Shrimp'],
  'American':     ['Burger', 'Steak', 'Wings', 'Mac and Cheese', 'Fried Chicken', 'Brisket'],
  'Bakery':       ['Croissant', 'Bagel', 'Cookie', 'Cake', 'Pastry', 'Danish', 'Muffin', 'Scone'],
  'Cafe':         ['Latte', 'Cappuccino', 'Croissant', 'Avocado Toast', 'Sandwich'],
  'Mediterranean':['Hummus', 'Falafel', 'Kebab', 'Shawarma', 'Tzatziki', 'Pita', 'Labneh'],
  'Ramen':        ['Ramen', 'Tonkotsu', 'Miso Ramen', 'Shoyu Ramen', 'Gyoza'],
  'BBQ':          ['Brisket', 'Ribs', 'Pulled Pork', 'Burnt Ends', 'Mac and Cheese', 'Coleslaw'],
  'Vietnamese':   ['Pho', 'Banh Mi', 'Spring Rolls', 'Bun', 'Vermicelli'],
  'Indian Sandwich':['Vada Pav', 'Chutney Sandwich', 'Bhaji'],
  // Italian Sandwich handled below (expanded entry)
  'Greek':        ['Gyro', 'Spanakopita', 'Moussaka', 'Souvlaki', 'Tzatziki', 'Greek Salad'],
  'Middle Eastern':['Shawarma', 'Falafel', 'Hummus', 'Kebab', 'Pita'],
  'Spanish':      ['Paella', 'Tapas', 'Jamón', 'Patatas Bravas', 'Churros'],
  'Bar':          ['Burger', 'Wings', 'Fries', 'Bar Snacks'],
  'Fine Dining':  ['Tasting Menu', 'Foie Gras', 'Caviar', 'Truffle'],
  // Additional cuisines (covering remaining high-volume categories)
  'New American':    ['Burger', 'Steak', 'Pasta', 'Roast Chicken', 'Mac and Cheese'],
  'Californian':     ['Salad', 'Avocado Toast', 'Grain Bowl', 'Roasted Vegetables'],
  'Asian':           ['Dumplings', 'Noodles', 'Rice Bowl', 'Fried Rice'],
  'Asian Fusion':    ['Dumplings', 'Rice Bowl', 'Bao', 'Noodles'],
  'Sandwiches':      ['Sandwich', 'Sub', 'Grinder', 'Panini'],
  'Italian Sandwich':['Italian Sub', 'Meatball Sub', 'Chicken Parm Sub', 'Sandwich'],
  'Deli':            ['Pastrami', 'Reuben', 'Bagel', 'Matzo Ball Soup', 'Sandwich'],
  'Taiwanese':       ['Beef Noodle Soup', 'Xiao Long Bao', 'Bao', 'Bubble Tea', 'Scallion Pancake'],
  'Filipino':        ['Adobo', 'Sisig', 'Lumpia', 'Pancit', 'Halo Halo'],
  'Caribbean':       ['Jerk Chicken', 'Oxtail', 'Curry Goat', 'Rice and Peas', 'Plantains'],
  'Cuban':           ['Cuban Sandwich', 'Ropa Vieja', 'Mojo Pork', 'Black Beans and Rice', 'Plantains'],
  'Cantonese':       ['Dim Sum', 'Roast Duck', 'Char Siu', 'Wonton', 'Congee'],
  'Barbecue':        ['Brisket', 'Ribs', 'Pulled Pork', 'Burnt Ends', 'Mac and Cheese', 'Coleslaw'],
  'Wine Bar':        ['Cheese Board', 'Charcuterie', 'Burrata'],
  'Brunch':          ['Eggs Benedict', 'Pancakes', 'French Toast', 'Avocado Toast', 'Omelette'],
  'Bagels':          ['Bagel', 'Lox', 'Cream Cheese'],
  'Pub':             ['Burger', 'Fish and Chips', 'Wings', 'Shepherd\'s Pie'],
  'Gastropub':       ['Burger', 'Fish and Chips', 'Wings'],
  'Latin American':  ['Tacos', 'Ceviche', 'Empanadas', 'Arepa'],
  'Peruvian':        ['Ceviche', 'Lomo Saltado', 'Aji de Gallina', 'Anticuchos'],
  'Southern':        ['Fried Chicken', 'Biscuits', 'Shrimp and Grits', 'Mac and Cheese', 'Cornbread'],
  'Soul Food':       ['Fried Chicken', 'Mac and Cheese', 'Cornbread', 'Collard Greens'],
  'Lebanese':        ['Hummus', 'Falafel', 'Shawarma', 'Kibbeh', 'Tabbouleh'],
  'Turkish':         ['Kebab', 'Pide', 'Baklava', 'Meze'],
  'Persian':         ['Kebab', 'Saffron Rice', 'Tahdig', 'Ghormeh Sabzi'],
  'Ethiopian':       ['Injera', 'Tibs', 'Doro Wat', 'Kitfo'],
  'German':          ['Schnitzel', 'Bratwurst', 'Pretzel', 'Sauerkraut'],
  'Eastern European':['Pierogi', 'Goulash', 'Borscht', 'Schnitzel'],
  'Russian':         ['Pelmeni', 'Borscht', 'Beef Stroganoff', 'Caviar', 'Blini'],
  'Polish':          ['Pierogi', 'Kielbasa', 'Golabki'],
  'Ukrainian':       ['Varenyky', 'Borscht', 'Holubtsi'],
  // Remaining long-tail cuisines
  'Desserts':        ['Cake', 'Ice Cream', 'Pastry', 'Cookies'],
  'Ice Cream':       ['Ice Cream', 'Sundae', 'Scoop', 'Soft Serve'],
  'Israeli':         ['Hummus', 'Falafel', 'Shakshuka', 'Sabich', 'Pita'],
  'Pakistani':       ['Biryani', 'Nihari', 'Kebab', 'Karahi', 'Naan'],
  'Lao':             ['Laap', 'Sticky Rice', 'Papaya Salad', 'Sai Oua'],
  'Portuguese':      ['Bacalhau', 'Piri Piri Chicken', 'Pastel de Nata', 'Francesinha'],
  'Puerto Rican':    ['Mofongo', 'Arroz con Gandules', 'Pernil', 'Tostones'],
  'African':         ['Jollof Rice', 'Suya', 'Egusi', 'Plantains'],
  'Sri Lankan':      ['Kottu', 'Hoppers', 'Curry', 'String Hoppers'],
  'Argentinian':     ['Asado', 'Empanadas', 'Chimichurri', 'Provoleta'],
  'Australian':      ['Meat Pie', 'Lamington', 'Avocado Toast', 'Flat White'],
  'Egyptian':        ['Koshari', 'Ful Medames', 'Molokhia', 'Mahshi'],
  'Jewish':          ['Matzo Ball Soup', 'Pastrami', 'Bagel', 'Latkes'],
  'Malaysian':       ['Nasi Lemak', 'Roti Canai', 'Laksa', 'Char Kway Teow'],
  'Moroccan':        ['Tagine', 'Couscous', 'Harira', 'Bastilla'],
}

function synthesizeCuisineMenuItems(cuisine: string | null): PreparedItem[] {
  if (!cuisine) return []
  const sigs = CUISINE_SIGNATURES[cuisine]
  if (!sigs || sigs.length === 0) return []
  const items: PreparedItem[] = []
  for (const display of sigs) {
    const prep = prepareMenuItem(display)
    if (!prep.searchKeys.length) continue
    items.push({
      id: `synth:${cuisine}:${display}`,  // synthetic ID prefix so we never FK this
      raw: display,
      display: prep.display,
      searchKeys: prep.searchKeys,
      section: null,
      price_cents: null,
    })
  }
  return items
}

const RECENT_MS = 1000 * 60 * 60 * 24 * 30 * 18  // ~18 months
function recencyBoost(postedAt: number | null, now: number): number {
  if (!postedAt) return 1.0
  const age = now - postedAt
  if (age <= 0) return 1.1
  if (age < RECENT_MS) return 1.0 + 0.2 * (1 - age / RECENT_MS)
  return 1.0
}

function scoreRestaurantTier1(
  menuItems: PreparedItem[],
  dishes: DishRow[],
  videos: VideoRow[],
): DishScore[] {
  const now = Date.now()
  // Build evidence list from quotes + captions (each piece used once per item)
  const evidence: Evidence[] = []
  for (const d of dishes) {
    if (d.sample_quote && d.sample_quote.length > 10) {
      const src = (d.sample_quote_source || 'google') as Evidence['source']
      evidence.push({ text: d.sample_quote, source: src === 'google' || src === 'tiktok' || src === 'instagram' ? src : 'google', weight: 1.0, postedAt: null })
    }
  }
  for (const v of videos) {
    if (v.caption && v.caption.length > 10) {
      const likeBoost = Math.min(1.0, Math.log10((v.like_count ?? 0) + 10) / 3)
      evidence.push({
        text: v.caption,
        source: (v.platform === 'instagram' ? 'instagram' : 'tiktok') as Evidence['source'],
        weight: 0.8 + 0.4 * likeBoost,  // 0.8 - 1.2
        postedAt: v.posted_at ? new Date(v.posted_at).getTime() : null,
      })
    }
  }

  // Precompute normalized text + token stems for each evidence piece once
  const evPrep = evidence.map((e) => {
    const norm = normalize(e.text)
    const toks = norm.split(/\s+/).filter(Boolean).filter((t) => !STOP_WORDS.has(t)).map(stem)
    return { ...e, norm, toks }
  })

  const results: DishScore[] = []
  for (const item of menuItems) {
    let pos = 0, neg = 0, neu = 0
    let bestQuote: { text: string; source: Evidence['source']; quality: number } | null = null
    let srcHas = { google: false, tiktok: false, instagram: false }
    let rawScore = 0

    for (const e of evPrep) {
      const q = matchItemInText(item, e.norm, e.toks)
      if (q <= 0) continue
      const window = findMatchWindow(e.text, item.searchKeys[0] || item.display)
      const sent = windowSentiment(window)
      if (sent === 'positive') pos++
      else if (sent === 'negative') neg++
      else neu++
      srcHas[e.source === 'other' ? 'google' : e.source] = true
      const sentMult = sent === 'positive' ? 1.0 : sent === 'neutral' ? 0.3 : -0.5
      rawScore += q * e.weight * sentMult * recencyBoost(e.postedAt, now)

      const quality = q * (sent === 'positive' ? 1.2 : sent === 'neutral' ? 1.0 : 0.5)
      if (!bestQuote || quality > bestQuote.quality) {
        bestQuote = { text: e.text, source: e.source, quality }
      }
    }

    // Also check: does any existing highlighted_dishes row in this restaurant
    // have a dish_name that matches this menu item? If yes, add its aggregated
    // google/tiktok/instagram mention counts as extra evidence weight.
    let gm = 0, tm = 0, im = 0
    for (const d of dishes) {
      const dishNorm = normalize(d.dish_name)
      const dishToks = dishNorm.split(/\s+/).filter(Boolean).filter((t) => !STOP_WORDS.has(t)).map(stem)
      const q = matchItemInText(item, dishNorm, dishToks)
      if (q <= 0) continue
      gm += d.google_mentions || 0
      tm += d.tiktok_mentions || 0
      im += d.instagram_mentions || 0
      // Small rollup bonus proportional to mention_count
      rawScore += Math.min(1.5, Math.log10((d.mention_count || 1) + 1)) * q * 0.5
    }

    const totalMentions = pos + neu + neg + Math.floor((gm + tm + im) / 3)
    // Diversity bonus: appeared in google AND (tiktok OR instagram)
    const diverse = srcHas.google && (srcHas.tiktok || srcHas.instagram)
    const diversityBonus = diverse ? 0.5 : 0

    const score = rawScore + diversityBonus
    if (score <= 0 || (pos + neu) === 0) continue  // need at least one non-negative mention
    // Threshold: any positive/neutral mention qualifies. Garbage filters are
    // tight enough that single hits are trustworthy — maximises coverage.
    if (pos < 1 && neu < 1) continue
    // QA gate: apply the same cleanliness rules we use for tier-2 rollup to
    // tier-1 display names too. Catches too-long menu-description leftovers,
    // article/drink/numeric leads, and meta-word poisoning that slipped
    // through prepareMenuItem's cleanup.
    if (!isCleanableDishName(item.display)) continue

    results.push({
      menu_item_id: item.id,
      display_name: item.display,
      score: Number(score.toFixed(3)),
      positive_count: pos,
      negative_count: neg,
      neutral_count: neu,
      google_mentions: gm + (srcHas.google ? 1 : 0),
      tiktok_mentions: tm + (srcHas.tiktok ? 1 : 0),
      instagram_mentions: im + (srcHas.instagram ? 1 : 0),
      total_mentions: totalMentions,
      sample_quote: bestQuote?.text?.slice(0, 400) || null,
      sample_quote_source: bestQuote?.source || null,
      tier: 'menu_anchored',
      price_cents: item.price_cents,
    })
  }

  results.sort((a, b) => b.score - a.score)
  // De-dupe display names that collapse to the same thing (e.g. two variants
  // of "Fries" on the same menu) — keep the higher scoring one. Uses stemmed
  // token form so "sandwich" and "sandwiches" collapse to one entry.
  const seen = new Set<string>()
  const deduped: DishScore[] = []
  for (const r of results) {
    const key = dedupKey(r.display_name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push(r)
    if (deduped.length >= MAX_TOP) break
  }
  return deduped
}

// ---------------- Tier 2: rollup fallback ----------------
// Reject EXACT single-word match only (these words are fine as modifiers in
// multi-word dish names like "Lemon Tart" or "Charred Octopus", but standing
// alone they're adjectives, not dish names)
const STOP_SINGLE_WORD_DISH = new Set([
  'crispy','crunchy','juicy','tender','savory','spicy','mild','tangy','zesty',
  'buttery','creamy','flaky','moist','fluffy','chewy','crumbly','smooth',
  'hearty','charred','smoky','delicate','refreshing','filling','satisfying',
  'indulgent','decadent','simple','tasty','yummy',
  // Italian single words that only make sense in compounds ("cacio e pepe",
  // "aglio e olio") — reject as stand-alones
  'cacio','pepe','aglio','olio','ragu','ragù',
  // Generic nouns that leaked as single-word "dishes"
  'part','parts','piece','pieces','choice','choices','spread','side','sides',
  'option','options','selection','item','items','combo','combos','patio',
  'version','versions','messy','fine','okay','decent','average',
  // Restaurant-ops words that are not dishes
  'ala','carte','prix','fixe','chef','chefs','chef\'s','sommelier',
  // Bare prepositions/adverbs that leaked as "dish" names from review text
  'through','throughout','during','before','after','while','since','until',
  'about','around','against','across','behind','beside','between',
  'inside','outside','below','above','among','across','toward','towards',
  'beyond','within','without','underneath','over','under','along',
])
const STOP_DISH_NAMES = new Set([
  'back','the','a','in','out','up','very','too','more','just','boring','bad',
  'blessed','busy','warm','hot','cold','fresh','great','good','nice','new',
  'best','favorite','perfect','amazing','experience','place','spot','joint',
  'restaurant','menu','food','service','order','drink','meal','try','time',
  'better','worse','much','many','every','another','several','few','lots',
  'quite','kinda','sorta','somewhat','rather','anyway','anything','everything',
  'something','nothing','really','truly','actually','definitely','maybe',
])
// Evaluative/comparative adjectives — rejects "Even Better", "Way Worse",
// "Much Better", "So Good", etc.
const EVALUATIVE_PREFIX = /^(even|way|much|so|really|quite|pretty|rather|truly|kinda|sorta|somewhat|far|totally|absolutely|extremely)\s+/i
// Words that, if present ANYWHERE in the phrase, indicate this is a sentence
// fragment, a review meta-statement, or otherwise not a dish. Stronger than
// STOP_DISH_NAMES because these poison multi-word phrases too.
const STRONG_STOP_WORD = new Set([
  'service','order','orders','ordering','ordered','menu','meal','meals','staff',
  'waiter','waitress','manager','host','hostess','customer','experience','visit',
  'visits','time','times','place','places','spot','spots','restaurant','joint',
  'dining','dinner','lunch','brunch','breakfast','reservation','reservations',
  'bill','tip','price','prices','wait','waiting','done','opportunity','chance',
  'moment','people','person','anyone','everyone','someone','boring','bad',
  'complained','complaining','complaint','complaints','said','says','saying',
  'told','telling','review','reviews','reviewed','reviewing','rating','ratings',
  // Sensory/quality attributes — when used as dish names they're review meta,
  // not actual dishes: "Flavors and Texture", "Great Taste", "Small Portion"
  'flavor','flavors','flavour','flavours','texture','textures','taste','tastes',
  'portion','portions','size','sizes','amount','amounts','quality','quantity',
  'presentation','smell','aroma','appearance','temperature','temp',
  // Review-meta nouns that leaked in multi-word phrases
  'hype','level','levels','version','versions','category','categories',
  'style','styles','type','types','kind','kinds',
  // Restaurant-ops terms — "Ala Carte Or Prix-fixe" etc.
  'ala','carte','prix','fixe','fixed','tasting','omakase-only',
  // Descriptors that poison multi-word phrases — "Little Messy", "Pretty Bland"
  'messy','bland','mediocre','meh','subpar','overpriced','underwhelming',
  // Review-meta containers — "Tasting Menu", "Set Menu", "Lot Of Dish",
  // "Dish For Sure", "Different Dishes To Share"
  'dish','dishes','menu','menus','lot','lots','bunch','bunches','number',
  'numbers','variety','varieties','set','sets','course','courses','cours',
  // Menu directives — "Choose Chicken Or Beef", "Pick Two", "Select One"
  'choose','pick','select','selects','selected','choosing','picking',
  // Review-fragment fillers — "Other Thing", "Irate About", "Best Thing"
  'thing','things','stuff','about','regarding','concerning','nothing',
  // Emotional review words — "Irate About Pickles", "Angry Waitress"
  'irate','angry','upset','annoyed','disgusted','furious','frustrated',
  // Generic menu/drink plurals used as category headers
  'cocktails','drinks','beverages','wines','beers','spirits','liqueurs',
  // Generic nouns used as review filler — "Option", "Treat", "Combo"
  'option','options','treat','treats','combo','combos','special','specials',
  // Non-dish modifiers that flag category headers
  'other','others','another','different','non','every','each',
])
// Spirit/wine brand names that sneak into menu data as "whiskey flight"
// items — reject when any of these appears as a word in the display name.
const SPIRIT_BRAND = new Set([
  'glenlivet','glenfiddich','macallan','lagavulin','laphroaig','ardbeg',
  'talisker','oban','balvenie','highland','bowmore','dalmore','yamazaki',
  'hibiki','hakushu','nikka','suntory','bulleit','woodford','maker\u2019s',
  'makers','jameson','jack','daniels','buffalo','trace','pappy','rittenhouse',
  'knob','creek','four','roses','wild','turkey','angel\u2019s','envy',
  'hennessy','courvoisier','remy','martell','dom','perignon','krug',
  'patron','clase','azul','casamigos','herradura','fortaleza',
  // Bourbon/rye brands
  'taylor','e.h.','eh','willett','weller','stagg','elijah','craig','blanton',
  // Additional cognac / vodka / gin brands
  'grey','goose','belvedere','absolut','tito','ciroc','bombay','tanqueray',
  'hendricks','beefeater','plymouth','sapphire',
])
// Dish names should be NOUN phrases. These trigram/bigram patterns indicate
// we've grabbed a fragment of a sentence rather than a dish.
const NOT_A_DISH = /\b(you|your|our|my|their|we|they|it|had|have|was|were|is|are|did|do|will|would|could|should|any|some|no|if|when|while|because|why|how|what|which|where|who|whom|of\s+us|for\s+us|to\s+us|back|done|opportunity|chance|visit|time|moment|people|person|complained|complaining|said|says|saying|told|and\s+(food|service|meal|drink|order)|(food|service|meal|drink|order)\s+and)\b/i
// Dish sanity: a dish has to contain at least one content token that plausibly
// refers to food/drink. Too permissive matters less than letting through
// "If You Have The Opportunity" — so: at least one token of length >=4 that
// isn't a stopword and isn't a pronoun/auxiliary.
// Generic category nouns that point to a "catalog reference" rather than a dish.
// "Sandwiches and Hot Dishes", "Coffee and Drinks", "Desserts and Treats" — reject.
const CATEGORY_NOUN = new Set([
  'dishes','dish','items','item','options','option','selections','selection',
  'stuff','things','picks','varieties','choices','specialties','specialty',
  'plates','plate','entrees','mains','sides','desserts','starters','appetizers',
  'sandwiches','drinks','beverages','snacks','treats',
])
function isCleanableDishName(name: string): boolean {
  const s = name.trim().toLowerCase()
  if (!s || s.length < 3) return false
  // Reject anything not starting with a letter (covers "(half Btl)",
  // "*Pate Maison", "+ Chicken", "'shawarma' Wagyu", and numeric leads
  // like "48 Mini Toasts" / "727 N Broadway" / "1/2 Brisket")
  if (!/^[a-z]/.test(s)) return false
  // Reject leading articles and possessives — "The quick delicious lunch...",
  // "His Attention", "Her Attention", "Our House Specialty SHRIMP",
  // "A Simple Salad", "My Favorite Burger". Dish names don't start with these.
  const LEADING_ARTICLE = new Set(['the','a','an','his','her','my','our','your','their','its'])
  const firstWord = s.split(/\s+/)[0]
  if (LEADING_ARTICLE.has(firstWord)) return false
  // Reject drink names (Cocktail, Martini, Espresso, etc.) — these slip
  // through the rollup tier from restaurant_highlighted_dishes.dish_name.
  if (DRINK_DISH_NAME.test(s)) return false
  // Reject if any word is a spirit brand (whiskey/cognac flights etc.)
  {
    const ws = s.split(/\s+/)
    for (const w of ws) {
      if (SPIRIT_BRAND.has(w.replace(/['\u2019]s?$/, ''))) return false
    }
  }
  if (STOP_DISH_NAMES.has(s)) return false
  if (STOP_SINGLE_WORD_DISH.has(s)) return false  // "Crispy" alone is never a dish
  if (/\bi['\u2019]ve\b|\bwe['\u2019]ve\b/.test(s)) return false
  const words = s.split(/\s+/)
  if (words.length > 4) return false  // dish names are almost always 1-4 words
  // Reject if ANY word is a strong stop (poisons multi-word phrases too)
  for (const w of words) {
    if (STRONG_STOP_WORD.has(w)) return false
  }
  // Reject any word individually matching STOP_DISH_NAMES for multi-word phrases.
  // (Single-word case is handled above via STOP_DISH_NAMES.has(s).)
  if (words.length > 1) {
    for (const w of words) {
      if (STOP_DISH_NAMES.has(w)) return false
    }
  }
  // Reject obvious sentence fragments
  if (NOT_A_DISH.test(s)) return false
  // Reject evaluative adverb-led phrases: "Even Better", "So Good"
  if (EVALUATIVE_PREFIX.test(s)) return false
  // Reject truncated words (dish names shouldn't end in bare "-e" where a
  // cleanup chopped a plural — e.g. "Dishe", "Sandwiche", "Pancake" is fine,
  // but "Dishe" is a truncation artifact from our cleanup).
  const TRUNCATED = /\b(dishe|sandwiche|potatoe|tomatoe)\b/
  if (TRUNCATED.test(s)) return false
  // Reject "X and Y" if Y is a catalog/category noun
  if (words.includes('and') || words.includes('&')) {
    for (const w of words) {
      if (CATEGORY_NOUN.has(w)) return false
    }
    // Also reject if "and" is the 2nd word and the phrase is 3+ words
    // ("Sandwiches And X") — usually a menu section header, not a dish.
    if ((words[1] === 'and' || words[1] === '&') && words.length >= 3) {
      const left = words[0], right = words[2]
      if (CATEGORY_NOUN.has(left) || CATEGORY_NOUN.has(right)) return false
    }
  }
  // Require at least one content word (non-stopword, >=3 chars)
  const content = words.filter(w => !STOP_WORDS.has(w) && w.length >= 3)
  if (content.length === 0) return false
  // Last guard: reject if any word is a generic adjective only ("Free Meal Back")
  const onlyAdjective = /^(free|nice|good|big|small|large|fresh|hot|cold|warm|best|special|excellent|great|awesome|incredible|delicious|tasty|new)\s+\w+$/i
  if (onlyAdjective.test(s) && words.length === 2) return false
  // Reject trailing fragments: dish names don't end in prepositions/conjunctions/articles
  const lastWord = words[words.length - 1]
  if (STOP_WORDS.has(lastWord) || ['and','or','but','with','on','in','at','for','to','of','the','a','an'].includes(lastWord)) return false
  // Reject leading conjunctions
  if (['and','or','but','because','so'].includes(words[0])) return false
  // Reject any leading preposition — dish names do not start with
  // "For/Of/With/From/To/At/On/In/Out/Going" ("For Thin Crust", "Of Oyster",
  // "With Seafood", "Going Without One", "From Farmhouse").
  const LEADING_PREPOSITION = new Set([
    'for','of','with','from','to','at','on','in','out','by','into','onto',
    'upon','going','having','being','getting',
  ])
  if (LEADING_PREPOSITION.has(words[0])) return false
  // Reject trailing-apostrophe truncations ("Bonnie'", "She'", "Truluck'",
  // "Comeback That'") — these are upstream tokenization artifacts where a
  // possessive was clipped mid-word.
  if (/['\u2019]$/.test(s)) return false
  // Reject phrases containing pronoun contractions that indicate a sentence
  // fragment was captured ("Mushroom He's", "Desserts I'd", "Coffee Drinks He's",
  // "Comeback That'").
  if (/\b(he|she|it|we|they|i|you|that|there|here)['\u2019](s|d|re|ll|ve|m)\b/.test(s)) return false
  // Reject any single-letter "word" which almost always means a tokenization
  // artifact leaked in (e.g. "Bonnie' s" → "Bonnie S" after normalization)
  if (words.some(w => w.length === 1 && !/^\d$/.test(w))) return false
  return true
}
// Canonical dedup key — stems each word so "sandwich" and "sandwiches" collide.
function dedupKey(name: string): string {
  return contentTokens(name).join(' ')
}
function titleCase(s: string): string {
  if (!s) return s
  if (s === s.toLowerCase() || s === s.toUpperCase()) {
    return s.toLowerCase().split(/(\s+)/).map((w) =>
      /^[a-z]/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w
    ).join('')
  }
  return s
}

// Italian/foreign compound dishes that upstream tokenization tends to split
// on "e"/"y"/"con" — if both halves appear in the same restaurant, merge them
// back into the canonical compound name.
const COMPOUND_MERGES: Array<{ parts: string[]; canonical: string }> = [
  { parts: ['cacio', 'pepe'], canonical: 'Cacio e Pepe' },
  { parts: ['aglio', 'olio'], canonical: 'Aglio e Olio' },
  { parts: ['arroz', 'pollo'], canonical: 'Arroz con Pollo' },
  { parts: ['pasta', 'pomodoro'], canonical: 'Pasta al Pomodoro' },
  { parts: ['pollo', 'parmesan'], canonical: 'Pollo Parmesan' },
]

function mergeCompoundRows(dishes: DishRow[]): DishRow[] {
  const out: DishRow[] = [...dishes]
  for (const { parts, canonical } of COMPOUND_MERGES) {
    const matches = parts.map(p =>
      out.find(d => d.dish_name.trim().toLowerCase() === p)
    )
    if (matches.every(Boolean)) {
      const ms = matches as DishRow[]
      const merged: DishRow = {
        dish_name: canonical,
        mention_count: Math.max(...ms.map(m => m.mention_count || 0)),
        google_mentions: Math.max(...ms.map(m => m.google_mentions || 0)),
        tiktok_mentions: Math.max(...ms.map(m => m.tiktok_mentions || 0)),
        instagram_mentions: Math.max(...ms.map(m => m.instagram_mentions || 0)),
        sample_quote: ms.find(m => m.sample_quote)?.sample_quote || null,
        sample_quote_source: ms.find(m => m.sample_quote_source)?.sample_quote_source || null,
        restaurant_id: ms[0].restaurant_id,
      }
      for (const m of ms) {
        const idx = out.indexOf(m)
        if (idx >= 0) out.splice(idx, 1)
      }
      out.push(merged)
    }
  }
  return out
}

function scoreRestaurantTier2(dishes: DishRow[]): DishScore[] {
  // Merge known compound splits back together before scoring
  dishes = mergeCompoundRows(dishes)
  // Score by: mention counts × sample_quote sentiment (if quote present).
  const results: DishScore[] = []
  for (const d of dishes) {
    if (!isCleanableDishName(d.dish_name)) continue
    let sent: 'positive' | 'negative' | 'neutral' = 'neutral'
    if (d.sample_quote) {
      sent = windowSentiment(findMatchWindow(d.sample_quote, d.dish_name))
    }
    const g = d.google_mentions || 0
    const t = d.tiktok_mentions || 0
    const i = d.instagram_mentions || 0
    const n = Math.max(1, g + t + i, d.mention_count || 1)
    const sentMult = sent === 'positive' ? 1.0 : sent === 'neutral' ? 0.4 : -0.5
    const diverse = (g > 0 && (t > 0 || i > 0)) ? 0.4 : 0
    const score = Math.log10(n + 1) * 2 * sentMult + diverse
    if (score <= 0) continue
    results.push({
      menu_item_id: null,
      display_name: titleCase(d.dish_name),
      score: Number(score.toFixed(3)),
      positive_count: sent === 'positive' ? 1 : 0,
      negative_count: sent === 'negative' ? 1 : 0,
      neutral_count: sent === 'neutral' ? 1 : 0,
      google_mentions: g,
      tiktok_mentions: t,
      instagram_mentions: i,
      total_mentions: n,
      sample_quote: d.sample_quote?.slice(0, 400) || null,
      sample_quote_source: d.sample_quote_source || null,
      tier: 'rollup_fallback',
      price_cents: null,
    })
  }
  results.sort((a, b) => b.score - a.score)
  const seen = new Set<string>()
  const out: DishScore[] = []
  for (const r of results) {
    const key = dedupKey(r.display_name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(r)
    if (out.length >= MAX_TOP) break
  }
  return out
}

// ---------------- Main ----------------
async function main() {
  console.log(`[topDishes] mode=${WRITE ? 'WRITE' : 'DRY-RUN'} topN=${MAX_TOP} sample=${SAMPLE || 'all'}`)
  console.log('[topDishes] loading data...')

  const menu = await loadAll<MenuItemRow>(
    'restaurant_menu_items',
    'id,restaurant_id,item_name,section,price_cents'
  )
  const dishes = await loadAll<DishRow>(
    'restaurant_highlighted_dishes',
    'restaurant_id,dish_name,sample_quote,sample_quote_source,google_mentions,tiktok_mentions,instagram_mentions,mention_count'
  )
  const videos = await loadAll<VideoRow>(
    'restaurant_videos',
    'restaurant_id,caption,platform,like_count,view_count,posted_at'
  )
  console.log(`[topDishes] loaded: ${menu.length} menu items, ${dishes.length} dish rollups, ${videos.length} videos`)

  // Group per restaurant
  const menuByRest = new Map<string, PreparedItem[]>()
  let droppedItems = 0
  for (const m of menu) {
    if (isJunkItem(m.item_name)) { droppedItems++; continue }
    if (isDrinkLikeItem(m.item_name, m.section)) { droppedItems++; continue }
    const prep = prepareMenuItem(m.item_name)
    if (!prep.searchKeys.length) { droppedItems++; continue }
    let arr = menuByRest.get(m.restaurant_id)
    if (!arr) { arr = []; menuByRest.set(m.restaurant_id, arr) }
    arr.push({ id: m.id, raw: m.item_name, display: prep.display, searchKeys: prep.searchKeys, section: m.section, price_cents: m.price_cents })
  }
  console.log(`[topDishes] filtered menu: ${menu.length - droppedItems} food items across ${menuByRest.size} restaurants (dropped ${droppedItems} junk/drinks)`)

  const dishesByRest = new Map<string, DishRow[]>()
  for (const d of dishes) {
    let arr = dishesByRest.get(d.restaurant_id)
    if (!arr) { arr = []; dishesByRest.set(d.restaurant_id, arr) }
    arr.push(d)
  }

  const videosByRest = new Map<string, VideoRow[]>()
  for (const v of videos) {
    let arr = videosByRest.get(v.restaurant_id)
    if (!arr) { arr = []; videosByRest.set(v.restaurant_id, arr) }
    arr.push(v)
  }

  // Load all restaurants with cuisine so we can synthesize cuisine-signature menu items
  // for tier-1 anchoring even when the actual menu is missing or junk.
  const allRest = await loadAll<{ id: string; name: string; cuisine: string | null }>(
    'restaurants',
    'id,name,cuisine',
  )
  console.log(`[topDishes] ${allRest.length} restaurants total`)

  const stats = { tier1: 0, tier2: 0, hybrid: 0, none: 0, totalRows: 0, totalDishes: 0 }
  const allRows: (DishScore & { restaurant_id: string; restaurant_name: string; rank: number })[] = []
  const sampleRestaurants: { name: string; rows: DishScore[] }[] = []

  let cuisineSynthCount = 0
  for (const r of allRest) {
    const realMi = menuByRest.get(r.id) || []
    const synthMi = synthesizeCuisineMenuItems(r.cuisine)
    if (synthMi.length) cuisineSynthCount++
    // Real menu items go first so they outrank synthetic ones in dedup/super-set collapse
    const mi = [...realMi, ...synthMi]
    const dr = dishesByRest.get(r.id) || []
    const vr = videosByRest.get(r.id) || []

    // Tier 1: menu-anchored (specific dishes from the restaurant's actual menu
    // OR from the cuisine's signature list, so "pizza" at a pizzeria anchors).
    let t1: DishScore[] = []
    if (mi.length > 0 && (dr.length > 0 || vr.length > 0)) {
      t1 = scoreRestaurantTier1(mi, dr, vr)
    }
    // Tier 2: rollup fallback (generic dish names from review aggregates)
    const t2 = scoreRestaurantTier2(dr)

    // Merge: tier-1 dishes first (more specific), then tier-2 to fill remaining
    // slots. Dedup by stemmed name so we don't show "Burger" next to "Smash Burger".
    const seen = new Set<string>()
    const merged: DishScore[] = []
    const addIfNew = (d: DishScore) => {
      const k = dedupKey(d.display_name)
      if (!k) return
      // Also reject if a tier-2 "Burger" would follow tier-1 "Smash Burger"
      // (any seen key is a superset of this one, or vice versa).
      for (const s of seen) {
        if (s === k) return
        if (s.includes(k) || k.includes(s)) return
      }
      seen.add(k)
      merged.push(d)
    }
    for (const d of t1) addIfNew(d)
    for (const d of t2) {
      if (merged.length >= MAX_TOP) break
      addIfNew(d)
    }
    const top = merged.slice(0, MAX_TOP)

    // Require at least 1 dish backed by real evidence
    if (top.length < 1) { stats.none++; continue }

    const hasT1 = top.some(d => d.tier === 'menu_anchored')
    const hasT2 = top.some(d => d.tier === 'rollup_fallback')
    if (hasT1 && hasT2) stats.hybrid++
    else if (hasT1) stats.tier1++
    else stats.tier2++
    stats.totalDishes += top.length
    top.forEach((row, idx) => {
      allRows.push({ ...row, restaurant_id: r.id, restaurant_name: r.name, rank: idx + 1 })
    })
    if (SAMPLE && sampleRestaurants.length < 20) {
      sampleRestaurants.push({ name: r.name, rows: top })
    }
  }
  stats.totalRows = allRows.length

  const covered = stats.tier1 + stats.tier2 + stats.hybrid
  console.log('---')
  console.log(`[topDishes] results:`)
  console.log(`  tier1 only (menu-anchored):   ${stats.tier1} restaurants`)
  console.log(`  tier2 only (rollup fallback): ${stats.tier2} restaurants`)
  console.log(`  hybrid (t1 + t2 mixed):       ${stats.hybrid} restaurants`)
  console.log(`  no top dishes:                ${stats.none} restaurants`)
  console.log(`  total dish rows:              ${stats.totalRows} (avg ${(stats.totalDishes / Math.max(1, covered)).toFixed(1)} per covered restaurant)`)
  console.log(`  coverage: ${((covered / allRest.length) * 100).toFixed(1)}% of restaurants have Top Dishes`)

  if (VERBOSE || SAMPLE > 0) {
    console.log('---')
    console.log(`[topDishes] sample:`)
    for (const s of sampleRestaurants.slice(0, SAMPLE || 10)) {
      console.log(`\n  ${s.name} (${s.rows[0]?.tier}):`)
      for (const r of s.rows.slice(0, 6)) {
        console.log(`    ${r.score.toFixed(2)} | ${r.display_name}  [+${r.positive_count} =${r.neutral_count} -${r.negative_count}] ${r.sample_quote ? '\n      "' + r.sample_quote.slice(0, 120).replace(/\n/g, ' ') + '"' : ''}`)
      }
    }
  }

  if (!WRITE) {
    console.log('\n[topDishes] dry-run. re-run with --write to persist.')
    return
  }

  // Scoped delete + bulk insert. Never TRUNCATE the whole table: chip-only
  // restaurants that aren't part of this run have no other mention source and
  // would be permanently dropped. Only clear the restaurants we recomputed.
  const touchedIds = [...new Set(allRows.map((r) => r.restaurant_id))]
  console.log(`[topDishes] clearing ${touchedIds.length} recomputed restaurants...`)
  const DEL_BATCH = 200
  for (let i = 0; i < touchedIds.length; i += DEL_BATCH) {
    const idChunk = touchedIds.slice(i, i + DEL_BATCH)
    const { error: delErr } = await sb.from('restaurant_top_dishes').delete().in('restaurant_id', idChunk)
    if (delErr) { console.error('delete err', delErr.message); process.exit(1) }
  }

  const nowIso = new Date().toISOString()
  const insertRows = allRows.map((r) => ({
    restaurant_id: r.restaurant_id,
    // Synthetic menu items (cuisine-signature) use a "synth:" sentinel id that
    // isn't a real FK — null it out before persisting.
    menu_item_id: r.menu_item_id && r.menu_item_id.startsWith('synth:') ? null : r.menu_item_id,
    display_name: r.display_name.slice(0, 160),
    rank: r.rank,
    score: r.score,
    positive_count: r.positive_count,
    negative_count: r.negative_count,
    neutral_count: r.neutral_count,
    google_mentions: r.google_mentions,
    tiktok_mentions: r.tiktok_mentions,
    instagram_mentions: r.instagram_mentions,
    total_mentions: r.total_mentions,
    sample_quote: r.sample_quote,
    sample_quote_source: r.sample_quote_source,
    tier: r.tier,
    price_cents: r.price_cents,
    computed_at: nowIso,
  }))
  console.log(`[topDishes] inserting ${insertRows.length} rows...`)
  const BATCH = 500
  let wrote = 0
  for (let i = 0; i < insertRows.length; i += BATCH) {
    const chunk = insertRows.slice(i, i + BATCH)
    const { error } = await sb.from('restaurant_top_dishes').insert(chunk)
    if (error) {
      console.error(`  insert err [${i}]:`, error.message)
    } else {
      wrote += chunk.length
    }
    if (i % (BATCH * 5) === 0) console.log(`  ...${Math.min(i + BATCH, insertRows.length)}/${insertRows.length}`)
  }
  console.log(`[topDishes] wrote ${wrote}/${insertRows.length} rows`)
}

main().catch((e) => { console.error(e); process.exit(1) })
