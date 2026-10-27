param([string]$Pattern='treatment*.test.sql')
$ErrorActionPreference='Stop'
$container='supabase_db_barnun-workbench'
$hooks = "select count(*) from pg_trigger t join pg_proc p on p.oid=t.tgfoid where not t.tgisinternal and p.proname='http_request';" | docker exec -i $container psql -U postgres -d postgres -At
if ($LASTEXITCODE -ne 0 -or $hooks.Trim() -ne '0') { throw 'Local backend unavailable or outbound hooks present' }
$files=Get-ChildItem "supabase/tests/$Pattern"
if (!$files) { throw 'No tests found' }
foreach ($file in $files) {
  $sql=Get-Content $file.FullName -Raw -Encoding UTF8
  $sql=$sql.Replace('-- TREATMENT_FIXTURE', (Get-Content 'supabase/tests/fixtures/treatments.sql' -Raw -Encoding UTF8))
  $result=$sql | docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 2>&1
  $result | Set-Content ".superpowers/sdd/2026-10-27-treatments/$($file.Name).log"
  if ($LASTEXITCODE -ne 0 -or ($result -match 'not ok|Looks like you failed')) { $result; throw "Failed: $($file.Name)" }
  Write-Output "$($file.Name): PASS"
}
