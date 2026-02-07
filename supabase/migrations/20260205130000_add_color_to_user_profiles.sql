-- Add color column to user_profiles for agenda distinction
ALTER TABLE "public"."user_profiles"
  ADD COLUMN IF NOT EXISTS "color" text DEFAULT '#6366f1';
