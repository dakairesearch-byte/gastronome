import Link from 'next/link'
import { MapPin } from 'lucide-react'
import type { City } from '@/types/database'

interface CityCardProps {
  city: City
}

export default function CityCard({ city }: CityCardProps) {
  return (
    <Link href={`/cities/${city.slug}`}>
      <div className="group relative h-56 rounded-2xl overflow-hidden shadow-md hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer">
        {/* Background */}
        {city.photo_url ? (
          <img
            src={city.photo_url}
            alt={`${city.name}, ${city.state}`}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600" />
        )}

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10 group-hover:from-black/80 transition-colors duration-300" />

        {/* Content overlay */}
        <div className="absolute inset-0 flex flex-col justify-end p-5">
          <h3 className="text-white text-xl font-bold tracking-tight">
            {city.name}
          </h3>
          <p className="text-white/80 text-sm font-medium mt-0.5">
            {city.state}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-emerald-300 text-sm">
            <MapPin size={14} />
            <span>
              {city.restaurant_count} {city.restaurant_count === 1 ? 'restaurant' : 'restaurants'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
