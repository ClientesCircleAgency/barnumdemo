-- Catalog assertions. pgTAP executes inside a rolled-back local transaction.
begin;
select plan(4);
select ok(not has_function_privilege('anon','public.convert_request_to_appointment(uuid,date,time,uuid,uuid,integer)','EXECUTE'),'anonymous conversion denied');
select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='notifications' and cmd='SELECT'),'notification reading has a policy');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='notifications'),'notification realtime enabled');
select ok(not has_column_privilege('authenticated','public.notifications','user_id','UPDATE'),'notification ownership cannot be changed');
select * from finish();
rollback;
