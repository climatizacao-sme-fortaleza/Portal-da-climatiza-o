<#
Liga o robo de atualizacao.

Faz tudo o que da para fazer sozinho depois que voce autenticou: confere a chave,
mostra o e-mail da conta de servico (que voce precisa para compartilhar a planilha),
guarda a chave no GitHub, apaga o arquivo local e dispara a primeira carga.

A chave NUNCA e impressa na tela. Ela vai do arquivo direto para o GitHub.

Uso:
  powershell -ExecutionPolicy Bypass -File tools\liga-robo.ps1 -Chave "C:\caminho\chave.json"

Antes de rodar, duas coisas suas (as duas pedem login):
  1. Criar a conta de servico no Google e baixar a chave JSON  -> tools\ROBO.md
  2. gh auth login   (o script avisa se faltar)
#>
param(
  [Parameter(Mandatory = $true)][string]$Chave,
  [string]$Repo = "climatizacao-sme-fortaleza/Portal-da-climatiza-o",
  [string]$NomeDoSegredo = "GOOGLE_SHEETS_CREDENCIAL",
  [switch]$ManterArquivo
)

# Continue, nao Stop: este script chama executaveis nativos (gh), e no PowerShell 5.1
# qualquer coisa que eles escrevam no stderr viraria erro terminante. Aqui o controle e
# pelo codigo de saida, conferido a cada passo.
$ErrorActionPreference = "Continue"

function Passo($n, $t) { Write-Host ""; Write-Host "[$n] $t" -ForegroundColor Cyan }
function Ok($t)        { Write-Host "    ok  $t" -ForegroundColor Green }
function Erro($t)      { Write-Host "    x   $t" -ForegroundColor Red }

# --- 1. achar o gh ---------------------------------------------------------
Passo 1 "Procurando o GitHub CLI"
$gh = (Get-Command gh -ErrorAction SilentlyContinue).Source
if (-not $gh) { $gh = "$env:LOCALAPPDATA\portal-cli\bin\gh.exe" }
if (-not (Test-Path $gh)) {
  Erro "gh nao encontrado. Baixe em https://cli.github.com e rode de novo."
  exit 1
}
Ok $gh

# --- 2. conferir login -----------------------------------------------------
# A chave vem antes do login de proposito: se ela estiver errada, voce descobre agora,
# sem ter passado pelo login a toa.
Passo 2 "Conferindo a chave da conta de servico"
if (-not (Test-Path $Chave)) { Erro "arquivo nao encontrado: $Chave"; exit 1 }
try { $j = Get-Content $Chave -Raw -Encoding UTF8 | ConvertFrom-Json }
catch { Erro "o arquivo nao e um JSON valido."; exit 1 }

if ($j.type -ne "service_account") {
  Erro "esse JSON nao e de conta de servico (type = '$($j.type)')."
  Write-Host "    Baixe a chave em: Conta de servico -> Chaves -> Adicionar chave -> JSON" -ForegroundColor Yellow
  exit 1
}
foreach ($campo in @("client_email", "private_key", "project_id")) {
  if (-not $j.$campo) { Erro "falta o campo '$campo' no JSON."; exit 1 }
}
Ok "chave valida (projeto $($j.project_id))"

# o e-mail NAO e segredo: e o que voce cola no Compartilhar da planilha
Write-Host ""
Write-Host "    Compartilhe a planilha mestra com este e-mail, como Leitor:" -ForegroundColor Yellow
Write-Host "    $($j.client_email)" -ForegroundColor White

# --- 3. conferir login -----------------------------------------------------
Passo 3 "Conferindo o login no GitHub"
& $gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) {
  Erro "voce ainda nao esta logado no GitHub."
  Write-Host ""
  Write-Host "    Rode o comando abaixo, escolha 'Login with a web browser'," -ForegroundColor Yellow
  Write-Host "    faca o login, e depois chame este script de novo:" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "    & '$gh' auth login" -ForegroundColor White
  exit 1
}
Ok "autenticado"

# --- 4. guardar no GitHub --------------------------------------------------
Passo 4 "Guardando a chave no GitHub como segredo '$NomeDoSegredo'"
Get-Content $Chave -Raw -Encoding UTF8 | & $gh secret set $NomeDoSegredo --repo $Repo
if ($LASTEXITCODE -ne 0) { Erro "nao consegui gravar o segredo."; exit 1 }
Ok "segredo gravado (o conteudo nao passou pela tela)"

# --- 5. apagar a chave local -----------------------------------------------
Passo 5 "Apagando a chave do computador"
if ($ManterArquivo) {
  Write-Host "    pulado (-ManterArquivo). Apague na mao quando puder." -ForegroundColor Yellow
} else {
  $tam = (Get-Item $Chave).Length
  [System.IO.File]::WriteAllBytes($Chave, (New-Object byte[] $tam))   # sobrescreve antes
  Remove-Item $Chave -Force
  Ok "apagada. Se precisar de outra, gere uma chave nova no console."
}

# --- 6. primeira carga -----------------------------------------------------
Passo 6 "Disparando a primeira carga"
Write-Host "    (so funciona depois que a planilha estiver compartilhada com o e-mail acima)" -ForegroundColor DarkGray
& $gh workflow run "atualiza-dados.yml" --repo $Repo
if ($LASTEXITCODE -ne 0) {
  Erro "nao consegui disparar. Rode pela aba Actions do repositorio."
  exit 1
}
Ok "disparado"

Write-Host ""
Write-Host "Acompanhe em:" -ForegroundColor Cyan
Write-Host "  https://github.com/$Repo/actions" -ForegroundColor White
Write-Host ""
Write-Host "Ou pelo terminal:" -ForegroundColor Cyan
Write-Host "  & '$gh' run watch --repo $Repo" -ForegroundColor White
