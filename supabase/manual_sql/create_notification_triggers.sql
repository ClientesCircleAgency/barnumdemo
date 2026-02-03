-- ============================================================================
-- NOTIFICATION TRIGGERS FOR BARNUN CLINIC
-- ============================================================================
-- Purpose: Automatically create notifications for all staff (admin, secretary, doctor)
--          when appointments are inserted or updated
-- ============================================================================

-- Function to create notifications for all staff users
CREATE OR REPLACE FUNCTION public.notify_staff_on_appointment_change()
RETURNS TRIGGER AS $$
DECLARE
  staff_user RECORD;
  notification_title TEXT;
  notification_body TEXT;
  appointment_patient_name TEXT;
BEGIN
  -- Get patient name for the notification
  SELECT name INTO appointment_patient_name
  FROM public.patients
  WHERE id = NEW.patient_id;

  -- Determine notification title and body based on operation
  IF (TG_OP = 'INSERT') THEN
    notification_title := 'Nova Consulta Marcada';
    notification_body := format('Consulta marcada para %s em %s às %s', 
                                COALESCE(appointment_patient_name, 'Paciente'), 
                                TO_CHAR(NEW.date::date, 'DD/MM/YYYY'),
                                SUBSTRING(NEW.time FROM 1 FOR 5));
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Only notify on meaningful changes (status, date, or time changes)
    IF (OLD.status IS DISTINCT FROM NEW.status OR 
        OLD.date IS DISTINCT FROM NEW.date OR 
        OLD.time IS DISTINCT FROM NEW.time) THEN
      
      notification_title := 'Consulta Alterada';
      
      IF (OLD.status != NEW.status) THEN
        notification_body := format('Estado da consulta de %s alterado: %s → %s', 
                                    COALESCE(appointment_patient_name, 'Paciente'),
                                    OLD.status,
                                    NEW.status);
      ELSIF (OLD.date != NEW.date OR OLD.time != NEW.time) THEN
        notification_body := format('Consulta de %s reagendada para %s às %s', 
                                    COALESCE(appointment_patient_name, 'Paciente'),
                                    TO_CHAR(NEW.date::date, 'DD/MM/YYYY'),
                                    SUBSTRING(NEW.time FROM 1 FOR 5));
      ELSE
        notification_body := format('Consulta de %s foi atualizada', 
                                    COALESCE(appointment_patient_name, 'Paciente'));
      END IF;
    ELSE
      -- No meaningful change, don't create notifications
      RETURN NEW;
    END IF;
  END IF;

  -- Create notifications for all staff users (admin, secretary, doctor roles)
  -- Note: Assuming user_roles table has users with role 'admin'
  -- Adjust if you have secretary/doctor roles
  FOR staff_user IN 
    SELECT DISTINCT user_id 
    FROM public.user_roles 
    WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (
      user_id,
      type,
      appointment_id,
      title,
      body,
      is_read,
      created_at
    ) VALUES (
      staff_user.user_id,
      CASE 
        WHEN TG_OP = 'INSERT' THEN 'appointment_created'
        WHEN TG_OP = 'UPDATE' THEN 'appointment_updated'
      END,
      NEW.id,
      notification_title,
      notification_body,
      false,
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS notify_staff_on_appointment_insert ON public.appointments;
DROP TRIGGER IF EXISTS notify_staff_on_appointment_update ON public.appointments;

-- Create trigger for INSERT
CREATE TRIGGER notify_staff_on_appointment_insert
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.notify_staff_on_appointment_change();

-- Create trigger for UPDATE
CREATE TRIGGER notify_staff_on_appointment_update
AFTER UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.notify_staff_on_appointment_change();

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this to verify triggers are installed:
-- SELECT 
--   tgname AS trigger_name,
--   tgenabled AS is_enabled,
--   tgtype AS trigger_type
-- FROM pg_trigger
-- WHERE tgrelid = 'public.appointments'::regclass
--   AND tgname LIKE 'notify_staff%';
-- ============================================================================
