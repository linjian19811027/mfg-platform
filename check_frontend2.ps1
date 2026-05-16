$ErrorActionPreference = "Stop"
$projectRoot = "C:\mfg-platform_copy"

Write-Host "=== 前端 TypeScript 编译检查 ==="

# 获取 TypeScript 路径
$tscPath = where.exe tsc 2>$null | Select-Object -First 1
if (-not $tscPath) {
    $tscPath = "node_modules\.bin\tsc"
}

Push-Location $projectRoot\frontend
try {
    $result = & $tscPath --noEmit --skipLibCheck 2>&1
    $exitCode = $LASTEXITCODE
    if ($exitCode -eq 0) {
        Write-Host "✓ 编译通过，零错误" -ForegroundColor Green
    } else {
        Write-Host "✗ 编译错误：" -ForegroundColor Red
        $result | ForEach-Object { Write-Host $_ }
    }
} finally {
    Pop-Location
}

exit $exitCode
