param([int]$Port = 8123, [string]$Root = "$PSScriptRoot\web")
$ErrorActionPreference = "Stop"
$mime = @{
  ".html"="text/html; charset=utf-8"; ".js"="application/javascript; charset=utf-8";
  ".css"="text/css; charset=utf-8"; ".json"="application/json; charset=utf-8";
  ".png"="image/png"; ".svg"="image/svg+xml"; ".ico"="image/x-icon"
}
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Servindo $Root em http://localhost:$Port/"
while ($listener.IsListening) {
  $ctx = $null
  try {
    $ctx = $listener.GetContext()
    $path = [System.Uri]::UnescapeDataString($ctx.Request.Url.LocalPath).TrimStart("/")
    if ([string]::IsNullOrEmpty($path)) { $path = "index.html" }
    $file = Join-Path $Root $path
    if (Test-Path $file -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      if ($mime.ContainsKey($ext)) { $ctx.Response.ContentType = $mime[$ext] }
      $ctx.Response.StatusCode = 200
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404: $path")
      $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
    }
  } catch {
    Write-Host "Erro req: $($_.Exception.Message)"
  } finally {
    if ($ctx) { try { $ctx.Response.OutputStream.Close() } catch {} }
  }
}
