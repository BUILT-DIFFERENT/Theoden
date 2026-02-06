# ralph-loop.ps1

$iterations = 25
$codexCommand = "codex"
$ralphPrompt = "Look through the plan in \docs\custom\plan.md Pick the most important task and complete it. If there are no and you have verified, find something to refactor or improve. When done create a commit and push. "

if (-not (Get-Command $codexCommand -ErrorAction SilentlyContinue)) {
    throw "Could not find '$codexCommand' in PATH."
}

Write-Host "Starting Ralph Loop for $iterations iterations..." -ForegroundColor Cyan
Write-Host "Using command from PATH: $codexCommand exec --yolo" -ForegroundColor DarkGray

for ($i = 1; $i -le $iterations; $i++) {
    Write-Host "`n----------------------------------------" -ForegroundColor DarkGray
    Write-Host "Ralph Cycle: $i of $iterations" -ForegroundColor Yellow
    Write-Host "----------------------------------------" -ForegroundColor DarkGray

    & $codexCommand exec --yolo $ralphPrompt
    if ($LASTEXITCODE -ne 0) {
        throw "Codex exited with code $LASTEXITCODE on cycle $i."
    }

    Write-Host "`nCycle $i complete." -ForegroundColor Green
    Start-Sleep -Seconds 3
}

Write-Host "`nRalph Loop sequence finished." -ForegroundColor Cyan
Clear-Host
