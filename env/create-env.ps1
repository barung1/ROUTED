param(
    [switch]$Force
)

$envDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $envDir "env.template.txt"
$dest = Join-Path $envDir ".env"

if (-not (Test-Path $source)) {
    Write-Error "Missing template: $source"
    exit 1
}

if ((Test-Path $dest) -and -not $Force) {
    Write-Host "env/.env already exists. Re-run with -Force to overwrite."
    exit 0
}

$outputLines = New-Object System.Collections.Generic.List[string]
$lines = Get-Content -Path $source -Raw -Encoding UTF8
$lines = $lines -split "\r?\n"

foreach ($line in $lines) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith("#")) {
        $outputLines.Add($line)
        continue
    }

    if ($line -match "^(?<key>[^=]+)=(?<val>.*)$") {
        $key = $Matches["key"]
        $defaultValue = $Matches["val"]

        if ([string]::IsNullOrEmpty($defaultValue)) {
            $prompt = "$key"
        } else {
            $prompt = "$key [$defaultValue]"
        }

        $inputValue = Read-Host $prompt
        if ([string]::IsNullOrEmpty($inputValue)) {
            $inputValue = $defaultValue
        }

        $outputLines.Add("$key=$inputValue")
    } else {
        $outputLines.Add($line)
    }
}

$outputLines | Set-Content -Path $dest -Encoding UTF8
Write-Host "Created env/.env from env/env.template.txt"
