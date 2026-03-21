# Script para iniciar o servidor de desenvolvimento
# Força o caminho correto do Vite

$ErrorActionPreference = "Stop"

Write-Host "🚀 A iniciar servidor de desenvolvimento..." -ForegroundColor Green

# Define o caminho correto do node_modules
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$VitePath = Join-Path $ProjectRoot "node_modules\vite\bin\vite.js"

if (-not (Test-Path $VitePath)) {
    Write-Host "❌ Vite não encontrado. A instalar dependências..." -ForegroundColor Red
    npm install
}

# Executa o Vite com o caminho absoluto
Write-Host "✅ A iniciar Vite..." -ForegroundColor Green
node $VitePath
