# Supabase Backend Snapshot (Reconstruído)

⚠️ Este documento foi reconstruído a partir dos outputs que você colou neste chat. Pode não estar 100% completo, mas representa a melhor fotografia possível do backend atual.

---
## TABELAS E COLUNAS (PUBLIC)

### appointment_requests
- id (uuid, not null)
- name (text, not null)
- email (text, not null)
- phone (text, not null)
- nif (text, not null)
- specialty_id (uuid, not null)
- preferred_date (date, not null)
- preferred_time (time, not null)
- reason (text, not null)
- estimated_duration (int, null)
- status (request_status, not null, default 'pending')
- assigned_professional_id (uuid, null)
- cancel_reason (text, null)
- created_at (timestamptz, not null)
- updated_at (timestamptz, not null)

### appointments
- id (uuid)
- patient_id (uuid, not null)
- professional_id (uuid, not null)
- specialty_id (uuid, not null)
- consultation_type_id (uuid, null)
- date (date, not null)
- time (time, not null)
- duration (int, not null, default 30)
- status (appointment_status, not null, default 'scheduled')
- reason (text, null)
- notes (text, null)
- room_id (uuid, null)
- created_at, updated_at

### patients
- id, nif, name, phone (not null)
- email, birth_date, notes, tags (optional)
- created_at, updated_at

### professionals
- id, name, color
- user_id (uuid, null)
- specialty_id (uuid, null)

### specialties
- id, name

### consultation_types
- id, name, default_duration, color

### rooms
- id, name, specialty_id

### whatsapp_workflows
- id
- appointment_id (uuid, null)
- appointment_request_id (uuid, null)
- patient_phone (text, not null)
- workflow_type (whatsapp_workflow_type)
- status (whatsapp_workflow_status, default 'pending')
- scheduled_at, sent_at, responded_at
- response (text)
- message_payload (jsonb)

### whatsapp_events
- id
- event_type (text)
- entity_type (text)
- entity_id (uuid)
- workflow_id (uuid, null)
- payload (jsonb)
- status (text, default 'pending')
- retry_count, max_retries, last_error
- scheduled_for, processed_at

### whatsapp_action_tokens
- id
- token (text)
- action_type (text)
- appointment_id (uuid, null)
- patient_id (uuid)
- workflow_id (uuid, null)
- metadata (jsonb)
- used_at
- expires_at

### appointment_notes
- id
- appointment_id
- author_user_id
- note
- created_at

### notifications
- id
- user_id
- type
- appointment_id
- title
- body
- is_read
- created_at

### waitlist
- id
- patient_id
- specialty_id
- professional_id
- time_preference (enum)
- preferred_dates (array)
- priority (enum)
- sort_order
- reason
- created_at

---
## ENUMS

appointment_status:
- scheduled
- pre_confirmed
- confirmed
- waiting
- in_progress
- completed
- cancelled
- no_show

request_status:
- pending
- pre_confirmed
- suggested
- converted
- cancelled
- expired
- rejected

whatsapp_workflow_status:
- pending
- sent
- delivered
- responded
- expired
- failed
- cancelled

whatsapp_workflow_type:
- pre_confirmation_sent
- confirmation_24h
- reschedule_prompt
- slot_suggestion
- request_cancelled

time_preference:
- morning
- afternoon
- any

waitlist_priority:
- low
- medium
- high

app_role:
- admin
- secretary
- doctor

---
## FUNÇÕES IMPORTANTES

- create_whatsapp_event
- generate_action_token
- validate_action_token
- mark_token_used
- has_role

Triggers:
- trigger_pre_confirmation
- trigger_no_show
- trigger_review

---
## RLS (RESUMO)

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

RLS DISABLED:
- appointment_suggestions
- notifications
- whatsapp_action_tokens
- whatsapp_events

---
## OBSERVAÇÕES CRÍTICAS

- appointment_requests.reason é NOT NULL
- Campos como service_type NÃO existem
- Enums são restritos (mismatch causa erros)
- workflows e eventos dependem fortemente de status

---
Documento gerado automaticamente para auditoria frontend/backend.

