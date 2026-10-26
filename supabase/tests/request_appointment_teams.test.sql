begin;
select plan(10);
select has_function('public','convert_request_to_appointment_with_team',array['uuid','date','time without time zone','uuid','uuid','integer','uuid[]'],'team conversion RPC exists');
insert into public.specialties(id,name) values('20000000-0000-0000-0000-000000000011','Synthetic dental');
insert into public.consultation_types(id,name,specialty_id) values('30000000-0000-0000-0000-000000000011','Synthetic type','20000000-0000-0000-0000-000000000011');
insert into public.professionals(id,name,specialty_id) values
('40000000-0000-0000-0000-000000000011','Synthetic A','20000000-0000-0000-0000-000000000011'),
('40000000-0000-0000-0000-000000000012','Synthetic B','20000000-0000-0000-0000-000000000011');
insert into public.appointment_requests(id,name,email,phone,nif,specialty_id,preferred_date,preferred_time,reason)
values('60000000-0000-0000-0000-000000000011','Synthetic request','test@example.invalid','+351900000000','TEST-REQUEST-TEAM','20000000-0000-0000-0000-000000000011','2026-10-26','16:00','Test');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select lives_ok($$select public.convert_request_to_appointment_with_team('60000000-0000-0000-0000-000000000011',null,null,'40000000-0000-0000-0000-000000000011','30000000-0000-0000-0000-000000000011',30,array['40000000-0000-0000-0000-000000000012'::uuid])$$,'request converts with complete team');
select is((select count(*)::integer from public.appointment_additional_professionals ap join public.appointments a on a.id=ap.appointment_id join public.patients p on p.id=a.patient_id where p.nif='TEST-REQUEST-TEAM'),1,'one additional participation');

select is((select professional_names from public.appointments where source_request_id='60000000-0000-0000-0000-000000000011'),array['Synthetic A','Synthetic B'],'RPC stores complete names, primary first');
create temporary table webhook_snapshot(names text[]);
create function pg_temp.capture_team_names() returns trigger language plpgsql as $$ begin insert into pg_temp.webhook_snapshot values(new.professional_names);return new;end; $$;
create trigger test_capture_team after insert or update on public.appointments for each row execute function pg_temp.capture_team_names();
insert into public.appointment_requests(id,name,email,phone,nif,specialty_id,preferred_date,preferred_time,reason)
values('60000000-0000-0000-0000-000000000012','Synthetic PATCH','patch@example.invalid','+351900000000','TEST-PATCH-TEAM','20000000-0000-0000-0000-000000000011','2026-10-27','16:00','Test');
select lives_ok($patch$update public.appointment_requests set status='converted',accepted_slot='{"date":"2026-10-27","time":"16:00","professional_id":"40000000-0000-0000-0000-000000000012","additional_professional_ids":["40000000-0000-0000-0000-000000000011"],"consultation_type_id":"30000000-0000-0000-0000-000000000011","duration":45}'::jsonb where id='60000000-0000-0000-0000-000000000012'$patch$,'direct WhatsApp PATCH converts complete team');
select is((select duration from public.appointments where source_request_id='60000000-0000-0000-0000-000000000012'),45,'PATCH preserves duration');
select is((select professional_names from public.appointments where source_request_id='60000000-0000-0000-0000-000000000012'),array['Synthetic B','Synthetic A'],'PATCH stores names in primary-first order');
select ok(not exists(select 1 from webhook_snapshot where names is distinct from array['Synthetic B','Synthetic A']),'every initial webhook already contains complete team names');
select lives_ok($patch$update public.appointment_requests set status='converted' where id='60000000-0000-0000-0000-000000000012'$patch$,'repeated direct PATCH is idempotent');
select public.save_appointment_team(id,version,'{}','{}'::uuid[]) from public.appointments where source_request_id='60000000-0000-0000-0000-000000000012';
select is((select professional_names from public.appointments where source_request_id='60000000-0000-0000-0000-000000000012'),array['Synthetic B'],'removing additional doctor refreshes names');

select * from finish();
rollback;
