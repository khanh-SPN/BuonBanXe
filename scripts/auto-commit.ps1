# Snapshots the project (incl. data/inventory.db) to git every time it's run.
# Scheduled via Windows Task Scheduler to fire every 5 minutes; commits only
# when something actually changed, so idle periods create no history noise.

$repoRoot = "E:\BuonBanXe"
Set-Location $repoRoot

$logFile = Join-Path $repoRoot "scripts\auto-commit.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

try {
    node "scripts\checkpoint-db.js" *> $null
} catch {}

git add -A *> $null
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    exit 0
}

git commit -m "Auto backup: $timestamp" --quiet *> $null
"$timestamp - auto commit" | Out-File -FilePath $logFile -Append -Encoding utf8
