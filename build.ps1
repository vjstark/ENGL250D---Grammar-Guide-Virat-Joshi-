# Packs the engine and every file in the levels folder into one playable HTML file.
# Run it by double-clicking build.cmd (or: powershell -File build.ps1 -Open).
param([switch]$Open)

$ErrorActionPreference = 'Stop'
$root      = Split-Path -Parent $MyInvocation.MyCommand.Path
$utf8      = New-Object System.Text.UTF8Encoding($false)
$levelsDir = Join-Path $root 'levels'
$engineDir = Join-Path $root 'engine'
$outFile   = Join-Path $root 'Grammar Guide Game.html'

if (-not (Test-Path $levelsDir)) { throw "No 'levels' folder next to build.ps1." }

# 1. Level files (.md), in filename order
$files = @()
Get-ChildItem -LiteralPath $levelsDir -Filter '*.md' -File | Sort-Object Name | ForEach-Object {
    $files += [pscustomobject]@{ name = $_.Name; text = [IO.File]::ReadAllText($_.FullName, $utf8) }
}

# 2. Pictures in levels/images, embedded so the game stays one file
$mime = @{ '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.gif'='image/gif'; '.webp'='image/webp'; '.svg'='image/svg+xml' }
$images = @{}
$imgDir = Join-Path $levelsDir 'images'
if (Test-Path $imgDir) {
    Get-ChildItem -LiteralPath $imgDir -File -Recurse | Where-Object { $mime.ContainsKey($_.Extension.ToLower()) } | ForEach-Object {
        $rel = 'images/' + ($_.FullName.Substring($imgDir.Length + 1) -replace '\\', '/')
        $images[$rel.ToLower()] = 'data:' + $mime[$_.Extension.ToLower()] + ';base64,' + [Convert]::ToBase64String([IO.File]::ReadAllBytes($_.FullName))
    }
}

# 3. Fill the template
$data = [ordered]@{ files = $files; images = $images; built = (Get-Date -Format 'yyyy-MM-dd HH:mm') }
$json = ConvertTo-Json -InputObject $data -Depth 6 -Compress
$tpl  = [IO.File]::ReadAllText((Join-Path $engineDir 'template.html'), $utf8)
$css  = [IO.File]::ReadAllText((Join-Path $engineDir 'style.css'), $utf8)
# Engine code: these files, in this order, share one scope.
$js = (@('parse.js', 'scene.js', 'sound.js', 'game.js') | ForEach-Object {
    [IO.File]::ReadAllText((Join-Path $engineDir $_), $utf8)
}) -join "`n"
# Fonts: any .woff2 / .woff / .ttf in engine/fonts is embedded. The file name (without extension) is the font's name.
$fontCss = ''
$fontDir = Join-Path $engineDir 'fonts'
if (Test-Path $fontDir) {
    $fmime = @{ '.woff2'='font/woff2'; '.woff'='font/woff'; '.ttf'='font/ttf' }
    Get-ChildItem -LiteralPath $fontDir -File | Where-Object { $fmime.ContainsKey($_.Extension.ToLower()) } | ForEach-Object {
        $name = ($_.BaseName -replace '[-_](Regular|VariableFont.*)$', '') -creplace '([a-z])([A-Z])', '$1 $2'
        $fontCss += "@font-face { font-family: '$name'; src: url(data:" + $fmime[$_.Extension.ToLower()] + ';base64,' + [Convert]::ToBase64String([IO.File]::ReadAllBytes($_.FullName)) + "); font-display: block; }`n"
    }
}
$html = $tpl.Replace('/*__FONTS__*/', $fontCss).Replace('/*__STYLE__*/', $css).Replace('/*__ENGINE__*/', $js).Replace('/*__DATA__*/', $json)
[IO.File]::WriteAllText($outFile, $html, $utf8)
# Same game as index.html, ready to upload to GitHub Pages.
[IO.File]::WriteAllText((Join-Path $root 'index.html'), $html, $utf8)

Write-Host ''
Write-Host ("Built 'Grammar Guide Game.html' from {0} level files and {1} pictures:" -f $files.Count, $images.Count)
$files | ForEach-Object { Write-Host ('  ' + $_.name) }
Write-Host ''
Write-Host 'Problems in the level files, if any, are listed on the game''s title screen.'

if ($Open) { Start-Process $outFile }
