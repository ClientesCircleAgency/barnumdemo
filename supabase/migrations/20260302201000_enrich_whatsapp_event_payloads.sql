-- Enrich whatsapp_events payload with full patient + appointment data
-- so n8n has everything needed to compose and send WhatsApp messages

-- Replace create_whatsapp_event with a version that builds a rich payload
-- by looking up patient, professional, specialty, and consultation type data
CREATE OR REPLACE FUNCTION public.create_whatsapp_event(
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_workflow_id uuid DEFAULT NULL::uuid,
  p_scheduled_for timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_event_id uuid;
  v_payload jsonb;
  v_patient record;
  v_professional record;
  v_specialty record;
  v_consult_type record;
  v_appointment record;
BEGIN
  -- Build payload based on entity type
  IF p_entity_type = 'appointment' THEN
    -- Fetch appointment
    SELECT * INTO v_appointment FROM public.appointments WHERE id = p_entity_id;

    IF v_appointment IS NOT NULL THEN
      -- Fetch patient
      SELECT id, name, phone, email, nif
        INTO v_patient
        FROM public.patients WHERE id = v_appointment.patient_id;

      -- Fetch professional
      SELECT id, name, color
        INTO v_professional
        FROM public.professionals WHERE id = v_appointment.professional_id;

      -- Fetch specialty
      SELECT id, name
        INTO v_specialty
        FROM public.specialties WHERE id = v_appointment.specialty_id;

      -- Fetch consultation type
      SELECT id, name
        INTO v_consult_type
        FROM public.consultation_types WHERE id = v_appointment.consultation_type_id;

      v_payload := jsonb_build_object(
        'event_type', p_event_type,
        'entity_id', p_entity_id,
        'created_at', now(),
        'appointment', jsonb_build_object(
          'id', v_appointment.id,
          'date', v_appointment.date,
          'time', v_appointment.time,
          'duration', v_appointment.duration,
          'status', v_appointment.status::text,
          'notes', COALESCE(v_appointment.notes, ''),
          'final_notes', COALESCE(v_appointment.final_notes, ''),
          'reason', COALESCE(v_appointment.reason, '')
        ),
        'patient', jsonb_build_object(
          'id', v_patient.id,
          'name', COALESCE(v_patient.name, ''),
          'phone', COALESCE(v_patient.phone, ''),
          'email', COALESCE(v_patient.email, ''),
          'nif', COALESCE(v_patient.nif, '')
        ),
        'professional', jsonb_build_object(
          'id', v_professional.id,
          'name', COALESCE(v_professional.name, '')
        ),
        'specialty', jsonb_build_object(
          'id', v_specialty.id,
          'name', COALESCE(v_specialty.name, '')
        ),
        'consultation_type', jsonb_build_object(
          'id', v_consult_type.id,
          'name', COALESCE(v_consult_type.name, '')
        )
      );
    ELSE
      -- Fallback if appointment not found
      v_payload := jsonb_build_object(
        'event_type', p_event_type,
        'entity_id', p_entity_id,
        'created_at', now(),
        'error', 'appointment_not_found'
      );
    END IF;

  ELSE
    -- Non-appointment entities: minimal payload
    v_payload := jsonb_build_object(
      'event_type', p_event_type,
      'entity_type', p_entity_type,
      'entity_id', p_entity_id,
      'created_at', now()
    );
  END IF;

  INSERT INTO public.whatsapp_events (
    event_type, entity_type, entity_id, workflow_id, payload, scheduled_for
  )
  VALUES (
    p_event_type, p_entity_type, p_entity_id, p_workflow_id, v_payload, p_scheduled_for
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$function$;
