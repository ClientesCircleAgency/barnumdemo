$files = Get-ChildItem -Path src, docs -Recurse -Include *.tsx,*.ts,*.jsx,*.js,*.md

foreach ($file in $files) {
    # Read with explicit UTF-8
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $originalContent = $content

    # 1. Rename Barnum -> Barnun (Case sensitive to preserve specific casing if needed, but 'Barnum' is the target)
    # Using .Replace() for literal replacement
    $content = $content.Replace('Barnum', 'Barnun')
    
    # 2. Fix potential Mojibake (Safe to run even if not present)
    # Common 2-byte sequences for UTF-8 bytes viewed as Windows-1252
    $content = $content.Replace('Ã¡', 'á')
    $content = $content.Replace('Ã§', 'ç') 
    $content = $content.Replace('Ã£', 'ã')
    $content = $content.Replace('Ãª', 'ê')
    $content = $content.Replace('Ã­', 'í')
    $content = $content.Replace('Ã³', 'ó')
    $content = $content.Replace('Ãº', 'ú')
    $content = $content.Replace('Ã ', 'à')
    $content = $content.Replace('Ã©', 'é')
    $content = $content.Replace('Ã‰', 'É')
    $content = $content.Replace('Ã“', 'Ó')
    $content = $content.Replace('Ãš', 'Ú')
    $content = $content.Replace('Ã‚', 'Â')
    $content = $content.Replace('Ã¢', 'â')
    $content = $content.Replace('Ãµ', 'õ')
    
    # Fix 'Area' and Arrows
    $content = $content.Replace('Ãrea', 'Área')
    $content = $content.Replace('â†’', '→')
    $content = $content.Replace('â†', '←')

    # 3. Write back ONLY if changed, enforcing UTF-8
    if ($content -ne $originalContent) {
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        Write-Host "Fixed: $($file.Name)"
    }
}
Write-Host "Global Fix Complete" -ForegroundColor Green
