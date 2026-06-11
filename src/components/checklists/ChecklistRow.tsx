'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MapPin } from 'lucide-react'
import BeenButton from './BeenButton'
import type { ChecklistRestaurant } from '@/lib/checklists'

interface ChecklistRowProps {
  restaurant: ChecklistRestaurant
  initialTried: boolean
}

export default function ChecklistRow({
  restaurant,
  initialTried,
}: ChecklistRowProps) {
  const [tried, setTried] = useState(initialTried)

  const where = [restaurant.neighborhood, restaurant.city]
    .filter(Boolean)
    .join(', ')

  return (
    <div
      className="flex items-center gap-3 py-3.5"
      style={{ borderBottom: '1px solid var(--color-border)' }}
    >
      {/* Check button — 44px touch target */}
      <BeenButton
        restaurantId={restaurant.id}
        initialTried={tried}
        onToggle={setTried}
      />

      {/* Restaurant info */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/restaurants/${restaurant.id}`}
          className="group"
        >
          <p
            className="text-sm font-medium leading-snug group-hover:underline truncate"
            style={{
              fontFamily: 'var(--font-body)',
              color: tried ? 'var(--color-text-secondary)' : 'var(--color-text)',
              textDecoration: tried ? 'line-through' : 'none',
              textDecorationColor: 'var(--color-text-secondary)',
            }}
          >
            {restaurant.name}
          </p>
          {(restaurant.cuisine || where) && (
            <p
              className="flex items-center gap-1 mt-0.5 text-xs truncate"
              style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)' }}
            >
              {restaurant.cuisine && <span>{restaurant.cuisine}</span>}
              {restaurant.cuisine && where && (
                <span aria-hidden="true" className="opacity-40">·</span>
              )}
              {where && (
                <span className="flex items-center gap-0.5">
                  <MapPin size={10} strokeWidth={1.5} aria-hidden="true" />
                  {where}
                </span>
              )}
            </p>
          )}
        </Link>
      </div>

      {/* Google rating */}
      {typeof restaurant.google_rating === 'number' && (
        <span
          className="flex-shrink-0 text-xs tabular-nums"
          style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)' }}
          aria-label={`Google rating ${restaurant.google_rating}`}
        >
          {restaurant.google_rating.toFixed(1)}★
        </span>
      )}
    </div>
  )
}
