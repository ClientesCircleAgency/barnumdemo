$files = Get-ChildItem -Path src, docs -Recurse -Include *.tsx,*.ts,*.jsx,*.js,*.md

function C($code) {
    return "$([char][int]$code)"
}

$C3 = C 0xC3
$E2 = C 0xE2
$86 = C 0x86

foreach ($file in $files) {
    try {
        $path = $file.FullName
        $content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
        $originalContent = $content

        # 1. Rename Barnum -> Barnun
        $content = $content.Replace('Barnum', 'Barnun')
        
        # 2. Fix Mojibake (Explicit Unrolled to avoid Array issues)
        # Ã¡ -> á
        $content = $content.Replace("$C3$(C 0xA1)", "$(C 0xE1)")
        # Ã§ -> ç
        $content = $content.Replace("$C3$(C 0xA7)", "$(C 0xE7)")
        # Ã£ -> ã
        $content = $content.Replace("$C3$(C 0xA3)", "$(C 0xE3)")
        # Ãª -> ê
        $content = $content.Replace("$C3$(C 0xAA)", "$(C 0xEA)")
        # Ã­ -> í
        $content = $content.Replace("$C3$(C 0xAD)", "$(C 0xED)")
        # Ã³ -> ó
        $content = $content.Replace("$C3$(C 0xB3)", "$(C 0xF3)")
        # Ãº -> ú
        $content = $content.Replace("$C3$(C 0xBA)", "$(C 0xFA)")
        # Ã  -> à
        $content = $content.Replace("$C3$(C 0xA0)", "$(C 0xE0)")
        # Ã© -> é
        $content = $content.Replace("$C3$(C 0xA9)", "$(C 0xE9)")
        # Ã‰ -> É
        $content = $content.Replace("$C3$(C 0x89)", "$(C 0xC9)")
        # Ã“ -> Ó
        $content = $content.Replace("$C3$(C 0x93)", "$(C 0xD3)")
        # Ãš -> Ú
        $content = $content.Replace("$C3$(C 0x9A)", "$(C 0xDA)")
        # Ã -> Á
        $content = $content.Replace("$C3$(C 0x81)", "$(C 0xC1)")
        # Ã‚ -> Â
        $content = $content.Replace("$C3$(C 0x82)", "$(C 0xC2)")
        # Ã¢ -> â
        $content = $content.Replace("$C3$(C 0xA2)", "$(C 0xE2)")
        # Ãµ -> õ
        $content = $content.Replace("$C3$(C 0xB5)", "$(C 0xF5)")
        
        # Area (Ã rea -> Área) - Covered by Ã (C3 81) -> Á above?
        # If "Ã rea" is "C3 81 72...", replacing C3 81 with C1 makes it "C1 72..." (Área). Correct.

        # Arrows: â†’ (E2 86 92) -> → (2192)
        $badArrow = "$E2$86$(C 0x92)"
        $goodArrow = "$(C 0x2192)"
        $content = $content.Replace($badArrow, $goodArrow)
        
        # Left Arrow: â† (E2 86) -> ← (2190) ??
        # Or just rely on replacing â† with arrow left icon manually if needed.
        # But let's fix the unicode char if possible.
        # â† is E2 86.
        # But normally E2 86 is prefix for many things.
        # Let's verify context. Previous manual fix used arrow icon.
        # If we see E2 86 surrounded by spaces...
        # For now, stick to Right Arrow which is common (â†’).
        
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
