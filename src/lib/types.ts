import { Database } from './database.types';

// Database row types - derived from generated types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Restaurant = Database['public']['Tables']['restaurants']['Row'];
export type Review = Database['public']['Tables']['reviews']['Row'];
export type ReviewPhoto = Database['public']['Tables']['review_photos']['Row'];
export type Follow = Database['public']['Tables']['follows']['Row'];

// Join types
export interface ReviewWithAuthor extends Review {
  profiles: Profile | null;
}

export interface ReviewWithRestaurant extends Review {
  restaurants: Restaurant | null;
}

export interface ReviewWithAuthorAndRestaurant extends Review {
  profiles: Profile | null;
  restaurants: Restaurant | null;
}

export interface RestaurantWithReviews extends Restaurant {
  reviews: Review[];
}
