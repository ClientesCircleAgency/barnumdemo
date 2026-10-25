import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const networkCount=execFileSync('docker',['exec','supabase_db_barnun-workbench','psql','-U','postgres','-d','postgres','-Atq','-c',"select count(*) from pg_trigger where not tgisinternal and pg_get_triggerdef(oid) ~* 'http_request|http_post|net.http'"],{encoding:'utf8'}).trim();
assert.equal(networkCount,'0','Refusing tests while local outbound webhooks exist');

// Deliberately fixed local Docker target: this harness cannot accept a remote URL.
const container = 'supabase_db_barnun-workbench';
function sql(input) {
  return new Promise(resolve => {
    const child = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq']);
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('error', error => resolve({ code: -1, output: error.message }));
    child.on('close', code => resolve({ code, output }));
    child.stdin.end(input);
  });
}
const [specialty, type, primary, additional, patient] = Array.from({ length: 5 }, randomUUID);
const setup = await sql(`begin;
insert into public.specialties(id,name) values('${specialty}','Concurrency synthetic');
insert into public.consultation_types(id,name,specialty_id) values('${type}','Concurrency synthetic','${specialty}');
insert into public.professionals(id,name,specialty_id) values('${primary}','Synthetic A','${specialty}'),('${additional}','Synthetic B','${specialty}');
insert into public.patients(id,nif,name,phone) values('${patient}','${patient}','Synthetic concurrency patient','+351900000000');
commit;`);
assert.equal(setup.code, 0, setup.output);
try {
  const appointment = { patient_id: patient, professional_id: primary, specialty_id: specialty, consultation_type_id: type, date: '2026-10-26', time: '16:00', duration: 30 };
  const transaction = (data, extras) => `begin;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.save_appointment_team(null,null,'${JSON.stringify(data)}',array[${extras.map(id => `'${id}'::uuid`).join(',')}]::uuid[]);
select pg_sleep(1); commit;`;
  const results = await Promise.all([
    sql(transaction(appointment, [additional])),
    sql(transaction({ ...appointment, professional_id: additional }, [])),
  ]);
  assert.equal(results.filter(r => r.code === 0).length, 1, JSON.stringify(results));
  assert.match(results.find(r => r.code !== 0).output, /conflict/);
  const count = await sql(`select count(*) from public.appointments where patient_id='${patient}';`);
  assert.equal(count.output.trim(), '1', 'no duplicate or partial bookings');
  console.log('PASS: two concurrent bookings, one accepted; additional participant blocks primary booking.');
} finally {
  const cleanup = await sql(`begin;
delete from public.notifications where appointment_id in(select id from public.appointments where patient_id='${patient}');
delete from public.appointments where patient_id='${patient}';
delete from public.patients where id='${patient}';
delete from public.professionals where id in('${primary}','${additional}');
delete from public.consultation_types where id='${type}';
delete from public.specialties where id='${specialty}'; commit;`);
  assert.equal(cleanup.code, 0, cleanup.output);
}
