# Local dev: Gnosis settlement (chain 100) + stick-web on 5174 — matches wallet login.
# Usage: .\scripts\dev-win-gnosis.ps1
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Get-NetTCPConnection -LocalPort 8787,5174 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { if ($_.OwningProcess -gt 0) { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }

# Never strip LOK_LISTING_KEY / LOK_OPS_STATUS_TOKEN — Gnosis boot requires them (or apps/server/.env.local).
Remove-Item Env:LOK_OWNER_KEY, Env:PRIVATE_KEY, Env:LOK_NFT, Env:LOK_FACTORY, Env:LOK_CHAIN_ID -ErrorAction SilentlyContinue

$env:NETWORK = "gnosis"
$env:LOK_REPLICA = "1"
$env:LOK_DATA_DIR = Join-Path $Root "apps\server\data"
$env:LOK_DEPLOY_JSON = Join-Path $Root "deployments\gnosis.json"
$env:LOK_CHAIN_RPC = "https://gnosis-rpc.publicnode.com"
$env:LOK_PUBLIC_RPC = "https://gnosis-rpc.publicnode.com"
$env:PORT = "8787"
$env:AUTH_ORIGINS = "http://localhost:5174"
$env:MAP_BUILDER_DEV = "1"

Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$Root'; Remove-Item Env:LOK_OWNER_KEY, Env:PRIVATE_KEY, Env:LOK_NFT, Env:LOK_FACTORY, Env:LOK_CHAIN_ID -ErrorAction SilentlyContinue; `$env:NETWORK='gnosis'; `$env:LOK_REPLICA='1'; `$env:LOK_DATA_DIR='$($env:LOK_DATA_DIR)'; `$env:LOK_DEPLOY_JSON='$($env:LOK_DEPLOY_JSON)'; `$env:LOK_CHAIN_RPC='$($env:LOK_CHAIN_RPC)'; `$env:LOK_PUBLIC_RPC='$($env:LOK_PUBLIC_RPC)'; `$env:PORT='8787'; `$env:AUTH_ORIGINS='http://localhost:5174'; `$env:MAP_BUILDER_DEV='1'; if (-not (Test-Path 'apps/server/.env.local')) { Write-Host 'Create apps/server/.env.local from .env.gnosis.example (LOK_LISTING_KEY + LOK_OPS_STATUS_TOKEN).' -ForegroundColor Red }; pnpm --filter @bellgrave/server dev"
)

Start-Sleep -Seconds 2

$stickWeb = Join-Path $Root "apps\stick-web"
$deployJson = Join-Path $Root "deployments\gnosis.json"
$Factory = "0x4083Fe6C57c88abf8a422ebCF73EEa8320192cFD"
if (Test-Path $deployJson) {
  $deploy = Get-Content $deployJson -Raw | ConvertFrom-Json
  if ($deploy.contracts.CharacterFactory) { $Factory = $deploy.contracts.CharacterFactory }
}
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$stickWeb'; `$env:VITE_NETWORK='gnosis'; `$env:VITE_CHAIN_ID='100'; `$env:VITE_GNOSIS_RPC_URL='https://gnosis-rpc.publicnode.com'; `$env:VITE_FACTORY='$Factory'; `$env:VITE_WS_URL='ws://localhost:8787'; if (-not `$env:VITE_WALLETCONNECT_PROJECT_ID) { Write-Host 'Tip: set VITE_WALLETCONNECT_PROJECT_ID in this shell for WalletConnect / mobile wallets.' -ForegroundColor Yellow }; pnpm dev"
)

Write-Host "Started server (8787, gnosis replica + MAP_BUILDER_DEV) and Vite (5174). Hard-refresh http://localhost:5174"
