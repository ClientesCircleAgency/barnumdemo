# FRONTEND_ENUMS_AND_TYPES.md

Generated From:** Codebase Analysis  
**Purpose:** Document ALL TypeScript types, enums, interfaces, status arrays, and validation schemas  
**Source:** `src/types/*.ts`, `src/hooks/*.ts`, `src/components/*.tsx`

---

## GENERATED SUPABASE TYPES

### Source: `src/integrations/supabase/types.ts`

#### Enums from Database

```typescript
// Lines 544-556
export type Enums = {
  app_role: "admin" | "user"
  
  appointment_status:
    | "scheduled"
    | "confirmed"
    | "waiting"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "no_show"
    | "pre_confirmed"
  
  time_preference: "morning" | "afternoon" | "any"
  
  waitlist_priority: "low" | "medium" | "high"
}
```

#### Enum Constants Array
```typescript
// Lines 680-698
export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      appointment_status: [
        "scheduled",
        "confirmed",
        "waiting",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
        "pre_confirmed",
      ],
      time_preference: ["morning", "afternoon", "any"],
      waitlist_priority: ["low", "medium", "high"],
    },
  },
} as const
```

---

## EXPORTED TYPE ALIASES

### Source: `src/types/database.ts`

#### Table Row Types (for reading)
```typescript
// Lines 4-11
export type SpecialtyRow = Database['public']['Tables']['specialties']['Row'];
export type ProfessionalRow = Database['public']['Tables']['professionals']['Row'];
export type ConsultationTypeRow = Database['public']['Tables']['consultation_types']['Row'];
export type RoomRow = Database['public']['Tables']['rooms']['Row'];
export type PatientRow = Database['public']['Tables']['patients']['Row'];
export type AppointmentRow = Database['public']['Tables']['appointments']['Row'];
export type WaitlistRow = Database['public']['Tables']['waitlist']['Row'];
export type ClinicSettingsRow = Database['public']['Tables']['clinic_settings']['Row'];
```

#### Insert Types (for creating)
```typescript
// Lines 14-21
export type SpecialtyInsert = Database['public']['Tables']['specialties']['Insert'];
export type ProfessionalInsert = Database['public']['Tables']['professionals']['Insert'];
export type ConsultationTypeInsert = Database['public']['Tables']['consultation_types']['Insert'];
export type RoomInsert = Database['public']['Tables']['rooms']['Insert'];
export type PatientInsert = Database['public']['Tables']['patients']['Insert'];
export type AppointmentInsert = Database['public']['Tables']['appointments']['Insert'];
export type WaitlistInsert = Database['public']['Tables']['waitlist']['Insert'];
export type ClinicSettingsInsert = Database['public']['Tables']['clinic_settings']['Insert'];
```

#### Update Types (for updating)
```typescript
// Lines 24-31
export type SpecialtyUpdate = Database['public']['Tables']['specialties']['Update'];
export type ProfessionalUpdate = Database['public']['Tables']['professionals']['Update'];
export type ConsultationTypeUpdate = Database['public']['Tables']['consultation_types']['Update'];
export type RoomUpdate = Database['public']['Tables']['rooms']['Update'];
export type PatientUpdate = Database['public']['Tables']['patients']['Update'];
export type AppointmentUpdate = Database['public']['Tables']['appointments']['Update'];
export type WaitlistUpdate = Database['public']['Tables']['waitlist']['Update'];
export type ClinicSettingsUpdate = Database['public']['Tables']['clinic_settings']['Update'];
```

#### Enum Types
```typescript
// Lines 34-36
export type AppointmentStatus = Database['public']['Enums']['appointment_status'];
export type WaitlistPriority = Database['public']['Enums']['waitlist_priority'];
export type TimePreference = Database['public']['Enums']['time_preference'];
```

---

## CUSTOM INTERFACES (Not Auto-Generated)

### AppointmentRequest Interface
**Source:** `src/hooks/useAppointmentRequests.ts:4-20`

```typescript
export interface AppointmentRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  nif: string;
  specialty_id: string; // 🔴 Field difference - see notes
  reason: string; // 🔴 Field difference - see notes
  preferred_date: string;
  preferred_time: string;
  status: 'pending' | 'approved' | 'rejected' | 'converted';
  notes: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  processed_by: string | null;
}

export type AppointmentRequestInsert = Omit<
  AppointmentRequest, 
  'id' | 'status' | 'created_at' | 'updated_at' | 'processed_at' | 'processed_by' | 'notes'
> & { notes?: string };
```

**Status Values:**
- `'pending'` (default)
- `'approved'`
- `'rejected'`
- `'converted'`

---

### WhatsappWorkflow Interface
**Source:** `src/hooks/useWhatsappWorkflows.ts:5-19`

```typescript
export interface WhatsappWorkflow {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  phone: string;
  workflow_type: 'confirmation_24h' | 'review_reminder' | 'availability_suggestion';
  status: 'pending' | 'sent' | 'delivered' | 'responded' | 'expired' | 'cancelled';
  scheduled_at: string;
  sent_at: string | null;
  response: string | null;
  responded_at: string | null;
  message_payload: Json | null;
  created_at: string;
  updated_at: string;
}
```

**Workflow Type Values:**
- `'confirmation_24h'`
- `'review_reminder'`
- `'availability_suggestion'`

**Status Values:**
- `'pending'`
- `'sent'`
- `'delivered'`
- `'responded'`
- `'expired'`
- `'cancelled'`

---

### WhatsappWorkflowInsert Interface
**Source:** `src/hooks/useWhatsappWorkflows.ts:21-28`

```typescript
export interface WhatsappWorkflowInsert {
  appointment_id?: string | null;
  patient_id: string;
  phone: string;
  workflow_type: string; // Note: string not literal union
  scheduled_at: string;
  message_payload?: Json;
}
```

---

### ClinicSetting Interface
**Source:** `src/hooks/useSettings.ts:5-10`

```typescript
interface ClinicSetting {
  id: string;
  key: string;
  value: Json; // Can be any JSON value
  updated_at: string;
}
```

---

### Notification Interface
**Source:** `src/hooks/useNotifications.ts:6-15`

```typescript
export interface Notification {
  id: string;
  user_id: string;
  type: string; // Free text, not enum
  appointment_id: string | null;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}
```

---

## FORM VALIDATION SCHEMAS (Zod)

### Appointment Request Form Schema
**Source:** `src/components/AppointmentSection.tsx:31-40`

```typescript
const appointmentSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100),
  email: z.string()
    .email('Email inválido')
    .max(255),
  phone: z.string()
    .min(9, 'Telefone inválido')
    .max(20),
  nif: z.string()
    .length(9, 'NIF deve ter 9 dígitos')
    .regex(/^\d+$/, 'NIF deve conter apenas números'),
  serviceType: z.enum(['dentaria', 'rejuvenescimento'], { 
    required_error: 'Selecione o tipo de consulta' 
  }),
  reason: z.string()
    .min(10, 'Por favor descreva o motivo da consulta (mínimo 10 caracteres)'),
  preferredDate: z.string()
    .min(1, 'Selecione uma data'),
  preferredTime: z.string()
    .min(1, 'Selecione uma hora'),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;
```

**Service Type Enum:**
- `'dentaria'`
- `'rejuvenescimento'`

🔴 **MISMATCH:** Form uses `serviceType` but sends `specialty_id` to database

---

### Contact Message Form Schema
**Source:** `src/components/ContactSection.tsx:14-19`

```typescript
const contactSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100),
  email: z.string()
    .email('Email inválido')
    .max(255),
  phone: z.string()
    .min(9, 'Telefone inválido')
    .max(20),
  message: z.string()
    .min(10, 'Mensagem deve ter pelo menos 10 caracteres')
    .max(1000),
});

type ContactFormData = z.infer<typeof contactSchema>;
```

---

## HARDCODED VALUES

### Specialty IDs Mapping
**Source:** `src/components/AppointmentSection.tsx:68-72`

```typescript
const SPECIALTY_IDS = {
  dentaria: '22222222-2222-2222-2222-222222222222',
  rejuvenescimento: '11111111-1111-1111-1111-111111111111',
};
```

**Usage:**
```typescript
specialty_id: SPECIALTY_IDS[data.serviceType]
```

**Risk:** Breaks if UUID values change in database

---

### Time Slots Array
**Source:** `src/components/AppointmentSection.tsx:44-47`

```typescript
const timeSlots = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', 
  '17:00', '17:30', '18:00', '18:30',
];
```

**Purpose:** Dropdown options for `preferred_time` field

---

## SUPABASE TABLE SCHEMAS (As Understood by Frontend)

### `appointment_requests` Table Contract
**Source:** `src/integrations/supabase/types.ts:17-70`

```typescript
Row: {
  id: string;
  name: string;
  email: string;
  phone: string;
  nif: string;
  specialty_id: string; // UUID
  reason: string;
  preferred_date: string; // DATE
  preferred_time: string; // TIME
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  processed_by: string | null;
}

Insert: {
  name: string;
  email: string;
  phone: string;
  nif: string;
  specialty_id: string;
  reason: string;
  preferred_date: string;
  preferred_time: string;
  status?: string; // Defaults to 'pending'
  notes?: string | null;
  // Other fields auto-generated
}
```

---

### `appointments` Table Contract
**Source:** `src/integrations/supabase/types.ts:71-154`

```typescript
Row: {
  id: string;
  patient_id: string; // UUID
  professional_id: string; // UUID
  specialty_id: string; // UUID
  consultation_type_id: string; // UUID
  room_id: string | null; // UUID
  date: string; // DATE
  time: string; // TIME
  duration: number; // minutes
  status: AppointmentStatus; // Enum
  notes: string | null;
  created_at: string;
  updated_at: string;
}

Insert: {
  patient_id: string; // Required
  professional_id: string; // Required
  specialty_id: string; // Required
  consultation_type_id: string; // Required
  date: string; // Required
  time: string; // Required
  duration?: number; // Default: 30
  status?: AppointmentStatus; // Default: 'scheduled'
  notes?: string | null;
  room_id?: string | null;
}
```

---

### `whatsapp_workflows` Table Contract
**Source:** `src/integrations/supabase/types.ts:474-529`

```typescript
Row: {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  phone: string;
  workflow_type: string;
  status: string;
  scheduled_at: string;
  sent_at: string | null;
  response: string | null;
  responded_at: string | null;
  message_payload: Json | null;
  created_at: string;
  updated_at: string;
}

Insert: {
  patient_id: string; // Required
  phone: string; // Required
  workflow_type: string; // Required
  scheduled_at: string; // Required
  appointment_id?: string | null;
  message_payload?: Json | null;
  status?: string; // Default: 'pending'
}
```

---

### `contact_messages` Table Contract
**Source:** `src/integrations/supabase/types.ts:200-229`

```typescript
Row: {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  is_read: boolean; // Note: field name is is_read not status
  created_at: string;
}

Insert: {
  name: string;
  email: string;
  phone: string;
  message: string;
  is_read?: boolean; // Default: false
}
```

---

### `patients` Table Contract
**Source:** `src/integrations/supabase/types.ts:271-309`

```typescript
Row: {
  id: string;
  nif: string; // Unique
  name: string;
  phone: string;
  email: string | null;
  birth_date: string | null; // DATE
  notes: string | null;
  tags: string[] | null; // Array
  created_at: string;
  updated_at: string;
}

Insert: {
  nif: string; // Required
  name: string; // Required
  phone: string; // Required
  email?: string | null;
  birth_date?: string | null;
  notes?: string | null;
  tags?: string[] | null;
}
```

---

### `waitlist` Table Contract
**Source:** `src/integrations/supabase/types.ts:413-473`

```typescript
Row: {
  id: string;
  patient_id: string;
  specialty_id: string | null;
  professional_id: string | null;
  time_preference: TimePreference; // Enum
  preferred_dates: string[] | null; // Array of DATEs
  priority: WaitlistPriority; // Enum
  sort_order: number;
  reason: string | null;
  created_at: string;
}

Insert: {
  patient_id: string; // Required
  specialty_id?: string | null;
  professional_id?: string | null;
  time_preference?: TimePreference; // Default: 'any'
  preferred_dates?: string[] | null;
  priority?: WaitlistPriority; // Default: 'medium'
  sort_order?: number; // Default: 0
  reason?: string | null;
}
```

---

## TYPE MAPPING NOTES

### Fields with Potential Mismatches

| Component Field | Database Field | Note |
|----------------|----------------|------|
| `serviceType` | `specialty_id` | 🔴 Form field name differs from DB column |
| `preferredDate` | `preferred_date` | ✅ Matches (camelCase→snake_case) |
| `preferredTime` | `preferred_time` | ✅ Matches (camelCase→snake_case) |

### Status Enums Used Differently

| Table | Frontend Uses | Schema Allows |
|-------|--------------|---------------|
| `appointment_requests.status` | `'pending' \| 'approved' \| 'rejected' \| 'converted'` | Same (TEXT with CHECK) |
| `appointments.status` | AppointmentStatus enum | ✅ Same |
| `whatsapp_workflows.status` | `'pending' \| 'sent' \| 'delivered' \| 'responded' \| 'expired' \| 'cancelled'` | string (no enum in types.ts) |

---

**END OF DOCUMENT**
