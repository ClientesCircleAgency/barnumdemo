-- Integration checks: all fixtures and webhook queue entries roll back.
begin;
set local statement_timeout = '20s';
select set_config('request.jwt.claim.sub', (select user_id::text from public.user_roles where role='admin' limit 1), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
do $$
declare
  request_id uuid;
  appointment_id uuid;
  professional_id uuid;
  specialty_id uuid;
  rejected boolean;
begin
  select p.id,p.specialty_id into professional_id,specialty_id from public.professionals p where p.specialty_id is not null limit 1;
  if professional_id is null then raise exception 'No professional fixture available'; end if;
  insert into public.appointment_requests(name,email,phone,nif,reason,specialty_id,preferred_date,preferred_time,status)
  values ('QA rollback only','qa@example.test','910000000','999999990','QA rollback',specialty_id,'2099-11-10','09:00','pending') returning id into request_id;
  appointment_id := public.convert_request_to_appointment(request_id,'2099-11-10','09:00',professional_id,null,30);
  if not exists(select 1 from public.appointments where id=appointment_id and status='confirmed') then
    raise exception 'FAIL: appointment was not confirmed';
  end if;
  if not exists(select 1 from public.appointment_requests where id=request_id and status='converted') then
    raise exception 'FAIL: request was not processed';
  end if;
  if (select count(*) from public.appointments where date='2099-11-10' and notes like '%999999990%') <> 1 then
    raise exception 'FAIL: duplicate appointment created';
  end if;
  rejected := false;
  begin
    perform public.convert_request_to_appointment(request_id,'2099-11-10','09:00',professional_id,null,30);
  exception when raise_exception then rejected := true;
  end;
  if not rejected then raise exception 'FAIL: repeated conversion accepted'; end if;

  insert into public.appointment_requests(name,email,phone,nif,reason,specialty_id,preferred_date,preferred_time,status)
  values ('QA rollback only','qa@example.test','910000000','999999991','QA rollback',specialty_id,'2099-11-10','09:15','pending') returning id into request_id;
  rejected := false;
  begin
    perform public.convert_request_to_appointment(request_id,'2099-11-10','09:15',professional_id,null,30);
  exception when raise_exception then rejected := true;
  end;
  if not rejected then raise exception 'FAIL: overlapping booking accepted'; end if;
  update public.appointment_requests set status='rejected' where id=request_id;
  rejected := false;
  begin
    perform public.convert_request_to_appointment(request_id,'2099-11-10','11:00',professional_id,null,30);
  exception when raise_exception then rejected := true;
  end;
  if not rejected then raise exception 'FAIL: rejected request converted'; end if;
end;
$$;
select 'conversion integration checks passed; fixtures rolled back' as result;
rollback;
