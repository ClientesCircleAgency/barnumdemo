$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $repoRoot
$container = 'supabase_db_barnun-workbench'
if ((Get-Content supabase/config.toml -Raw) -notmatch 'project_id = "barnun-workbench"') { throw 'Expected Workbench configuration.' }
& supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop, then retry.' }
$tableCount = & docker exec $container psql -U postgres -d postgres -Atq -c "select count(*) from information_schema.tables where table_schema='public';"
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect local database.' }
if ([int]$tableCount -eq 0) {
    $schema = Get-Content supabase/local/baseline-20261024.sql -Raw
    if ($schema -match 'net\.http|http_post|supabase_functions\.http_request') { throw 'Unexpected network-enabled baseline.' }
    $schema | & docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q
    if ($LASTEXITCODE -ne 0) { throw 'Baseline import failed.' }
    foreach ($migration in Get-ChildItem supabase/migrations/20261024*.sql | Sort-Object Name) {
        Get-Content -LiteralPath $migration.FullName -Raw | & docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q
        if ($LASTEXITCODE -ne 0) { throw ('Local migration failed: ' + $migration.Name) }
    }
} else {
    $ready = & docker exec $container psql -U postgres -d postgres -Atq -c "select count(*) from information_schema.columns where table_schema='public' and table_name='appointments' and column_name='finalized_by';"
    if ($LASTEXITCODE -ne 0 -or [int]$ready -ne 1) { throw 'Existing local schema needs manual review. No data was reset.' }
}
$localState = (& supabase status -o json | ConvertFrom-Json)
if ($localState.API_URL -ne 'http://127.0.0.1:46321') { throw 'Refusing non-Workbench endpoint.' }
$envLines = @(('VITE_SUPABASE_URL=' + $localState.API_URL), ('VITE_SUPABASE_PUBLISHABLE_KEY=' + $localState.ANON_KEY))
[IO.File]::WriteAllLines((Join-Path $repoRoot '.env.development.local'), $envLines, [Text.UTF8Encoding]::new($false))
Write-Output 'Workbench ready at http://127.0.0.1:46321. No production data copied. Run npm run dev.'
