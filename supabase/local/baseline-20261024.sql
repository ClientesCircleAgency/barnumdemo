


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


CREATE OR REPLACE FUNCTION "public"."convert_request_to_appointment"("p_request_id" "uuid", "p_accepted_date" "date" DEFAULT NULL::"date", "p_accepted_time" time without time zone DEFAULT NULL::time without time zone, "p_professional_id" "uuid" DEFAULT NULL::"uuid", "p_consultation_type_id" "uuid" DEFAULT NULL::"uuid", "p_duration" integer DEFAULT NULL::integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_request record;
  v_slot jsonb;
  v_patient_id uuid;
  v_appointment_id uuid;
  v_date date;
  v_time time;
  v_prof_id uuid;
  v_duration integer;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not (auth.uid() is not null and (
       public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'secretary')
     )) then
    raise exception 'Staff manager role required' using errcode = '42501';
  end if;
  select * into v_request from public.appointment_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found: %', p_request_id;
  end if;

  if v_request.status = 'converted' then
    raise exception 'Request already converted';
  end if;

  if v_request.status not in ('pending', 'pre_confirmed', 'suggested') then
    raise exception 'Request cannot be converted from its current status';
  end if;

  v_slot := public.normalize_accepted_slot_value(v_request.accepted_slot);

  v_date := coalesce(
    p_accepted_date,
    case when v_slot is not null then (v_slot->>'date')::date else null end,
    v_request.preferred_date
  );

  v_time := coalesce(
    p_accepted_time,
    case when v_slot is not null then (v_slot->>'time')::time else null end,
    v_request.preferred_time
  );

  v_prof_id := coalesce(p_professional_id, v_request.assigned_professional_id);

  if v_prof_id is null and v_slot ? 'professional_id' then
    v_prof_id := nullif(v_slot->>'professional_id', '')::uuid;
  end if;

  if v_prof_id is null then
    select nullif(slot->>'professional_id', '')::uuid
      into v_prof_id
    from jsonb_array_elements(coalesce(v_request.suggested_slots, '[]'::jsonb)) as slot
    where slot->>'date' = to_char(v_date, 'YYYY-MM-DD')
      and left(slot->>'time', 5) = to_char(v_time, 'HH24:MI')
      and slot ? 'professional_id'
    limit 1;
  end if;

  if v_prof_id is null then
    select p.id
      into v_prof_id
    from public.professionals p
    left join public.professional_specialties ps on ps.professional_id = p.id
    where p.specialty_id = v_request.specialty_id
       or ps.specialty_id = v_request.specialty_id
    order by p.created_at asc
    limit 1;
  end if;

  if v_prof_id is null then
    raise exception 'No professional available for request % specialty %', p_request_id, v_request.specialty_id;
  end if;

  v_duration := coalesce(p_duration, v_request.estimated_duration, 30);

  if v_date is null or v_time is null or v_duration <= 0 or v_duration > 1440 then
    raise exception 'Invalid appointment date, time or duration';
  end if;

  -- Serialize concurrent RPC bookings for this professional/day.
  perform pg_advisory_xact_lock(hashtextextended(v_prof_id::text || ':' || v_date::text, 0));
  if exists (
    select 1 from public.appointments a
    where a.professional_id = v_prof_id and a.date = v_date
      and a.status not in ('cancelled', 'no_show')
      and a.date + a.time < v_date + v_time + make_interval(mins => v_duration)
      and v_date + v_time < a.date + a.time + make_interval(mins => a.duration)
  ) then
    raise exception 'Professional is not available at this time';
  end if;

  insert into public.patients (name, phone, email, nif)
  values (v_request.name, v_request.phone, v_request.email, v_request.nif)
  on conflict (nif) do update
    set name = coalesce(nullif(excluded.name, ''), public.patients.name),
        phone = coalesce(nullif(excluded.phone, ''), public.patients.phone),
        email = coalesce(nullif(excluded.email, ''), public.patients.email),
        updated_at = now()
  returning id into v_patient_id;

  insert into public.appointments (
    patient_id,
    professional_id,
    specialty_id,
    consultation_type_id,
    date,
    time,
    duration,
    status,
    reason,
    notes
  ) values (
    v_patient_id,
    v_prof_id,
    v_request.specialty_id,
    p_consultation_type_id,
    v_date,
    v_time,
    v_duration,
    'confirmed',
    v_request.reason,
    'Convertido de pedido online. NIF: ' || v_request.nif
  ) returning id into v_appointment_id;

  update public.appointment_requests
     set status = 'converted',
         accepted_slot = jsonb_build_object('date', v_date, 'time', v_time, 'professional_id', v_prof_id)
   where id = p_request_id;

  return v_appointment_id;
end;
$$;


ALTER FUNCTION "public"."convert_request_to_appointment"("p_request_id" "uuid", "p_accepted_date" "date", "p_accepted_time" time without time zone, "p_professional_id" "uuid", "p_consultation_type_id" "uuid", "p_duration" integer) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."normalize_accepted_slot_value"("slot_value" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
declare
  slot_text text;
begin
  if slot_value is null then
    return null;
  end if;

  if jsonb_typeof(slot_value) = 'object' then
    return slot_value;
  end if;

  if jsonb_typeof(slot_value) = 'string' then
    slot_text := btrim(slot_value #>> '{}');
    if slot_text = '' then
      return null;
    end if;

    return slot_text::jsonb;
  end if;

  return null;
exception when others then
  return null;
end;
$$;


ALTER FUNCTION "public"."normalize_accepted_slot_value"("slot_value" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_contact_phone_before_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.phone := public.normalize_portuguese_phone_value(new.phone);
  return new;
end;
$$;


ALTER FUNCTION "public"."normalize_contact_phone_before_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_portuguese_phone_value"("phone_value" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $_$
declare
  digits text;
begin
  if phone_value is null or btrim(phone_value) = '' then
    return phone_value;
  end if;

  digits := regexp_replace(phone_value, '\D', '', 'g');

  if digits = '' then
    return btrim(phone_value);
  end if;

  if digits ~ '^00351[0-9]{9}$' then
    return '+351' || substring(digits from 6);
  end if;

  if digits ~ '^351[0-9]{9}$' then
    return '+' || digits;
  end if;

  if digits ~ '^0055[0-9]{10,11}$' then
    return '+55' || substring(digits from 5);
  end if;

  if digits ~ '^55[0-9]{10,11}$' then
    return '+' || digits;
  end if;

  if digits ~ '^[0-9]{9}$' then
    return '+351' || digits;
  end if;

  if digits ~ '^[0-9]{10,11}$' then
    return '+55' || digits;
  end if;

  return '+' || digits;
end;
$_$;


ALTER FUNCTION "public"."normalize_portuguese_phone_value"("phone_value" "text") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_appointment_request_names"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.assigned_professional_id is not null then
    new.professional_name := (
      select coalesce(
        (select p.name from public.professionals p where p.id = new.assigned_professional_id limit 1),
        (select p.name from public.professionals p where p.user_id = new.assigned_professional_id limit 1)
      )
    );
  else
    new.professional_name := null;
  end if;

  if new.specialty_id is not null then
    select s.name
      into new.specialty_name
    from public.specialties s
    where s.id = new.specialty_id
    limit 1;
  else
    new.specialty_name := null;
  end if;

  new.updated_at := now();

  return new;
end;
$$;


ALTER FUNCTION "public"."set_appointment_request_names"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_appointment_snapshot_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.patient_id is not null then
    select
      p.name,
      p.phone
    into
      new.patient_name,
      new.patient_phone
    from public.patients p
    where p.id = new.patient_id
    limit 1;
  else
    new.patient_name := null;
    new.patient_phone := null;
  end if;

  if new.professional_id is not null then
    select pr.name
    into new.professional_name
    from public.professionals pr
    where pr.id = new.professional_id
       or pr.user_id = new.professional_id
    limit 1;
  else
    new.professional_name := null;
  end if;

  if new.specialty_id is not null then
    select s.name
    into new.specialty_name
    from public.specialties s
    where s.id = new.specialty_id
    limit 1;
  else
    new.specialty_name := null;
  end if;

  new.updated_at := now();

  return new;
end;
$$;


ALTER FUNCTION "public"."set_appointment_snapshot_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_consultation_type_name"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.consultation_type_id IS NOT NULL THEN
    SELECT name INTO NEW.consultation_type_name
    FROM public.consultation_types
    WHERE id = NEW.consultation_type_id;
  ELSE
    NEW.consultation_type_name := NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_consultation_type_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_professional_name"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
    BEGIN
      IF NEW.professional_id IS NOT NULL THEN
        SELECT name INTO NEW.professional_name
        FROM professionals
        WHERE id = NEW.professional_id;
      END IF;
      RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."sync_professional_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_request_professional_name"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
    BEGIN
      IF NEW.assigned_professional_id IS NOT NULL THEN
        SELECT name INTO NEW.professional_name
        FROM professionals
        WHERE id = NEW.assigned_professional_id;
      END IF;
      RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."sync_request_professional_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_create_appointment_on_convert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_slot jsonb;
  v_patient_id uuid;
  v_prof_id uuid;
  v_date date;
  v_time time;
  v_duration integer;
  v_consultation_type_id uuid;
  v_professional_name text;
  v_specialty_name text;
begin
  if new.status <> 'converted' then
    return new;
  end if;

  if old.status = 'converted' and old.accepted_slot is not distinct from new.accepted_slot then
    return new;
  end if;

  v_slot := public.normalize_accepted_slot_value(new.accepted_slot);

  if v_slot is null or v_slot->>'date' is null or v_slot->>'time' is null then
    return new;
  end if;

  v_date := (v_slot->>'date')::date;
  v_time := (v_slot->>'time')::time;
  v_duration := coalesce(new.estimated_duration, 30);

  if v_slot ? 'professional_id' then
    v_prof_id := nullif(v_slot->>'professional_id', '')::uuid;
  end if;

  if v_prof_id is null then
    select nullif(slot->>'professional_id', '')::uuid
      into v_prof_id
    from jsonb_array_elements(coalesce(new.suggested_slots, '[]'::jsonb)) as slot
    where slot->>'date' = to_char(v_date, 'YYYY-MM-DD')
      and left(slot->>'time', 5) = to_char(v_time, 'HH24:MI')
      and slot ? 'professional_id'
    limit 1;
  end if;

  v_prof_id := coalesce(v_prof_id, new.assigned_professional_id);

  if v_prof_id is null then
    select p.id
      into v_prof_id
    from public.professionals p
    left join public.professional_specialties ps on ps.professional_id = p.id
    where p.specialty_id = new.specialty_id
       or ps.specialty_id = new.specialty_id
    order by p.created_at asc
    limit 1;
  end if;

  if v_prof_id is null then
    raise exception 'No professional available for request % specialty %', new.id, new.specialty_id;
  end if;

  select id
    into v_consultation_type_id
  from public.consultation_types
  where specialty_id = new.specialty_id
  order by created_at asc
  limit 1;

  insert into public.patients (name, phone, email, nif)
  values (new.name, new.phone, new.email, new.nif)
  on conflict (nif) do update
    set name = coalesce(nullif(excluded.name, ''), public.patients.name),
        phone = coalesce(nullif(excluded.phone, ''), public.patients.phone),
        email = coalesce(nullif(excluded.email, ''), public.patients.email),
        updated_at = now()
  returning id into v_patient_id;

  if exists (
    select 1
    from public.appointments
    where patient_id = v_patient_id
      and date = v_date
      and time = v_time
      and status not in ('cancelled', 'no_show')
  ) then
    return new;
  end if;

  select p.name into v_professional_name from public.professionals p where p.id = v_prof_id;
  select s.name into v_specialty_name from public.specialties s where s.id = new.specialty_id;

  insert into public.appointments (
    patient_id,
    professional_id,
    specialty_id,
    consultation_type_id,
    date,
    time,
    duration,
    status,
    reason,
    notes,
    professional_name,
    specialty_name,
    patient_name,
    patient_phone,
    consultation_type_name
  ) values (
    v_patient_id,
    v_prof_id,
    new.specialty_id,
    v_consultation_type_id,
    v_date,
    v_time,
    v_duration,
    'confirmed',
    new.reason,
    'Convertido de pedido online. NIF: ' || new.nif,
    v_professional_name,
    v_specialty_name,
    new.name,
    new.phone,
    (select ct.name from public.consultation_types ct where ct.id = v_consultation_type_id)
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."trg_create_appointment_on_convert"() OWNER TO "postgres";


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

SET default_tablespace = '';

SET default_table_access_method = "heap";


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
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rejection_reason" "text",
    "professional_name" "text",
    "specialty_name" "text",
    "suggested_slots" "jsonb" DEFAULT '[]'::"jsonb",
    "accepted_slot" "jsonb",
    "suggestion_expires_at" timestamp with time zone
);


ALTER TABLE "public"."appointment_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "specialty_id" "uuid" NOT NULL,
    "consultation_type_id" "uuid",
    "date" "date" NOT NULL,
    "time" time without time zone NOT NULL,
    "duration" integer DEFAULT 30 NOT NULL,
    "status" "public"."appointment_status" DEFAULT 'confirmed'::"public"."appointment_status" NOT NULL,
    "reason" "text",
    "notes" "text",
    "room_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "send_review" boolean DEFAULT true NOT NULL,
    "finalized_at" timestamp with time zone,
    "final_notes" "text",
    "cancellation_reason" "text",
    "professional_name" "text",
    "specialty_name" "text",
    "patient_name" "text",
    "patient_phone" "text",
    "consultation_type_name" "text",
    "is_rescheduled" boolean DEFAULT false NOT NULL
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
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "specialty_id" "uuid"
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


CREATE TABLE IF NOT EXISTS "public"."professional_specialties" (
    "professional_id" "uuid" NOT NULL,
    "specialty_id" "uuid" NOT NULL
);


ALTER TABLE "public"."professional_specialties" OWNER TO "postgres";


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
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "color" "text",
    "active_specialty_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "active_consultation_type_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "working_hours" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "time_off" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "extra_permissions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_profiles"."working_hours" IS 'Per-user working hours managed by staff operations.';



COMMENT ON COLUMN "public"."user_profiles"."time_off" IS 'Per-user days off, holidays and vacation ranges managed by staff operations.';



COMMENT ON COLUMN "public"."user_profiles"."extra_permissions" IS 'Extra operational permissions delegated to this staff account.';



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."appointment_requests"
    ADD CONSTRAINT "appointment_requests_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."professional_specialties"
    ADD CONSTRAINT "professional_specialties_pkey" PRIMARY KEY ("professional_id", "specialty_id");



ALTER TABLE ONLY "public"."professionals"
    ADD CONSTRAINT "professionals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."professionals"
    ADD CONSTRAINT "professionals_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."specialties"
    ADD CONSTRAINT "specialties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



CREATE INDEX "idx_appointment_requests_created_at" ON "public"."appointment_requests" USING "btree" ("created_at");



CREATE INDEX "idx_appointment_requests_status" ON "public"."appointment_requests" USING "btree" ("status");



CREATE INDEX "idx_appointments_date" ON "public"."appointments" USING "btree" ("date");



CREATE INDEX "idx_appointments_finalized_at" ON "public"."appointments" USING "btree" ("finalized_at") WHERE ("finalized_at" IS NOT NULL);



CREATE INDEX "idx_appointments_patient" ON "public"."appointments" USING "btree" ("patient_id");



CREATE INDEX "idx_appointments_professional" ON "public"."appointments" USING "btree" ("professional_id");



CREATE INDEX "idx_appointments_status" ON "public"."appointments" USING "btree" ("status");



CREATE INDEX "idx_contact_messages_is_read" ON "public"."contact_messages" USING "btree" ("is_read");



CREATE INDEX "idx_notifications_user_unread" ON "public"."notifications" USING "btree" ("user_id", "is_read");



CREATE INDEX "idx_patients_nif" ON "public"."patients" USING "btree" ("nif");



CREATE INDEX "idx_professionals_specialty" ON "public"."professionals" USING "btree" ("specialty_id");



CREATE INDEX "idx_user_roles_user_id" ON "public"."user_roles" USING "btree" ("user_id");









CREATE OR REPLACE TRIGGER "normalize_appointment_requests_phone_before_write" BEFORE INSERT OR UPDATE OF "phone" ON "public"."appointment_requests" FOR EACH ROW EXECUTE FUNCTION "public"."normalize_contact_phone_before_write"();



CREATE OR REPLACE TRIGGER "normalize_contact_messages_phone_before_write" BEFORE INSERT OR UPDATE OF "phone" ON "public"."contact_messages" FOR EACH ROW EXECUTE FUNCTION "public"."normalize_contact_phone_before_write"();



CREATE OR REPLACE TRIGGER "normalize_patients_phone_before_write" BEFORE INSERT OR UPDATE OF "phone" ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."normalize_contact_phone_before_write"();



CREATE OR REPLACE TRIGGER "notify_staff_on_appointment_insert" AFTER INSERT ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_staff_on_appointment_change"();



CREATE OR REPLACE TRIGGER "notify_staff_on_appointment_update" AFTER UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_staff_on_appointment_change"();



CREATE OR REPLACE TRIGGER "trg_create_appointment_on_convert" AFTER UPDATE OF "status", "accepted_slot" ON "public"."appointment_requests" FOR EACH ROW EXECUTE FUNCTION "public"."trg_create_appointment_on_convert"();



CREATE OR REPLACE TRIGGER "trg_set_appointment_request_names" BEFORE INSERT OR UPDATE OF "assigned_professional_id", "specialty_id" ON "public"."appointment_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_appointment_request_names"();



CREATE OR REPLACE TRIGGER "trg_set_appointment_snapshot_fields" BEFORE INSERT OR UPDATE OF "patient_id", "professional_id", "specialty_id" ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."set_appointment_snapshot_fields"();



CREATE OR REPLACE TRIGGER "trg_sync_consultation_type_name" BEFORE INSERT OR UPDATE OF "consultation_type_id" ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."sync_consultation_type_name"();



CREATE OR REPLACE TRIGGER "trg_sync_professional_name" BEFORE INSERT OR UPDATE OF "professional_id" ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."sync_professional_name"();



CREATE OR REPLACE TRIGGER "update_appointment_requests_updated_at" BEFORE UPDATE ON "public"."appointment_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_appointments_updated_at" BEFORE UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clinic_settings_updated_at" BEFORE UPDATE ON "public"."clinic_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_patients_updated_at" BEFORE UPDATE ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



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
    ADD CONSTRAINT "appointments_professional_id_fkey1" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_professional_id_fkey2" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_professional_id_fkey3" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_professional_id_fkey4" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_professional_id_fkey5" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "public"."specialties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."consultation_types"
    ADD CONSTRAINT "consultation_types_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "public"."specialties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professional_specialties"
    ADD CONSTRAINT "professional_specialties_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professional_specialties"
    ADD CONSTRAINT "professional_specialties_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "public"."specialties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professionals"
    ADD CONSTRAINT "professionals_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "public"."specialties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."professionals"
    ADD CONSTRAINT "professionals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admin manage clinic_settings" ON "public"."clinic_settings" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admin manage professionals" ON "public"."professionals" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admin manage profiles" ON "public"."user_profiles" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admin manage roles" ON "public"."user_roles" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admin/Secretary manage appointment_requests" ON "public"."appointment_requests" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role")));



CREATE POLICY "Admin/Secretary manage appointments" ON "public"."appointments" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role")));



CREATE POLICY "Admin/Secretary manage consultation_types" ON "public"."consultation_types" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role")));



CREATE POLICY "Admin/Secretary manage contact_messages" ON "public"."contact_messages" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role")));



CREATE POLICY "Admin/Secretary manage patients" ON "public"."patients" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role")));



CREATE POLICY "Admin/Secretary manage specialties" ON "public"."specialties" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role")));



CREATE POLICY "Admins can manage professional_specialties" ON "public"."professional_specialties" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can view all roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Authenticated users can read professional_specialties" ON "public"."professional_specialties" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Doctor can update own appointments" ON "public"."appointments" FOR UPDATE TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'doctor'::"public"."app_role") AND (EXISTS ( SELECT 1
   FROM "public"."professionals" "p"
  WHERE (("p"."id" = "appointments"."professional_id") AND ("p"."user_id" = "auth"."uid"())))))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'doctor'::"public"."app_role") AND (EXISTS ( SELECT 1
   FROM "public"."professionals" "p"
  WHERE (("p"."id" = "appointments"."professional_id") AND ("p"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Doctor can view consultation_types" ON "public"."consultation_types" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'doctor'::"public"."app_role"));



CREATE POLICY "Doctor can view own appointments" ON "public"."appointments" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'doctor'::"public"."app_role") AND (EXISTS ( SELECT 1
   FROM "public"."professionals" "p"
  WHERE (("p"."id" = "appointments"."professional_id") AND ("p"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Doctor can view specialties" ON "public"."specialties" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'doctor'::"public"."app_role"));



CREATE POLICY "Public can insert appointment_requests" ON "public"."appointment_requests" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Public can insert contact_messages" ON "public"."contact_messages" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Public can view specialties" ON "public"."specialties" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Staff can manage non-admin professional specialties" ON "public"."professional_specialties" TO "authenticated" USING ((("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role")) AND (EXISTS ( SELECT 1
   FROM ("public"."professionals" "p"
     JOIN "public"."user_roles" "target_role" ON (("target_role"."user_id" = "p"."user_id")))
  WHERE (("p"."id" = "professional_specialties"."professional_id") AND ("target_role"."role" <> 'admin'::"public"."app_role")))))) WITH CHECK ((("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role")) AND (EXISTS ( SELECT 1
   FROM ("public"."professionals" "p"
     JOIN "public"."user_roles" "target_role" ON (("target_role"."user_id" = "p"."user_id")))
  WHERE (("p"."id" = "professional_specialties"."professional_id") AND ("target_role"."role" <> 'admin'::"public"."app_role"))))));



CREATE POLICY "Staff can manage non-admin professionals" ON "public"."professionals" TO "authenticated" USING ((("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role")) AND ("user_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "target_role"
  WHERE (("target_role"."user_id" = "professionals"."user_id") AND ("target_role"."role" <> 'admin'::"public"."app_role")))))) WITH CHECK ((("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role")) AND ("user_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "target_role"
  WHERE (("target_role"."user_id" = "professionals"."user_id") AND ("target_role"."role" <> 'admin'::"public"."app_role"))))));



CREATE POLICY "Staff can manage non-admin profiles" ON "public"."user_profiles" TO "authenticated" USING ((("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role")) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "target_role"
  WHERE (("target_role"."user_id" = "user_profiles"."user_id") AND ("target_role"."role" <> 'admin'::"public"."app_role")))))) WITH CHECK ((("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role")) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "target_role"
  WHERE (("target_role"."user_id" = "user_profiles"."user_id") AND ("target_role"."role" <> 'admin'::"public"."app_role"))))));



CREATE POLICY "Staff can update non-admin roles" ON "public"."user_roles" FOR UPDATE TO "authenticated" USING ((("role" <> 'admin'::"public"."app_role") AND ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role")))) WITH CHECK ((("role" <> 'admin'::"public"."app_role") AND ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role"))));



CREATE POLICY "Staff can view non-admin roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ((("role" <> 'admin'::"public"."app_role") AND ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role"))));



CREATE POLICY "Staff can view patients" ON "public"."patients" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'doctor'::"public"."app_role")));



CREATE POLICY "Staff can view professionals" ON "public"."professionals" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'doctor'::"public"."app_role")));



CREATE POLICY "Staff can view profiles" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'secretary'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'doctor'::"public"."app_role")));



CREATE POLICY "Users can insert own profile" ON "public"."user_profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can mark own notifications read" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can read own relevant notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'admin'::"public"."app_role") OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'secretary'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM ("public"."appointments" "a"
     JOIN "public"."professionals" "p" ON (("p"."id" = "a"."professional_id")))
  WHERE (("a"."id" = "notifications"."appointment_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "Users can update own professional specialties" ON "public"."professional_specialties" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."professionals" "p"
  WHERE (("p"."id" = "professional_specialties"."professional_id") AND ("p"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."professionals" "p"
  WHERE (("p"."id" = "professional_specialties"."professional_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."appointment_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clinic_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consultation_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."professional_specialties" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."professionals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."specialties" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."convert_request_to_appointment"("p_request_id" "uuid", "p_accepted_date" "date", "p_accepted_time" time without time zone, "p_professional_id" "uuid", "p_consultation_type_id" "uuid", "p_duration" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."convert_request_to_appointment"("p_request_id" "uuid", "p_accepted_date" "date", "p_accepted_time" time without time zone, "p_professional_id" "uuid", "p_consultation_type_id" "uuid", "p_duration" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."convert_request_to_appointment"("p_request_id" "uuid", "p_accepted_date" "date", "p_accepted_time" time without time zone, "p_professional_id" "uuid", "p_consultation_type_id" "uuid", "p_duration" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_accepted_slot_value"("slot_value" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_accepted_slot_value"("slot_value" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_accepted_slot_value"("slot_value" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_contact_phone_before_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_contact_phone_before_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_contact_phone_before_write"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_portuguese_phone_value"("phone_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_portuguese_phone_value"("phone_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_portuguese_phone_value"("phone_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_staff_on_appointment_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_staff_on_appointment_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_staff_on_appointment_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_appointment_request_names"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_appointment_request_names"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_appointment_request_names"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_appointment_snapshot_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_appointment_snapshot_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_appointment_snapshot_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_consultation_type_name"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_consultation_type_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_consultation_type_name"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_professional_name"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_professional_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_professional_name"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_request_professional_name"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_request_professional_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_request_professional_name"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_create_appointment_on_convert"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_create_appointment_on_convert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_create_appointment_on_convert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."appointment_requests" TO "anon";
GRANT ALL ON TABLE "public"."appointment_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_requests" TO "service_role";



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
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT UPDATE("is_read") ON TABLE "public"."notifications" TO "authenticated";



GRANT ALL ON TABLE "public"."patients" TO "anon";
GRANT ALL ON TABLE "public"."patients" TO "authenticated";
GRANT ALL ON TABLE "public"."patients" TO "service_role";



GRANT ALL ON TABLE "public"."professional_specialties" TO "anon";
GRANT ALL ON TABLE "public"."professional_specialties" TO "authenticated";
GRANT ALL ON TABLE "public"."professional_specialties" TO "service_role";



GRANT ALL ON TABLE "public"."professionals" TO "anon";
GRANT ALL ON TABLE "public"."professionals" TO "authenticated";
GRANT ALL ON TABLE "public"."professionals" TO "service_role";



GRANT ALL ON TABLE "public"."specialties" TO "anon";
GRANT ALL ON TABLE "public"."specialties" TO "authenticated";
GRANT ALL ON TABLE "public"."specialties" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



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
