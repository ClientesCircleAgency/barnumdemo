-- Ensure collaborator color can be stored when provided,
-- but never blocks profile creation when omitted.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS color text;

ALTER TABLE public.user_profiles
  ALTER COLUMN color DROP DEFAULT;
