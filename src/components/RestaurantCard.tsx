import Link from 'next/link'
import StarRating from './StarRating'
import SourceRatingsBar from './SourceRatingsBar'
import AccoladesBadges from './AccoladesBadges'
import { Restaurant } from '@/types/database'
import { MapPin } from 'lucide-react'

interface RestaurantCardProps {
    restaurant: Restaurant
}

export default function RestaurantCard({ restaurant }: RestaurantCardProps) {
    const priceDisplay = '$'.repeat(restaurant.price_range)
    const avgRating = restaurant.avg_rating || 0
    const displayRating = restaurant.google_rating || avgRating
    const hasAccolades = (restaurant.michelin_stars && restaurant.michelin_stars > 0) || restaurant.james_beard_nominated || restaurant.eater_38

  return (
        <Link href={`/restaurants/${restaurant.id}`}>
                <div className="rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 border border-gray-100 overflow-hidden bg-white cursor-pointer group">
                        <div className="p-4 sm:p-5 space-y-3">
                          {/* Restaurant Name + Accolades */}
                                  <div>
                                              <div className="flex items-start justify-between gap-2">
                                                            <h3 className="font-semibold text-gray-900 text-lg line-clamp-2 group-hover:text-emerald-600 transition-colors">
                                                              {restaurant.name}
                                                            </h3>h3>
                                                {hasAccolades && (
                          <div className="shrink-0">
                                            <AccoladesBadges
                                                                  accolades={restaurant.accolades}
                                                                  michelinStars={restaurant.michelin_stars}
                                                                  michelinDesignation={restaurant.michelin_designation}
                                                                  compact
                                                                />
                          </div>div>
                                                            )}
                                              </div>div>
                                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                                                              {restaurant.cuisine}
                                                            </span>span>
                                                            <span className="flex items-center gap-1 text-sm text-gray-500">
                                                                            <MapPin size={14} />
                                                              {restaurant.city}
                                                            </span>span>
                                              </div>div>
                                  </div>div>
                        
                          {/* Source Ratings Bar */}
                                  <div className="px-0">
                                              <SourceRatingsBar restaurant={restaurant} />
                                  </div>div>
                        
                          {/* Rating and Price */}
                                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                              <div className="flex items-center gap-2">
                                                            <StarRating rating={Math.round(displayRating)} size={16} readonly />
                                                            <span className="text-sm font-semibold text-gray-900">
                                                              {displayRating > 0 ? displayRating.toFixed(1) : 'N/A'}
                                                            </span>span>
                                                            <span className="text-xs text-gray-500">
                                                                            ({restaurant.review_count})
                                                            </span>span>
                                              </div>div>
                                              <span className="text-sm font-bold text-emerald-600 font-mono">
                                                {priceDisplay}
                                              </span>span>
                                  </div>div>
                        </div>div>
                </div>div>
        </Link>Link>
      )
}</div>
