import {spawn,execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const container='supabase_db_barnun-workbench';
const hooks=execFileSync('docker',['exec',container,'psql','-U','postgres','-d','postgres','-Atc',"select count(*) from pg_trigger where not tgisinternal and pg_get_triggerdef(oid) ~* 'http_request|http_post|net.http'"],{encoding:'utf8'}).trim();
assert.equal(hooks,'0');
const sql=input=>new Promise(resolve=>{const child=spawn('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-Atq','-v','ON_ERROR_STOP=1']);let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);child.on('error',e=>resolve({code:-1,output:e.message}));child.on('close',code=>resolve({code,output}));child.stdin.end(input);});
let fixture=readFileSync('supabase/tests/fixtures/treatments.sql','utf8');
const ids=new Map([...fixture.matchAll(/[0-9a-f]{8}-[0-9a-f-]{27,}/g)].map(m=>[m[0],randomUUID()]));
for(const [from,to] of ids)fixture=fixture.replaceAll(from,to);
fixture=fixture.replaceAll('TEST-TREATMENT',randomUUID()).replaceAll('@example.invalid',`-${randomUUID()}@example.invalid`);
const admin=ids.get('71000000-0000-0000-0000-000000000001'),patient=ids.get('75000000-0000-0000-0000-000000000001'),specialty=ids.get('72000000-0000-0000-0000-000000000001'),type=ids.get('73000000-0000-0000-0000-000000000001'),doctor=ids.get('74000000-0000-0000-0000-000000000001');
const setup=await sql(String.raw`begin;${fixture}
select public.save_treatment(null,null,'${JSON.stringify({patient_id:patient,specialty_id:specialty,name:'Concurrency'})}',array['${doctor}'::uuid],'${doctor}') as tid \gset
select public.save_treatment_session(null,null,:'tid','${JSON.stringify({name:'One',ordinal:1,consultation_type_id:type,primary_professional_id:doctor,duration:30})}','{}') as sid \gset
select public.save_treatment_session(null,null,:'tid','${JSON.stringify({name:'Two',ordinal:2,consultation_type_id:type,primary_professional_id:doctor,duration:30})}','{}') as sid2 \gset
select public.save_treatment_session(null,null,:'tid','${JSON.stringify({name:'Three',ordinal:3,consultation_type_id:type,primary_professional_id:doctor,duration:30})}','{}') as sid3 \gset
select 'RESULT:'||jsonb_build_object('tid',:'tid','sid',:'sid','sid2',:'sid2','sid3',:'sid3')::text;commit;`);
assert.equal(setup.code,0,setup.output);
const {tid,sid,sid2,sid3}=JSON.parse(setup.output.split('RESULT:')[1].trim());
const book=(id,time)=>`begin;select set_config('request.jwt.claims','{"sub":"${admin}","role":"authenticated"}',true);set local role authenticated;select public.book_treatment_sessions('${tid}','${JSON.stringify([{session_id:id,expected_version:1,date:'2026-11-10',time}])}');select pg_sleep(0.3);commit;`;
try{
 const same=await Promise.all([sql(book(sid,'10:00')),sql(book(sid,'10:00'))]);same.forEach(r=>assert.equal(r.code,0,r.output));
 let count=await sql(`select count(*) from public.appointments where patient_id='${patient}'`);assert.equal(count.output.trim(),'1');
 const conflict=await Promise.all([sql(book(sid2,'11:00')),sql(book(sid3,'11:00'))]);assert.equal(conflict.filter(r=>r.code===0).length,1,JSON.stringify(conflict));
 count=await sql(`select count(*) from public.appointments where patient_id='${patient}'`);assert.equal(count.output.trim(),'2');
 console.log('PASS: same session concurrent retry creates one appointment; conflicting sessions accept only one.');
}finally{
 const users=[...ids.entries()].filter(([key])=>key.startsWith('71')).map(([,id])=>`'${id}'`).join(',');
 const result=await sql(`begin;delete from public.treatment_session_professionals where session_id in(select id from public.treatment_sessions where treatment_id='${tid}');delete from public.treatment_sessions where treatment_id='${tid}';delete from public.treatment_professionals where treatment_id='${tid}';delete from public.treatments where id='${tid}';delete from public.notifications where appointment_id in(select id from public.appointments where patient_id='${patient}');delete from public.appointments where patient_id='${patient}';delete from public.patients where id='${patient}';delete from public.professionals where specialty_id='${specialty}';delete from public.consultation_types where id='${type}';delete from public.specialties where id='${specialty}';delete from public.user_roles where user_id in(${users});delete from public.user_profiles where user_id in(${users});delete from auth.users where id in(${users});commit;`);
 assert.equal(result.code,0,result.output);
}
