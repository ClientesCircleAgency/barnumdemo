# FRONTEND_DB_CONTRACT.md

**Generated From:** Codebase Analysis  
**Purpose:** Document REAL Supabase calls made by  frontend code  
**Source:** `src/hooks/*.ts` files

---

## TABLE: `appointment_requests`

### SELECT - Get All (Admin View)
**File:** `src/hooks/useAppointmentRequests.ts:28-31`  
**Operation:** SELECT
```typescript
.from('appointment_requests')
.select('*')
.order('created_at', { ascending: false })
```
**Expected Columns:** All columns per TypeScript type `AppointmentRequest` (lines 4-20):
- `id`, `name`, `email`, `phone`, `nif`
- `specialty_id` **(see note below)**
- `reason` **(see note below)**
- `preferred_date`, `preferred_time`
- `status`, `notes`, `created_at`, `updated_at`, `processed_at`, `processed_by`

🔴 **MISMATCH DETECTED:** TypeScript interface expects `specialty_id` and `reason` but Supabase generated types show these exist. Frontend sends these fields.

### INSERT - Public Submission
**File:** `src/hooks/useAppointmentRequests.ts:46-48`  
**Operation:** INSERT
```typescript
.from('appointment_requests')
.insert(request) // No .select() - Returns nothing
```
**Payload Sent (`AppointmentRequestInsert` type):**
```typescript
{
  name: string;
  email: string;
  phone: string;
  nif: string;
  specialty_id: string; // UUID
  reason: string;
  preferred_date: string; // DATE format
  preferred_time: string; // TIME format
  notes?: string; // Optional
}
```
**Actual Usage** (from `AppointmentSection.tsx:76-84`):
```typescript
{
  name: data.name,
  email: data.email,
  phone: data.phone,
  nif: data.nif,
  reason: data.reason,
  specialty_id: SPECIALTY_IDS[data.serviceType], // Hardcoded UUIDs
  preferred_date: data.preferredDate,
  preferred_time: data.preferredTime,
}
```
**Hardcoded Values:**
```typescript
// AppointmentSection.tsx:69-72
const SPECIALTY_IDS = {
  dentaria: '22222222-2222-2222-2222-222222222222',
  rejuvenescimento: '11111111-1111-1111-1111-111111111111',
};
```

### UPDATE - Change Status
**File:** `src/hooks/useAppointmentRequests.ts:65-68`  
**Operation:** UPDATE
```typescript
.from('appointment_requests')
.update({ status })
.eq('id', id)
```
**Payload:**
```typescript
{ status: 'pending' | 'approved' | 'rejected' | 'converted' }
```

### DELETE
**File:** `src/hooks/useAppointmentRequests.ts:86-88`  
**Operation:** DELETE
```typescript
.from('appointment_requests')
.delete()
.eq('id', id)
```

---

## TABLE: `appointments`

### SELECT - Get All
**File:** `src/hooks/useAppointments.ts:9-13`  
**Operation:** SELECT
```typescript
.from('appointments')
.select('*')
.order('date', { ascending: true })
.order('time', { ascending: true })
```

### SELECT - By Date
**File:** `src/hooks/useAppointments.ts:27-31`  
**Operation:** SELECT
```typescript
.from('appointments')
.select('*')
.eq('date', date) // date: string (YYYY-MM-DD)
.order('time', { ascending: true })
```

### SELECT - By Patient
**File:** `src/hooks/useAppointments.ts:46-51`  
**Operation:** SELECT
```typescript
.from('appointments')
.select('*')
.eq('patient_id', patientId) // UUID
.order('date', { ascending: false })
.order('time', { ascending: false })
```

### INSERT
**File:** `src/hooks/useAppointments.ts:65-69`  
**Operation:** INSERT
```typescript
.from('appointments')
.insert(appointment)
.select()
.single()
```
**Payload (`AppointmentInsert`)** - per Supabase types (types.ts:87-101):
```typescript
{
  patient_id: string; // UUID (required)
  professional_id: string; // UUID (required)
  specialty_id: string; // UUID (required)
  consultation_type_id: string; // UUID (required)
  date: string; // DATE (required)
  time: string; // TIME (required)
  duration?: number; // Default: 30
  status?: 'scheduled' | 'confirmed' | 'waiting' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'pre_confirmed';
  notes?: string | null;
  room_id?: string | null; //  UUID
}
```

### UPDATE - Full Update
**File:** `src/hooks/useAppointments.ts:85-90`  
**Operation:** UPDATE
```typescript
.from('appointments')
.update(data) // AppointmentUpdate type
.eq('id', id)
.select()
.single()
```

### UPDATE - Status Only
**File:** `src/hooks/useAppointments.ts:106-111`  
**Operation:** UPDATE
```typescript
.from('appointments')
.update({ status })
.eq('id', id)
.select()
.single()
```
**Status Values** (from Supabase types.ts:545-553):
```typescript
type AppointmentStatus = 
  | "scheduled"
  | "confirmed"
  | "waiting"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show"
  | "pre_confirmed"
```

### DELETE
**File:** `src/hooks/useAppointments.ts:127-130`  
**Operation:** DELETE
```typescript
.from('appointments')
.delete()
.eq('id', id)
```

---

## TABLE: `patients`

### SELECT - Get All
**File:** `src/hooks/usePatients.ts:9-12`  
**Operation:** SELECT
```typescript
.from('patients')
.select('*')
.order('name')
```

### SELECT - By ID
**File:** `src/hooks/usePatients.ts:26-30`  
**Operation:** SELECT
```typescript
.from('patients')
.select('*')
.eq('id', id)
.maybeSingle()
```

### SELECT - By NIF
**File:** `src/hooks/usePatients.ts:45-49`  
**Operation:** SELECT
```typescript
.from('patients')
.select('*')
.eq('nif', nif)
.maybeSingle()
```

### INSERT
**File:** `src/hooks/usePatients.ts:63-67`  
**Operation:** INSERT
```typescript
.from('patients')
.insert(patient)
.select()
.single()
```
**Payload (`PatientInsert`)** - per Supabase types (types.ts:284-295):
```typescript
{
  name: string; // Required
  nif: string; // Required, unique
  phone: string; // Required
  email?: string | null;
  birth_date?: string | null; // DATE
  notes?: string | null;
  tags?: string[] | null; // Array
}
```

### UPDATE
**File:** `src/hooks/usePatients.ts:83-88`  
**Operation:** UPDATE
```typescript
.from('patients')
.update(data)
.eq('id', id)
.select()
.single()
```

### DELETE
**File:** `src/hooks/usePatients.ts:105-108`  
**Operation:** DELETE
```typescript
.from('patients')
.delete()
.eq('id', id)
```

---

## TABLE: `professionals`

### SELECT - Get All
**File:** `src/hooks/useProfessionals.ts:9-12`  
**Operation:** SELECT
```typescript
.from('professionals')
.select('*')
.order('name')
```

### INSERT
**File:** `src/hooks/useProfessionals.ts:25-29`  
**Operation:** INSERT
```typescript
.from('professionals')
.insert(professional)
.select()
.single()
```
**Payload (`ProfessionalInsert`)** - per Supabase types (types.ts:319-326):
```typescript
{
  name: string; // Required
  specialty_id?: string | null; // UUID
  color?: string; // Default: '#3b82f6'
  avatar_url?: string | null;
}
```

### UPDATE
**File:** `src/hooks/useProfessionals.ts:45-50`  
**Operation:** UPDATE
```typescript
.from('professionals')
.update(data)
.eq('id', id)
.select()
.single()
```

### DELETE
**File:** `src/hooks/useProfessionals.ts:66-69`  
**Operation:** DELETE
```typescript
.from('professionals')
.delete()
.eq('id', id)
```

---

### UI Flow: Create Professional

**Entry Point:** Settings Page → "Gerir Profissionais" button  
**Component:** `src/components/admin/ManageProfessionalsModal.tsx`  
**Context Layer:** `src/context/ClinicContext.tsx` (lines 309-315)

**User Flow:**
1. Admin clicks "Gerir Profissionais" in Settings
2. Modal opens with list of existing professionals
3. Click "Adicionar Profissional" button
4. Fill form: Name, Specialty (dropdown), Color picker
5. Click "Adicionar"

**Form Validation** (lines 79-82):
```typescript
if (!newForm.name.trim() || !newForm.specialty.trim()) {
  toast.error('Preencha todos os campos');
  return;
}
```

**Specialty Dropdown** (lines 192-206):
```typescript
<Select value={newForm.specialty} onValueChange={(v) => setNewForm({ ...newForm, specialty: v })}>
  <SelectContent>
    {specialties.map((s) => (
      <SelectItem key={s.id} value={s.id}>
        {s.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

**Submit Payload** (lines 84-88 → context line 310-315):
```typescript
addProfessional({
  name: newForm.name.trim(),
  specialty: newForm.specialty.trim(), // This is specialty.id (UUID)
  color: newForm.color,
});

// Mapped to:
{
  name: data.name,
  specialty_id: data.specialty, // UUID from dropdown
  color: data.color,
  avatar_url: data.avatar, // undefined
}
```

**Success Feedback** (line 89-91):
- Toast: "Profissional adicionado"
- Form reset to defaults
- Modal remains open for adding more (isAdding = false)

**Backend Write:**
- Direct Supabase client INSERT via `useProfessionals` hook
- Invalidates React Query cache on success
- No RLS bypass needed (admin context)

---

## TABLE: `consultation_types`

### SELECT - Get All
**File:** `src/hooks/useConsultationTypes.ts:9-12`  
**Operation:** SELECT
```typescript
.from('consultation_types')
.select('*')
.order('name')
```

### INSERT
**File:** `src/hooks/useConsultationTypes.ts:25-29`  
**Operation:** INSERT
```typescript
.from('consultation_types')
.insert(type)
.select()
.single()
```
**Payload (`ConsultationTypeInsert`)** - per Supabase types (types.ts:184-190):
```typescript
{
  name: string; // Required
  default_duration?: number; // Default: 30
  color?: string | null;
}
```

### UPDATE
**File:** `src/hooks/useConsultationTypes.ts:45-50`  
**Operation:** UPDATE
```typescript
.from('consultation_types')
.update(data)
.eq('id', id)
.select()
.single()
```

### DELETE
**File:** `src/hooks/useConsultationTypes.ts:66-69`  
**Operation:** DELETE
```typescript
.from('consultation_types')
.delete()
.eq('id', id)
```

---

## TABLE: `specialties`

### SELECT - Get All
**File:** `src/hooks/useSpecialties.ts:9-12`  
**Operation:** SELECT
```typescript
.from('specialties')
.select('*')
.order('name')
```
**No mutations - Read-only in frontend**

---

## TABLE: `rooms`

### SELECT - Get All
**File:** `src/hooks/useRooms.ts:9-12`  
**Operation:** SELECT
```typescript
.from('rooms')
.select('*')
.order('name')
```
**No mutations - Read-only in frontend**

---

## TABLE: `waitlist`

### SELECT - Get All
**File:** `src/hooks/useWaitlist.ts:9-13`  
**Operation:** SELECT
```typescript
.from('waitlist')
.select('*')
.order('priority', { ascending: false })
.order('sort_order', { ascending: true })
```

### INSERT
**File:** `src/hooks/useWaitlist.ts:26-30`  
**Operation:** INSERT
```typescript
.from('waitlist')
.insert(item)
.select()
.single()
```
**Payload (`WaitlistInsert`)** - per Supabase types (types.ts:426-437):
```typescript
{
  patient_id: string; // UUID, required
  specialty_id?: string | null; // UUID
  professional_id?: string | null; // UUID
  time_preference?: 'morning' | 'afternoon' | 'any'; // Default: 'any'
  preferred_dates?: string[] | null; // Array of DATEs
  priority?: 'low' | 'medium' | 'high'; // Default: 'medium'
  sort_order?: number; // Default: 0
  reason?: string | null;
}
```

### UPDATE
**File:** `src/hooks/useWaitlist.ts:46-51`  
**Operation:** UPDATE
```typescript
.from('waitlist')
.update(data)
.eq('id', id)
.select()
.single()
```

### DELETE
**File:** `src/hooks/useWaitlist.ts:67-70`  
**Operation:** DELETE
```typescript
.from('waitlist')
.delete()
.eq('id', id)
```

---

## TABLE: `whatsapp_workflows`

### SELECT - Get All
**File:** `src/hooks/useWhatsappWorkflows.ts:34-37`  
**Operation:** SELECT
```typescript
.from('whatsapp_workflows')
.select('*')
.order('scheduled_at', { ascending: true })
```

### SELECT - Pending Only
**File:** `src/hooks/useWhatsappWorkflows.ts:49-53`  
**Operation:** SELECT
```typescript
.from('whatsapp_workflows')
.select('*')
.eq('status', 'pending')
.order('scheduled_at', { ascending: true })
```

### INSERT
**File:** `src/hooks/useWhatsappWorkflows.ts:66-70`  
**Operation:** INSERT
```typescript
.from('whatsapp_workflows')
.insert([workflow])
.select()
.single()
```
**Payload (`WhatsappWorkflowInsert`)** - per useWhatsappWorkflows.ts:21-28:
```typescript
{
  patient_id: string; // UUID, required
  phone: string; // Required
  workflow_type: string; // Required - see values below
  scheduled_at: string; // TIMESTAMPTZ, required
  appointment_id?: string | null; // UUID, optional
  message_payload?: Json; // JSONB, optional
}
```
**Workflow Types Used in Code:**
- `'confirmation_24h'` (line 165)
- `'review_reminder'` (line 141)
- `'availability_suggestion'` (mentioned in type definition line 10)

### UPDATE - Status Change
**File:** `src/hooks/useWhatsappWorkflows.ts:97-102`  
**Operation:** UPDATE
```typescript
.from('whatsapp_workflows')
.update(updateData) // Dynamic based on status
.eq('id', id)
.select()
.single()
```
**Update Logic (lines 85-95):**
```typescript
const updateData: Record<string, unknown> = { status };

if (status === 'sent') {
  updateData.sent_at = new Date().toISOString();
}

if (response) {
  updateData.response = response;
  updateData.responded_at = new Date().toISOString();
}
```
**Status Values** (from useWhatsappWorkflows.ts:11):
```typescript
type Status = 'pending' | 'sent' | 'delivered' | 'responded' | 'expired' | 'cancelled'
```

### UPDATE - Cancel by Appointment
**File:** `src/hooks/useWhatsappWorkflows.ts:118-122`  
**Operation:** UPDATE
```typescript
.from('whatsapp_workflows')
.update({ status: 'cancelled' })
.eq('appointment_id', appointmentId)
.eq('status', 'pending')
```

---

## TABLE: `clinic_settings`

### SELECT - Get All (Converted to Object)
**File:** `src/hooks/useSettings.ts:16-28`  
**Operation:** SELECT
```typescript
.from('clinic_settings')
.select('*')
// Then converted to Record<string, Json> keyed by 'key' field
```

### UPSERT Logic - Update or Insert
**File:** `src/hooks/useSettings.ts:39-65`  
**Operations:** SELECT then UPDATE or INSERT
```typescript
// 1. Check existence
.from('clinic_settings')
.select('id')
.eq('key', key)
.maybeSingle()

// 2a. If exists - UPDATE
.from('clinic_settings')
.update({ value })
.eq('key', key)
.select()
.single()

// 2b. If not exists - INSERT
.from('clinic_settings')
.insert([{ key, value }])
.select()
.single()
```
**Payload:**
```typescript
{
  key: string;
  value: Json; // JSONB any valid JSON
}
```

---

## TABLE: `contact_messages`

### SELECT - Get All
**File:** `src/hooks/useContactMessages.ts:22-25`  
**Operation:** SELECT
```typescript
.from('contact_messages')
.select('*')
.order('created_at', { ascending: false })
```

### INSERT - Public Submission
**File:** `src/hooks/useContactMessages.ts:44-48`  
**Operation:** INSERT
```typescript
.from('contact_messages')
.insert(message)
.select()
.single()
```
**Payload** (from ContactSection.tsx:62-67):
```typescript
{
  name: string;
  email: string;
  phone: string;
  message: string;
}
```

### UPDATE - Mark as Read
**File:** `src/hooks/useContactMessages.ts:62-66`  
**Operation:** UPDATE
```typescript
.from('contact_messages')
.update({ is_read: true })
.eq('id', id)
.select()
.single()
```

### UPDATE - Batch Mark Read
**File:** `src/hooks/useContactMessages.ts:84-88`  
**Operation:** UPDATE (multiple rows)
```typescript
.from('contact_messages')
.update({ is_read: true })
.eq('is_read', false)
.select()
```

### DELETE
**File:** `src/hooks/useContactMessages.ts:105-108`  
**Operation:** DELETE
```typescript
.from('contact_messages')
.delete()
.eq('id', id)
```

---

## TABLE: `notifications`

### SELECT - By User
**File:** `src/hooks/useNotifications.ts:27-32`  
**Operation:** SELECT
```typescript
.from('notifications')
.select('*')
.eq('user_id', user.id)
.order('created_at', { ascending: false })
.limit(50)
```

### UPDATE - Mark One as Read
**File:** `src/hooks/useNotifications.ts:83-86`  
**Operation:** UPDATE
```typescript
.from('notifications')
.update({ is_read: true })
.eq('id', notificationId)
```

### UPDATE - Mark All as Read
**File:** `src/hooks/useNotifications.ts:104-108`  
**Operation:** UPDATE (multiple rows)
```typescript
.from('notifications')
.update({ is_read: true })
.eq('user_id', user.id)
.eq('is_read', false)
```

### REALTIME SUBSCRIPTION
**File:** `src/hooks/useNotifications.ts:44-59`  
**Operation:** Realtime channel subscription
```typescript
supabase
  .channel('notifications-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${user.id}`,
  }, callbackfunction)
  .subscribe()
```

---

## SUMMARY OF STATUS/ENUM VALUES USED

### `appointment_requests.status`
- `'pending'` (default)
- `'approved'`
- `'rejected'`
- `'converted'`

### `appointments.status`
-  `'scheduled'`, `'confirmed'`, `'waiting'`, `'in_progress'`, `'completed'`, `'cancelled'`, `'no_show'`, `'pre_confirmed'`

### `whatsapp_workflows.status`
- `'pending'`, `'sent'`, `'delivered'`, `'responded'`, `'expired'`, `'cancelled'`

### `whatsapp_workflows.workflow_type`
- `'confirmation_24h'`
- `'review_reminder'`
- `'availability_suggestion'`

### `waitlist.priority`
- `'low'`, `'medium'` (default), `'high'`

### `waitlist.time_preference`
- `'morning'`, `'afternoon'`, `'any'` (default)

---

**END OF DOCUMENT**
