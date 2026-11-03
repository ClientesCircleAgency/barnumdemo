begin;
-- TREATMENT_FIXTURE
select no_plan();
select public.save_treatment(null,null,'{"patient_id":"75000000-0000-0000-0000-000000000001","specialty_id":"72000000-0000-0000-0000-000000000001","name":"Plan"}',array['74000000-0000-0000-0000-000000000001'::uuid],'74000000-0000-0000-0000-000000000001') as tid \gset
select is((select name from public.treatments where id=:'tid'),'Plan','manager creates treatment');
select public.save_treatment_session(null,null,:'tid','{"name":"First","kind":"consultation","ordinal":1,"duration":30,"consultation_type_id":"73000000-0000-0000-0000-000000000001","primary_professional_id":"74000000-0000-0000-0000-000000000001"}','{}') as sid \gset
select throws_ok(format('select public.set_treatment_state(%L,1,''completed'')',:'tid'),'P0001','pending_sessions','pending steps prevent closing');
select throws_ok(format('select public.save_treatment(%L,0,''{"name":"Changed"}'',''{}'',null)',:'tid'),'40001','stale_version','stale writes fail');
select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select is((select count(*)::int from public.treatments where id=:'tid'),1,'other doctor reads');
select throws_ok(format('select public.save_treatment_session(null,null,%L,''{}'',''{}'')',:'tid'),'42501','forbidden','doctor cannot manage plans');
select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000005","role":"authenticated"}',true);
select is((select count(*)::int from public.treatments where id=:'tid'),0,'nonstaff cannot read');
select throws_ok(format('update public.treatments set name=''Forged'' where id=%L',:'tid'),'42501',null,'direct writes denied');
select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select lives_ok(format('select public.omit_treatment_session(%L,1,''No longer required'')',:'sid'),'secretary omits unbooked step');
select lives_ok(format('select public.set_treatment_state(%L,1,''completed'')',:'tid'),'secretary closes resolved treatment');
select is((select count(*)::int from public.treatment_state_events where treatment_id=:'tid'),1,'state audit recorded');
reset role;
set local role anon;
select throws_ok('select * from public.treatments','42501',null,'anonymous no access');
reset role;
select * from finish();
rollback;
