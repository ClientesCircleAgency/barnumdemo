-- Self-contained synthetic integration tests; all writes roll back.
begin;
select plan(6);
insert into public.specialties(id,name) values('20000000-0000-0000-0000-000000000021','Rollback test');
insert into public.consultation_types(id,name,specialty_id) values('30000000-0000-0000-0000-000000000021','Rollback type','20000000-0000-0000-0000-000000000021');
insert into public.professionals(id,name,specialty_id) values('40000000-0000-0000-0000-000000000021','Rollback doctor','20000000-0000-0000-0000-000000000021');
insert into public.appointment_requests(id,name,email,phone,nif,specialty_id,preferred_date,preferred_time,reason,assigned_professional_id) values
('60000000-0000-0000-0000-000000000021','Synthetic first','qa@example.invalid','+351900000000','SYNTHETIC-ROLLBACK-1','20000000-0000-0000-0000-000000000021','2026-10-26','09:00','Test','40000000-0000-0000-0000-000000000021'),
('60000000-0000-0000-0000-000000000022','Synthetic second','qa@example.invalid','+351900000000','SYNTHETIC-ROLLBACK-2','20000000-0000-0000-0000-000000000021','2026-10-26','09:00','Test','40000000-0000-0000-0000-000000000021');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select lives_ok($$select public.convert_request_to_appointment('60000000-0000-0000-0000-000000000021')$$,'legacy conversion supported');
select lives_ok($$select public.convert_request_to_appointment('60000000-0000-0000-0000-000000000021')$$,'retry is idempotent');
select is((select count(*)::integer from public.appointments where source_request_id='60000000-0000-0000-0000-000000000021'),1,'retry creates no duplicate');
select throws_ok($$select public.convert_request_to_appointment('60000000-0000-0000-0000-000000000022')$$,'23514',null,'conflict rejects second conversion');
select is((select status::text from public.appointment_requests where id='60000000-0000-0000-0000-000000000022'),'pending','failed request unchanged');
select is((select count(*)::integer from public.patients where nif='SYNTHETIC-ROLLBACK-2'),0,'patient insert rolled back with failed reservation');
select * from finish();
rollback;
