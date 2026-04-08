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
          google_rating: number | null
          google_review_count: number | null
          yelp_rating: number | null
          yelp_review_count: number | null
          beli_score: number | null
          google_url: string | null
          yelp_url: string | null
          beli_url: string | null
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
          google_rating?: number | null
          google_review_count?: number | null
          yelp_rating?: number | null
          yelp_review_count?: number | null
          beli_score?: number | null
          google_url?: string | null
          yelp_url?: string | null
          beli_url?: string | null
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
          google_rating?: number | null
          google_review_count?: number | null
          yelp_rating?: number | null
          yelp_review_count?: number | null
          beli_score?: number | null
          google_url?: string | null
          yelp_url?: string | null
          beli_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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

// Helper types for easier usage
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Restaurant = Database['public']['Tables']['restaurants']['Row']
export type Review = Database['public']['Tables']['reviews']['Row']
export type ReviewPhoto = Database['public']['Tables']['review_photos']['Row']
export type Follow = Database['public']['Tables']['follows']['Row']
