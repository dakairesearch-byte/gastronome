-- Add onboarding-related columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS favorite_cities JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS favorite_cuisines JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill existing users: treat them as having completed onboarding so they
-- are not force-redirected on next login.
UPDATE public.profiles
SET onboarding_completed = TRUE
WHERE onboarding_completed IS DISTINCT FROM TRUE;

-- Index for middleware lookup (tiny, boolean column on small table — optional)
CREATE INDEX IF NOT EXISTS profiles_onboarding_completed_idx
  ON public.profiles (id)
  WHERE onboarding_completed = FALSE;
