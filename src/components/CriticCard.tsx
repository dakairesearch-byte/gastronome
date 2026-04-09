import Link from 'next/link'
import { Profile } from '@/types/database'

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
    <Link href={`/profile/${profile.id}`}>
      <div className="bg-white rounded-lg border border-gray-100 p-4 transition-all duration-150 hover:shadow-md group">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name}
              className="w-11 h-11 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-semibold text-gray-400">
                {profile.display_name[0]?.toUpperCase()}
              </span>
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm group-hover:text-amber-600 transition-colors truncate">
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
      </div>
    </Link>
  )
}
