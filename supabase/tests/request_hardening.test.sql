begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into public.specialties(id,name) values('20000000-0000-0000-0000-000000000011','Synthetic dental');
insert into public.consultation_types(id,name,specialty_id) values('30000000-0000-0000-0000-000000000011','Synthetic type','20000000-0000-0000-0000-000000000011');
insert into public.professionals(id,name,specialty_id) values
('40000000-0000-0000-0000-000000000011','Synthetic A','20000000-0000-0000-0000-000000000011'),
('40000000-0000-0000-0000-000000000012','Synthetic B','20000000-0000-0000-0000-000000000011');
insert into public.appointment_requests(id,name,email,phone,nif,specialty_id,preferred_date,preferred_time,reason)
values('60000000-0000-0000-0000-000000000011','Synthetic request','test@example.invalid','+351900000000','TEST-REQUEST-TEAM','20000000-0000-0000-0000-000000000011','2026-10-26','16:00','Test');

set local role anon;
select lives_ok($q$insert into public.appointment_requests(name,email,phone,nif,specialty_id,preferred_date,preferred_time,reason) values('Test','test@example.invalid','+351900000000','TEST-PUBLIC','20000000-0000-0000-0000-000000000011','2026-11-01','10:00','Test')$q$,'public pending request allowed');
select throws_ok(format($q$insert into public.appointment_requests(name,email,phone,nif,specialty_id,preferred_date,preferred_time,reason,%s) values('Test','test@example.invalid','+351900000000','TEST-PUBLIC','20000000-0000-0000-0000-000000000011','2026-11-01','10:00','Test',%s)$q$,column_name,expression),'42501',null,'public cannot supply '||column_name||'='||expression)
from (values ('status',$v$'rejected'$v$),('status',$v$'suggested'$v$),('accepted_slot',$v$'{}'::jsonb$v$),('suggested_slots',$v$'[{}]'::jsonb$v$),('rejection_reason',$v$'injected'$v$),('cancel_reason',$v$'injected'$v$),('assigned_professional_id',$v$'40000000-0000-0000-0000-000000000011'::uuid$v$),('suggestion_expires_at','now()')) as cases(column_name,expression);
select throws_ok('insert into public.appointment_requests(id) values(gen_random_uuid())','42501',null,'public cannot choose id');
select throws_ok('insert into public.appointment_requests(estimated_duration) values(90)','42501',null,'public cannot choose duration');
select throws_ok('insert into public.appointment_requests(created_at) values(now())','42501',null,'public cannot choose created_at');
reset role;
insert into auth.users(id,email) values ('10000000-0000-0000-0000-000000000071','secretary-test@example.invalid'),('10000000-0000-0000-0000-000000000072','unprivileged-test@example.invalid');
insert into public.user_roles(user_id,role) values ('10000000-0000-0000-0000-000000000071','secretary');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000072","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($q$insert into public.appointment_requests(name,email,phone,nif,specialty_id,preferred_date,preferred_time,reason,status) values('Test','test@example.invalid','+351900000000','TEST-AUTH','20000000-0000-0000-0000-000000000011','2026-11-01','10:00','Test','suggested')$q$,'42501',null,'unprivileged authenticated user cannot bypass pending requirement');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000071","role":"authenticated"}',true);
select lives_ok($q$insert into public.appointment_requests(name,email,phone,nif,specialty_id,preferred_date,preferred_time,reason,status) values('Test','test@example.invalid','+351900000000','TEST-STAFF','20000000-0000-0000-0000-000000000011','2026-11-01','10:00','Test','suggested')$q$,'secretary retains request management');
reset role;
insert into public.patients(name,phone,email,nif) values('Verified patient','+351911111111','verified@example.invalid','TEST-REQUEST-TEAM');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.convert_request_to_appointment_with_team('60000000-0000-0000-0000-000000000011',null,null,'40000000-0000-0000-0000-000000000011','30000000-0000-0000-0000-000000000011',30,array['40000000-0000-0000-0000-000000000012'::uuid]);
select is((select name from public.patients where nif='TEST-REQUEST-TEAM'),'Verified patient','conversion preserves verified name');
select is((select phone from public.patients where nif='TEST-REQUEST-TEAM'),'+351911111111','conversion preserves verified phone');
select is((select email from public.patients where nif='TEST-REQUEST-TEAM'),'verified@example.invalid','conversion preserves verified email');
select version as contact_version from public.appointments where source_request_id='60000000-0000-0000-0000-000000000011' \gset
update public.patients set name='Corrected patient',phone='+351922222222' where nif='TEST-REQUEST-TEAM';
select is((select version from public.appointments where source_request_id='60000000-0000-0000-0000-000000000011'),:'contact_version'::bigint,'contact-only sync preserves booking version');
select is((select patient_phone from public.appointments where source_request_id='60000000-0000-0000-0000-000000000011'),'+351922222222','open appointment gets corrected phone');
select is((select patient_name from public.appointments where source_request_id='60000000-0000-0000-0000-000000000011'),'Corrected patient','open appointment gets corrected name');
select version as mixed_version from public.appointments where source_request_id='60000000-0000-0000-0000-000000000011' \gset
update public.appointments set patient_name='Mixed contact update',notes='Booking edit at the same time' where source_request_id='60000000-0000-0000-0000-000000000011';
select is((select version from public.appointments where source_request_id='60000000-0000-0000-0000-000000000011'),:'mixed_version'::bigint+1,'contact plus another field still increments version');
select public.set_appointment_state(id,version,'completed','Original notes',false) from public.appointments where source_request_id='60000000-0000-0000-0000-000000000011';
-- Use a past timestamp to detect an accidental reset; now() is constant per transaction.
update public.appointments set finalized_at='2026-01-01T10:00:00Z' where source_request_id='60000000-0000-0000-0000-000000000011';
select public.set_appointment_state(id,version,'in_progress') from public.appointments where source_request_id='60000000-0000-0000-0000-000000000011';
select public.set_appointment_state(id,version,'completed',' ',null) from public.appointments where source_request_id='60000000-0000-0000-0000-000000000011';
select is((select final_notes from public.appointments where source_request_id='60000000-0000-0000-0000-000000000011'),null::text,'empty re-finalization clears notes');
select is((select finalized_at from public.appointments where source_request_id='60000000-0000-0000-0000-000000000011'),'2026-01-01T10:00:00Z'::timestamptz,'re-finalization preserves original timestamp');
select is((select send_review from public.appointments where source_request_id='60000000-0000-0000-0000-000000000011'),false,'re-finalization preserves review opt-out');
update public.patients set phone='+351955555555' where nif='TEST-REQUEST-TEAM';
select is((select patient_phone from public.appointments where source_request_id='60000000-0000-0000-0000-000000000011'),'+351922222222','completed review-disabled history untouched');
update public.appointments set send_review=true where source_request_id='60000000-0000-0000-0000-000000000011';
update public.patients set phone='+351933333333' where nif='TEST-REQUEST-TEAM';
select is((select patient_phone from public.appointments where source_request_id='60000000-0000-0000-0000-000000000011'),'+351922222222','old completed history remains unchanged');
select is((select finalized_at from public.appointments where source_request_id='60000000-0000-0000-0000-000000000011'),'2026-01-01T10:00:00Z'::timestamptz,'contact sync never restarts review timer');
update public.appointments set status='cancelled' where source_request_id='60000000-0000-0000-0000-000000000011';
update public.patients set phone='+351944444444' where nif='TEST-REQUEST-TEAM';
select is((select patient_phone from public.appointments where source_request_id='60000000-0000-0000-0000-000000000011'),'+351922222222','cancelled history untouched');
update public.appointments set status='completed',finalized_at=now()-interval '2 hours',send_review=true,final_notes='Keep this' where source_request_id='60000000-0000-0000-0000-000000000011';
update public.patients set phone='+351966666666' where nif='TEST-REQUEST-TEAM';
select is((select patient_phone from public.appointments where source_request_id='60000000-0000-0000-0000-000000000011'),'+351966666666','recent completed review gets corrected phone');
select public.set_appointment_state(id,version,'in_progress') from public.appointments where source_request_id='60000000-0000-0000-0000-000000000011';
select public.set_appointment_state(id,version,'completed',null,null) from public.appointments where source_request_id='60000000-0000-0000-0000-000000000011';
select is((select final_notes from public.appointments where source_request_id='60000000-0000-0000-0000-000000000011'),'Keep this','null preserves previous notes');
select * from finish();
rollback;
