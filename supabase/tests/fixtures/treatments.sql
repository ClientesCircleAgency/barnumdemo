create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
insert into auth.users(id,email) values
('71000000-0000-0000-0000-000000000001','t-admin@example.invalid'),
('71000000-0000-0000-0000-000000000002','t-secretary@example.invalid'),
('71000000-0000-0000-0000-000000000003','t-doctor@example.invalid'),
('71000000-0000-0000-0000-000000000004','t-reader@example.invalid'),
('71000000-0000-0000-0000-000000000005','t-none@example.invalid');
insert into public.user_roles(user_id,role) values
('71000000-0000-0000-0000-000000000001','admin'),('71000000-0000-0000-0000-000000000002','secretary'),
('71000000-0000-0000-0000-000000000003','doctor'),('71000000-0000-0000-0000-000000000004','doctor');
insert into public.specialties(id,name) values('72000000-0000-0000-0000-000000000001','Treatment test specialty');
insert into public.consultation_types(id,name,specialty_id) values('73000000-0000-0000-0000-000000000001','Treatment test type','72000000-0000-0000-0000-000000000001');
insert into public.professionals(id,name,specialty_id,user_id) values
('74000000-0000-0000-0000-000000000001','Treatment doctor','72000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000003'),
('74000000-0000-0000-0000-000000000002','Treatment reader','72000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000004');
insert into public.patients(id,nif,name,phone) values('75000000-0000-0000-0000-000000000001','TEST-TREATMENT','Synthetic treatment patient','+351900000000');
select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
