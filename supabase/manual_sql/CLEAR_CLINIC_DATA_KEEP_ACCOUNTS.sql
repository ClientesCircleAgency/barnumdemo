-- Clear operational clinic data while preserving all accounts and staff setup.
-- Keeps: auth.users, public.user_roles, public.user_profiles, public.professionals,
--        public.professional_specialties, public.specialties, public.consultation_types,
--        public.clinic_settings, public.contact_messages.
-- Clears: patients, appointments, appointment requests, waitlists, related notes/suggestions,
--         legacy WhatsApp outbox data, and appointment-linked notifications.

do $$
begin
  -- Remove notifications tied to appointments before deleting appointments.
  if to_regclass('public.notifications') is not null then
    delete from public.notifications
    where appointment_id is not null;
  end if;

  -- Legacy / optional operational tables from older schema versions.
  if to_regclass('public.appointment_notes') is not null then
    delete from public.appointment_notes;
  end if;

  if to_regclass('public.appointment_suggestions') is not null then
    delete from public.appointment_suggestions;
  end if;

  if to_regclass('public.waitlist') is not null then
    delete from public.waitlist;
  end if;

  if to_regclass('public.whatsapp_action_tokens') is not null then
    delete from public.whatsapp_action_tokens;
  end if;

  if to_regclass('public.whatsapp_events') is not null then
    delete from public.whatsapp_events;
  end if;

  if to_regclass('public.whatsapp_workflows') is not null then
    delete from public.whatsapp_workflows;
  end if;

  if to_regclass('public."desistências"') is not null then
    delete from public."desistências";
  end if;

  -- Current core operational data.
  if to_regclass('public.appointments') is not null then
    delete from public.appointments;
  end if;

  if to_regclass('public.appointment_requests') is not null then
    delete from public.appointment_requests;
  end if;

  if to_regclass('public.patients') is not null then
    delete from public.patients;
  end if;
end $$;
