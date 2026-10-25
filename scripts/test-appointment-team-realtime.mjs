import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const networkCount=execFileSync('docker',['exec','supabase_db_barnun-workbench','psql','-U','postgres','-d','postgres','-Atq','-c',"select count(*) from pg_trigger where not tgisinternal and pg_get_triggerdef(oid) ~* 'http_request|http_post|net.http'"],{encoding:'utf8'}).trim();
assert.equal(networkCount,'0','Refusing tests while local outbound webhooks exist');

const state=JSON.parse(execFileSync('supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(state.API_URL,'http://127.0.0.1:46321','This test may only run on the Barnun Workbench');
const options={auth:{persistSession:false,autoRefreshToken:false}};
const service=createClient(state.API_URL,state.SERVICE_ROLE_KEY,options);
const staff=createClient(state.API_URL,state.ANON_KEY,options);
const doctor=createClient(state.API_URL,state.ANON_KEY,options);
const users=[];
const [specialty,type,primary,additional,patient]=Array.from({length:5},randomUUID);
let appointment;
let channel;
async function ok(result){const {data,error}=await result;if(error) throw new Error(error.message);return data;}
const events=[];
async function waitForEvent(predicate){
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){if(events.some(predicate)) return;await new Promise(resolve=>setTimeout(resolve,100));}
  throw new Error('Realtime did not deliver the shared appointment update');
}
try {
  for(const role of ['admin','doctor','doctor']){
    const email=`workbench-${randomUUID()}@example.invalid`,password=randomUUID();
    const {user}=await ok(service.auth.admin.createUser({email,password,email_confirm:true}));
    users.push(user.id);
    await ok(service.from('user_roles').insert({user_id:user.id,role}));
    await ok(service.from('user_profiles').upsert({user_id:user.id,full_name:`Synthetic ${role}`}));
    if(users.length===1) await ok(staff.auth.signInWithPassword({email,password}));
    if(users.length===3) await ok(doctor.auth.signInWithPassword({email,password}));
  }
  await ok(service.from('specialties').insert({id:specialty,name:'Synthetic realtime'}));
  await ok(service.from('consultation_types').insert({id:type,specialty_id:specialty,name:'Synthetic realtime'}));
  await ok(service.from('professionals').insert([{id:primary,name:'Synthetic A',specialty_id:specialty,user_id:users[1]},{id:additional,name:'Synthetic B',specialty_id:specialty,user_id:users[2]}]));
  await ok(service.from('patients').insert({id:patient,nif:patient,name:'Synthetic realtime patient',phone:'+351900000000'}));
  channel=doctor.channel(`shared-qa-${randomUUID()}`).on('postgres_changes',{event:'*',schema:'public',table:'appointments'},event=>events.push(event.new));
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Realtime subscription timed out')),15000);channel.subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timer);resolve();}else if(status==='CHANNEL_ERROR'){clearTimeout(timer);reject(new Error('Realtime channel error'));}});});
  appointment=await ok(staff.rpc('save_appointment_team',{p_appointment_id:null,p_expected_version:null,p_appointment:{patient_id:patient,professional_id:primary,specialty_id:specialty,consultation_type_id:type,date:'2026-10-26',time:'16:00',duration:30},p_additional_professional_ids:[additional]}));
  await waitForEvent(event=>event.id===appointment);
  const shared=await ok(doctor.from('appointments').select('*,appointment_additional_professionals(*)').eq('id',appointment).single());
  assert.equal(shared.appointment_additional_professionals[0].professional_id,additional);
  await ok(doctor.from('appointment_notes').insert({appointment_id:appointment,author_user_id:users[2],note:'Synthetic authored note'}));
  const denied=await doctor.rpc('save_appointment_team',{p_appointment_id:appointment,p_expected_version:shared.version,p_appointment:{time:'17:00'},p_additional_professional_ids:[additional]});
  assert.equal(denied.error?.code,'42501');
  await ok(staff.rpc('save_appointment_team',{p_appointment_id:appointment,p_expected_version:shared.version,p_appointment:{},p_additional_professional_ids:[]}));
  const hidden=await ok(doctor.from('appointments').select('id').eq('id',appointment));
  assert.equal(hidden.length,0,'removed doctor loses read access');
  const removed=await doctor.rpc('set_appointment_state',{p_appointment_id:appointment,p_expected_version:shared.version,p_status:'completed'});
  assert.equal(removed.error?.code,'42501','removed doctor loses write access');
  let current=await ok(staff.from('appointments').select('version').eq('id',appointment).single());
  await ok(staff.rpc('save_appointment_team',{p_appointment_id:appointment,p_expected_version:current.version,p_appointment:{},p_additional_professional_ids:[additional]}));
  current=await ok(staff.from('appointments').select('version').eq('id',appointment).single());
  await ok(doctor.rpc('set_appointment_state',{p_appointment_id:appointment,p_expected_version:current.version,p_status:'completed',p_final_notes:'Synthetic conclusion',p_send_review:false}));
  await waitForEvent(event=>event.id===appointment && event.status==='completed');
  const final=await ok(staff.from('appointments').select('status,send_review,finalized_by').eq('id',appointment).single());
  assert.deepEqual(final,{status:'completed',send_review:false,finalized_by:users[2]});
  console.log('PASS: authenticated staff/doctor sessions, shared reads, authored notes, revoked access and Realtime completion.');
} finally {
  if(channel) await doctor.removeChannel(channel);
  if(appointment){await ok(service.from('notifications').delete().eq('appointment_id',appointment));await ok(service.from('appointments').delete().eq('id',appointment));}
  await ok(service.from('patients').delete().eq('id',patient));
  await ok(service.from('professionals').delete().in('id',[primary,additional]));
  await ok(service.from('consultation_types').delete().eq('id',type));
  await ok(service.from('specialties').delete().eq('id',specialty));
  for(const id of users) await ok(service.auth.admin.deleteUser(id));
  await staff.auth.signOut();await doctor.auth.signOut();
}
