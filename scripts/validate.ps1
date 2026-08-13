param(
    [string]$DotnetPath = "dotnet",
    [switch]$SkipNpmInstall
)

$ErrorActionPreference = "Stop"

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Executable,
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Arguments
    )

    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Executable failed with exit code $LASTEXITCODE."
    }
}

if (-not $SkipNpmInstall) {
    Invoke-Checked npm ci
}

Invoke-Checked npm audit --audit-level=high
Invoke-Checked npm run check
Invoke-Checked npm test
Invoke-Checked npm run build
Invoke-Checked node spec-factory\bin\spec-factory.js validate spec-factory\examples\modernization\approved
Invoke-Checked node spec-factory\bin\spec-factory.js validate spec-factory\examples\audit-feature\approved
Invoke-Checked node spec-factory\bin\spec-factory.js approve spec-factory\examples\modernization\approved --id modernization-approved
Invoke-Checked node spec-factory\bin\spec-factory.js approve spec-factory\examples\audit-feature\approved --id audit-feature-approved
Invoke-Checked node benchmark\scripts\generate-illustrative-evidence.js
Invoke-Checked npm --workspace dashboard run build:singlefile

Invoke-Checked $DotnetPath msbuild `
    "src\legacy-trade-reconciliation\LegacyTradeReconciliation.sln" `
    "/t:Restore,Build" `
    "/p:Configuration=Release" `
    "/v:minimal"

Invoke-Checked `
    "src\legacy-trade-reconciliation\tests\LegacyTradeReconciliation.CharacterizationTests\bin\Release\LegacyTradeReconciliation.CharacterizationTests.exe"

Invoke-Checked $DotnetPath test `
    "src\canonical-modernized\TradeRecon.sln" `
    "--configuration" `
    "Release"

Invoke-Checked node evaluator\bin\evaluate.js fixture-hashes

$evaluatorEvidence = Join-Path $env:TEMP "specforge-modernization-evidence.json"
try {
    Invoke-Checked node evaluator\bin\evaluate.js evaluate `
        --candidate src\legacy-trade-reconciliation `
        --episode modernization `
        --evidence $evaluatorEvidence `
        --dotnet $DotnetPath
}
finally {
    if (Test-Path $evaluatorEvidence) {
        Remove-Item -LiteralPath $evaluatorEvidence -Force
    }
}

Write-Host "All SpecForge validations passed."
