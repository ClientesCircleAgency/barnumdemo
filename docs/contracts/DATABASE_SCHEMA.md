# Barnum — Database Schema Reference

> **Last updated:** 2026-03-12
> **Source of truth:** Remote Supabase (`oziejxqmghwmtjufstfp`)
> **Database:** Supabase (PostgreSQL)

---

## Enums

### `app_role`
```sql
'admin' | 'secretary' | 'doctor'
```

### `appointment_status`
```sql
'confirmed' | 'waiting' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
```

### `request_status`
```sql
'pending' | 'pre_confirmed' | 'suggested' | 'converted' | 'cancelled' | 'expired' | 'rejected'
```

---

## Tables

### `patients`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `name` | TEXT | Required |
| `phone` | TEXT | Required |
| `email` | TEXT | Nullable |
| `nif` | TEXT (UNIQUE) | Portuguese tax ID |
| `birth_date` | DATE | Nullable |
| `notes` | TEXT | Nullable |
| `tags` | TEXT[] | Array of tags. Nullable |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-updated by trigger |

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
| `professional_name` | TEXT | Nullable. Denormalized from professionals.name via trigger. Included in n8n webhook payload |
| `specialty_id` | UUID (FK → specialties) | Required |
| `consultation_type_id` | UUID (FK → consultation_types) | Nullable |
| `date` | DATE | |
| `time` | TIME | |
| `duration` | INTEGER | Minutes. Default 30 |
| `status` | appointment_status | Default 'confirmed' |
| `notes` | TEXT | Nullable |
| `reason` | TEXT | Nullable. Patient's reason for visit |
| `room_id` | UUID | Nullable. Orphan column (rooms table was dropped) |
| `cancellation_reason` | TEXT | Nullable. Set when cancelled |
| `final_notes` | TEXT | Nullable. Doctor's notes after consultation |
| `finalized_at` | TIMESTAMPTZ | Nullable. Set when doctor finalizes |
| `review_opt_out` | BOOLEAN | Default false |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-updated by trigger |

### `appointment_requests`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `name` | TEXT | Patient name from form |
| `email` | TEXT | Required |
| `phone` | TEXT | Required |
| `nif` | TEXT | Required |
| `specialty_id` | UUID (FK → specialties) | Required |
| `assigned_professional_id` | UUID (FK → professionals) | Nullable |
| `professional_name` | TEXT | Nullable. Denormalized from professionals.name via trigger when assigned_professional_id is set |
| `preferred_date` | DATE | |
| `preferred_time` | TIME | |
| `reason` | TEXT | Required |
| `estimated_duration` | INTEGER | Nullable. Set by secretary during triage |
| `status` | request_status | Default 'pending' |
| `cancel_reason` | TEXT | Nullable |
| `rejection_reason` | TEXT | Nullable. Set when rejecting |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-updated by trigger |

### `appointment_suggestions`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `appointment_request_id` | UUID | Nullable |
| `patient_id` | UUID | Required |
| `suggested_slots` | JSONB | Default '[]'. Array of slot objects |
| `status` | TEXT | Nullable. Default 'pending' |
| `accepted_slot` | JSONB | Nullable. The slot the patient chose |
| `expires_at` | TIMESTAMPTZ | Default now() + 7 days |
| `created_at` | TIMESTAMPTZ | Nullable |
| `updated_at` | TIMESTAMPTZ | Nullable |

### `consultation_types`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `name` | TEXT | Required |
| `default_duration` | INTEGER | Default 30 |
| `color` | TEXT | Nullable. Hex color for display |
| `specialty_id` | UUID (FK → specialties) | Nullable. Links type to a specialty |
| `created_at` | TIMESTAMPTZ | |

### `specialties`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `name` | TEXT | Required |
| `created_at` | TIMESTAMPTZ | |

### `clinic_settings`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `key` | TEXT (UNIQUE) | Setting key (e.g., 'workingHours', 'generalSettings') |
| `value` | JSONB | Setting value |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-updated by trigger |

### `user_roles`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `user_id` | UUID (FK → auth.users) | |
| `role` | app_role | admin, secretary, or doctor |
| `created_at` | TIMESTAMPTZ | Nullable |

UNIQUE constraint on (`user_id`, `role`).

### `user_profiles`
| Column | Type | Notes |
|--------|------|-------|
| `user_id` | UUID (PK, FK → auth.users) | |
| `full_name` | TEXT | Required |
| `photo_url` | TEXT | Nullable |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-updated by trigger |

### `notifications`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `user_id` | UUID (FK → auth.users) | Nullable |
| `type` | TEXT | |
| `appointment_id` | UUID (FK → appointments) | Nullable |
| `title` | TEXT | Required |
| `body` | TEXT | Nullable |
| `is_read` | BOOLEAN | Default false |
| `created_at` | TIMESTAMPTZ | |

### `contact_messages`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `name` | TEXT | Required |
| `email` | TEXT | Required |
| `phone` | TEXT | Nullable |
| `message` | TEXT | Required |
| `is_read` | BOOLEAN | Default false |
| `created_at` | TIMESTAMPTZ | |

---

## Key Functions

| Function | Purpose |
|----------|---------|
| `has_role(_user_id UUID, _role app_role)` | Returns boolean — check if user has specific role |
| `update_updated_at_column()` | Trigger function to auto-update `updated_at` |
| `notify_on_appointment_change()` | Trigger function for realtime notifications |
| `notify_staff_on_appointment_change()` | Trigger function to create staff notifications |

---

## DB Triggers

| Trigger | Table | When | Action |
|---------|-------|------|--------|
| `N8N convert pacient` | appointment_requests | AFTER UPDATE | Webhook to n8n for patient conversion |
| `update_appointment_requests_updated_at` | appointment_requests | BEFORE UPDATE | Auto-update `updated_at` |
| `notify_staff_on_appointment_insert` | appointments | AFTER INSERT | Create notification for staff |
| `notify_staff_on_appointment_update` | appointments | AFTER UPDATE | Create notification for staff |
| `trg_notify_appointment_change` | appointments | AFTER INSERT/UPDATE | Realtime notification via pg_notify |
| `update_appointments_updated_at` | appointments | BEFORE UPDATE | Auto-update `updated_at` |
| `update_clinic_settings_updated_at` | clinic_settings | BEFORE UPDATE | Auto-update `updated_at` |
| `update_patients_updated_at` | patients | BEFORE UPDATE | Auto-update `updated_at` |
| `update_user_profiles_updated_at` | user_profiles | BEFORE UPDATE | Auto-update `updated_at` |

---

## Unique Constraints

| Table | Column(s) | Constraint Name |
|-------|-----------|-----------------|
| `clinic_settings` | `key` | `clinic_settings_key_key` |
| `patients` | `nif` | `patients_nif_key` |
| `professionals` | `user_id` | `professionals_user_id_key` |
| `user_roles` | `user_id`, `role` | `user_roles_user_id_role_key` |

---

## WhatsApp Automations

WhatsApp automations are handled via **Supabase Database Webhooks** + **n8n**, not via in-database outbox tables. The old outbox pattern (`whatsapp_events`, `whatsapp_workflows`) was removed in migration `20260302210000_simplify_schema.sql`.

The n8n partner uses **appointment status changes** as triggers for WhatsApp messages. See `docs/contracts/WHATSAPP_AUTOMATIONS_SPEC.md` for details.
