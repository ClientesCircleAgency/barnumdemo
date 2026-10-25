begin;
select plan(3);
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
select * from finish();
rollback;
