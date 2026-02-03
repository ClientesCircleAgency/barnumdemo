
# SUPABASE_BACKEND_SNAPSHOT.md
Fonte: Outputs manuais fornecidos pelo utilizador (schema, enums, RLS, funções)

## Tabelas e Colunas (public)
(Resumo completo colado pelo utilizador)

appointment_requests:
- id (uuid, PK)
- name (text, NOT NULL)
- email (text, NOT NULL)
- phone (text, NOT NULL)
- nif (text, NOT NULL)
- specialty_id (uuid, NOT NULL)
- preferred_date (date, NOT NULL)
- preferred_time (time, NOT NULL)
- reason (text, NOT NULL)
- estimated_duration (int, nullable)
- status (request_status, NOT NULL, default pending)
- assigned_professional_id (uuid, nullable)
- cancel_reason (text, nullable)
- created_at, updated_at

appointments:
- id
- patient_id
- professional_id
- specialty_id
- consultation_type_id
- date
- time
- duration
- status (appointment_status)
- reason
- notes
- room_id
- created_at, updated_at

patients, professionals, rooms, specialties, user_profiles, user_roles, waitlist,
whatsapp_action_tokens, whatsapp_events, whatsapp_workflows, notifications,
appointment_notes, appointment_suggestions, clinic_settings, consultation_types,
contact_messages

(Ver conversa para lista completa original)

## ENUMs
appointment_status:
scheduled, pre_confirmed, confirmed, waiting, in_progress, completed, cancelled, no_show

request_status:
pending, pre_confirmed, suggested, converted, cancelled, expired, rejected

whatsapp_workflow_status:
pending, sent, delivered, responded, expired, failed, cancelled

whatsapp_workflow_type:
pre_confirmation_sent, confirmation_24h, reschedule_prompt, slot_suggestion, request_cancelled

time_preference:
morning, afternoon, any

waitlist_priority:
low, medium, high

app_role:
admin, secretary, doctor

## RLS (Row Level Security)
RLS DISABLED:
- appointment_suggestions
- notifications
- whatsapp_action_tokens
- whatsapp_events

RLS ENABLED:
- appointment_notes
- appointment_requests
- appointments
- clinic_settings
- consultation_types
- contact_messages
- patients
- professionals
- rooms
- specialties
- user_profiles
- user_roles
- waitlist
- whatsapp_workflows

## Funções (3.3)
- create_whatsapp_event
- generate_action_token
- has_role
- mark_token_used
- notify_on_appointment_change
- notify_staff_on_appointment_change
- trigger_no_show
- trigger_pre_confirmation
- trigger_review
- update_updated_at_column
- validate_action_token

Este ficheiro serve como snapshot manual da fonte de verdade do backend Supabase.
