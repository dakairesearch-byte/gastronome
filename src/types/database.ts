export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      _chips_garbage_backup_20260601: {
        Row: {
          google_count: number | null
          id: string | null
          instagram_mentions: number | null
          keyword: string | null
          match_confidence: number | null
          match_method: string | null
          menu_item_id: string | null
          raw_keyword: string | null
          restaurant_id: string | null
          review_mentions: number | null
          sample_quote: string | null
          score: number | null
          scored_at: string | null
          scraped_at: string | null
          source_breakdown: Json | null
          tiktok_mentions: number | null
        }
        Insert: {
          google_count?: number | null
          id?: string | null
          instagram_mentions?: number | null
          keyword?: string | null
          match_confidence?: number | null
          match_method?: string | null
          menu_item_id?: string | null
          raw_keyword?: string | null
          restaurant_id?: string | null
          review_mentions?: number | null
          sample_quote?: string | null
          score?: number | null
          scored_at?: string | null
          scraped_at?: string | null
          source_breakdown?: Json | null
          tiktok_mentions?: number | null
        }
        Update: {
          google_count?: number | null
          id?: string | null
          instagram_mentions?: number | null
          keyword?: string | null
          match_confidence?: number | null
          match_method?: string | null
          menu_item_id?: string | null
          raw_keyword?: string | null
          restaurant_id?: string | null
          review_mentions?: number | null
          sample_quote?: string | null
          score?: number | null
          scored_at?: string | null
          scraped_at?: string | null
          source_breakdown?: Json | null
          tiktok_mentions?: number | null
        }
        Relationships: []
      }
      _dish_gap_targets: {
        Row: {
          id: string | null
          rn: number | null
        }
        Insert: {
          id?: string | null
          rn?: number | null
        }
        Update: {
          id?: string | null
          rn?: number | null
        }
        Relationships: []
      }
      _dish_junk_backup_20260601: {
        Row: {
          computed_at: string | null
          display_name: string | null
          google_mentions: number | null
          id: string | null
          instagram_mentions: number | null
          menu_item_id: string | null
          negative_count: number | null
          neutral_count: number | null
          positive_count: number | null
          price_cents: number | null
          rank: number | null
          restaurant_id: string | null
          sample_quote: string | null
          sample_quote_source: string | null
          score: number | null
          tier: string | null
          tiktok_mentions: number | null
          total_mentions: number | null
        }
        Insert: {
          computed_at?: string | null
          display_name?: string | null
          google_mentions?: number | null
          id?: string | null
          instagram_mentions?: number | null
          menu_item_id?: string | null
          negative_count?: number | null
          neutral_count?: number | null
          positive_count?: number | null
          price_cents?: number | null
          rank?: number | null
          restaurant_id?: string | null
          sample_quote?: string | null
          sample_quote_source?: string | null
          score?: number | null
          tier?: string | null
          tiktok_mentions?: number | null
          total_mentions?: number | null
        }
        Update: {
          computed_at?: string | null
          display_name?: string | null
          google_mentions?: number | null
          id?: string | null
          instagram_mentions?: number | null
          menu_item_id?: string | null
          negative_count?: number | null
          neutral_count?: number | null
          positive_count?: number | null
          price_cents?: number | null
          rank?: number | null
          restaurant_id?: string | null
          sample_quote?: string | null
          sample_quote_source?: string | null
          score?: number | null
          tier?: string | null
          tiktok_mentions?: number | null
          total_mentions?: number | null
        }
        Relationships: []
      }
      _dish_recurate_targets: {
        Row: {
          id: string | null
          rn: number | null
        }
        Insert: {
          id?: string | null
          rn?: number | null
        }
        Update: {
          id?: string | null
          rn?: number | null
        }
        Relationships: []
      }
      _menu_items_qa_backup_20260513: {
        Row: {
          backed_up_at: string | null
          backup_reason: string | null
          created_at: string | null
          description: string | null
          id: string | null
          item_name: string | null
          price_cents: number | null
          price_raw: string | null
          raw_snippet: string | null
          restaurant_id: string | null
          section: string | null
          source: string | null
          source_url: string | null
          updated_at: string | null
        }
        Insert: {
          backed_up_at?: string | null
          backup_reason?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          item_name?: string | null
          price_cents?: number | null
          price_raw?: string | null
          raw_snippet?: string | null
          restaurant_id?: string | null
          section?: string | null
          source?: string | null
          source_url?: string | null
          updated_at?: string | null
        }
        Update: {
          backed_up_at?: string | null
          backup_reason?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          item_name?: string | null
          price_cents?: number | null
          price_raw?: string | null
          raw_snippet?: string | null
          restaurant_id?: string | null
          section?: string | null
          source?: string | null
          source_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      _menu_items_snapshot_20260531: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          item_name: string | null
          price_cents: number | null
          price_raw: string | null
          raw_snippet: string | null
          restaurant_id: string | null
          section: string | null
          source: string | null
          source_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          item_name?: string | null
          price_cents?: number | null
          price_raw?: string | null
          raw_snippet?: string | null
          restaurant_id?: string | null
          section?: string | null
          source?: string | null
          source_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          item_name?: string | null
          price_cents?: number | null
          price_raw?: string | null
          raw_snippet?: string | null
          restaurant_id?: string | null
          section?: string | null
          source?: string | null
          source_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      _menu_junk_backup_20260601: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          item_name: string | null
          price_cents: number | null
          price_raw: string | null
          raw_snippet: string | null
          restaurant_id: string | null
          section: string | null
          source: string | null
          source_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          item_name?: string | null
          price_cents?: number | null
          price_raw?: string | null
          raw_snippet?: string | null
          restaurant_id?: string | null
          section?: string | null
          source?: string | null
          source_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          item_name?: string | null
          price_cents?: number | null
          price_raw?: string | null
          raw_snippet?: string | null
          restaurant_id?: string | null
          section?: string | null
          source?: string | null
          source_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      _menu_rescrape_targets: {
        Row: {
          id: string | null
          rn: number | null
        }
        Insert: {
          id?: string | null
          rn?: number | null
        }
        Update: {
          id?: string | null
          rn?: number | null
        }
        Relationships: []
      }
      _qa_reviews_backup_20260601: {
        Row: {
          author_name: string | null
          external_id: string | null
          fetched_at: string | null
          id: string | null
          published_at: string | null
          rating: number | null
          restaurant_id: string | null
          source: string | null
          text: string | null
        }
        Insert: {
          author_name?: string | null
          external_id?: string | null
          fetched_at?: string | null
          id?: string | null
          published_at?: string | null
          rating?: number | null
          restaurant_id?: string | null
          source?: string | null
          text?: string | null
        }
        Update: {
          author_name?: string | null
          external_id?: string | null
          fetched_at?: string | null
          id?: string | null
          published_at?: string | null
          rating?: number | null
          restaurant_id?: string | null
          source?: string | null
          text?: string | null
        }
        Relationships: []
      }
      _qa_videos_backup_20260601: {
        Row: {
          author_display_name: string | null
          author_username: string | null
          caption: string | null
          comment_count: number | null
          created_at: string | null
          dishes: string[] | null
          dishes_extracted_at: string | null
          embed_url: string | null
          fetched_at: string | null
          id: string | null
          like_count: number | null
          platform: string | null
          posted_at: string | null
          restaurant_id: string | null
          thumbnail_storage_path: string | null
          thumbnail_url: string | null
          video_id: string | null
          video_url: string | null
          view_count: number | null
        }
        Insert: {
          author_display_name?: string | null
          author_username?: string | null
          caption?: string | null
          comment_count?: number | null
          created_at?: string | null
          dishes?: string[] | null
          dishes_extracted_at?: string | null
          embed_url?: string | null
          fetched_at?: string | null
          id?: string | null
          like_count?: number | null
          platform?: string | null
          posted_at?: string | null
          restaurant_id?: string | null
          thumbnail_storage_path?: string | null
          thumbnail_url?: string | null
          video_id?: string | null
          video_url?: string | null
          view_count?: number | null
        }
        Update: {
          author_display_name?: string | null
          author_username?: string | null
          caption?: string | null
          comment_count?: number | null
          created_at?: string | null
          dishes?: string[] | null
          dishes_extracted_at?: string | null
          embed_url?: string | null
          fetched_at?: string | null
          id?: string | null
          like_count?: number | null
          platform?: string | null
          posted_at?: string | null
          restaurant_id?: string | null
          thumbnail_storage_path?: string | null
          thumbnail_url?: string | null
          video_id?: string | null
          video_url?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
      _remediation_backup_20260531_menu: {
        Row: {
          _reason: string | null
          created_at: string | null
          description: string | null
          id: string | null
          item_name: string | null
          price_cents: number | null
          price_raw: string | null
          raw_snippet: string | null
          restaurant_id: string | null
          section: string | null
          source: string | null
          source_url: string | null
          updated_at: string | null
        }
        Insert: {
          _reason?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          item_name?: string | null
          price_cents?: number | null
          price_raw?: string | null
          raw_snippet?: string | null
          restaurant_id?: string | null
          section?: string | null
          source?: string | null
          source_url?: string | null
          updated_at?: string | null
        }
        Update: {
          _reason?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          item_name?: string | null
          price_cents?: number | null
          price_raw?: string | null
          raw_snippet?: string | null
          restaurant_id?: string | null
          section?: string | null
          source?: string | null
          source_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      _remediation_backup_20260531_videos: {
        Row: {
          _reason: string | null
          author_display_name: string | null
          author_username: string | null
          caption: string | null
          comment_count: number | null
          created_at: string | null
          dishes: string[] | null
          dishes_extracted_at: string | null
          embed_url: string | null
          fetched_at: string | null
          id: string | null
          like_count: number | null
          platform: string | null
          posted_at: string | null
          restaurant_id: string | null
          thumbnail_storage_path: string | null
          thumbnail_url: string | null
          video_id: string | null
          video_url: string | null
          view_count: number | null
        }
        Insert: {
          _reason?: string | null
          author_display_name?: string | null
          author_username?: string | null
          caption?: string | null
          comment_count?: number | null
          created_at?: string | null
          dishes?: string[] | null
          dishes_extracted_at?: string | null
          embed_url?: string | null
          fetched_at?: string | null
          id?: string | null
          like_count?: number | null
          platform?: string | null
          posted_at?: string | null
          restaurant_id?: string | null
          thumbnail_storage_path?: string | null
          thumbnail_url?: string | null
          video_id?: string | null
          video_url?: string | null
          view_count?: number | null
        }
        Update: {
          _reason?: string | null
          author_display_name?: string | null
          author_username?: string | null
          caption?: string | null
          comment_count?: number | null
          created_at?: string | null
          dishes?: string[] | null
          dishes_extracted_at?: string | null
          embed_url?: string | null
          fetched_at?: string | null
          id?: string | null
          like_count?: number | null
          platform?: string | null
          posted_at?: string | null
          restaurant_id?: string | null
          thumbnail_storage_path?: string | null
          thumbnail_url?: string | null
          video_id?: string | null
          video_url?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
      _top_dishes_backup_20260601: {
        Row: {
          computed_at: string | null
          display_name: string | null
          google_mentions: number | null
          id: string | null
          instagram_mentions: number | null
          menu_item_id: string | null
          negative_count: number | null
          neutral_count: number | null
          positive_count: number | null
          price_cents: number | null
          rank: number | null
          restaurant_id: string | null
          sample_quote: string | null
          sample_quote_source: string | null
          score: number | null
          tier: string | null
          tiktok_mentions: number | null
          total_mentions: number | null
        }
        Insert: {
          computed_at?: string | null
          display_name?: string | null
          google_mentions?: number | null
          id?: string | null
          instagram_mentions?: number | null
          menu_item_id?: string | null
          negative_count?: number | null
          neutral_count?: number | null
          positive_count?: number | null
          price_cents?: number | null
          rank?: number | null
          restaurant_id?: string | null
          sample_quote?: string | null
          sample_quote_source?: string | null
          score?: number | null
          tier?: string | null
          tiktok_mentions?: number | null
          total_mentions?: number | null
        }
        Update: {
          computed_at?: string | null
          display_name?: string | null
          google_mentions?: number | null
          id?: string | null
          instagram_mentions?: number | null
          menu_item_id?: string | null
          negative_count?: number | null
          neutral_count?: number | null
          positive_count?: number | null
          price_cents?: number | null
          rank?: number | null
          restaurant_id?: string | null
          sample_quote?: string | null
          sample_quote_source?: string | null
          score?: number | null
          tier?: string | null
          tiktok_mentions?: number | null
          total_mentions?: number | null
        }
        Relationships: []
      }
      _top_dishes_pre_llm_20260601: {
        Row: {
          computed_at: string | null
          display_name: string | null
          google_mentions: number | null
          id: string | null
          instagram_mentions: number | null
          menu_item_id: string | null
          negative_count: number | null
          neutral_count: number | null
          positive_count: number | null
          price_cents: number | null
          rank: number | null
          restaurant_id: string | null
          sample_quote: string | null
          sample_quote_source: string | null
          score: number | null
          tier: string | null
          tiktok_mentions: number | null
          total_mentions: number | null
        }
        Insert: {
          computed_at?: string | null
          display_name?: string | null
          google_mentions?: number | null
          id?: string | null
          instagram_mentions?: number | null
          menu_item_id?: string | null
          negative_count?: number | null
          neutral_count?: number | null
          positive_count?: number | null
          price_cents?: number | null
          rank?: number | null
          restaurant_id?: string | null
          sample_quote?: string | null
          sample_quote_source?: string | null
          score?: number | null
          tier?: string | null
          tiktok_mentions?: number | null
          total_mentions?: number | null
        }
        Update: {
          computed_at?: string | null
          display_name?: string | null
          google_mentions?: number | null
          id?: string | null
          instagram_mentions?: number | null
          menu_item_id?: string | null
          negative_count?: number | null
          neutral_count?: number | null
          positive_count?: number | null
          price_cents?: number | null
          rank?: number | null
          restaurant_id?: string | null
          sample_quote?: string | null
          sample_quote_source?: string | null
          score?: number | null
          tier?: string | null
          tiktok_mentions?: number | null
          total_mentions?: number | null
        }
        Relationships: []
      }
      accolades_matches: {
        Row: {
          ambiguous: boolean | null
          created_at: string | null
          match_method: string | null
          match_score: number | null
          restaurant_id: string | null
          staging_id: number
        }
        Insert: {
          ambiguous?: boolean | null
          created_at?: string | null
          match_method?: string | null
          match_score?: number | null
          restaurant_id?: string | null
          staging_id: number
        }
        Update: {
          ambiguous?: boolean | null
          created_at?: string | null
          match_method?: string | null
          match_score?: number | null
          restaurant_id?: string | null
          staging_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "accolades_matches_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accolades_matches_staging_id_fkey"
            columns: ["staging_id"]
            isOneToOne: true
            referencedRelation: "accolades_staging"
            referencedColumns: ["id"]
          },
        ]
      }
      accolades_michelin_audit: {
        Row: {
          city: string | null
          michelin_before: Json | null
          name: string | null
          restaurant_id: string | null
        }
        Insert: {
          city?: string | null
          michelin_before?: Json | null
          name?: string | null
          restaurant_id?: string | null
        }
        Update: {
          city?: string | null
          michelin_before?: Json | null
          name?: string | null
          restaurant_id?: string | null
        }
        Relationships: []
      }
      accolades_prev_snapshot: {
        Row: {
          accolades: Json | null
          beli_url: string | null
          city: string | null
          eater_38: boolean | null
          id: string | null
          infatuation_url: string | null
          name: string | null
          snapshot_at: string | null
        }
        Insert: {
          accolades?: Json | null
          beli_url?: string | null
          city?: string | null
          eater_38?: boolean | null
          id?: string | null
          infatuation_url?: string | null
          name?: string | null
          snapshot_at?: string | null
        }
        Update: {
          accolades?: Json | null
          beli_url?: string | null
          city?: string | null
          eater_38?: boolean | null
          id?: string | null
          infatuation_url?: string | null
          name?: string | null
          snapshot_at?: string | null
        }
        Relationships: []
      }
      accolades_staging: {
        Row: {
          address: string | null
          city: string
          created_at: string | null
          id: number
          list_name: string | null
          month: number | null
          name: string
          normalized_name: string
          posted_at: string | null
          rank: number | null
          source: string
          source_url: string | null
          url: string | null
          video_id: string | null
          year: number | null
        }
        Insert: {
          address?: string | null
          city: string
          created_at?: string | null
          id?: number
          list_name?: string | null
          month?: number | null
          name: string
          normalized_name: string
          posted_at?: string | null
          rank?: number | null
          source: string
          source_url?: string | null
          url?: string | null
          video_id?: string | null
          year?: number | null
        }
        Update: {
          address?: string | null
          city?: string
          created_at?: string | null
          id?: number
          list_name?: string | null
          month?: number | null
          name?: string
          normalized_name?: string
          posted_at?: string | null
          rank?: number | null
          source?: string
          source_url?: string | null
          url?: string | null
          video_id?: string | null
          year?: number | null
        }
        Relationships: []
      }
      cities: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          photo_url: string | null
          restaurant_count: number | null
          slug: string
          state: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          photo_url?: string | null
          restaurant_count?: number | null
          slug: string
          state: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          photo_url?: string | null
          restaurant_count?: number | null
          slug?: string
          state?: string
        }
        Relationships: []
      }
      dish_dict: {
        Row: {
          canonical: string
          confidence: number
          phrase: string
        }
        Insert: {
          canonical: string
          confidence?: number
          phrase: string
        }
        Update: {
          canonical?: string
          confidence?: number
          phrase?: string
        }
        Relationships: []
      }
      external_review_dish_mentions: {
        Row: {
          confidence: number | null
          created_at: string | null
          dish_context: string | null
          dish_name: string
          dish_name_normalized: string
          id: string
          restaurant_id: string
          review_id: string
          sentiment: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          dish_context?: string | null
          dish_name: string
          dish_name_normalized: string
          id?: string
          restaurant_id: string
          review_id: string
          sentiment?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          dish_context?: string | null
          dish_name?: string
          dish_name_normalized?: string
          id?: string
          restaurant_id?: string
          review_id?: string
          sentiment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_review_dish_mentions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_review_dish_mentions_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "external_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      external_reviews: {
        Row: {
          author_name: string | null
          external_id: string
          fetched_at: string | null
          id: string
          published_at: string | null
          rating: number | null
          restaurant_id: string
          source: string
          text: string | null
        }
        Insert: {
          author_name?: string | null
          external_id: string
          fetched_at?: string | null
          id?: string
          published_at?: string | null
          rating?: number | null
          restaurant_id: string
          source: string
          text?: string | null
        }
        Update: {
          author_name?: string | null
          external_id?: string
          fetched_at?: string | null
          id?: string
          published_at?: string | null
          rating?: number | null
          restaurant_id?: string
          source?: string
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      fetch_logs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          restaurant_id: string | null
          source: string
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          restaurant_id?: string | null
          source: string
          started_at?: string | null
          status: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          restaurant_id?: string | null
          source?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fetch_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
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
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          creative_mode_enabled: boolean | null
          display_name: string | null
          email: string | null
          favorite_cities: Json | null
          favorite_cuisines: Json | null
          home_city: string | null
          id: string
          is_critic: boolean | null
          onboarding_completed: boolean | null
          updated_at: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          creative_mode_enabled?: boolean | null
          display_name?: string | null
          email?: string | null
          favorite_cities?: Json | null
          favorite_cuisines?: Json | null
          home_city?: string | null
          id: string
          is_critic?: boolean | null
          onboarding_completed?: boolean | null
          updated_at?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          creative_mode_enabled?: boolean | null
          display_name?: string | null
          email?: string | null
          favorite_cities?: Json | null
          favorite_cuisines?: Json | null
          home_city?: string | null
          id?: string
          is_critic?: boolean | null
          onboarding_completed?: boolean | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      restaurant_dish_signals: {
        Row: {
          created_at: string
          dish_name: string
          id: string
          raw_snippet: string | null
          restaurant_id: string
          signal_source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dish_name: string
          id?: string
          raw_snippet?: string | null
          restaurant_id: string
          signal_source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dish_name?: string
          id?: string
          raw_snippet?: string | null
          restaurant_id?: string
          signal_source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_dish_signals_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_eater38_history: {
        Row: {
          city: string
          created_at: string | null
          id: number
          list_url: string | null
          restaurant_id: string
          year: number
        }
        Insert: {
          city: string
          created_at?: string | null
          id?: number
          list_url?: string | null
          restaurant_id: string
          year: number
        }
        Update: {
          city?: string
          created_at?: string | null
          id?: number
          list_url?: string | null
          restaurant_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_eater38_history_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_google_chips: {
        Row: {
          google_count: number
          id: string
          instagram_mentions: number
          keyword: string
          match_confidence: number | null
          match_method: string | null
          menu_item_id: string | null
          raw_keyword: string
          restaurant_id: string
          review_mentions: number
          sample_quote: string | null
          score: number | null
          scored_at: string | null
          scraped_at: string
          source_breakdown: Json | null
          tiktok_mentions: number
        }
        Insert: {
          google_count: number
          id?: string
          instagram_mentions?: number
          keyword: string
          match_confidence?: number | null
          match_method?: string | null
          menu_item_id?: string | null
          raw_keyword: string
          restaurant_id: string
          review_mentions?: number
          sample_quote?: string | null
          score?: number | null
          scored_at?: string | null
          scraped_at?: string
          source_breakdown?: Json | null
          tiktok_mentions?: number
        }
        Update: {
          google_count?: number
          id?: string
          instagram_mentions?: number
          keyword?: string
          match_confidence?: number | null
          match_method?: string | null
          menu_item_id?: string | null
          raw_keyword?: string
          restaurant_id?: string
          review_mentions?: number
          sample_quote?: string | null
          score?: number | null
          scored_at?: string | null
          scraped_at?: string
          source_breakdown?: Json | null
          tiktok_mentions?: number
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_google_chips_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "restaurant_menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_google_chips_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_highlighted_dishes: {
        Row: {
          avg_rating: number | null
          dish_name: string
          display_name: string | null
          google_mentions: number
          instagram_mentions: number
          match_confidence: number | null
          match_method: string | null
          matched_at: string | null
          matched_menu_item_id: string | null
          mention_count: number
          other_mentions: number
          positive_pct: number | null
          rank: number | null
          rating_sample_size: number
          restaurant_id: string
          sample_quote: string | null
          sample_quote_source: string | null
          sample_video_ids: string[]
          sentiment_sample_size: number
          tiktok_mentions: number
          updated_at: string
        }
        Insert: {
          avg_rating?: number | null
          dish_name: string
          display_name?: string | null
          google_mentions?: number
          instagram_mentions?: number
          match_confidence?: number | null
          match_method?: string | null
          matched_at?: string | null
          matched_menu_item_id?: string | null
          mention_count?: number
          other_mentions?: number
          positive_pct?: number | null
          rank?: number | null
          rating_sample_size?: number
          restaurant_id: string
          sample_quote?: string | null
          sample_quote_source?: string | null
          sample_video_ids?: string[]
          sentiment_sample_size?: number
          tiktok_mentions?: number
          updated_at?: string
        }
        Update: {
          avg_rating?: number | null
          dish_name?: string
          display_name?: string | null
          google_mentions?: number
          instagram_mentions?: number
          match_confidence?: number | null
          match_method?: string | null
          matched_at?: string | null
          matched_menu_item_id?: string | null
          mention_count?: number
          other_mentions?: number
          positive_pct?: number | null
          rank?: number | null
          rating_sample_size?: number
          restaurant_id?: string
          sample_quote?: string | null
          sample_quote_source?: string | null
          sample_video_ids?: string[]
          sentiment_sample_size?: number
          tiktok_mentions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_highlighted_dishes_matched_menu_item_id_fkey"
            columns: ["matched_menu_item_id"]
            isOneToOne: false
            referencedRelation: "restaurant_menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_highlighted_dishes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_jbf_history: {
        Row: {
          award_name: string
          chef_name: string | null
          created_at: string | null
          id: number
          region: string | null
          restaurant_id: string
          source_url: string | null
          status: string
          year: number
        }
        Insert: {
          award_name: string
          chef_name?: string | null
          created_at?: string | null
          id?: number
          region?: string | null
          restaurant_id: string
          source_url?: string | null
          status: string
          year: number
        }
        Update: {
          award_name?: string
          chef_name?: string | null
          created_at?: string | null
          id?: number
          region?: string | null
          restaurant_id?: string
          source_url?: string | null
          status?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_jbf_history_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_menu_fetches: {
        Row: {
          error_message: string | null
          fetched_at: string
          id: string
          items_found: number
          menu_url: string | null
          restaurant_id: string
          source: string
          source_url: string | null
          status: string
        }
        Insert: {
          error_message?: string | null
          fetched_at?: string
          id?: string
          items_found?: number
          menu_url?: string | null
          restaurant_id: string
          source: string
          source_url?: string | null
          status: string
        }
        Update: {
          error_message?: string | null
          fetched_at?: string
          id?: string
          items_found?: number
          menu_url?: string | null
          restaurant_id?: string
          source?: string
          source_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_menu_fetches_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_menu_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          item_name: string
          price_cents: number | null
          price_raw: string | null
          raw_snippet: string | null
          restaurant_id: string
          section: string | null
          source: string
          source_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          item_name: string
          price_cents?: number | null
          price_raw?: string | null
          raw_snippet?: string | null
          restaurant_id: string
          section?: string | null
          source: string
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          item_name?: string
          price_cents?: number | null
          price_raw?: string | null
          raw_snippet?: string | null
          restaurant_id?: string
          section?: string | null
          source?: string
          source_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_michelin_history: {
        Row: {
          created_at: string | null
          designation: string
          id: number
          restaurant_id: string
          source_url: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          designation: string
          id?: number
          restaurant_id: string
          source_url?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          designation?: string
          id?: number
          restaurant_id?: string
          source_url?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_michelin_history_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_photos: {
        Row: {
          alt_text: string | null
          created_at: string
          height: number | null
          id: string
          is_primary: boolean
          photo_url: string
          restaurant_id: string
          sort_order: number
          source: string
          source_url: string | null
          updated_at: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          height?: number | null
          id?: string
          is_primary?: boolean
          photo_url: string
          restaurant_id: string
          sort_order?: number
          source: string
          source_url?: string | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          height?: number | null
          id?: string
          is_primary?: boolean
          photo_url?: string
          restaurant_id?: string
          sort_order?: number
          source?: string
          source_url?: string | null
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_photos_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_top_dishes: {
        Row: {
          computed_at: string
          display_name: string
          google_mentions: number
          id: string
          instagram_mentions: number
          menu_item_id: string | null
          negative_count: number
          neutral_count: number
          positive_count: number
          price_cents: number | null
          rank: number
          restaurant_id: string
          sample_quote: string | null
          sample_quote_source: string | null
          score: number
          tier: string
          tiktok_mentions: number
          total_mentions: number
        }
        Insert: {
          computed_at?: string
          display_name: string
          google_mentions?: number
          id?: string
          instagram_mentions?: number
          menu_item_id?: string | null
          negative_count?: number
          neutral_count?: number
          positive_count?: number
          price_cents?: number | null
          rank: number
          restaurant_id: string
          sample_quote?: string | null
          sample_quote_source?: string | null
          score: number
          tier: string
          tiktok_mentions?: number
          total_mentions?: number
        }
        Update: {
          computed_at?: string
          display_name?: string
          google_mentions?: number
          id?: string
          instagram_mentions?: number
          menu_item_id?: string | null
          negative_count?: number
          neutral_count?: number
          positive_count?: number
          price_cents?: number | null
          rank?: number
          restaurant_id?: string
          sample_quote?: string | null
          sample_quote_source?: string | null
          score?: number
          tier?: string
          tiktok_mentions?: number
          total_mentions?: number
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_top_dishes_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "restaurant_menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_top_dishes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_videos: {
        Row: {
          author_display_name: string | null
          author_username: string | null
          caption: string | null
          comment_count: number | null
          created_at: string | null
          dishes: string[] | null
          dishes_extracted_at: string | null
          embed_url: string | null
          fetched_at: string | null
          id: string
          like_count: number | null
          platform: string
          posted_at: string | null
          restaurant_id: string
          thumbnail_storage_path: string | null
          thumbnail_url: string | null
          video_id: string
          video_url: string
          view_count: number | null
        }
        Insert: {
          author_display_name?: string | null
          author_username?: string | null
          caption?: string | null
          comment_count?: number | null
          created_at?: string | null
          dishes?: string[] | null
          dishes_extracted_at?: string | null
          embed_url?: string | null
          fetched_at?: string | null
          id?: string
          like_count?: number | null
          platform: string
          posted_at?: string | null
          restaurant_id: string
          thumbnail_storage_path?: string | null
          thumbnail_url?: string | null
          video_id: string
          video_url: string
          view_count?: number | null
        }
        Update: {
          author_display_name?: string | null
          author_username?: string | null
          caption?: string | null
          comment_count?: number | null
          created_at?: string | null
          dishes?: string[] | null
          dishes_extracted_at?: string | null
          embed_url?: string | null
          fetched_at?: string | null
          id?: string
          like_count?: number | null
          platform?: string
          posted_at?: string | null
          restaurant_id?: string
          thumbnail_storage_path?: string | null
          thumbnail_url?: string | null
          video_id?: string
          video_url?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_videos_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          _norm_name: string | null
          accolades: Json | null
          address: string | null
          avg_rating: number | null
          beli_score: number | null
          beli_url: string | null
          business_status: string | null
          city: string | null
          created_at: string | null
          created_by: string | null
          cuisine: string | null
          description: string | null
          eater_38: boolean | null
          flagged_for_removal: boolean
          google_photo_url: string | null
          google_place_id: string | null
          google_rating: number | null
          google_review_count: number | null
          google_url: string | null
          hours: Json | null
          id: string
          image_url: string | null
          infatuation_rating: number | null
          infatuation_review_snippet: string | null
          infatuation_url: string | null
          instagram_follower_count: number | null
          instagram_handle: string | null
          instagram_last_fetched_at: string | null
          instagram_url: string | null
          is_featured: boolean | null
          james_beard_winner: boolean | null
          last_fetched_at: string | null
          latitude: number | null
          longitude: number | null
          menu_format: string | null
          menu_note: string | null
          michelin_designation: string | null
          michelin_stars: number | null
          michelin_url: string | null
          name: string
          neighborhood: string | null
          phone: string | null
          photo_url: string | null
          photo_urls: string[] | null
          price_range: number | null
          review_count: number | null
          reviews_fetched_at: string | null
          social_score: number | null
          state: string | null
          updated_at: string | null
          website: string | null
          website_photo_url: string | null
          yelp_id: string | null
          yelp_photo_url: string | null
          yelp_rating: number | null
          yelp_review_count: number | null
          yelp_url: string | null
          zip_code: string | null
        }
        Insert: {
          _norm_name?: string | null
          accolades?: Json | null
          address?: string | null
          avg_rating?: number | null
          beli_score?: number | null
          beli_url?: string | null
          business_status?: string | null
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          cuisine?: string | null
          description?: string | null
          eater_38?: boolean | null
          flagged_for_removal?: boolean
          google_photo_url?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          google_url?: string | null
          hours?: Json | null
          id?: string
          image_url?: string | null
          infatuation_rating?: number | null
          infatuation_review_snippet?: string | null
          infatuation_url?: string | null
          instagram_follower_count?: number | null
          instagram_handle?: string | null
          instagram_last_fetched_at?: string | null
          instagram_url?: string | null
          is_featured?: boolean | null
          james_beard_winner?: boolean | null
          last_fetched_at?: string | null
          latitude?: number | null
          longitude?: number | null
          menu_format?: string | null
          menu_note?: string | null
          michelin_designation?: string | null
          michelin_stars?: number | null
          michelin_url?: string | null
          name: string
          neighborhood?: string | null
          phone?: string | null
          photo_url?: string | null
          photo_urls?: string[] | null
          price_range?: number | null
          review_count?: number | null
          reviews_fetched_at?: string | null
          social_score?: number | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
          website_photo_url?: string | null
          yelp_id?: string | null
          yelp_photo_url?: string | null
          yelp_rating?: number | null
          yelp_review_count?: number | null
          yelp_url?: string | null
          zip_code?: string | null
        }
        Update: {
          _norm_name?: string | null
          accolades?: Json | null
          address?: string | null
          avg_rating?: number | null
          beli_score?: number | null
          beli_url?: string | null
          business_status?: string | null
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          cuisine?: string | null
          description?: string | null
          eater_38?: boolean | null
          flagged_for_removal?: boolean
          google_photo_url?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          google_url?: string | null
          hours?: Json | null
          id?: string
          image_url?: string | null
          infatuation_rating?: number | null
          infatuation_review_snippet?: string | null
          infatuation_url?: string | null
          instagram_follower_count?: number | null
          instagram_handle?: string | null
          instagram_last_fetched_at?: string | null
          instagram_url?: string | null
          is_featured?: boolean | null
          james_beard_winner?: boolean | null
          last_fetched_at?: string | null
          latitude?: number | null
          longitude?: number | null
          menu_format?: string | null
          menu_note?: string | null
          michelin_designation?: string | null
          michelin_stars?: number | null
          michelin_url?: string | null
          name?: string
          neighborhood?: string | null
          phone?: string | null
          photo_url?: string | null
          photo_urls?: string[] | null
          price_range?: number | null
          review_count?: number | null
          reviews_fetched_at?: string | null
          social_score?: number | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
          website_photo_url?: string | null
          yelp_id?: string | null
          yelp_photo_url?: string | null
          yelp_rating?: number | null
          yelp_review_count?: number | null
          yelp_url?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_photos: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          photo_url: string
          review_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          photo_url: string
          review_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          photo_url?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_photos_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: string
          rating: number
          restaurant_id: string
          title: string
          updated_at: string | null
          visit_date: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          rating: number
          restaurant_id: string
          title: string
          updated_at?: string | null
          visit_date?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          rating?: number
          restaurant_id?: string
          title?: string
          updated_at?: string | null
          visit_date?: string | null
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
          },
        ]
      }
      tmp_merge_backup_restaurants: {
        Row: {
          _norm_name: string | null
          accolades: Json | null
          address: string | null
          avg_rating: number | null
          beli_score: number | null
          beli_url: string | null
          business_status: string | null
          city: string | null
          created_at: string | null
          created_by: string | null
          cuisine: string | null
          description: string | null
          eater_38: boolean | null
          flagged_for_removal: boolean | null
          google_photo_url: string | null
          google_place_id: string | null
          google_rating: number | null
          google_review_count: number | null
          google_url: string | null
          hours: Json | null
          id: string | null
          image_url: string | null
          infatuation_rating: number | null
          infatuation_review_snippet: string | null
          infatuation_url: string | null
          instagram_follower_count: number | null
          instagram_handle: string | null
          instagram_last_fetched_at: string | null
          instagram_url: string | null
          is_featured: boolean | null
          james_beard_winner: boolean | null
          last_fetched_at: string | null
          latitude: number | null
          longitude: number | null
          menu_format: string | null
          menu_note: string | null
          michelin_designation: string | null
          michelin_stars: number | null
          michelin_url: string | null
          name: string | null
          neighborhood: string | null
          phone: string | null
          photo_url: string | null
          photo_urls: string[] | null
          price_range: number | null
          review_count: number | null
          reviews_fetched_at: string | null
          state: string | null
          updated_at: string | null
          website: string | null
          website_photo_url: string | null
          yelp_id: string | null
          yelp_photo_url: string | null
          yelp_rating: number | null
          yelp_review_count: number | null
          yelp_url: string | null
          zip_code: string | null
        }
        Insert: {
          _norm_name?: string | null
          accolades?: Json | null
          address?: string | null
          avg_rating?: number | null
          beli_score?: number | null
          beli_url?: string | null
          business_status?: string | null
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          cuisine?: string | null
          description?: string | null
          eater_38?: boolean | null
          flagged_for_removal?: boolean | null
          google_photo_url?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          google_url?: string | null
          hours?: Json | null
          id?: string | null
          image_url?: string | null
          infatuation_rating?: number | null
          infatuation_review_snippet?: string | null
          infatuation_url?: string | null
          instagram_follower_count?: number | null
          instagram_handle?: string | null
          instagram_last_fetched_at?: string | null
          instagram_url?: string | null
          is_featured?: boolean | null
          james_beard_winner?: boolean | null
          last_fetched_at?: string | null
          latitude?: number | null
          longitude?: number | null
          menu_format?: string | null
          menu_note?: string | null
          michelin_designation?: string | null
          michelin_stars?: number | null
          michelin_url?: string | null
          name?: string | null
          neighborhood?: string | null
          phone?: string | null
          photo_url?: string | null
          photo_urls?: string[] | null
          price_range?: number | null
          review_count?: number | null
          reviews_fetched_at?: string | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
          website_photo_url?: string | null
          yelp_id?: string | null
          yelp_photo_url?: string | null
          yelp_rating?: number | null
          yelp_review_count?: number | null
          yelp_url?: string | null
          zip_code?: string | null
        }
        Update: {
          _norm_name?: string | null
          accolades?: Json | null
          address?: string | null
          avg_rating?: number | null
          beli_score?: number | null
          beli_url?: string | null
          business_status?: string | null
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          cuisine?: string | null
          description?: string | null
          eater_38?: boolean | null
          flagged_for_removal?: boolean | null
          google_photo_url?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          google_url?: string | null
          hours?: Json | null
          id?: string | null
          image_url?: string | null
          infatuation_rating?: number | null
          infatuation_review_snippet?: string | null
          infatuation_url?: string | null
          instagram_follower_count?: number | null
          instagram_handle?: string | null
          instagram_last_fetched_at?: string | null
          instagram_url?: string | null
          is_featured?: boolean | null
          james_beard_winner?: boolean | null
          last_fetched_at?: string | null
          latitude?: number | null
          longitude?: number | null
          menu_format?: string | null
          menu_note?: string | null
          michelin_designation?: string | null
          michelin_stars?: number | null
          michelin_url?: string | null
          name?: string | null
          neighborhood?: string | null
          phone?: string | null
          photo_url?: string | null
          photo_urls?: string[] | null
          price_range?: number | null
          review_count?: number | null
          reviews_fetched_at?: string | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
          website_photo_url?: string | null
          yelp_id?: string | null
          yelp_photo_url?: string | null
          yelp_rating?: number | null
          yelp_review_count?: number | null
          yelp_url?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      tmp_outofmarket_backup_restaurants: {
        Row: {
          _norm_name: string | null
          accolades: Json | null
          address: string | null
          avg_rating: number | null
          beli_score: number | null
          beli_url: string | null
          business_status: string | null
          city: string | null
          created_at: string | null
          created_by: string | null
          cuisine: string | null
          description: string | null
          eater_38: boolean | null
          flagged_for_removal: boolean | null
          google_photo_url: string | null
          google_place_id: string | null
          google_rating: number | null
          google_review_count: number | null
          google_url: string | null
          hours: Json | null
          id: string | null
          image_url: string | null
          infatuation_rating: number | null
          infatuation_review_snippet: string | null
          infatuation_url: string | null
          instagram_follower_count: number | null
          instagram_handle: string | null
          instagram_last_fetched_at: string | null
          instagram_url: string | null
          is_featured: boolean | null
          james_beard_winner: boolean | null
          last_fetched_at: string | null
          latitude: number | null
          longitude: number | null
          menu_format: string | null
          menu_note: string | null
          michelin_designation: string | null
          michelin_stars: number | null
          michelin_url: string | null
          name: string | null
          neighborhood: string | null
          phone: string | null
          photo_url: string | null
          photo_urls: string[] | null
          price_range: number | null
          review_count: number | null
          reviews_fetched_at: string | null
          state: string | null
          updated_at: string | null
          website: string | null
          website_photo_url: string | null
          yelp_id: string | null
          yelp_photo_url: string | null
          yelp_rating: number | null
          yelp_review_count: number | null
          yelp_url: string | null
          zip_code: string | null
        }
        Insert: {
          _norm_name?: string | null
          accolades?: Json | null
          address?: string | null
          avg_rating?: number | null
          beli_score?: number | null
          beli_url?: string | null
          business_status?: string | null
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          cuisine?: string | null
          description?: string | null
          eater_38?: boolean | null
          flagged_for_removal?: boolean | null
          google_photo_url?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          google_url?: string | null
          hours?: Json | null
          id?: string | null
          image_url?: string | null
          infatuation_rating?: number | null
          infatuation_review_snippet?: string | null
          infatuation_url?: string | null
          instagram_follower_count?: number | null
          instagram_handle?: string | null
          instagram_last_fetched_at?: string | null
          instagram_url?: string | null
          is_featured?: boolean | null
          james_beard_winner?: boolean | null
          last_fetched_at?: string | null
          latitude?: number | null
          longitude?: number | null
          menu_format?: string | null
          menu_note?: string | null
          michelin_designation?: string | null
          michelin_stars?: number | null
          michelin_url?: string | null
          name?: string | null
          neighborhood?: string | null
          phone?: string | null
          photo_url?: string | null
          photo_urls?: string[] | null
          price_range?: number | null
          review_count?: number | null
          reviews_fetched_at?: string | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
          website_photo_url?: string | null
          yelp_id?: string | null
          yelp_photo_url?: string | null
          yelp_rating?: number | null
          yelp_review_count?: number | null
          yelp_url?: string | null
          zip_code?: string | null
        }
        Update: {
          _norm_name?: string | null
          accolades?: Json | null
          address?: string | null
          avg_rating?: number | null
          beli_score?: number | null
          beli_url?: string | null
          business_status?: string | null
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          cuisine?: string | null
          description?: string | null
          eater_38?: boolean | null
          flagged_for_removal?: boolean | null
          google_photo_url?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          google_url?: string | null
          hours?: Json | null
          id?: string | null
          image_url?: string | null
          infatuation_rating?: number | null
          infatuation_review_snippet?: string | null
          infatuation_url?: string | null
          instagram_follower_count?: number | null
          instagram_handle?: string | null
          instagram_last_fetched_at?: string | null
          instagram_url?: string | null
          is_featured?: boolean | null
          james_beard_winner?: boolean | null
          last_fetched_at?: string | null
          latitude?: number | null
          longitude?: number | null
          menu_format?: string | null
          menu_note?: string | null
          michelin_designation?: string | null
          michelin_stars?: number | null
          michelin_url?: string | null
          name?: string | null
          neighborhood?: string | null
          phone?: string | null
          photo_url?: string | null
          photo_urls?: string[] | null
          price_range?: number | null
          review_count?: number | null
          reviews_fetched_at?: string | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
          website_photo_url?: string | null
          yelp_id?: string | null
          yelp_photo_url?: string | null
          yelp_rating?: number | null
          yelp_review_count?: number | null
          yelp_url?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      tmp_stale_closures_backup_20260601: {
        Row: {
          _norm_name: string | null
          accolades: Json | null
          address: string | null
          avg_rating: number | null
          beli_score: number | null
          beli_url: string | null
          business_status: string | null
          city: string | null
          created_at: string | null
          created_by: string | null
          cuisine: string | null
          description: string | null
          eater_38: boolean | null
          flagged_for_removal: boolean | null
          google_photo_url: string | null
          google_place_id: string | null
          google_rating: number | null
          google_review_count: number | null
          google_url: string | null
          hours: Json | null
          id: string | null
          image_url: string | null
          infatuation_rating: number | null
          infatuation_review_snippet: string | null
          infatuation_url: string | null
          instagram_follower_count: number | null
          instagram_handle: string | null
          instagram_last_fetched_at: string | null
          instagram_url: string | null
          is_featured: boolean | null
          james_beard_winner: boolean | null
          last_fetched_at: string | null
          latitude: number | null
          longitude: number | null
          menu_format: string | null
          menu_note: string | null
          michelin_designation: string | null
          michelin_stars: number | null
          michelin_url: string | null
          name: string | null
          neighborhood: string | null
          phone: string | null
          photo_url: string | null
          photo_urls: string[] | null
          price_range: number | null
          review_count: number | null
          reviews_fetched_at: string | null
          state: string | null
          updated_at: string | null
          website: string | null
          website_photo_url: string | null
          yelp_id: string | null
          yelp_photo_url: string | null
          yelp_rating: number | null
          yelp_review_count: number | null
          yelp_url: string | null
          zip_code: string | null
        }
        Insert: {
          _norm_name?: string | null
          accolades?: Json | null
          address?: string | null
          avg_rating?: number | null
          beli_score?: number | null
          beli_url?: string | null
          business_status?: string | null
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          cuisine?: string | null
          description?: string | null
          eater_38?: boolean | null
          flagged_for_removal?: boolean | null
          google_photo_url?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          google_url?: string | null
          hours?: Json | null
          id?: string | null
          image_url?: string | null
          infatuation_rating?: number | null
          infatuation_review_snippet?: string | null
          infatuation_url?: string | null
          instagram_follower_count?: number | null
          instagram_handle?: string | null
          instagram_last_fetched_at?: string | null
          instagram_url?: string | null
          is_featured?: boolean | null
          james_beard_winner?: boolean | null
          last_fetched_at?: string | null
          latitude?: number | null
          longitude?: number | null
          menu_format?: string | null
          menu_note?: string | null
          michelin_designation?: string | null
          michelin_stars?: number | null
          michelin_url?: string | null
          name?: string | null
          neighborhood?: string | null
          phone?: string | null
          photo_url?: string | null
          photo_urls?: string[] | null
          price_range?: number | null
          review_count?: number | null
          reviews_fetched_at?: string | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
          website_photo_url?: string | null
          yelp_id?: string | null
          yelp_photo_url?: string | null
          yelp_rating?: number | null
          yelp_review_count?: number | null
          yelp_url?: string | null
          zip_code?: string | null
        }
        Update: {
          _norm_name?: string | null
          accolades?: Json | null
          address?: string | null
          avg_rating?: number | null
          beli_score?: number | null
          beli_url?: string | null
          business_status?: string | null
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          cuisine?: string | null
          description?: string | null
          eater_38?: boolean | null
          flagged_for_removal?: boolean | null
          google_photo_url?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          google_url?: string | null
          hours?: Json | null
          id?: string | null
          image_url?: string | null
          infatuation_rating?: number | null
          infatuation_review_snippet?: string | null
          infatuation_url?: string | null
          instagram_follower_count?: number | null
          instagram_handle?: string | null
          instagram_last_fetched_at?: string | null
          instagram_url?: string | null
          is_featured?: boolean | null
          james_beard_winner?: boolean | null
          last_fetched_at?: string | null
          latitude?: number | null
          longitude?: number | null
          menu_format?: string | null
          menu_note?: string | null
          michelin_designation?: string | null
          michelin_stars?: number | null
          michelin_url?: string | null
          name?: string | null
          neighborhood?: string | null
          phone?: string | null
          photo_url?: string | null
          photo_urls?: string[] | null
          price_range?: number | null
          review_count?: number | null
          reviews_fetched_at?: string | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
          website_photo_url?: string | null
          yelp_id?: string | null
          yelp_photo_url?: string | null
          yelp_rating?: number | null
          yelp_review_count?: number | null
          yelp_url?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      user_collection_items: {
        Row: {
          added_at: string
          collection_id: string
          restaurant_id: string
        }
        Insert: {
          added_at?: string
          collection_id: string
          restaurant_id: string
        }
        Update: {
          added_at?: string
          collection_id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "user_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_collection_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_collections: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_favorites: {
        Row: {
          created_at: string
          restaurant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          restaurant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          restaurant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      video_dish_mentions: {
        Row: {
          confidence: number | null
          created_at: string | null
          dish_context: string | null
          dish_name: string
          dish_name_normalized: string
          id: string
          restaurant_id: string
          sentiment: string | null
          video_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          dish_context?: string | null
          dish_name: string
          dish_name_normalized: string
          id?: string
          restaurant_id: string
          sentiment?: string | null
          video_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          dish_context?: string | null
          dish_name?: string
          dish_name_normalized?: string
          id?: string
          restaurant_id?: string
          sentiment?: string | null
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_dish_mentions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_dish_mentions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "restaurant_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_signups: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_restaurant_avg_rating: {
        Args: { restaurant_uuid: string }
        Returns: number
      }
      rebuild_all_highlighted_dishes: { Args: never; Returns: number }
      rebuild_highlighted_dishes: {
        Args: { p_restaurant_id: string }
        Returns: number
      }
      set_restaurant_cover:
        | { Args: { p_id: string; p_url: string }; Returns: boolean }
        | {
            Args: {
              p_hours?: Json
              p_id: string
              p_place_id?: string
              p_status?: string
              p_url: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_address?: string
              p_hours?: Json
              p_id: string
              p_lat?: number
              p_lng?: number
              p_place_id?: string
              p_status?: string
              p_url: string
            }
            Returns: boolean
          }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

// ---------------------------------------------------------------------------
// Manual additions (NOT generated by Supabase). Preserved across regeneration.
// Convenience Row aliases + aggregator-specific domain types used across the
// app. Regenerated 2026-06-07 from live schema (project trwdqzsfgeydafojajbh)
// to fix schema drift: added the google-chips table and removed the
// non-existent rating-snapshots table. See reports/remediation-2026-06-07.
// ---------------------------------------------------------------------------

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Restaurant = Database['public']['Tables']['restaurants']['Row']
export type Review = Database['public']['Tables']['reviews']['Row']
export type ReviewPhoto = Database['public']['Tables']['review_photos']['Row']
export type Follow = Database['public']['Tables']['follows']['Row']
export type RestaurantVideo = Database['public']['Tables']['restaurant_videos']['Row']
export type City = Database['public']['Tables']['cities']['Row']
export type FetchLog = Database['public']['Tables']['fetch_logs']['Row']
export type RestaurantTopDish =
  Database['public']['Tables']['restaurant_top_dishes']['Row']
export type RestaurantMenuItem =
  Database['public']['Tables']['restaurant_menu_items']['Row']
export type RestaurantDishSignal =
  Database['public']['Tables']['restaurant_dish_signals']['Row']
export type RestaurantMichelinHistory =
  Database['public']['Tables']['restaurant_michelin_history']['Row']
export type RestaurantJbfHistory =
  Database['public']['Tables']['restaurant_jbf_history']['Row']
export type RestaurantEater38History =
  Database['public']['Tables']['restaurant_eater38_history']['Row']

// Aggregator-specific types
export type Accolade = {
  type: 'michelin' | 'james_beard' | 'eater_38' | 'worlds_50_best' | 'bon_appetit' | 'nyt_critic_pick' | 'custom'
  label: string
  year?: number
  url?: string
  icon?: string
}

export type SourceRating = {
  source: 'google' | 'yelp' | 'infatuation' | 'beli'
  rating: number | null
  reviewCount?: number
  url: string | null
  maxRating: number
  color: string
  label: string
  icon: string
}
