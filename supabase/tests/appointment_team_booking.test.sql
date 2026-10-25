begin;
select plan(15);
insert into auth.users(id,email) values
 ('10000000-0000-0000-0000-000000000001','admin@test.invalid'),
 ('10000000-0000-0000-0000-000000000002','doctor@test.invalid');
insert into public.user_roles(user_id,role) values
 ('10000000-0000-0000-0000-000000000001','admin'),
 ('10000000-0000-0000-0000-000000000002','doctor');
insert into public.specialties(id,name) values ('20000000-0000-0000-0000-000000000001','Test Dental');
insert into public.consultation_types(id,name,specialty_id) values ('30000000-0000-0000-0000-000000000001','Test Checkup','20000000-0000-0000-0000-000000000001');
insert into public.professionals(id,name,specialty_id,user_id) values
 ('40000000-0000-0000-0000-000000000001','Test A','20000000-0000-0000-0000-000000000001',null),
 ('40000000-0000-0000-0000-000000000002','Test B','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002');
insert into public.patients(id,nif,name,phone) values ('50000000-0000-0000-0000-000000000001','TEST-TEAM-1','Synthetic Patient','+351900000000');
insert into public.user_profiles(user_id,full_name,working_hours) values
 ('10000000-0000-0000-0000-000000000002','Test B','[{"day":"Segunda","enabled":true,"start":"16:00","end":"19:00"}]')
on conflict(user_id) do update set working_hours=excluded.working_hours;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is((select reason from public.get_appointment_team_availability('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','2026-10-26','13:00',30,null) where professional_id='40000000-0000-0000-0000-000000000002'), 'working_hours', 'Monday 13:00 outside additional doctor shift');
select lives_ok($$select public.save_appointment_team(null,null,'{"patient_id":"50000000-0000-0000-0000-000000000001","professional_id":"40000000-0000-0000-0000-000000000001","specialty_id":"20000000-0000-0000-0000-000000000001","consultation_type_id":"30000000-0000-0000-0000-000000000001","date":"2026-10-26","time":"16:00","duration":30}',array['40000000-0000-0000-0000-000000000002'::uuid])$$,'atomic team creation succeeds');
select is((select count(*)::integer from public.appointments where patient_id='50000000-0000-0000-0000-000000000001'),1,'only one appointment');
select is((select count(*)::integer from public.appointment_additional_professionals),1,'additional participant saved');
select is((select reason from public.get_appointment_team_availability('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','2026-10-26','16:00',30,null) where professional_id='40000000-0000-0000-0000-000000000002'),'conflict','additional doctor blocks another appointment');
select is((select available from public.get_appointment_team_availability('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','2026-10-26','16:30',30,null) where professional_id='40000000-0000-0000-0000-000000000002'),true,'adjacent appointments allowed');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from public.appointments where patient_id='50000000-0000-0000-0000-000000000001'),1,'additional doctor can read consultation');
select throws_ok($$select public.save_appointment_team((select id from public.appointments limit 1),1,'{"time":"17:00"}',array['40000000-0000-0000-0000-000000000002'::uuid])$$,'42501','forbidden','additional doctor cannot reschedule');
select lives_ok($$select public.set_appointment_state((select id from public.appointments limit 1),1,'completed','Synthetic final note',false)$$,'additional doctor can conclude');
select is((select send_review from public.appointments limit 1),false,'finalization preserves review opt-out');
select lives_ok($$insert into public.appointment_notes(appointment_id,author_user_id,note) select id,'10000000-0000-0000-0000-000000000002','Additional doctor note' from public.appointments limit 1$$,'additional doctor can append authored notes');
select throws_ok($$insert into public.appointment_notes(appointment_id,author_user_id,note) select id,'10000000-0000-0000-0000-000000000001','Forged note' from public.appointments limit 1$$,'42501',null,'cannot forge note author');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.save_appointment_team((select id from public.appointments limit 1),1,'{"time":"17:00"}',array['40000000-0000-0000-0000-000000000002'::uuid])$$,'40001','stale_version','stale editor cannot overwrite conclusion');
reset role;
select throws_ok($$insert into public.appointments(patient_id,professional_id,specialty_id,consultation_type_id,date,time,duration) values('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','2026-10-26','16:00',30)$$,'23514',null,'direct privileged writes also detect additional conflicts');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.save_appointment_team(null,null,'{"patient_id":"50000000-0000-0000-0000-000000000001","professional_id":"40000000-0000-0000-0000-000000000002","specialty_id":"20000000-0000-0000-0000-000000000001","consultation_type_id":"30000000-0000-0000-0000-000000000001","date":"2026-10-26","time":"16:30","duration":30}','{}'::uuid[])$$,'existing doctor own single-appointment creation remains available');
select * from finish();
rollback;
