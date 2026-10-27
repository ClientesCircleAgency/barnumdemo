begin;
-- TREATMENT_FIXTURE
select no_plan();
select public.save_treatment(null,null,'{"patient_id":"75000000-0000-0000-0000-000000000001","specialty_id":"72000000-0000-0000-0000-000000000001","name":"Plan"}',array['74000000-0000-0000-0000-000000000001'::uuid],'74000000-0000-0000-0000-000000000001') as tid \gset
select public.save_treatment_session(null,null,:'tid','{"name":"First","ordinal":1,"duration":30,"consultation_type_id":"73000000-0000-0000-0000-000000000001","primary_professional_id":"74000000-0000-0000-0000-000000000001"}','{}') as sid \gset
select public.save_treatment_session(null,null,:'tid','{"name":"Second","ordinal":2,"duration":30,"consultation_type_id":"73000000-0000-0000-0000-000000000001","primary_professional_id":"74000000-0000-0000-0000-000000000001"}','{}') as sid2 \gset
select jsonb_build_array(jsonb_build_object('session_id',:'sid','expected_version',1,'date','2026-11-10','time','10:00'),jsonb_build_object('session_id',:'sid2','expected_version',1,'date','2026-11-10','time','10:00')) as badslots \gset
select throws_ok(format('select public.book_treatment_sessions(%L,%L)',:'tid',:'badslots'),'23514',null,'overlapping batch rejected');
select is((select count(*)::int from public.appointments where patient_id='75000000-0000-0000-0000-000000000001'),0,'batch rollback leaves zero appointments');
select jsonb_build_array(jsonb_build_object('session_id',:'sid','expected_version',1,'date','2026-11-10','time','10:00')) as slots \gset
select lives_ok(format('select public.book_treatment_sessions(%L,%L)',:'tid',:'slots'),'book session');
select lives_ok(format('select public.book_treatment_sessions(%L,%L)',:'tid',:'slots'),'retry idempotent despite old session version');
select is((select count(*)::int from public.appointments where patient_id='75000000-0000-0000-0000-000000000001'),1,'one appointment');
select throws_ok(format('select public.book_treatment_sessions(%L,%L)',:'tid',replace(:'slots','10:00','11:00')),'P0001',null,'different retry does not reschedule');
select appointment_id as aid from public.treatment_sessions where id=:'sid' \gset
select throws_ok(format('select public.link_treatment_appointment(%L,1,%L)',:'sid2',:'aid'),'23505',null,'appointment cannot belong to two steps');
select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select throws_ok(format('select public.book_treatment_sessions(%L,%L)',:'tid',:'slots'),'42501','forbidden','reader cannot book');
reset role;
select * from finish();rollback;
