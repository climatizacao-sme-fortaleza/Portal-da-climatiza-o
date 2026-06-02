# Le uma aba de um .xlsx (sem Excel) e grava CSV UTF-8.
# Uso: powershell -File xlsx2csv.ps1 -Sheet ESCOLA -Out _data\ESCOLA.csv
param(
  [string]$Src = "C:\Users\Sr. Projeto\Desktop\cowork\portal\CLIMATIZACAO_MODELO_CONSOLIDADO.xlsx",
  [Parameter(Mandatory=$true)][string]$Sheet,
  [Parameter(Mandatory=$true)][string]$Out
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null

$zip = [System.IO.Compression.ZipFile]::OpenRead($Src)
function ReadEntry($name){
  $e = $zip.GetEntry($name); if(-not $e){ return $null }
  $sr = New-Object System.IO.StreamReader($e.Open(), [System.Text.Encoding]::UTF8)
  $t = $sr.ReadToEnd(); $sr.Dispose(); return $t
}

# shared strings
$shared = @()
$sstTxt = ReadEntry "xl/sharedStrings.xml"
if($sstTxt){
  $sst = New-Object System.Xml.XmlDocument; $sst.LoadXml($sstTxt)
  foreach($si in $sst.GetElementsByTagName("si")){ $shared += $si.InnerText }
}

# nome da aba -> arquivo de planilha (via rels)
$wb = New-Object System.Xml.XmlDocument; $wb.LoadXml((ReadEntry "xl/workbook.xml"))
$rel = New-Object System.Xml.XmlDocument; $rel.LoadXml((ReadEntry "xl/_rels/workbook.xml.rels"))
$relMap = @{}
foreach($rl in $rel.GetElementsByTagName("Relationship")){ $relMap[$rl.GetAttribute("Id")] = $rl.GetAttribute("Target") }
$target = $null
foreach($sh in $wb.GetElementsByTagName("sheet")){
  if($sh.GetAttribute("name") -eq $Sheet){ $target = $relMap[$sh.GetAttribute("r:id")]; break }
}
if(-not $target){ throw "Aba '$Sheet' nao encontrada" }
if($target -match '^/'){ $target = $target.TrimStart('/') } else { $target = "xl/" + $target }

function ColIdx($ref){
  $letters = ($ref -replace '[0-9]','')
  $n = 0
  foreach($ch in $letters.ToCharArray()){ $n = $n*26 + ([int][char]$ch - 64) }
  return $n
}
function CsvCell($s){
  if($null -eq $s){ return "" }
  if($s -match '[",\r\n]'){ return '"' + ($s -replace '"','""') + '"' }
  return $s
}

$doc = New-Object System.Xml.XmlDocument; $doc.LoadXml((ReadEntry $target))
$rowsParsed = New-Object System.Collections.ArrayList
$maxCol = 0
foreach($row in $doc.GetElementsByTagName("row")){
  $cells = @{}
  foreach($c in $row.ChildNodes){
    if($c.LocalName -ne "c"){ continue }
    $ref = $c.GetAttribute("r"); $ci = ColIdx $ref
    if($ci -gt $maxCol){ $maxCol = $ci }
    $t = $c.GetAttribute("t")
    $val = ""
    foreach($child in $c.ChildNodes){
      if($child.LocalName -eq "v"){ $val = $child.InnerText }
      elseif($child.LocalName -eq "is"){ $val = $child.InnerText }
    }
    if($t -eq "s" -and $val -ne ""){ $val = $shared[[int]$val] }
    $cells[$ci] = $val
  }
  [void]$rowsParsed.Add($cells)
}
$zip.Dispose()

$sb = New-Object System.Text.StringBuilder
foreach($cells in $rowsParsed){
  $line = @()
  for($i=1; $i -le $maxCol; $i++){ $line += (CsvCell $cells[$i]) }
  [void]$sb.AppendLine(($line -join ","))
}
$enc = New-Object System.Text.UTF8Encoding($false)  # sem BOM
[System.IO.File]::WriteAllText($Out, $sb.ToString(), $enc)
"OK $Sheet -> $Out  (linhas=$($rowsParsed.Count) cols=$maxCol)"
