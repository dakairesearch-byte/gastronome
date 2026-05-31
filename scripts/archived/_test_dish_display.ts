// Smoke test for the dish-display helpers. Hits every ambiguous case
// I could think of from the real data. Disposable — delete after.
import { titleCaseDish, dedupePluralDishes } from '../src/lib/dishes/display'

const cases: Array<[string, string]> = [
  // Basic lowercase → Title Case
  ['pastrami', 'Pastrami'],
  ['spicy rigatoni', 'Spicy Rigatoni'],
  ['soup dumplings', 'Soup Dumplings'],
  ['fried chicken', 'Fried Chicken'],
  // Small connector words stay lowercase in middle
  ['steak au poivre', 'Steak au Poivre'],
  ['cacio e pepe', 'Cacio e Pepe'],
  ['pollo a la brasa', 'Pollo a la Brasa'],
  ['chicken and waffles', 'Chicken and Waffles'],
  ['fish and chips', 'Fish and Chips'],
  ['surf and turf', 'Surf and Turf'],
  // First word always capped even if small
  ['the farmer\u2019s plate', 'The Farmer\u2019s Plate'],
  ['a bowl of pho', 'A Bowl of Pho'],
  // Acronyms preserved
  ['bbq ribs', 'BBQ Ribs'],
  ['BBQ brisket', 'BBQ Brisket'],
  ['nyc slice', 'NYC Slice'],
  // Hyphenated
  ['wood-fired pizza', 'Wood-Fired Pizza'],
  ['fresh-baked bread', 'Fresh-Baked Bread'],
  // Apostrophes
  ["joe's special", "Joe's Special"],
  ['l\u2019escargot', 'L\u2019Escargot'],
  // Already Title Case — no change
  ['Spanish Fried Chicken', 'Spanish Fried Chicken'],
  ['The Farmer\u2019s Plate', 'The Farmer\u2019s Plate'],
  // Mixed / weird
  ['OMAKASE', 'OMAKASE'],  // already all caps, preserved
  ['a.o.c.', 'a.o.c.'],  // kept as lowercase (no letters-not-in-dots only — we accept this)
  ['crispy garlic shrimp', 'Crispy Garlic Shrimp'],
]

let failed = 0
for (const [input, expected] of cases) {
  const actual = titleCaseDish(input)
  const ok = actual === expected
  if (!ok) failed += 1
  const mark = ok ? 'OK ' : 'XX '
  console.log(`${mark} "${input}" \u2192 "${actual}"${ok ? '' : ` (expected "${expected}")`}`)
}

console.log('\n--- dedupePluralDishes ---')
const items = [
  { name: 'Pizza', count: 10 },
  { name: 'Pizzas', count: 3 },
  { name: 'Caesar Salad', count: 8 },
  { name: 'Pasta', count: 6 },
  { name: 'Sandwich', count: 4 },
  { name: 'Sandwiches', count: 5 },  // higher count wins
]
const out = dedupePluralDishes(items)
console.log(JSON.stringify(out, null, 2))
// Expected: Pizza (10>3), Caesar Salad, Pasta, Sandwiches (5>4)

console.log(`\n${failed === 0 ? 'PASS' : `FAIL — ${failed} cases`}`)
process.exit(failed === 0 ? 0 : 1)
