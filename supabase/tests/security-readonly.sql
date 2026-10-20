-- Safe to run against production: assertions use catalog metadata only.
begin read only;
do $$
begin
  if has_function_privilege('anon', 'public.convert_request_to_appointment(uuid,date,time,uuid,uuid,integer)', 'EXECUTE') then
    raise exception 'FAIL: anonymous conversion is allowed';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notifications' and cmd='SELECT') then
    raise exception 'FAIL: notifications cannot be read';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='notifications') then
    raise exception 'FAIL: notification realtime is missing';
  end if;
  if has_column_privilege('authenticated','public.notifications','user_id','UPDATE') then
    raise exception 'FAIL: notification ownership can be changed';
  end if;
end;
$$;
select 'security assertions passed' as result;
rollback;
