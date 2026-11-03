begin;
-- TREATMENT_FIXTURE
select no_plan();
select public.save_treatment(null,null,'{"patient_id":"75000000-0000-0000-0000-000000000001","specialty_id":"72000000-0000-0000-0000-000000000001","name":"Plan"}',array['74000000-0000-0000-0000-000000000001'::uuid],'74000000-0000-0000-0000-000000000001') as tid \gset
select public.save_treatment_session(null,null,:'tid','{"name":"First","ordinal":1,"duration":30,"consultation_type_id":"73000000-0000-0000-0000-000000000001","primary_professional_id":"74000000-0000-0000-0000-000000000001"}','{}') as sid \gset
select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select public.save_treatment_comment(null,null,:'sid','Original private comment') as cid \gset
select is((select author_user_id::text from public.treatment_session_comments where id=:'cid'),'71000000-0000-0000-0000-000000000003','author from session');
select lives_ok(format('select public.save_treatment_comment(%L,1,%L,''Edited'')',:'cid',:'sid'),'author edits');
select throws_ok(format('select public.save_treatment_comment(%L,1,%L,''Stale'')',:'cid',:'sid'),'40001','stale_version','stale edit rejected');
select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select is((select count(*)::int from public.treatment_session_comments where id=:'cid'),1,'nonparticipant reads');
select throws_ok(format('select public.save_treatment_comment(null,null,%L,''Forged'')',:'sid'),'42501','forbidden','nonparticipant cannot comment');
select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select throws_ok(format('select public.save_treatment_comment(%L,2,%L,''Other author'')',:'cid',:'sid'),'42501','forbidden','secretary cannot edit another author');
select lives_ok(format('select public.save_treatment_comment(null,null,%L,''Secretariat comment'')',:'sid'),'secretary comments');
select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok(format('select public.save_treatment_comment(%L,2,%L,''Admin edit'')',:'cid',:'sid'),'admin edits anyone');
select is((select author_user_id::text from public.treatment_session_comments where id=:'cid'),'71000000-0000-0000-0000-000000000003','admin preserves author');
select is((select count(*)::int from public.treatment_comment_revisions where comment_id=:'cid'),2,'immutable revisions');
select throws_ok('delete from public.treatment_comment_revisions','42501',null,'cannot erase revisions');
select public.book_treatment_sessions(:'tid',jsonb_build_array(jsonb_build_object('session_id',:'sid','expected_version',1,'date','2026-11-10','time','10:00')));
select appointment_id as aid from public.treatment_sessions where id=:'sid' \gset
select lives_ok(format('select public.finalize_appointment_with_observation(%L,1,''Patient message'',false,''INTERNAL ONLY'')',:'aid'),'atomic conclusion with internal text');
select is((select final_notes from public.appointments where id=:'aid'),'Patient message','external note separate');
select is((select body from public.appointment_clinical_observations where appointment_id=:'aid'),'INTERNAL ONLY','internal observation stored separately');
select public.finalize_appointment_with_observation(:'aid',1,'Patient message',false,'INTERNAL ONLY');
select is((select count(*)::int from public.appointment_clinical_observations where appointment_id=:'aid'),1,'conclusion retry does not duplicate observation');
select throws_ok(format('select public.save_treatment_comment(null,null,%L,''   '')',:'sid'),'P0001','invalid_body','empty comment rejected');
select throws_ok(format('select public.save_clinical_observation(null,null,%L,repeat(''x'',20001))',:'aid'),'P0001','invalid_body','oversized internal observation rejected');
select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select public.save_clinical_observation(null,null,:'aid','Author clinical text') as oid \gset
reset role;
-- Simulate a team change through the established team API as admin.
select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select version as av from public.appointments where id=:'aid' \gset
select public.save_appointment_team(:'aid',:'av','{"professional_id":"74000000-0000-0000-0000-000000000002"}','{}');
select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select throws_ok(format('select public.save_treatment_comment(%L,3,%L,''Removed author edit'')',:'cid',:'sid'),'42501','forbidden','removed doctor loses editing access even to own comment');
select throws_ok(format('select public.save_clinical_observation(%L,1,%L,''Removed author edit'')',:'oid',:'aid'),'42501','forbidden','removed doctor loses observation editing access');
select is((public.get_treatment_session_context(:'tid')->0->>'can_write')::boolean,false,'session context uses actual appointment team');
select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select lives_ok(format('select public.save_treatment_comment(null,null,%L,''New participant'')',:'sid'),'current doctor can comment despite different planned team');
reset role;
select * from finish();rollback;
