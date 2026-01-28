$files = Get-ChildItem -Path src, docs -Recurse -Include *.tsx,*.ts,*.jsx,*.js,*.md

function Get-MojibakeString($byte2) {
    return "$([char]0x00C3)$([char]$byte2)"
}

foreach ($file in $files) {
    $path = $file.FullName
    $content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $originalContent = $content

    # 1. Rename Barnum -> Barnun
    $content = $content.Replace('Barnum', 'Barnun')

    # 2. Fix Mojibake (Using ASCII construction to avoid script encoding issues)
    # Ã¡ (C3 A1) -> á
    $content = $content.Replace("$(Get-MojibakeString 0xA1)", "á")
    # Ã§ (C3 A7) -> ç
    $content = $content.Replace("$(Get-MojibakeString 0xA7)", "ç")
    # Ã£ (C3 A3) -> ã
    $content = $content.Replace("$(Get-MojibakeString 0xA3)", "ã")
    # Ãª (C3 AA) -> ê
    $content = $content.Replace("$(Get-MojibakeString 0xAA)", "ê")
    # Ã­ (C3 AD) -> í
    $content = $content.Replace("$(Get-MojibakeString 0xAD)", "í")
    # Ã³ (C3 B3) -> ó
    $content = $content.Replace("$(Get-MojibakeString 0xB3)", "ó")
    # Ãº (C3 BA) -> ú
    $content = $content.Replace("$(Get-MojibakeString 0xBA)", "ú")
    # Ã  (C3 A0) -> à
    $content = $content.Replace("$(Get-MojibakeString 0xA0)", "à")
    # Ã© (C3 A9) -> é
    $content = $content.Replace("$(Get-MojibakeString 0xA9)", "é")
    # Ã‰ (C3 89) -> É
    $content = $content.Replace("$(Get-MojibakeString 0x89)", "É")
    # Ã“ (C3 93) -> Ó
    $content = $content.Replace("$(Get-MojibakeString 0x93)", "Ó")
    # Ãš (C3 9A) -> Ú
    $content = $content.Replace("$(Get-MojibakeString 0x9A)", "Ú") 
    # Ã (C3 81) -> Á
    $content = $content.Replace("$(Get-MojibakeString 0x81)", "Á")
    # Ã‚ (C3 82) -> Â
    $content = $content.Replace("$(Get-MojibakeString 0x82)", "Â")
    # Ã¢ (C3 A2) -> â
    $content = $content.Replace("$(Get-MojibakeString 0xA2)", "â")
    # Ãµ (C3 B5) -> õ
    $content = $content.Replace("$(Get-MojibakeString 0xB5)", "õ")
    
    # Fix 'Area' (Ã rea -> Área)
    $badArea = "$(Get-MojibakeString 0x81)rea"
    $content = $content.Replace($badArea, "Área")

    # 3. Write back ONLY if changed
    if ($content -ne $originalContent) {
        [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
        Write-Host "Fixed: $($file.Name)"
    }
}
Write-Host "Global Fix Complete" -ForegroundColor Green
