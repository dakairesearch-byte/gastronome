export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          username: string
          display_name: string
          bio: string | null
          avatar_url: string | null
          is_critic: boolean
          creative_mode_enabled: boolean
          home_city: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          username: string
          display_name: string
          bio?: string | null
          avatar_url?: string | null
          is_critic?: boolean
          creative_mode_enabled?: boolean
          home_city?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          username?: string
          display_name?: string
          bio?: string | null
          avatar_url?: string | null
          is_critic?: boolean
          creative_mode_enabled?: boolean
          home_city?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          id: string
          name: string
          cuisine: string
          city: string
          address: string | null
          phone: string | null
          website: string | null
          price_range: number
          avg_rating: number | null
          review_count: number
          google_place_id: string | null
          google_rating: number | null
          google_review_count: number | null
          google_url: string | null
          google_photo_url: string | null
          yelp_id: string | null
          yelp_rating: number | null
          yelp_review_count: number | null
          yelp_url: string | null
          yelp_photo_url: string | null
          infatuation_rating: number | null
          infatuation_url: string | null
          infatuation_review_snippet: string | null
          latitude: number | null
          longitude: number | null
          photo_url: string | null
          neighborhood: string | null
          description: string | null
          is_featured: boolean
          michelin_stars: number
          michelin_designation: string | null
          michelin_url: string | null
          james_beard_nominated: boolean
          james_beard_winner: boolean
          eater_38: boolean
          accolades: Json
          last_fetched_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          cuisine: string
          city: string
          address?: string | null
          phone?: string | null
          website?: string | null
          price_range: number
          avg_rating?: number | null
          review_count?: number
          google_place_id?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          google_url?: string | null
          google_photo_url?: string | null
          yelp_id?: string | null
          yelp_rating?: number | null
          yelp_review_count?: number | null
          yelp_url?: string | null
          yelp_photo_url?: string | null
          infatuation_rating?: number | null
          infatuation_url?: string | null
          infatuation_review_snippet?: string | null
          latitude?: number | null
          longitude?: number | null
          photo_url?: string | null
          neighborhood?: string | null
          description?: string | null
          is_featured?: boolean
          michelin_stars?: number
          michelin_designation?: string | null
          michelin_url?: string | null
          james_beard_nominated?: boolean
          james_beard_winner?: boolean
          eater_38?: boolean
          accolades?: Json
          last_fetched_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          cuisine?: string
          city?: string
          address?: string | null
          phone?: string | null
          website?: string | null
          price_range?: number
          avg_rating?: number | null
          review_count?: number
          google_place_id?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          google_url?: string | null
          google_photo_url?: string | null
          yelp_id?: string | null
          yelp_rating?: number | null
          yelp_review_count?: number | null
          yelp_url?: string | null
          yelp_photo_url?: string | null
          infatuation_rating?: number | null
          infatuation_url?: string | null
          infatuation_review_snippet?: string | null
          latitude?: number | null
          longitude?: number | null
          photo_url?: string | null
          neighborhood?: string | null
          description?: string | null
          is_featured?: boolean
          michelin_stars?: number
          michelin_designation?: string | null
          michelin_url?: string | null
          james_beard_nominated?: boolean
          james_beard_winner?: boolean
          eater_38?: boolean
          accolades?: Json
          last_fetched_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_videos: {
        Row: {
          id: string
          restaurant_id: string
          platform: string
          video_id: string
          video_url: string
          embed_url: string | null
          thumbnail_url: string | null
          caption: string | null
          author_username: string | null
          author_display_name: string | null
          like_count: number
          view_count: number
          comment_count: number
          posted_at: string | null
          fetched_at: string
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          platform: string
          video_id: string
          video_url: string
          embed_url?: string | null
          thumbnail_url?: string | null
          caption?: string | null
          author_username?: string | null
          author_display_name?: string | null
          like_count?: number
          view_count?: number
          comment_count?: number
          posted_at?: string | null
          fetched_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          platform?: string
          video_id?: string
          video_url?: string
          embed_url?: string | null
          thumbnail_url?: string | null
          caption?: string | null
          author_username?: string | null
          author_display_name?: string | null
          like_count?: number
          view_count?: number
          comment_count?: number
          posted_at?: string | null
          fetched_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_videos_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          }
        ]
      }
      cities: {
        Row: {
          id: string
          name: string
          state: string
          slug: string
          photo_url: string | null
          restaurant_count: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          state: string
          slug: string
          photo_url?: string | null
          restaurant_count?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          state?: string
          slug?: string
          photo_url?: string | null
          restaurant_count?: number
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      fetch_logs: {
        Row: {
          id: string
          restaurant_id: string | null
          source: string
          status: string
          error_message: string | null
          metadata: Json
          started_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          restaurant_id?: string | null
          source: string
          status: string
          error_message?: string | null
          metadata?: Json
          started_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          restaurant_id?: string | null
          source?: string
          status?: string
          error_message?: string | null
          metadata?: Json
          started_at?: string
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fetch_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          }
        ]
      }
      reviews: {
        Row: {
          id: string
          restaurant_id: string
          author_id: string
          rating: number
          title: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          author_id: string
          rating: number
          title: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          author_id?: string
          rating?: number
          title?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          }
        ]
      }
      review_photos: {
        Row: {
          id: string
          review_id: string
          photo_url: string
          created_at: string
        }
        Insert: {
          id?: string
          review_id: string
          photo_url: string
          created_at?: string
        }
        Update: {
          id?: string
          review_id?: string
          photo_url?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_photos_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          }
        ]
      }
      restaurant_rating_snapshots: {
        Row: {
          id: string
          restaurant_id: string
          google_rating: number | null
          google_review_count: number | null
          yelp_rating: number | null
          yelp_review_count: number | null
          infatuation_rating: number | null
          snapshot_date: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          google_rating?: number | null
          google_review_count?: number | null
          yelp_rating?: number | null
          yelp_review_count?: number | null
          infatuation_rating?: number | null
          snapshot_date?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          google_rating?: number | null
          google_review_count?: number | null
          yelp_rating?: number | null
          yelp_review_count?: number | null
          infatuation_rating?: number | null
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_rating_snapshots_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          }
        ]
      }
      follows: {
        Row: {
          id: string
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: {
          id?: string
          follower_id: string
          following_id: string
          created_at?: string
        }
        Update: {
          id?: string
          follower_id?: string
          following_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Restaurant = Database['public']['Tables']['restaurants']['Row']
export type Review = Database['public']['Tables']['reviews']['Row']
export type ReviewPhoto = Database['public']['Tables']['review_photos']['Row']
export type Follow = Database['public']['Tables']['follows']['Row']
export type RestaurantVideo = Database['public']['Tables']['restaurant_videos']['Row']
export type City = Database['public']['Tables']['cities']['Row']
export type FetchLog = Database['public']['Tables']['fetch_logs']['Row']

// Aggregator-specific types
export type Accolade = {
  type: 'michelin' | 'james_beard' | 'eater_38' | 'worlds_50_best' | 'bon_appetit' | 'nyt_critic_pick' | 'custom'
  label: string
  year?: number
  url?: string
  icon?: string
}

export type SourceRating = {
  source: 'google' | 'yelp' | 'infatuation'
  rating: number | null
  reviewCount?: number
  url: string | null
  maxRating: number
  color: string
  label: string
  icon: string
}
