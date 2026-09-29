-- Migrate any existing rows with deprecated statuses
UPDATE public.appointments SET status = 'confirmed' WHERE status IN ('scheduled', 'pre_confirmed');

-- Drop default before type change (avoids cast error)
ALTER TABLE public.appointments ALTER COLUMN status DROP DEFAULT;

-- Recreate enum without deprecated values
ALTER TYPE public.appointment_status RENAME TO appointment_status_old;
CREATE TYPE public.appointment_status AS ENUM (
  'confirmed', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show'
);
ALTER TABLE public.appointments
  ALTER COLUMN status TYPE public.appointment_status
  USING status::text::public.appointment_status;
DROP TYPE public.appointment_status_old;

-- Re-set default after type change
ALTER TABLE public.appointments
  ALTER COLUMN status SET DEFAULT 'confirmed'::public.appointment_status;
