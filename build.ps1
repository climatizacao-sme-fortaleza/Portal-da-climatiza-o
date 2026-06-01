$ErrorActionPreference = "Stop"
$base = "C:\Users\Sr. Projeto\Desktop\cowork\portal\_data"
$webData = "C:\Users\Sr. Projeto\Desktop\cowork\portal\web\data"
New-Item -ItemType Directory -Force -Path $webData | Out-Null

$INV = [System.Globalization.CultureInfo]::InvariantCulture
$NST = [System.Globalization.NumberStyles]::Float
function Num($v) {
  if ($null -eq $v) { return $null }
  $s = ("" + $v).Trim()
  if ($s -eq "") { return $null }
  $s = $s -replace 'R\$', '' -replace '\s', '' -replace ',', ''  # US: virgula=milhar, ponto=decimal
  $d = 0.0
  if ([double]::TryParse($s, $NST, $INV, [ref]$d)) { return $d }
  return $null
}
function Int1($v) {
  $n = Num $v
  if ($null -eq $n) { return $null }
  return [int]$n
}
function Txt($v) {
  if ($null -eq $v) { return $null }
  $s = ("" + $v).Trim()
  if ($s -eq "") { return $null }
  return $s
}

# ---- ESCOLA ---- (LAT/LNG vem prontos da planilha, sem geocodificar)
$er = Import-Csv (Join-Path $base "ESCOLA.csv") -Encoding UTF8
$ec = $er[0].PSObject.Properties.Name
$escolas = foreach ($r in $er) {
  $addr = Txt $r.($ec[20])
  $lat = Num $r.($ec[21])
  $lng = Num $r.($ec[22])
  $gsrc = $null
  if ($null -ne $lat -and $null -ne $lng) { $gsrc = "planilha" }
  [ordered]@{
    sge = Txt $r.($ec[0]); tipo = Txt $r.($ec[1]); nome = Txt $r.($ec[2]);
    endereco = Txt $r.($ec[3]); bairro = Txt $r.($ec[4]); codBairro = Txt $r.($ec[5]);
    distrito = Txt $r.($ec[6]); regional = Txt $r.($ec[7]); territorio = Txt $r.($ec[8]);
    etapa = Txt $r.($ec[9]); salas = Int1 $r.($ec[10]); subestacao = Txt $r.($ec[11]);
    potenciaSub = Txt $r.($ec[12]); status = Txt $r.($ec[13]);
    valorCivil = Num $r.($ec[14]); valorEletrica = Num $r.($ec[15]); valorTotal = Num $r.($ec[16]);
    asCivil = Txt $r.($ec[17]); asEletrica = Txt $r.($ec[18]); temExecucao = Txt $r.($ec[19]);
    lat = $lat; lng = $lng; geoSrc = $gsrc
  }
}

# ---- DIAGNOSTICO (por SGE) ----
$dr = Import-Csv (Join-Path $base "DIAGNOSTICO.csv") -Encoding UTF8
$dc = $dr[0].PSObject.Properties.Name
$diag = @{}
foreach ($r in $dr) {
  $sge = Txt $r.($dc[0]); if (-not $sge) { continue }
  $diag[$sge] = [ordered]@{
    salasClim = Int1 $r.($dc[2]); salasFora = Int1 $r.($dc[3]); necessitaSub = Txt $r.($dc[4]);
    estagio = Txt $r.($dc[5]); dataVisita = Txt $r.($dc[6]); dataEstudo = Txt $r.($dc[7]);
    dataRepasse = Txt $r.($dc[8]); dataOsEletrica = Txt $r.($dc[9]);
    responsavel = Txt $r.($dc[10]); obs = Txt $r.($dc[11])
  }
}

# ---- OS (por SGE, lista) ----
$or = Import-Csv (Join-Path $base "OS.csv") -Encoding UTF8
$oc = $or[0].PSObject.Properties.Name
$os = @{}
foreach ($r in $or) {
  $sge = Txt $r.($oc[1]); if (-not $sge) { continue }
  if (-not $os.ContainsKey($sge)) { $os[$sge] = New-Object System.Collections.ArrayList }
  [void]$os[$sge].Add([ordered]@{
    numero = Txt $r.($oc[0]); tipo = Txt $r.($oc[3]); responsavel = Txt $r.($oc[4]);
    valor = Num $r.($oc[5]); prioridade = Txt $r.($oc[6]); estagio = Txt $r.($oc[7]);
    ultimoMov = Txt $r.($oc[8]); diasEstagio = Int1 $r.($oc[9]);
    linkOrcamento = Txt $r.($oc[10]); obs = Txt $r.($oc[11])
  })
}

# ---- EXECUCAO (por SGE, lista; uma linha por etapa) ----
$xr = Import-Csv (Join-Path $base "EXECUCAO.csv") -Encoding UTF8
$xc = $xr[0].PSObject.Properties.Name
$exec = @{}
foreach ($r in $xr) {
  $sge = Txt $r.($xc[0]); if (-not $sge) { continue }
  if (-not $exec.ContainsKey($sge)) { $exec[$sge] = New-Object System.Collections.ArrayList }
  [void]$exec[$sge].Add([ordered]@{
    etapa = Txt $r.($xc[2]);
    ar12 = Int1 $r.($xc[3]); ar18 = Int1 $r.($xc[4]); ar24 = Int1 $r.($xc[5]);
    ar36 = Int1 $r.($xc[6]); ar48 = Int1 $r.($xc[7]); totalMaq = Int1 $r.($xc[8]);
    valorMaq = Num $r.($xc[9]); servCivil = Num $r.($xc[10]); servEletrica = Num $r.($xc[11]);
    servInstalacao = Num $r.($xc[12]); totalGasto = Num $r.($xc[13]);
    statusCivil = Txt $r.($xc[14]); statusEletrica = Txt $r.($xc[15]); statusInstalacao = Txt $r.($xc[16]);
    equipe = Txt $r.($xc[17]); inicio = Txt $r.($xc[18]); fim = Txt $r.($xc[19])
  })
}

$comCoord = ($escolas | Where-Object { $_.lat }).Count
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("// Dados gerados de CLIMATIZACAO_MODELO_CONSOLIDADO.xlsx - NAO editar a mao")
[void]$sb.AppendLine("window.ESCOLAS = " + ($escolas | ConvertTo-Json -Depth 6 -Compress) + ";")
[void]$sb.AppendLine("window.DIAGNOSTICO = " + ($diag | ConvertTo-Json -Depth 6 -Compress) + ";")
[void]$sb.AppendLine("window.OS = " + ($os | ConvertTo-Json -Depth 6 -Compress) + ";")
[void]$sb.AppendLine("window.EXECUCAO = " + ($exec | ConvertTo-Json -Depth 6 -Compress) + ";")
$sb.ToString() | Out-File (Join-Path $webData "dados.js") -Encoding UTF8

"escolas=$($escolas.Count) comCoord=$comCoord diag=$($diag.Count) osSGE=$($os.Count) execSGE=$($exec.Count)"
