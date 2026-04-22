/**
 * Seed script for Gastronome restaurant data.
 *
 * Usage:
 *   npx tsx src/scripts/seed-restaurants.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const SEED_RESTAURANTS = [
  // Miami
  { name: "Joe's Stone Crab", city: 'Miami', cuisine: 'Seafood', price_range: 4, neighborhood: 'South Beach' },
  { name: 'Boia De', city: 'Miami', cuisine: 'Italian', price_range: 3, neighborhood: 'Upper Buena Vista' },
  { name: 'KYU', city: 'Miami', cuisine: 'Asian Fusion', price_range: 3, neighborhood: 'Wynwood' },
  { name: 'Carbone', city: 'Miami', cuisine: 'Italian', price_range: 4, neighborhood: 'South Beach' },
  { name: 'Mandolin Aegean Bistro', city: 'Miami', cuisine: 'Mediterranean', price_range: 3, neighborhood: 'Design District' },
  { name: 'Cvi.che 105', city: 'Miami', cuisine: 'Peruvian', price_range: 2, neighborhood: 'Downtown' },
  { name: 'Motek', city: 'Miami', cuisine: 'Mediterranean', price_range: 2, neighborhood: 'Brickell' },
  { name: 'The Surf Club Restaurant', city: 'Miami', cuisine: 'French', price_range: 4, neighborhood: 'Surfside' },
  { name: 'Zuma', city: 'Miami', cuisine: 'Japanese', price_range: 4, neighborhood: 'Downtown' },
  { name: 'Los Fuegos by Francis Mallmann', city: 'Miami', cuisine: 'Argentine', price_range: 4, neighborhood: 'Bal Harbour' },

  // New York
  { name: 'Peter Luger Steak House', city: 'New York', cuisine: 'Steakhouse', price_range: 4, neighborhood: 'Williamsburg' },
  { name: "L'Artusi", city: 'New York', cuisine: 'Italian', price_range: 3, neighborhood: 'West Village' },
  { name: "Le Bernardin", city: 'New York', cuisine: 'French', price_range: 4, neighborhood: 'Midtown' },
  { name: "Joe's Pizza", city: 'New York', cuisine: 'Pizza', price_range: 1, neighborhood: 'Greenwich Village' },
  { name: 'Eleven Madison Park', city: 'New York', cuisine: 'American', price_range: 4, neighborhood: 'Flatiron' },
  { name: 'Via Carota', city: 'New York', cuisine: 'Italian', price_range: 3, neighborhood: 'West Village' },
  { name: 'Dhamaka', city: 'New York', cuisine: 'Indian', price_range: 2, neighborhood: 'Lower East Side' },
  { name: "Di Fara Pizza", city: 'New York', cuisine: 'Pizza', price_range: 2, neighborhood: 'Midwood' },
  { name: 'Atomix', city: 'New York', cuisine: 'Korean', price_range: 4, neighborhood: 'NoMad' },
  { name: 'Don Angie', city: 'New York', cuisine: 'Italian', price_range: 3, neighborhood: 'West Village' },

  // Los Angeles
  { name: 'Bestia', city: 'Los Angeles', cuisine: 'Italian', price_range: 3, neighborhood: 'Arts District' },
  { name: "Howlin' Ray's", city: 'Los Angeles', cuisine: 'Southern', price_range: 2, neighborhood: 'Chinatown' },
  { name: 'Republique', city: 'Los Angeles', cuisine: 'French', price_range: 3, neighborhood: 'La Brea' },
  { name: 'Gjelina', city: 'Los Angeles', cuisine: 'American', price_range: 3, neighborhood: 'Venice' },
  { name: 'Sushi Ginza Onodera', city: 'Los Angeles', cuisine: 'Japanese', price_range: 4, neighborhood: 'West Hollywood' },
  { name: 'Guerrilla Tacos', city: 'Los Angeles', cuisine: 'Mexican', price_range: 2, neighborhood: 'Arts District' },
  { name: 'Providence', city: 'Los Angeles', cuisine: 'Seafood', price_range: 4, neighborhood: 'Hollywood' },
  { name: 'Bavel', city: 'Los Angeles', cuisine: 'Middle Eastern', price_range: 3, neighborhood: 'Arts District' },
  { name: 'Jitlada', city: 'Los Angeles', cuisine: 'Thai', price_range: 2, neighborhood: 'Thai Town' },
  { name: 'Camphor', city: 'Los Angeles', cuisine: 'French', price_range: 4, neighborhood: 'Arts District' },

  // Chicago
  { name: 'Alinea', city: 'Chicago', cuisine: 'American', price_range: 4, neighborhood: 'Lincoln Park' },
  { name: "Portillo's", city: 'Chicago', cuisine: 'American', price_range: 1, neighborhood: 'River North' },
  { name: 'Girl & The Goat', city: 'Chicago', cuisine: 'American', price_range: 3, neighborhood: 'West Loop' },
  { name: 'Smyth', city: 'Chicago', cuisine: 'American', price_range: 4, neighborhood: 'West Loop' },
  { name: 'Au Cheval', city: 'Chicago', cuisine: 'American', price_range: 2, neighborhood: 'West Loop' },

  // San Francisco
  { name: 'State Bird Provisions', city: 'San Francisco', cuisine: 'American', price_range: 3, neighborhood: 'Western Addition' },
  { name: 'La Taqueria', city: 'San Francisco', cuisine: 'Mexican', price_range: 1, neighborhood: 'Mission' },
  { name: 'Benu', city: 'San Francisco', cuisine: 'Asian Fusion', price_range: 4, neighborhood: 'SoMa' },
  { name: 'Tartine Bakery', city: 'San Francisco', cuisine: 'Bakery', price_range: 2, neighborhood: 'Mission' },
  { name: 'Lazy Bear', city: 'San Francisco', cuisine: 'American', price_range: 4, neighborhood: 'Mission' },
]

async function seed() {
  console.log(`Seeding ${SEED_RESTAURANTS.length} restaurants...`)

  for (const restaurant of SEED_RESTAURANTS) {
    const { error } = await supabase
      .from('restaurants')
      .upsert(
        {
          name: restaurant.name,
          city: restaurant.city,
          cuisine: restaurant.cuisine,
          price_range: restaurant.price_range,
          neighborhood: restaurant.neighborhood,
          is_featured: true,
        },
        { onConflict: 'name' }
      )
      .select()
      .single()

    if (error) {
      // Try insert without upsert if no unique constraint on name
      const { error: insertError } = await supabase
        .from('restaurants')
        .insert({
          name: restaurant.name,
          city: restaurant.city,
          cuisine: restaurant.cuisine,
          price_range: restaurant.price_range,
          neighborhood: restaurant.neighborhood,
          is_featured: true,
        })

      if (insertError) {
        console.error(`  Error seeding ${restaurant.name}:`, insertError.message)
      } else {
        console.log(`  + ${restaurant.name} (${restaurant.city})`)
      }
    } else {
      console.log(`  + ${restaurant.name} (${restaurant.city})`)
    }
  }

  console.log('Done!')
}

seed().catch(console.error)
