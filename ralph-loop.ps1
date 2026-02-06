# ralph.ps1
# Requires: OpenAI Codex CLI (@openai/codex)

$iterations = 10
$workspace  = (Get-Location).Path

# Multiline prompt (we'll pipe it via stdin)
$prompt = @"
Read \docs\custom\update-ui.md. Check progress.md. Pick the next incomplete task from plan.md.
Implement it. Prefer retreivel-led reasoning with skills for task completion. Update progress.md when done.
If all tasks are complete, reply ONLY with: ALL DONE
"@

Write-Host "Starting Ralph Loop for $iterations iterations..." -ForegroundColor Cyan

# Basic guardrails
if (!(Test-Path (Join-Path $workspace "plan.md"))) {
  throw "Missing plan.md in $workspace"
}
if (!(Test-Path (Join-Path $workspace "progress.md"))) {
  New-Item -ItemType File -Path (Join-Path $workspace "progress.md") | Out-Null
}

for ($i = 1; $i -le $iterations; $i++) {
  Write-Host "--- Iteration $i of $iterations ---" -ForegroundColor Yellow

  # codex exec:
  # - designed for scripts/CI (non-interactive)
  # - PROMPT can be '-' to read from stdin
  # - --sandbox workspace-write allows edits in the workspace
  # - --ask-for-approval never prevents approval pauses
  $result = $prompt | & codex exec `
    --cd "$workspace" `
    --sandbox workspace-write `
    --ask-for-approval never `
    - 2>$null

  $result = ($result | Out-String).Trim()

  if ($result -match '^\s*ALL DONE\s*$') {
    Write-Host "ALL DONE reported. Stopping early." -ForegroundColor Green
    break
  }

  Write-Host "Iteration $i complete." -ForegroundColor Green
  Start-Sleep -Seconds 2
}

Write-Host "Ralph Loop finished." -ForegroundColor Cyan
