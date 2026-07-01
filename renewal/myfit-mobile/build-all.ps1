# MyFit 신형(renewal) 빌드 스크립트 — 웹(/v2 배포) + Android(데모/실제)
# 실행: cd renewal/myfit-mobile;  .\build-all.ps1 -Target web
#   web          → 레포 루트 /v2 에 정적 배포본 생성 (basePath /MyFit/v2, 데모모드=백엔드 없이 자기완결)
#   android:demo → 직접설치용 APK
#   android:prod → Play Store 제출용 AAB

param(
    [string]$Target = "web",          # web | android:demo | android:prod | all
    [switch]$SkipAndroid = $false
)

$REPO      = "c:\Users\kgg25\Desktop\MyFit"
$MYFIT_DIR = "$REPO\renewal\myfit-mobile"
$V2_OUT    = "$REPO\v2"

Set-Location $MYFIT_DIR

function Build-Web {
    Write-Host "`n=== [웹 v2] 빌드 시작 (basePath /MyFit/v2, DEMO_MODE) ===" -ForegroundColor Cyan
    $env:NEXT_PUBLIC_BASE_PATH = "/MyFit/v2"
    $env:NEXT_PUBLIC_DEMO_MODE = "true"
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Host "[웹] 빌드 실패" -ForegroundColor Red; return $false }
    if (Test-Path $V2_OUT) { Remove-Item $V2_OUT -Recurse -Force }
    Copy-Item "out" $V2_OUT -Recurse
    Write-Host "[웹] out -> $V2_OUT (커밋+푸시하면 https://kgg2512.github.io/MyFit/v2/ 반영)" -ForegroundColor Green
    return $true
}

function Build-Android {
    param([bool]$Demo)
    $label = if ($Demo) { "Android 데모 APK" } else { "Android 실제 AAB" }
    $envf  = if ($Demo) { ".env.app.demo" } else { ".env.app" }
    Write-Host "`n=== [$label] 빌드 시작 ===" -ForegroundColor Cyan

    Copy-Item $envf ".env.production.local" -Force
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Host "[$label] Next.js 빌드 실패" -ForegroundColor Red; return $false }

    npx cap sync android
    Set-Location android
    if ($Demo) {
        .\gradlew assembleRelease
        $apk = Get-ChildItem "app\build\outputs\apk\release\*.apk" | Select-Object -First 1
        if ($apk) { Copy-Item $apk.FullName "$REPO\..\MyFit-Demo.apk" -Force; Write-Host "[$label] -> Desktop\MyFit-Demo.apk" -ForegroundColor Green }
    } else {
        .\gradlew bundleRelease
        $aab = Get-ChildItem "app\build\outputs\bundle\release\*.aab" | Select-Object -First 1
        if ($aab) { Copy-Item $aab.FullName "$REPO\..\MyFit-PlayStore.aab" -Force; Write-Host "[$label] -> Desktop\MyFit-PlayStore.aab" -ForegroundColor Green }
    }
    Set-Location $MYFIT_DIR
    Remove-Item ".env.production.local" -ErrorAction SilentlyContinue
    return $true
}

switch ($Target) {
    "web"          { Build-Web }
    "android:demo" { Build-Android -Demo $true }
    "android:prod" { Build-Android -Demo $false }
    "all"          { Build-Web; if (!$SkipAndroid) { Build-Android -Demo $true; Build-Android -Demo $false } }
}

Write-Host "`n=== 빌드 완료 ===" -ForegroundColor Yellow
