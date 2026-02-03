


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'secretary',
    'doctor'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."appointment_status" AS ENUM (
    'scheduled',
    'pre_confirmed',
    'confirmed',
    'waiting',
    'in_progress',
    'completed',
    'cancelled',
    'no_show'
);


ALTER TYPE "public"."appointment_status" OWNER TO "postgres";


CREATE TYPE "public"."request_status" AS ENUM (
    'pending',
    'pre_confirmed',
    'suggested',
    'converted',
    'cancelled',
    'expired',
    'rejected'
);


ALTER TYPE "public"."request_status" OWNER TO "postgres";


CREATE TYPE "public"."time_preference" AS ENUM (
    'morning',
    'afternoon',
    'any'
);


ALTER TYPE "public"."time_preference" OWNER TO "postgres";


CREATE TYPE "public"."waitlist_priority" AS ENUM (
    'low',
    'medium',
    'high'
);


ALTER TYPE "public"."waitlist_priority" OWNER TO "postgres";


CREATE TYPE "public"."whatsapp_workflow_status" AS ENUM (
    'pending',
    'sent',
    'delivered',
    'responded',
    'expired',
    'failed',
    'cancelled'
);


ALTER TYPE "public"."whatsapp_workflow_status" OWNER TO "postgres";


CREATE TYPE "public"."whatsapp_workflow_type" AS ENUM (
    'pre_confirmation_sent',
    'confirmation_24h',
    'reschedule_prompt',
    'slot_suggestion',
    'request_cancelled'
);


ALTER TYPE "public"."whatsapp_workflow_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_whatsapp_event"("p_event_type" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_workflow_id" "uuid" DEFAULT NULL::"uuid", "p_scheduled_for" timestamp with time zone DEFAULT "now"()) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO public.whatsapp_events (event_type, entity_type, entity_id, workflow_id, payload, scheduled_for)
  VALUES (p_event_type, p_entity_type, p_entity_id, p_workflow_id, 
          jsonb_build_object('event_type', p_event_type, 'entity_id', p_entity_id, 'created_at', now()), 
          p_scheduled_for)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;


ALTER FUNCTION "public"."create_whatsapp_event"("p_event_type" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_workflow_id" "uuid", "p_scheduled_for" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_action_token"("p_action_type" "text", "p_appointment_id" "uuid", "p_patient_id" "uuid", "p_workflow_id" "uuid" DEFAULT NULL::"uuid", "p_metadata" "jsonb" DEFAULT NULL::"jsonb", "p_expires_in_days" integer DEFAULT 7) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_token text;
BEGIN
  v_token := encode(gen_random_bytes(24), 'base64');
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');
  
  INSERT INTO public.whatsapp_action_tokens (token, action_type, appointment_id, patient_id, workflow_id, metadata, expires_at)
  VALUES (v_token, p_action_type, p_appointment_id, p_patient_id, p_workflow_id, p_metadata, now() + (p_expires_in_days || ' days')::interval);
  
  RETURN v_token;
END;
$$;


ALTER FUNCTION "public"."generate_action_token"("p_action_type" "text", "p_appointment_id" "uuid", "p_patient_id" "uuid", "p_workflow_id" "uuid", "p_metadata" "jsonb", "p_expires_in_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_token_used"("p_token" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.whatsapp_action_tokens SET used_at = now() WHERE token = p_token;
END;
$$;


ALTER FUNCTION "public"."mark_token_used"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_appointment_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  notif_title text;
  notif_body text;
  notif_type text;
begin
  if tg_op = 'INSERT' then
    notif_type := 'appointment_created';
    notif_title := 'Nova consulta marcada';
    notif_body := 'Consulta criada para ' || new.date || ' às ' || new.time;
  else
    notif_type := 'appointment_updated';
    notif_title := 'Consulta atualizada';
    notif_body := 'Consulta atualizada para ' || new.date || ' às ' || new.time;
  end if;

  -- Create notifications for ALL staff users (admin/secretary/doctor)
  insert into public.notifications (user_id, type, appointment_id, title, body)
  select ur.user_id, notif_type, new.id, notif_title, notif_body
  from public.user_roles ur
  where ur.role in ('admin', 'secretary', 'doctor');

  return new;
end;
$$;


ALTER FUNCTION "public"."notify_on_appointment_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_staff_on_appointment_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  notif_title text;
  notif_body text;
  patient_label text;
begin
  -- Try to get a patient label safely (fallback to 'Paciente' if any issue)
  begin
    -- If patients has 'name', this works; if not, it will fail and we fallback
    select p.name into patient_label
    from public.patients p
    where p.id = new.patient_id;
  exception when others then
    patient_label := null;
  end;

  patient_label := coalesce(patient_label, 'Paciente');

  if tg_op = 'INSERT' then
    notif_title := 'Nova consulta marcada';
    notif_body := format(
      'Consulta marcada para %s em %s às %s',
      patient_label,
      to_char(new.date::date, 'DD/MM/YYYY'),
      substring(new.time::text from 1 for 5)
    );

  elsif tg_op = 'UPDATE' then
    -- Only notify on meaningful changes
    if (old.status is distinct from new.status)
      or (old.date is distinct from new.date)
      or (old.time is distinct from new.time)
    then
      notif_title := 'Consulta alterada';

      if old.status is distinct from new.status then
        notif_body := format(
          'Estado da consulta de %s: %s → %s',
          patient_label,
          old.status::text,
          new.status::text
        );
      elsif (old.date is distinct from new.date) or (old.time is distinct from new.time) then
        notif_body := format(
          'Consulta de %s reagendada para %s às %s',
          patient_label,
          to_char(new.date::date, 'DD/MM/YYYY'),
          substring(new.time::text from 1 for 5)
        );
      else
        notif_body := format('Consulta de %s atualizada', patient_label);
      end if;
    else
      return new; -- no meaningful change
    end if;
  end if;

  -- Notify all staff roles
  insert into public.notifications (user_id, type, appointment_id, title, body)
  select
    ur.user_id,
    case when tg_op = 'INSERT' then 'appointment_created' else 'appointment_updated' end,
    new.id,
    notif_title,
    notif_body
  from public.user_roles ur
  where ur.role in ('admin', 'secretary', 'doctor');

  return new;
end;
$$;


ALTER FUNCTION "public"."notify_staff_on_appointment_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_no_show"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_wf_id uuid;
  v_phone text;
BEGIN
  -- Cast enum to text for comparison
  IF OLD.status::text != 'no_show' AND NEW.status::text = 'no_show' THEN
    
    SELECT phone INTO v_phone FROM public.patients WHERE id = NEW.patient_id;
    
    IF v_phone IS NOT NULL THEN
      INSERT INTO public.whatsapp_workflows (appointment_id, patient_id, phone, workflow_type, scheduled_at)
      VALUES (NEW.id, NEW.patient_id, v_phone, 'reschedule_no_show', now() + interval '1 hour')
      RETURNING id INTO v_wf_id;
      
      PERFORM public.create_whatsapp_event('appointment.no_show_reschedule', 'appointment', NEW.id, v_wf_id, now() + interval '1 hour');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_no_show"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_pre_confirmation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_wf_id uuid;
  v_phone text;
BEGIN
  -- Check against REAL enum values from public.appointment_status
  IF NEW.status::text IN ('scheduled', 'confirmed', 'pre_confirmed') THEN
    
    SELECT phone INTO v_phone FROM public.patients WHERE id = NEW.patient_id;
    
    IF v_phone IS NOT NULL THEN
      INSERT INTO public.whatsapp_workflows (appointment_id, patient_id, phone, workflow_type, scheduled_at)
      VALUES (NEW.id, NEW.patient_id, v_phone, 'pre_confirmation', now())
      RETURNING id INTO v_wf_id;
      
      PERFORM public.create_whatsapp_event('appointment.pre_confirmed', 'appointment', NEW.id, v_wf_id, now());
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_pre_confirmation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_review"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_wf_id uuid;
  v_phone text;
BEGIN
  -- Cast enum to text for comparison
  IF OLD.status::text != 'completed' AND NEW.status::text = 'completed' THEN
    
    SELECT phone INTO v_phone FROM public.patients WHERE id = NEW.patient_id;
    
    IF v_phone IS NOT NULL THEN
      INSERT INTO public.whatsapp_workflows (appointment_id, patient_id, phone, workflow_type, scheduled_at)
      VALUES (NEW.id, NEW.patient_id, v_phone, 'review_2h', now() + interval '2 hours')
      RETURNING id INTO v_wf_id;
      
      PERFORM public.create_whatsapp_event('appointment.review_reminder', 'appointment', NEW.id, v_wf_id, now() + interval '2 hours');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_review"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_action_token"("p_token" "text") RETURNS TABLE("valid" boolean, "appointment_id" "uuid", "patient_id" "uuid", "action_type" "text", "metadata" "jsonb", "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_rec record;
BEGIN
  SELECT * INTO v_rec FROM public.whatsapp_action_tokens WHERE token = p_token;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, NULL::jsonb, 'Token not found'::text;
    RETURN;
  END IF;
  
  IF v_rec.used_at IS NOT NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, NULL::jsonb, 'Already used'::text;
    RETURN;
  END IF;
  
  IF v_rec.expires_at < now() THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, NULL::jsonb, 'Expired'::text;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT true, v_rec.appointment_id, v_rec.patient_id, v_rec.action_type, v_rec.metadata, NULL::text;
END;
$$;


ALTER FUNCTION "public"."validate_action_token"("p_token" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."appointment_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_id" "uuid" NOT NULL,
    "author_user_id" "uuid" NOT NULL,
    "note" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."appointment_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointment_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "nif" "text" NOT NULL,
    "specialty_id" "uuid" NOT NULL,
    "preferred_date" "date" NOT NULL,
    "preferred_time" time without time zone NOT NULL,
    "reason" "text" NOT NULL,
    "estimated_duration" integer,
    "status" "public"."request_status" DEFAULT 'pending'::"public"."request_status" NOT NULL,
    "assigned_professional_id" "uuid",
    "cancel_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."appointment_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointment_suggestions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_request_id" "uuid",
    "patient_id" "uuid" NOT NULL,
    "suggested_slots" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "accepted_slot" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval)
);


ALTER TABLE "public"."appointment_suggestions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "specialty_id" "uuid" NOT NULL,
    "consultation_type_id" "uuid",
    "date" "date" NOT NULL,
    "time" time without time zone NOT NULL,
    "duration" integer DEFAULT 30 NOT NULL,
    "status" "public"."appointment_status" DEFAULT 'scheduled'::"public"."appointment_status" NOT NULL,
    "reason" "text",
    "notes" "text",
    "room_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clinic_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."clinic_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."consultation_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "default_duration" integer DEFAULT 30 NOT NULL,
    "color" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."consultation_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "message" "text" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contact_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "appointment_id" "uuid",
    "title" "text" NOT NULL,
    "body" "text",
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nif" "text" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "email" "text",
    "birth_date" "date",
    "notes" "text",
    "tags" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."patients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."professionals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "specialty_id" "uuid",
    "color" "text" DEFAULT '#3b82f6'::"text" NOT NULL,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."professionals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "specialty_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."specialties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."specialties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "user_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "photo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waitlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "specialty_id" "uuid",
    "professional_id" "uuid",
    "time_preference" "public"."time_preference" DEFAULT 'any'::"public"."time_preference" NOT NULL,
    "preferred_dates" "date"[],
    "priority" "public"."waitlist_priority" DEFAULT 'medium'::"public"."waitlist_priority" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."waitlist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_action_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "action_type" "text" NOT NULL,
    "appointment_id" "uuid",
    "patient_id" "uuid" NOT NULL,
    "workflow_id" "uuid",
    "metadata" "jsonb",
    "used_at" timestamp with time zone,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."whatsapp_action_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "workflow_id" "uuid",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "last_error" "text",
    "scheduled_for" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."whatsapp_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_workflows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_id" "uuid",
    "appointment_request_id" "uuid",
    "patient_phone" "text" NOT NULL,
    "workflow_type" "public"."whatsapp_workflow_type" NOT NULL,
    "status" "public"."whatsapp_workflow_status" DEFAULT 'pending'::"public"."whatsapp_workflow_status" NOT NULL,
    "scheduled_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "responded_at" timestamp with time zone,
    "response" "text",
    "message_payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."whatsapp_workflows" OWNER TO "postgres";


ALTER TABLE ONLY "public"."appointment_notes"
    ADD CONSTRAINT "appointment_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointment_requests"
    ADD CONSTRAINT "appointment_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointment_suggestions"
    ADD CONSTRAINT "appointment_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clinic_settings"
    ADD CONSTRAINT "clinic_settings_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."clinic_settings"
    ADD CONSTRAINT "clinic_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consultation_types"
    ADD CONSTRAINT "consultation_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_messages"
    ADD CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_nif_key" UNIQUE ("nif");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."professionals"
    ADD CONSTRAINT "professionals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."professionals"
    ADD CONSTRAINT "professionals_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."specialties"
    ADD CONSTRAINT "specialties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_action_tokens"
    ADD CONSTRAINT "whatsapp_action_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_action_tokens"
    ADD CONSTRAINT "whatsapp_action_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."whatsapp_events"
    ADD CONSTRAINT "whatsapp_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_workflows"
    ADD CONSTRAINT "whatsapp_workflows_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_appointment_notes_appointment" ON "public"."appointment_notes" USING "btree" ("appointment_id");



CREATE INDEX "idx_appointment_requests_created_at" ON "public"."appointment_requests" USING "btree" ("created_at");



CREATE INDEX "idx_appointment_requests_status" ON "public"."appointment_requests" USING "btree" ("status");



CREATE INDEX "idx_appointment_suggestions_patient" ON "public"."appointment_suggestions" USING "btree" ("patient_id");



CREATE INDEX "idx_appointments_date" ON "public"."appointments" USING "btree" ("date");



CREATE INDEX "idx_appointments_patient" ON "public"."appointments" USING "btree" ("patient_id");



CREATE INDEX "idx_appointments_professional" ON "public"."appointments" USING "btree" ("professional_id");



CREATE INDEX "idx_appointments_status" ON "public"."appointments" USING "btree" ("status");



CREATE INDEX "idx_contact_messages_is_read" ON "public"."contact_messages" USING "btree" ("is_read");



CREATE INDEX "idx_notifications_user_unread" ON "public"."notifications" USING "btree" ("user_id", "is_read");



CREATE INDEX "idx_patients_nif" ON "public"."patients" USING "btree" ("nif");



CREATE INDEX "idx_professionals_specialty" ON "public"."professionals" USING "btree" ("specialty_id");



CREATE INDEX "idx_user_roles_user_id" ON "public"."user_roles" USING "btree" ("user_id");



CREATE INDEX "idx_waitlist_priority" ON "public"."waitlist" USING "btree" ("priority");



CREATE INDEX "idx_waitlist_sort_order" ON "public"."waitlist" USING "btree" ("sort_order");



CREATE INDEX "idx_whatsapp_action_tokens_token" ON "public"."whatsapp_action_tokens" USING "btree" ("token");



CREATE INDEX "idx_whatsapp_events_entity" ON "public"."whatsapp_events" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_whatsapp_events_scheduled" ON "public"."whatsapp_events" USING "btree" ("scheduled_for");



CREATE INDEX "idx_whatsapp_events_status" ON "public"."whatsapp_events" USING "btree" ("status");



CREATE INDEX "idx_whatsapp_workflows_status_scheduled" ON "public"."whatsapp_workflows" USING "btree" ("status", "scheduled_at");



CREATE OR REPLACE TRIGGER "notify_staff_on_appointment_insert" AFTER INSERT ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_staff_on_appointment_change"();



CREATE OR REPLACE TRIGGER "notify_staff_on_appointment_update" AFTER UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_staff_on_appointment_change"();



CREATE OR REPLACE TRIGGER "trg_no_show" AFTER UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_no_show"();



CREATE OR REPLACE TRIGGER "trg_notify_appointment_change" AFTER INSERT OR UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_appointment_change"();



CREATE OR REPLACE TRIGGER "trg_pre_confirmation" AFTER INSERT ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_pre_confirmation"();



CREATE OR REPLACE TRIGGER "trg_review" AFTER UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_review"();



CREATE OR REPLACE TRIGGER "update_appointment_requests_updated_at" BEFORE UPDATE ON "public"."appointment_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_appointments_updated_at" BEFORE UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clinic_settings_updated_at" BEFORE UPDATE ON "public"."clinic_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_patients_updated_at" BEFORE UPDATE ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_whatsapp_workflows_updated_at" BEFORE UPDATE ON "public"."whatsapp_workflows" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."appointment_notes"
    ADD CONSTRAINT "appointment_notes_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_notes"
    ADD CONSTRAINT "appointment_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."appointment_requests"
    ADD CONSTRAINT "appointment_requests_assigned_professional_id_fkey" FOREIGN KEY ("assigned_professional_id") REFERENCES "public"."professionals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointment_requests"
    ADD CONSTRAINT "appointment_requests_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "public"."specialties"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_consultation_type_id_fkey" FOREIGN KEY ("consultation_type_id") REFERENCES "public"."consultation_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "public"."specialties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professionals"
    ADD CONSTRAINT "professionals_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "public"."specialties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."professionals"
    ADD CONSTRAINT "professionals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "public"."specialties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "public"."specialties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."whatsapp_workflows"
    ADD CONSTRAINT "whatsapp_workflows_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_workflows"
    ADD CONSTRAINT "whatsapp_workflows_appointment_request_id_fkey" FOREIGN KEY ("appointment_request_id") REFERENCES "public"."appointment_requests"("id") ON DELETE CASCADE;



CREATE POLICY "Admin manage clinic_settings" ON "public"."clinic_settings" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admin manage professionals" ON "public"."professionals" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admin manage profiles" ON "public"."user_profiles" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admin manage roles" ON "public"."user_roles" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admin manage whatsapp_workflows" ON "public"."whatsapp_workflows" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admin/Secretary manage appointment_notes" ON "public"."appointment_notes" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role")));



CREATE POLICY "Admin/Secretary manage appointment_requests" ON "public"."appointment_requests" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role")));



CREATE POLICY "Admin/Secretary manage appointments" ON "public"."appointments" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role")));



CREATE POLICY "Admin/Secretary manage consultation_types" ON "public"."consultation_types" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role")));



CREATE POLICY "Admin/Secretary manage contact_messages" ON "public"."contact_messages" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role")));



CREATE POLICY "Admin/Secretary manage patients" ON "public"."patients" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role")));



CREATE POLICY "Admin/Secretary manage rooms" ON "public"."rooms" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role")));



CREATE POLICY "Admin/Secretary manage specialties" ON "public"."specialties" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role")));



CREATE POLICY "Admin/Secretary manage waitlist" ON "public"."waitlist" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role")));



CREATE POLICY "Admins can view all roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Doctor can create notes for own appointments" ON "public"."appointment_notes" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_role"("auth"."uid"(), 'doctor'::"public"."app_role") AND (EXISTS ( SELECT 1
   FROM ("public"."appointments" "a"
     JOIN "public"."professionals" "p" ON (("p"."id" = "a"."professional_id")))
  WHERE (("a"."id" = "appointment_notes"."appointment_id") AND ("p"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Doctor can update own appointments" ON "public"."appointments" FOR UPDATE TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'doctor'::"public"."app_role") AND (EXISTS ( SELECT 1
   FROM "public"."professionals" "p"
  WHERE (("p"."id" = "appointments"."professional_id") AND ("p"."user_id" = "auth"."uid"())))))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'doctor'::"public"."app_role") AND (EXISTS ( SELECT 1
   FROM "public"."professionals" "p"
  WHERE (("p"."id" = "appointments"."professional_id") AND ("p"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Doctor can view consultation_types" ON "public"."consultation_types" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'doctor'::"public"."app_role"));



CREATE POLICY "Doctor can view notes for own appointments" ON "public"."appointment_notes" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'doctor'::"public"."app_role") AND (EXISTS ( SELECT 1
   FROM ("public"."appointments" "a"
     JOIN "public"."professionals" "p" ON (("p"."id" = "a"."professional_id")))
  WHERE (("a"."id" = "appointment_notes"."appointment_id") AND ("p"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Doctor can view own appointments" ON "public"."appointments" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'doctor'::"public"."app_role") AND (EXISTS ( SELECT 1
   FROM "public"."professionals" "p"
  WHERE (("p"."id" = "appointments"."professional_id") AND ("p"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Doctor can view rooms" ON "public"."rooms" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'doctor'::"public"."app_role"));



CREATE POLICY "Doctor can view specialties" ON "public"."specialties" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'doctor'::"public"."app_role"));



CREATE POLICY "Doctor can view waitlist" ON "public"."waitlist" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'doctor'::"public"."app_role"));



CREATE POLICY "Public can insert appointment_requests" ON "public"."appointment_requests" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Public can insert contact_messages" ON "public"."contact_messages" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Staff can view patients" ON "public"."patients" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'doctor'::"public"."app_role")));



CREATE POLICY "Staff can view professionals" ON "public"."professionals" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'doctor'::"public"."app_role")));



CREATE POLICY "Staff can view profiles" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'doctor'::"public"."app_role")));



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."appointment_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointment_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clinic_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consultation_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."professionals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."specialties" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."waitlist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_workflows" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_whatsapp_event"("p_event_type" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_workflow_id" "uuid", "p_scheduled_for" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."create_whatsapp_event"("p_event_type" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_workflow_id" "uuid", "p_scheduled_for" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_whatsapp_event"("p_event_type" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_workflow_id" "uuid", "p_scheduled_for" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_action_token"("p_action_type" "text", "p_appointment_id" "uuid", "p_patient_id" "uuid", "p_workflow_id" "uuid", "p_metadata" "jsonb", "p_expires_in_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_action_token"("p_action_type" "text", "p_appointment_id" "uuid", "p_patient_id" "uuid", "p_workflow_id" "uuid", "p_metadata" "jsonb", "p_expires_in_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_action_token"("p_action_type" "text", "p_appointment_id" "uuid", "p_patient_id" "uuid", "p_workflow_id" "uuid", "p_metadata" "jsonb", "p_expires_in_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_token_used"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_token_used"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_token_used"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_appointment_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_appointment_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_appointment_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_staff_on_appointment_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_staff_on_appointment_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_staff_on_appointment_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_no_show"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_no_show"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_no_show"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_pre_confirmation"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_pre_confirmation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_pre_confirmation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_review"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_review"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_review"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_action_token"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_action_token"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_action_token"("p_token" "text") TO "service_role";



GRANT ALL ON TABLE "public"."appointment_notes" TO "anon";
GRANT ALL ON TABLE "public"."appointment_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_notes" TO "service_role";



GRANT ALL ON TABLE "public"."appointment_requests" TO "anon";
GRANT ALL ON TABLE "public"."appointment_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_requests" TO "service_role";



GRANT ALL ON TABLE "public"."appointment_suggestions" TO "anon";
GRANT ALL ON TABLE "public"."appointment_suggestions" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_suggestions" TO "service_role";



GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT ALL ON TABLE "public"."clinic_settings" TO "anon";
GRANT ALL ON TABLE "public"."clinic_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."clinic_settings" TO "service_role";



GRANT ALL ON TABLE "public"."consultation_types" TO "anon";
GRANT ALL ON TABLE "public"."consultation_types" TO "authenticated";
GRANT ALL ON TABLE "public"."consultation_types" TO "service_role";



GRANT ALL ON TABLE "public"."contact_messages" TO "anon";
GRANT ALL ON TABLE "public"."contact_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_messages" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."patients" TO "anon";
GRANT ALL ON TABLE "public"."patients" TO "authenticated";
GRANT ALL ON TABLE "public"."patients" TO "service_role";



GRANT ALL ON TABLE "public"."professionals" TO "anon";
GRANT ALL ON TABLE "public"."professionals" TO "authenticated";
GRANT ALL ON TABLE "public"."professionals" TO "service_role";



GRANT ALL ON TABLE "public"."rooms" TO "anon";
GRANT ALL ON TABLE "public"."rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."rooms" TO "service_role";



GRANT ALL ON TABLE "public"."specialties" TO "anon";
GRANT ALL ON TABLE "public"."specialties" TO "authenticated";
GRANT ALL ON TABLE "public"."specialties" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist" TO "anon";
GRANT ALL ON TABLE "public"."waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."waitlist" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_action_tokens" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_action_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_action_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_events" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_events" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_events" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_workflows" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_workflows" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_workflows" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







