-- Add specialty_id to consultation_types so each type is linked to a specialty
ALTER TABLE "public"."consultation_types"
  ADD COLUMN IF NOT EXISTS "specialty_id" uuid REFERENCES "public"."specialties"(id) ON DELETE SET NULL;
