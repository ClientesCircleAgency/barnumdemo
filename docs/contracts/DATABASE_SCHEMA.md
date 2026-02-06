# Barnum — Database Schema Reference

> **Last updated:** 2026-02-06
> **Source of truth:** `supabase/migrations/` directory
> **Database:** Supabase (PostgreSQL)

---

## Enums

### `app_role`
```sql
'admin' | 'secretary' | 'doctor'
```

### `appointment_status`
```sql
'scheduled' | 'pre_confirmed' | 'confirmed' | 'waiting' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
```

### `request_status`
```sql
'pending' | 'pre_confirmed' | 'suggested' | 'converted' | 'cancelled' | 'expired' | 'rejected'
```

### `whatsapp_workflow_type`
```sql
'pre_confirmation_sent' | 'confirmation_24h' | 'reschedule_prompt' | 'slot_suggestion' | 'request_cancelled'
```

### `whatsapp_workflow_status`
```sql
'pending' | 'sent' | 'delivered' | 'responded' | 'expired' | 'failed' | 'cancelled'
```

---

## Tables

### `patients`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `name` | TEXT | Required |
| `phone` | TEXT | |
| `email` | TEXT | |
| `nif` | TEXT (UNIQUE) | Portuguese tax ID |
| `birth_date` | DATE | Nullable |
| `notes` | TEXT | Nullable |
| `tags` | TEXT[] | Array of tags |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `professionals`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `name` | TEXT | Required |
| `specialty_id` | UUID (FK → specialties) | Nullable |
| `color` | TEXT | Default '#3b82f6' |
| `avatar_url` | TEXT | Nullable |
| `user_id` | UUID (FK → auth.users, UNIQUE) | Links professional to auth account. Nullable |
| `created_at` | TIMESTAMPTZ | |

### `appointments`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `patient_id` | UUID (FK → patients) | Required |
| `professional_id` | UUID (FK → professionals) | Required |
| `specialty_id` | UUID (FK → specialties) | |
| `consultation_type_id` | UUID (FK → consultation_types) | Nullable |
| `date` | DATE | |
| `time` | TIME | |
| `duration` | INTEGER | Minutes. Default 30. Set by secretary per appointment |
| `status` | appointment_status | |
| `notes` | TEXT | |
| `reason` | TEXT | Patient's reason for visit |
| `room_id` | UUID (FK → rooms) | Nullable |
| `cancellation_reason` | TEXT | Nullable. Set when cancelled |
| `final_notes` | TEXT | Nullable. Doctor's notes after consultation |
| `finalized_at` | TIMESTAMPTZ | Nullable. Set when doctor finalizes |
| `review_opt_out` | BOOLEAN | Default false. Patient can opt out of review |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `appointment_requests`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `name` | TEXT | Patient name from form |
| `email` | TEXT | |
| `phone` | TEXT | |
| `nif` | TEXT | |
| `specialty_id` | UUID (FK → specialties) | |
| `assigned_professional_id` | UUID (FK → professionals) | Nullable |
| `preferred_date` | DATE | |
| `preferred_time` | TIME | |
| `reason` | TEXT | Why the patient wants the appointment |
| `estimated_duration` | INTEGER | Nullable. Set by secretary during triage |
| `status` | request_status | |
| `cancel_reason` | TEXT | Nullable |
| `rejection_reason` | TEXT | Nullable. Mandatory when rejecting |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `appointment_suggestions`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `appointment_request_id` | UUID (FK → appointment_requests) | Nullable |
| `patient_id` | UUID (FK → patients) | |
| `suggested_slots` | JSONB | Default '[]'. Array of slot objects |
| `status` | TEXT | Nullable |
| `accepted_slot` | JSONB | Nullable. The slot the patient chose |
| `expires_at` | TIMESTAMPTZ | Nullable |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `consultation_types`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `name` | TEXT | Required |
| `default_duration` | INTEGER | Default 30. **NOT used in UI** — duration is per-request |
| `color` | TEXT | Hex color for display |
| `created_at` | TIMESTAMPTZ | |

### `specialties`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `name` | TEXT | Required |
| `created_at` | TIMESTAMPTZ | |

### `rooms`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `name` | TEXT | Required |
| `specialty_id` | UUID (FK → specialties) | |
| `created_at` | TIMESTAMPTZ | |

### `clinic_settings`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `key` | TEXT (UNIQUE) | Setting key (e.g., 'workingHours', 'generalSettings') |
| `value` | JSONB | Setting value |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `user_roles`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `user_id` | UUID (FK → auth.users) | |
| `role` | app_role | admin, secretary, or doctor |
| `created_at` | TIMESTAMPTZ | |

### `user_profiles`
| Column | Type | Notes |
|--------|------|-------|
| `user_id` | UUID (PK, FK → auth.users) | |
| `full_name` | TEXT | |
| `photo_url` | TEXT | Nullable |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `whatsapp_events`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `event_type` | TEXT | e.g., 'appointment.pre_confirmed' |
| `entity_type` | TEXT | e.g., 'appointment' |
| `entity_id` | UUID | ID of related entity |
| `workflow_id` | UUID | FK to whatsapp_workflows. Nullable |
| `payload` | JSONB | Default '{}'. Data for building message |
| `status` | TEXT | 'pending', 'processed', 'failed' |
| `retry_count` | INTEGER | |
| `max_retries` | INTEGER | |
| `last_error` | TEXT | |
| `scheduled_for` | TIMESTAMPTZ | When to process. Null = immediate |
| `processed_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `whatsapp_workflows`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `appointment_id` | UUID (FK → appointments) | Nullable |
| `appointment_request_id` | UUID (FK → appointment_requests) | Nullable |
| `patient_phone` | TEXT | |
| `workflow_type` | whatsapp_workflow_type | |
| `status` | whatsapp_workflow_status | |
| `scheduled_at` | TIMESTAMPTZ | Nullable |
| `sent_at` | TIMESTAMPTZ | Nullable |
| `response` | TEXT | Patient's response. Nullable |
| `responded_at` | TIMESTAMPTZ | Nullable |
| `message_payload` | JSONB | Nullable |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `whatsapp_action_tokens`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `token` | TEXT (UNIQUE) | Secure token for action URLs |
| `action_type` | TEXT | 'confirm', 'cancel', 'reschedule' |
| `appointment_id` | UUID (FK → appointments) | |
| `patient_id` | UUID (FK → patients) | |
| `workflow_id` | UUID (FK → whatsapp_workflows) | Nullable |
| `metadata` | JSONB | Nullable |
| `used_at` | TIMESTAMPTZ | Null if not yet used |
| `expires_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | |

### `notifications`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `user_id` | UUID (FK → auth.users) | Nullable |
| `type` | TEXT | |
| `appointment_id` | UUID (FK → appointments) | Nullable |
| `title` | TEXT | |
| `body` | TEXT | Nullable |
| `is_read` | BOOLEAN | Default false |
| `created_at` | TIMESTAMPTZ | |

### `waitlist`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `patient_id` | UUID (FK → patients) | |
| `specialty_id` | UUID (FK → specialties) | |
| `professional_id` | UUID (FK → professionals) | |
| `time_preference` | TEXT | |
| `preferred_dates` | TEXT[] | |
| `priority` | TEXT | |
| `sort_order` | INTEGER | |
| `reason` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

### `contact_messages`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `name` | TEXT | |
| `email` | TEXT | |
| `phone` | TEXT | |
| `message` | TEXT | |
| `is_read` | BOOLEAN | Default false |
| `created_at` | TIMESTAMPTZ | |

### `appointment_notes`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `appointment_id` | UUID (FK → appointments) | |
| `author_user_id` | UUID (FK → auth.users) | |
| `note` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

### `desistências`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `patient_id` | UUID (FK → patients) | |
| `appointment_request_id` | UUID (FK → appointment_requests) | Nullable |
| `appointment_id` | UUID (FK → appointments) | Nullable |
| `reason` | TEXT | |
| `created_by_user_id` | UUID (FK → auth.users) | |
| `notes` | TEXT | Nullable |
| `created_at` | TIMESTAMPTZ | |

---

## Key Functions

| Function | Purpose |
|----------|---------|
| `has_role(user_id UUID, role app_role)` | Returns boolean — check if user has specific role |
| `create_whatsapp_event(...)` | Insert event into whatsapp_events outbox |
| `generate_action_token(...)` | Create secure token for patient action URLs |
| `validate_action_token(token TEXT)` | Validate token and return associated data |
| `mark_token_used(token TEXT)` | Mark action token as used |
| `update_updated_at_column()` | Trigger function to auto-update `updated_at` |

---

## DB Triggers (WhatsApp Automations)

| Trigger | Table | When | Creates |
|---------|-------|------|---------|
| `trigger_appointment_pre_confirmation` | appointments | AFTER INSERT (status in scheduled/pre_confirmed/confirmed) | workflow + event `appointment.pre_confirmed` |
| `trigger_appointment_no_show_reschedule` | appointments | AFTER UPDATE (status → no_show) | workflow + event `appointment.no_show_reschedule` |
| `trigger_appointment_review_reminder` | appointments | AFTER UPDATE (finalized_at NULL→NOT NULL, review_opt_out=false) | workflow + event `appointment.review_reminder` (scheduled 2h later) |
| `trigger_appointment_request_suggestion` | appointment_requests | AFTER INSERT | Empty appointment_suggestions record |
| `trigger_send_appointment_suggestion` | appointment_suggestions | AFTER UPDATE (suggested_slots empty→populated) | workflow + event `appointment.suggestion_ready` |
| `notify_staff_on_appointment_insert` | appointments | AFTER INSERT | Notification for all staff |
| `notify_staff_on_appointment_update` | appointments | AFTER UPDATE | Notification for all staff |
