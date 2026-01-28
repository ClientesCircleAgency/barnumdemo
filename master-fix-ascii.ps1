$files = Get-ChildItem -Path src, docs -Recurse -Include *.tsx,*.ts,*.jsx,*.js,*.md

function Get-StringFromBytes($inputObj) {
    # Force input to be treated as array of ints
    $bytes = @($inputObj) 
    $chars = $bytes | ForEach-Object { [char][int]$_ }
    return -join $chars
}

# Define Mojibake mappings (Bad -> Good)
# Keys are patterns like C3 A1, Values are single chars like E1
$replacements = @{
    # Ã¡ (C3 A1) -> á (E1)
    (0xC3, 0xA1) = 0xE1
    # Ã§ (C3 A7) -> ç (E7)
    (0xC3, 0xA7) = 0xE7
    # Ã£ (C3 A3) -> ã (E3)
    (0xC3, 0xA3) = 0xE3
    # Ãª (C3 AA) -> ê (EA)
    (0xC3, 0xAA) = 0xEA
    # Ã­ (C3 AD) -> í (ED)
    (0xC3, 0xAD) = 0xED
    # Ã³ (C3 B3) -> ó (F3)
    (0xC3, 0xB3) = 0xF3
    # Ãº (C3 BA) -> ú (FA)
    (0xC3, 0xBA) = 0xFA
    # Ã  (C3 A0) -> à (E0)
    (0xC3, 0xA0) = 0xE0
    # Ã© (C3 A9) -> é (E9)
    (0xC3, 0xA9) = 0xE9
    # Ã‰ (C3 89) -> É (C9)
    (0xC3, 0x89) = 0xC9
    # Ã“ (C3 93) -> Ó (D3)
    (0xC3, 0x93) = 0xD3
    # Ãš (C3 9A) -> Ú (DA)
    (0xC3, 0x9A) = 0xDA
    # Ã (C3 81) -> Á (C1)
    (0xC3, 0x81) = 0xC1
    # Ã‚ (C3 82) -> Â (C2)
    (0xC3, 0x82) = 0xC2
    # Ã¢ (C3 A2) -> â (E2)
    (0xC3, 0xA2) = 0xE2
    # Ãµ (C3 B5) -> õ (F5)
    (0xC3, 0xB5) = 0xF5
}

# Arrows: â†’ (E2 86 92) -> → (2192)
$arrowBad = Get-StringFromBytes @(0xE2, 0x86, 0x92)
$arrowGood = "$([char]0x2192)"

# Special Area (C3 81 72) -> (C1 72)
$badArea = "$(Get-StringFromBytes @(0xC3, 0x81))rea"
$goodArea = "$([char]0xC1)rea"

foreach ($file in $files) {
    try {
        $path = $file.FullName
        $content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
        $originalContent = $content

        # 1. Rename Barnum -> Barnun
        $content = $content.Replace('Barnum', 'Barnun')
        
        # 2. Fix Mojibake
        foreach ($key in $replacements.Keys) {
            $badStr = Get-StringFromBytes $key
            $goodStr = "$([char]$replacements[$key])"
            $content = $content.Replace($badStr, $goodStr)
        }
        
        # Area specific
        $content = $content.Replace($badArea, $goodArea)

        # Arrows
        $content = $content.Replace($arrowBad, $arrowGood)

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
