ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS color text;

ALTER TABLE public.user_profiles
  ALTER COLUMN color DROP DEFAULT;;
