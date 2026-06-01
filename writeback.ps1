$ErrorActionPreference = "Stop"
$base = "C:\Users\Sr. Projeto\Desktop\cowork\portal\_data"
$src  = "C:\Users\Sr. Projeto\Desktop\cowork\portal\CLIMATIZACAO_MODELO_CONSOLIDADO.xlsx"

# cache de geocode: address -> {lat,lng}
$geo = @{}
$j = Get-Content (Join-Path $base "geocode_cache.json") -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($p in $j.PSObject.Properties) { $geo[$p.Name] = $p.Value }

$xl = New-Object -ComObject Excel.Application; $xl.Visible = $false; $xl.DisplayAlerts = $false
$wb = $xl.Workbooks.Open($src)
$ws = $wb.Worksheets.Item("ESCOLA")
$used = $ws.UsedRange
$nRows = $used.Rows.Count
# cabecalho na linha 1: localizar colunas por nome
$nCols = $used.Columns.Count
$colGeo = 0; $colLat = 0; $colLng = 0
for ($c = 1; $c -le $nCols; $c++) {
  $h = "" + $ws.Cells.Item(1, $c).Value2
  if ($h -match 'GEOCODE') { $colGeo = $c }
  elseif ($h -eq 'LAT') { $colLat = $c }
  elseif ($h -eq 'LNG') { $colLng = $c }
}
$wrote = 0
for ($r = 2; $r -le $nRows; $r++) {
  $addr = ("" + $ws.Cells.Item($r, $colGeo).Value2).Trim()
  if ($addr -and $geo.ContainsKey($addr) -and $geo[$addr].lat) {
    $ws.Cells.Item($r, $colLat).Value2 = [double]$geo[$addr].lat
    $ws.Cells.Item($r, $colLng).Value2 = [double]$geo[$addr].lng
    $wrote++
  }
}
$wb.Save()
$wb.Close($true); $xl.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($xl) | Out-Null
"LAT/LNG gravados em $wrote linhas (cols geo=$colGeo lat=$colLat lng=$colLng)"
