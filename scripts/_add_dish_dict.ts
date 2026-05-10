import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.join(process.cwd(), '.env.local')
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}
// Iconic NYC / general dishes missing from existing dict.
// "phrase" is what appears in reviews; "canonical" groups variants.
const ADDITIONS: Array<[string, string, number]> = [
  // Jewish deli
  ['pastrami', 'pastrami', 0.9],
  ['pastrami sandwich', 'pastrami', 0.95],
  ['pastrami on rye', 'pastrami', 0.95],
  ['reuben', 'reuben', 0.95],
  ['reuben sandwich', 'reuben', 0.95],
  ['corned beef', 'corned beef', 0.9],
  ['corned beef sandwich', 'corned beef', 0.95],
  ['matzo ball', 'matzo ball soup', 0.95],
  ['matzo ball soup', 'matzo ball soup', 0.95],
  ['matzah ball', 'matzo ball soup', 0.9],
  ['latke', 'latkes', 0.9],
  ['latkes', 'latkes', 0.9],
  ['knish', 'knish', 0.9],
  ['knishes', 'knish', 0.9],
  ['black and white cookie', 'black and white cookie', 0.95],
  ['black-and-white cookie', 'black and white cookie', 0.95],
  ['egg cream', 'egg cream', 0.85],
  ['whitefish', 'whitefish', 0.85],
  ['whitefish salad', 'whitefish', 0.9],
  ['nova lox', 'lox', 0.9],
  ['smoked salmon', 'smoked salmon', 0.9],
  ['sable', 'sable', 0.8],
  // Steakhouse
  ['mutton chop', 'mutton chop', 0.95],
  ['porterhouse', 'porterhouse', 0.95],
  ['porterhouse steak', 'porterhouse', 0.95],
  ['dry aged steak', 'dry aged steak', 0.9],
  ['dry-aged ribeye', 'dry aged ribeye', 0.95],
  ['filet mignon', 'filet mignon', 0.95],
  ['bone marrow', 'bone marrow', 0.9],
  ['tomahawk', 'tomahawk', 0.95],
  ['tomahawk steak', 'tomahawk', 0.95],
  ['steak au poivre', 'steak au poivre', 0.95],
  ['steak tartare', 'steak tartare', 0.95],
  ['short rib', 'short rib', 0.9],
  ['short ribs', 'short rib', 0.9],
  ['braised short rib', 'short rib', 0.95],
  ['wedge salad', 'wedge salad', 0.95],
  ['creamed corn', 'creamed corn', 0.9],
  ['hash browns', 'hash browns', 0.9],
  ['onion rings', 'onion rings', 0.9],
  // Italian
  ['cacio e pepe', 'cacio e pepe', 0.95],
  ['spicy rigatoni', 'spicy rigatoni', 0.95],
  ['rigatoni vodka', 'spicy rigatoni', 0.95],
  ['lasagna', 'lasagna', 0.9],
  ['cannoli', 'cannoli', 0.9],
  ['tiramisu', 'tiramisu', 0.9],
  ['eggplant parm', 'eggplant parmesan', 0.9],
  ['eggplant parmesan', 'eggplant parmesan', 0.9],
  ['chicken parm', 'chicken parmesan', 0.9],
  ['chicken parmesan', 'chicken parmesan', 0.9],
  ['veal parm', 'veal parmesan', 0.9],
  ['gnocchi', 'gnocchi', 0.9],
  ['ravioli', 'ravioli', 0.9],
  ['lobster ravioli', 'lobster ravioli', 0.95],
  ['branzino', 'branzino', 0.9],
  ['osso buco', 'osso buco', 0.95],
  ['prosciutto', 'prosciutto', 0.85],
  ['burrata', 'burrata', 0.9],
  ['arancini', 'arancini', 0.9],
  // Japanese / Sushi
  ['omakase', 'omakase', 0.95],
  ['nigiri', 'nigiri', 0.9],
  ['sashimi', 'sashimi', 0.9],
  ['sushi roll', 'sushi roll', 0.9],
  ['tonkotsu', 'tonkotsu ramen', 0.9],
  ['tonkotsu ramen', 'tonkotsu ramen', 0.95],
  ['miso ramen', 'miso ramen', 0.95],
  ['shoyu ramen', 'shoyu ramen', 0.95],
  ['tsukemen', 'tsukemen', 0.9],
  ['chashu', 'chashu', 0.85],
  ['uni pasta', 'uni pasta', 0.95],
  ['hamachi', 'hamachi', 0.85],
  ['otoro', 'otoro', 0.9],
  ['chutoro', 'otoro', 0.85],
  // Chinese
  ['xiao long bao', 'xiao long bao', 0.95],
  ['soup dumplings', 'soup dumplings', 0.95],
  ['soup dumpling', 'soup dumplings', 0.95],
  ['peking duck', 'peking duck', 0.95],
  ['kung pao', 'kung pao chicken', 0.9],
  ['mapo tofu', 'mapo tofu', 0.95],
  ['dan dan', 'dan dan noodles', 0.9],
  ['dan dan noodles', 'dan dan noodles', 0.95],
  ['char siu', 'char siu', 0.9],
  ['har gow', 'har gow', 0.95],
  ['shu mai', 'shu mai', 0.9],
  ['siu mai', 'shu mai', 0.9],
  ['dim sum', 'dim sum', 0.9],
  ['hand pulled noodles', 'hand pulled noodles', 0.95],
  ['hand ripped noodles', 'hand pulled noodles', 0.95],
  ['biang biang', 'biang biang noodles', 0.95],
  ['biang biang noodles', 'biang biang noodles', 0.95],
  ['cumin lamb', 'cumin lamb', 0.95],
  ['lamb noodles', 'cumin lamb', 0.9],
  ['scallion pancake', 'scallion pancake', 0.9],
  ['lamb skewers', 'lamb skewers', 0.9],
  // Thai / SE Asian
  ['drunken noodle', 'drunken noodles', 0.95],
  ['drunken noodles', 'drunken noodles', 0.95],
  ['khao soi', 'khao soi', 0.95],
  ['pho ga', 'pho', 0.9],
  ['pho tai', 'pho', 0.9],
  ['banh xeo', 'banh xeo', 0.95],
  ['tom kha', 'tom kha', 0.9],
  ['tom kha gai', 'tom kha', 0.9],
  ['larb', 'larb', 0.9],
  ['khao man gai', 'khao man gai', 0.95],
  ['green papaya salad', 'papaya salad', 0.95],
  ['papaya salad', 'papaya salad', 0.95],
  // Korean
  ['kbbq', 'kbbq', 0.9],
  ['korean bbq', 'korean bbq', 0.9],
  ['galbi', 'galbi', 0.9],
  ['bulgogi', 'bulgogi', 0.9],
  ['kalbi', 'galbi', 0.9],
  ['kimchi stew', 'kimchi stew', 0.9],
  ['soondubu', 'soondubu', 0.9],
  ['bibim guksu', 'bibim guksu', 0.9],
  ['korean fried chicken', 'korean fried chicken', 0.95],
  ['kfc', 'korean fried chicken', 0.7],
  // Indian
  ['butter chicken', 'butter chicken', 0.95],
  ['tikka masala', 'tikka masala', 0.95],
  ['chicken tikka', 'chicken tikka', 0.9],
  ['chicken 65', 'chicken 65', 0.95],
  ['saag paneer', 'saag paneer', 0.95],
  ['palak paneer', 'palak paneer', 0.95],
  ['dosa', 'dosa', 0.9],
  ['masala dosa', 'masala dosa', 0.95],
  ['samosa', 'samosa', 0.9],
  ['samosas', 'samosa', 0.9],
  ['vindaloo', 'vindaloo', 0.9],
  ['korma', 'korma', 0.9],
  ['goat biryani', 'goat biryani', 0.95],
  ['lamb biryani', 'lamb biryani', 0.95],
  ['tandoori chicken', 'tandoori chicken', 0.9],
  // Mexican / Latin
  ['al pastor', 'al pastor', 0.95],
  ['carne asada', 'carne asada', 0.9],
  ['carnitas', 'carnitas', 0.9],
  ['barbacoa', 'barbacoa', 0.9],
  ['lengua', 'lengua', 0.85],
  ['tortas', 'torta', 0.9],
  ['chiles rellenos', 'chiles rellenos', 0.95],
  ['elote', 'elote', 0.9],
  ['esquites', 'esquites', 0.9],
  ['mole', 'mole', 0.85],
  ['mole poblano', 'mole', 0.95],
  ['ceviche', 'ceviche', 0.9],
  ['ropa vieja', 'ropa vieja', 0.95],
  ['cubano', 'cubano', 0.9],
  ['medianoche', 'medianoche', 0.9],
  // Middle Eastern
  ['shawarma', 'shawarma', 0.9],
  ['chicken shawarma', 'chicken shawarma', 0.95],
  ['beef shawarma', 'beef shawarma', 0.95],
  ['gyros', 'gyro', 0.9],
  ['manakeesh', 'manakeesh', 0.9],
  ['kibbeh', 'kibbeh', 0.9],
  ['tabbouleh', 'tabbouleh', 0.9],
  ['fattoush', 'fattoush', 0.9],
  ['sujuk', 'sujuk', 0.85],
  // Mediterranean
  ['spanakopita', 'spanakopita', 0.95],
  ['moussaka', 'moussaka', 0.9],
  ['dolmades', 'dolmades', 0.9],
  ['gyro', 'gyro', 0.9],
  // American classics
  ['fried chicken sandwich', 'fried chicken sandwich', 0.95],
  ['chicken sandwich', 'chicken sandwich', 0.9],
  ['nashville hot chicken', 'nashville hot chicken', 0.95],
  ['smash burger', 'smash burger', 0.95],
  ['smashburger', 'smash burger', 0.95],
  ['double cheeseburger', 'double cheeseburger', 0.95],
  ['lobster roll', 'lobster roll', 0.95],
  ['crab cake', 'crab cake', 0.95],
  ['crab cakes', 'crab cake', 0.95],
  ['clam chowder', 'clam chowder', 0.95],
  ['oyster rockefeller', 'oyster rockefeller', 0.95],
  ['bloody mary', 'bloody mary', 0.8],
  ['dirty martini', 'dirty martini', 0.85],
  // Pizza
  ['margherita', 'margherita', 0.9],
  ['margherita pizza', 'margherita', 0.95],
  ['pepperoni pizza', 'pepperoni pizza', 0.95],
  ['white pizza', 'white pizza', 0.9],
  ['detroit style', 'detroit pizza', 0.9],
  ['detroit pizza', 'detroit pizza', 0.95],
  ['square pizza', 'square pizza', 0.9],
  ['vodka pizza', 'vodka pizza', 0.95],
  ['upside down pizza', 'upside down pizza', 0.95],
  ['grandma slice', 'grandma slice', 0.95],
  ['grandma pie', 'grandma slice', 0.95],
  // Brunch
  ['avocado toast', 'avocado toast', 0.95],
  ['eggs benedict', 'eggs benedict', 0.95],
  ['breakfast sandwich', 'breakfast sandwich', 0.9],
  ['chicken and waffles', 'chicken and waffles', 0.95],
  ['dutch baby', 'dutch baby', 0.95],
  ['ricotta pancakes', 'ricotta pancakes', 0.95],
  ['french toast', 'french toast', 0.9],
]
async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const rows = ADDITIONS.map(([phrase, canonical, confidence]) => ({ phrase, canonical, confidence }))
  // Upsert (phrase is unique ideally; if not, conflict on phrase)
  const { error } = await s.from('dish_dict').upsert(rows, { onConflict: 'phrase' })
  if (error) {
    console.error('upsert error:', error.message)
    // Fall back to insert + ignore duplicates manually
    let ok = 0, dup = 0
    for (const r of rows) {
      const { error: e } = await s.from('dish_dict').insert(r)
      if (e) { dup += 1 } else { ok += 1 }
    }
    console.log(`inserted=${ok} skipped=${dup}`)
  } else {
    console.log(`upserted ${rows.length} rows`)
  }
  const { count } = await s.from('dish_dict').select('phrase', { count: 'exact', head: true })
  console.log('total dict rows now:', count)
}
main()
