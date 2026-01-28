$files = Get-ChildItem -Path src, docs -Recurse -Include *.tsx,*.ts,*.jsx,*.js,*.md

# Pre-calculate strings to avoid loop errors
$C3 = [char]0xC3
$E2 = [char]0xE2
$86 = [char]0x86

# Mapping pairs: [BadString, GoodString]
$maps = @(
    @("$C3$([char]0xA1)", "$([char]0xE1)"), # Ã¡ -> á
    @("$C3$([char]0xA7)", "$([char]0xE7)"), # Ã§ -> ç
    @("$C3$([char]0xA3)", "$([char]0xE3)"), # Ã£ -> ã
    @("$C3$([char]0xAA)", "$([char]0xEA)"), # Ãª -> ê
    @("$C3$([char]0xAD)", "$([char]0xED)"), # Ã­ -> í
    @("$C3$([char]0xB3)", "$([char]0xF3)"), # Ã³ -> ó
    @("$C3$([char]0xBA)", "$([char]0xFA)"), # Ãº -> ú
    @("$C3$([char]0xA0)", "$([char]0xE0)"), # Ã  -> à
    @("$C3$([char]0xA9)", "$([char]0xE9)"), # Ã© -> é
    @("$C3$([char]0x89)", "$([char]0xC9)"), # Ã‰ -> É
    @("$C3$([char]0x93)", "$([char]0xD3)"), # Ã“ -> Ó
    @("$C3$([char]0x9A)", "$([char]0xDA)"), # Ãš -> Ú
    @("$C3$([char]0x81)", "$([char]0xC1)"), # Ã -> Á
    @("$C3$([char]0x82)", "$([char]0xC2)"), # Ã‚ -> Â
    @("$C3$([char]0xA2)", "$([char]0xE2)"), # Ã¢ -> â
    @("$C3$([char]0xB5)", "$([char]0xF5)"), # Ãµ -> õ
    # Area
    @("$C3$([char]0x81)rea", "$([char]0xC1)rea"), # Ã rea -> Área
    # Arrow
    @("$E2$86$([char]0x92)", "$([char]0x2192)")
)

foreach ($file in $files) {
    try {
        $path = $file.FullName
        # Force UTF-8 reading
        $content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
        $originalContent = $content

        # 1. Rename Barnum -> Barnun
        if ($content.Contains('Barnum')) {
            $content = $content.Replace('Barnum', 'Barnun')
        }

        # 2. Fix Mojibake
        foreach ($pair in $maps) {
            $bad = $pair[0]
            $good = $pair[1]
            if ($content.Contains($bad)) {
                $content = $content.Replace($bad, $good)
            }
        }

        # 3. Write back
        if ($content -ne $originalContent) {
            [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
            Write-Host "Fixed: $($file.Name)"
        }
    }
    catch {
        Write-Host "Error processing $($file.Name): $_" -ForegroundColor Red
    }
}
Write-Host "Global Fix Complete" -ForegroundColor Green
