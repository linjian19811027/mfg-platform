$content = Get-Content "C:\mfg-platform_copy\frontend\src\locale\zh-CN.ts"
$modules = @{}
foreach ($line in $content) {
    if ($line -match "^\s+'([^.]+)") {
        $modules[$matches[1]] = $true
    }
}
$modules.Keys | Sort-Object
