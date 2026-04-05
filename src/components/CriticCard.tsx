import Link from 'next/link'
import { Profile, Review } from '@/types/database'
import { Users, PenTool } from 'lucide-react'

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
  isFeatured = false,
}: CriticCardProps) {
  return (
    <Link href={`/profile/${profile.id}`}>
      <div
        className={`rounded-lg border transition-all cursor-pointer group ${
          isFeatured
            ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 shadow-md hover:shadow-lg'
            : 'bg-white border-gray-200 shadow-sm hover:shadow-md hover:border-amber-200'
        }`}
      >
        <div className="p-6 text-center">
          {/* Avatar */}
          {profile.avatar_url && (
            <img
              src={profile.avatar_url}
              alt={profile.display_name}
              className="w-16 h-16 rounded-full mx-auto mb-4 object-cover border-4 border-white shadow-sm group-hover:shadow-md transition-shadow"
            />
          )}

          {/* Name */}
          <h3 className="font-semibold text-gray-900 text-lg mb-1 group-hover:text-amber-600 transition-colors">
            {profile.display_name}
          </h3>

          {/* Username */}
          <p className="text-sm text-gray-600 mb-4">@{profile.username}</p>

          {/* Bio */}
          {profile.bio && (
            <p className="text-sm text-gray-600 mb-4 line-clamp-2 h-10">
              {profile.bio}
            </p>
          )}

          {/* Stats */}
          <div className="flex justify-around py-4 border-t border-gray-100">
            <div className="text-center">
              <p className="text-xl font-bold text-gray-900">
                {reviewCount}
              </p>
              <p className="text-xs text-gray-600 flex items-center justify-center gap-1 mt-1">
                <PenTool size={12} />
                Reviews
              </p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-gray-900">
                {followerCount}
              </p>
              <p className="text-xs text-gray-600 flex items-center justify-center gap-1 mt-1">
                <Users size={12} />
                Followers
              </p>
            </div>
          </div>

          {/* Badge for critics */}
          {profile.is_critic && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <span className="inline-block px-3 py-1 bg-amber-500 text-white text-xs font-semibold rounded-full">
                Featured Critic
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
