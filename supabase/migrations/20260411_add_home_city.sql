-- Add home_city column to profiles for personalized homepage
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_city TEXT;
