import Link from 'next/link'
import { Profile } from '@/types/database'
import { ArrowRight } from 'lucide-react'

interface CriticCardProps {
  profile: Profile
  reviewCount: number
  followerCount: number
  isFeatured?: boolean
}

export default function CriticCard({
  profile,
  reviewCount,
  followerCount,
}: CriticCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 transition-all duration-200 hover:shadow-md group">
      <Link href={`/profile/${profile.id}`}>
        <div className="flex items-center gap-3">
          {/* Avatar */}
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name}
              className="w-11 h-11 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-semibold text-emerald-600">
                {profile.display_name[0]?.toUpperCase()}
              </span>
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm group-hover:text-emerald-600 transition-colors truncate">
              {profile.display_name}
            </h3>
            <p className="text-xs text-gray-400 truncate">@{profile.username}</p>
            {profile.bio && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{profile.bio}</p>
            )}
          </div>

          {/* Stats */}
          <div className="flex gap-4 flex-shrink-0">
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900">{reviewCount}</p>
              <p className="text-[10px] text-gray-400">reviews</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900">{followerCount}</p>
              <p className="text-[10px] text-gray-400">followers</p>
            </div>
          </div>
        </div>
      </Link>

      {/* View Profile CTA */}
      <div className="pt-3 mt-3 border-t border-gray-100">
        <Link
          href={`/profile/${profile.id}`}
          className="w-full py-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors text-center flex items-center justify-center gap-1"
        >
          View Profile
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}
