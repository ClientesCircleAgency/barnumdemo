-- ============================================================================
-- ADD consultation_type_name TO appointments
-- Pattern: mirrors professional_name, specialty_name denormalization
-- n8n receives the name directly in the DB Webhook payload (no extra lookup)
-- ============================================================================

-- 1. Add the column
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS consultation_type_name TEXT;

-- 2. Trigger function: auto-populate from consultation_types on INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.sync_consultation_type_name()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.consultation_type_id IS NOT NULL THEN
    SELECT name INTO NEW.consultation_type_name
    FROM public.consultation_types
    WHERE id = NEW.consultation_type_id;
  ELSE
    NEW.consultation_type_name := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_consultation_type_name
  BEFORE INSERT OR UPDATE OF consultation_type_id
  ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_consultation_type_name();

-- 3. Backfill existing rows
UPDATE public.appointments a
SET consultation_type_name = ct.name
FROM public.consultation_types ct
WHERE a.consultation_type_id = ct.id
  AND a.consultation_type_name IS NULL;
