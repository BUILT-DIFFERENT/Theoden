# ralph.ps1

# 1. Configuration
$iterations = 10
$planFile = "plan.md"
$progressFile = "progress.md"

# 2. The "Ralph" Prompt
# This instructs the model to contextualize itself, do one job, and update state.
$ralphPrompt = "Read $planFile and $progressFile. Identify the next incomplete task. Execute that task effectively. Update $progressFile to reflect the completed work. If all tasks are done, simply say 'ALL DONE' and exit."

Write-Host "Starting Ralph Loop for $iterations iterations..." -ForegroundColor Cyan
Write-Host "Using command: codex exec --yolo ..." -ForegroundColor DarkGray

# 3. The Loop
for ($i = 1; $i -le $iterations; $i++) {
    Write-Host "`n----------------------------------------" -ForegroundColor DarkGray
    Write-Host "Ralph Cycle: $i of $iterations" -ForegroundColor Yellow
    Write-Host "----------------------------------------" -ForegroundColor DarkGray

    # Execute the Codex CLI with the 'yolo' flag (no permission prompts)
    # We invoke it directly as a command
    codex exec --yolo $ralphPrompt

    Write-Host "`nCycle $i complete." -ForegroundColor Green

    # A short pause to allow file system writes to finalize
    Start-Sleep -Seconds 3
}

Write-Host "`nRalph Loop sequence finished." -ForegroundColor Cyan
