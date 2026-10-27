begin;
-- TREATMENT_FIXTURE
reset role;
create temp table treatment_event_capture(operation text, payload jsonb);
create function pg_temp.capture_treatment_event() returns trigger language plpgsql security definer as $$
begin insert into pg_temp.treatment_event_capture values(TG_OP,to_jsonb(NEW)); return NEW; end $$;
create trigger treatment_test_capture after insert or update on public.appointments for each row execute function pg_temp.capture_treatment_event();
grant select on treatment_event_capture to authenticated;
set local role authenticated;
select no_plan();
select public.save_treatment(null,null,'{"patient_id":"75000000-0000-0000-0000-000000000001","specialty_id":"72000000-0000-0000-0000-000000000001","name":"Plan"}',array['74000000-0000-0000-0000-000000000001'::uuid],'74000000-0000-0000-0000-000000000001') as tid \gset
select public.save_treatment_session(null,null,:'tid','{"name":"First","ordinal":1,"duration":30,"consultation_type_id":"73000000-0000-0000-0000-000000000001","primary_professional_id":"74000000-0000-0000-0000-000000000001"}','{}') as sid \gset
select public.save_treatment_comment(null,null,:'sid','PRIVATE-COMMENT-MARKER') as cid \gset
select public.save_treatment_comment(:'cid',1,:'sid','PRIVATE-EDIT-MARKER');
select is((select count(*)::int from treatment_event_capture),0,'planning and comment edits emit no appointment events');
select jsonb_build_array(jsonb_build_object('session_id',:'sid','expected_version',1,'date','2026-11-10','time','10:00')) as slots \gset
select public.book_treatment_sessions(:'tid',:'slots');
select is((select count(*)::int from treatment_event_capture where operation='INSERT'),1,'booking emits one normal insertion');
select is((select count(*)::int from treatment_event_capture where operation='UPDATE'),0,'session link adds no technical update');
select public.book_treatment_sessions(:'tid',:'slots');
select is((select count(*)::int from treatment_event_capture),1,'booking retry emits nothing');
select appointment_id as aid from public.treatment_sessions where id=:'sid' \gset
select public.finalize_appointment_with_observation(:'aid',1,'PUBLIC-PATIENT-MESSAGE',false,'PRIVATE-CLINICAL-MARKER');
select is((select count(*)::int from treatment_event_capture where operation='UPDATE'),1,'conclusion emits one normal update');
select is((select payload->>'final_notes' from treatment_event_capture where operation='UPDATE'),'PUBLIC-PATIENT-MESSAGE','public note remains in normal payload');
select is((select count(*)::int from treatment_event_capture where payload::text like '%PRIVATE-%'),0,'no internal comment or observation enters full appointment payload');
select public.finalize_appointment_with_observation(:'aid',1,'PUBLIC-PATIENT-MESSAGE',false,'PRIVATE-CLINICAL-MARKER');
select is((select count(*)::int from treatment_event_capture),2,'conclusion retry emits nothing');
select version as tv from public.treatments where id=:'tid' \gset
select public.set_treatment_state(:'tid',:'tv','completed');
select is((select count(*)::int from treatment_event_capture),2,'closing treatment emits no appointment event');
reset role;
select * from finish();
rollback;
