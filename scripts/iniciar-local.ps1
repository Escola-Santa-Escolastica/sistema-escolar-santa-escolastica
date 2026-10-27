# =====================================================================
# Sistema Escolar — Instituto Santa Escolástica
# Sobe tudo no seu computador (Windows) para testar em http://localhost:3000
#
# Precisa de: Node.js 20 ou mais novo, Docker Desktop aberto, Git.
# Uso (PowerShell, na pasta do projeto):
#   powershell -ExecutionPolicy Bypass -File scripts\iniciar-local.ps1
# =====================================================================
param(
  [string]$Email = "",
  [string]$Nome = "",
  [switch]$NovaSenha
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

function Passo($texto) { Write-Host ""; Write-Host "==> $texto" -ForegroundColor Green }
function Parar($texto) { Write-Host ""; Write-Host "ERRO: $texto" -ForegroundColor Red; exit 1 }

# 1. Ferramentas
Passo "Conferindo Node.js e Docker"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Parar "Node.js não encontrado. Instale a versão LTS em https://nodejs.org e abra um novo PowerShell."
}
$versaoNode = [int]((node -v).TrimStart("v").Split(".")[0])
if ($versaoNode -lt 20) { Parar "Node.js $(node -v) é antigo. Instale a versão LTS (20 ou mais nova) em https://nodejs.org." }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Parar "Docker não encontrado. Instale o Docker Desktop em https://www.docker.com/products/docker-desktop e abra-o."
}
docker info *> $null
if ($LASTEXITCODE -ne 0) { Parar "O Docker Desktop não está rodando. Abra o Docker Desktop, espere aparecer 'Engine running' e rode este script de novo." }
Write-Host "Node $(node -v) e Docker ok."

# 2. Dependências
if (-not (Test-Path "node_modules")) {
  Passo "Instalando dependências (só na primeira vez)"
  npm install
  if ($LASTEXITCODE -ne 0) { Parar "Falha no npm install." }
}

# 3. Banco de dados e login (Supabase local)
Passo "Subindo o banco de dados local (na primeira vez baixa as imagens; pode levar alguns minutos)"
npx supabase start
if ($LASTEXITCODE -ne 0) { Parar "Falha ao subir o Supabase local. Confira se o Docker Desktop está aberto." }

$status = @{}
npx supabase status -o env | ForEach-Object {
  if ($_ -match '^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$') { $status[$Matches[1]] = $Matches[2] }
}
$url = $status["API_URL"]
$publica = if ($status["PUBLISHABLE_KEY"]) { $status["PUBLISHABLE_KEY"] } else { $status["ANON_KEY"] }
$secreta = if ($status["SECRET_KEY"]) { $status["SECRET_KEY"] } else { $status["SERVICE_ROLE_KEY"] }
if (-not $url -or -not $publica -or -not $secreta) { Parar "Não consegui ler as chaves do Supabase local (npx supabase status)." }

# 4. .env.local (sem BOM, para o Next.js ler certo)
Passo "Gravando .env.local com as chaves do banco local"
$conteudo = @"
NEXT_PUBLIC_SUPABASE_URL=$url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$publica
SUPABASE_SECRET_KEY=$secreta
NEXT_PUBLIC_SITE_URL=http://localhost:3000
"@
[System.IO.File]::WriteAllText((Join-Path (Get-Location) ".env.local"), $conteudo, (New-Object System.Text.UTF8Encoding $false))

# 5. Seu login de administrador
Passo "Criando o seu login de administrador"
$arquivoAdmin = Join-Path (Get-Location) "supabase\.temp\admin-local.txt"
if (-not $Email -and (Test-Path $arquivoAdmin)) { $Email, $Nome = Get-Content $arquivoAdmin -Encoding UTF8 }
if (-not $Email) { $Email = Read-Host "Seu e-mail para o login de administrador" }
if (-not $Nome) { $Nome = Read-Host "Seu nome completo" }
New-Item -ItemType Directory -Force -Path (Split-Path $arquivoAdmin) | Out-Null
[System.IO.File]::WriteAllLines($arquivoAdmin, @($Email, $Nome), (New-Object System.Text.UTF8Encoding $false))
if ($NovaSenha) { node scripts/criar-admin.mjs $Email $Nome --nova-senha } else { node scripts/criar-admin.mjs $Email $Nome }
if ($LASTEXITCODE -ne 0) { Parar "Falha ao criar o login de administrador." }

# 6. Sistema
Passo "Abrindo o sistema"
Write-Host "  Sistema:            http://localhost:3000"
Write-Host "  E-mails de teste:   http://localhost:54324  (convites e troca de senha chegam aqui)"
Write-Host "  Banco (Studio):     http://localhost:54323"
Write-Host ""
Write-Host "  Para parar: Ctrl+C aqui e depois 'npx supabase stop'." -ForegroundColor Yellow
Start-Job -ScriptBlock { Start-Sleep -Seconds 8; Start-Process "http://localhost:3000" } | Out-Null
npm run dev
