import { createServerSupabaseClient } from '@/lib/supabase/server'
import CityCard from '@/components/CityCard'
import { MapPin } from 'lucide-react'

export const revalidate = 60

export default async function CitiesPage() {
  const supabase = await createServerSupabaseClient()

  const { data: cities } = await supabase
    .from('cities')
    .select('*')
    .eq('is_active', true)
    .gt('restaurant_count', 0)
    .order('name')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-center gap-2 mb-8">
          <MapPin size={24} className="text-emerald-600" />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">All Cities</h1>
        </div>

        {(cities && cities.length > 0) ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {cities.map((city) => (
              <CityCard key={city.id} city={city} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <MapPin size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Cities coming soon — we're adding restaurants every day.</p>
          </div>
        )}
      </div>
    </div>
  )
}
