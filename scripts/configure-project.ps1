$ErrorActionPreference = 'Stop'
$taskProject = Get-Content -Raw -LiteralPath '.vercel/project.json' | ConvertFrom-Json
New-Item -ItemType Directory -Force .local | Out-Null
$taskSettingsFile = Join-Path (Get-Location) '.local/project-settings.json'
if (Test-Path -LiteralPath $taskSettingsFile) {
  $taskSettings = Get-Content -Raw -LiteralPath $taskSettingsFile | ConvertFrom-Json -AsHashtable
} else {
  $taskAccount = vercel api /v2/user | ConvertFrom-Json
  $taskSettings = @{
    SESSION_SECRET = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    WORKER_SECRET = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    CRON_SECRET = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    BETA_OWNER_INVITE_TOKEN = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
    BETA_OWNER_EMAIL = $taskAccount.user.email
    APP_URL = 'https://video-studio-vert-two.vercel.app'
    BETA_ACCEPTING_JOBS = 'false'
    BETA_MAX_ACTIVE_JOBS = '1'
    BETA_MAX_JOBS_PER_DAY = '3'
    BETA_GLOBAL_CONCURRENCY = '2'
    BETA_MAX_WORKER_SECONDS = '1800'
    BETA_RETENTION_DAYS = '30'
    ANTHROPIC_MODEL = 'claude-sonnet-4-6'
    AI_GATEWAY_MODEL = 'anthropic/claude-sonnet-4.6'
  }
  $taskSettings | ConvertTo-Json | Set-Content -LiteralPath $taskSettingsFile
}
foreach ($taskSetting in $taskSettings.GetEnumerator()) {
  @{key=$taskSetting.Key;value=$taskSetting.Value;type='encrypted';target=@('production','preview','development')} | ConvertTo-Json -Compress | Set-Content .local/env-one.json
  vercel api ('/v10/projects/' + $taskProject.projectId + '/env?upsert=true') --method POST --input .local/env-one.json --silent
  if ($LASTEXITCODE -ne 0) { throw 'Project environment update failed' }
  Write-Output ('Configured ' + $taskSetting.Key)
}
vercel env pull .env.local --yes
Write-Output 'Project configuration saved. Secrets were not printed.'
