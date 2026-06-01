$ErrorActionPreference = "Stop"
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
$base = "C:\Users\Sr. Projeto\Desktop\cowork\portal\_data"
$csv  = Join-Path $base "ESCOLA.csv"
$cacheFile = Join-Path $base "geocode_cache.json"

$rows = Import-Csv $csv -Encoding UTF8
$cols = $rows[0].PSObject.Properties.Name
$cGeo = $cols | Where-Object { $_ -match 'GEOCODE' } | Select-Object -First 1
$cSge = $cols | Where-Object { $_ -eq 'SGE' } | Select-Object -First 1

# carrega cache existente (hashtable address -> objeto)
$cache = @{}
if (Test-Path $cacheFile) {
  $j = Get-Content $cacheFile -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($p in $j.PSObject.Properties) { $cache[$p.Name] = $p.Value }
  Write-Host "Cache carregado: $($cache.Count) enderecos"
}

# Fortaleza viewbox (left,top,right,bottom = lonMin,latMax,lonMax,latMin)
$viewbox = "-38.70,-3.66,-38.35,-3.95"
$ua = "PortalClimatizacaoFortaleza/1.0 (gestao SME COINF)"

function Geocode($q, $bounded) {
  $u = "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&viewbox=$viewbox"
  if ($bounded) { $u += "&bounded=1" }
  $u += "&q=" + [uri]::EscapeDataString($q)
  try {
    $r = Invoke-RestMethod -Uri $u -Headers @{ 'User-Agent' = $ua } -TimeoutSec 25
    if ($r -and $r.Count -ge 1) { return @{ lat = [double]$r[0].lat; lng = [double]$r[0].lon } }
  } catch { Start-Sleep -Milliseconds 500 }
  return $null
}

$total = $rows.Count; $i = 0; $novos = 0; $hit = 0; $miss = 0
foreach ($row in $rows) {
  $i++
  $addr = ("" + $row.$cGeo).Trim()
  if ([string]::IsNullOrWhiteSpace($addr)) { continue }
  if ($cache.ContainsKey($addr)) {
    if ($cache[$addr].lat) { $hit++ } else { $miss++ }
    continue
  }
  # 1) endereco completo, bounded
  $res = Geocode $addr $true
  $src = "nominatim_full"
  # 2) sem numero (rua, bairro, cidade), bounded
  if (-not $res) {
    $semNum = $addr -replace ',\s*\d+\s*,', ','
    if ($semNum -ne $addr) { $res = Geocode $semNum $true; $src = "nominatim_rua" }
  }
  if ($res) {
    $cache[$addr] = @{ lat = $res.lat; lng = $res.lng; src = $src }
    $hit++
  } else {
    $cache[$addr] = @{ lat = $null; lng = $null; src = "none" }
    $miss++
  }
  $novos++
  Start-Sleep -Milliseconds 1100   # respeita 1 req/s do Nominatim

  if ($novos % 10 -eq 0) {
    $cache | ConvertTo-Json -Depth 5 | Out-File $cacheFile -Encoding UTF8
  }
  if ($i % 25 -eq 0) {
    Write-Host ("[{0}/{1}] novos={2} hit={3} miss={4}" -f $i, $total, $novos, $hit, $miss)
  }
}
$cache | ConvertTo-Json -Depth 5 | Out-File $cacheFile -Encoding UTF8
Write-Host ("FIM. total={0} hit={1} miss={2} novos_geocodificados={3}" -f $total, $hit, $miss, $novos)
