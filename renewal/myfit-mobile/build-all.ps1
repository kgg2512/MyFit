# MyFit 신형(renewal) 빌드 스크립트 — 웹(데모/스토어) + Android(데모/실제)
# 실행: cd renewal/myfit-mobile;  .\build-all.ps1 -Target web:demo
#   web:demo     → 레포 루트 /v2 에 정적 배포본 (basePath /MyFit/v2, DEMO_MODE=true, 라이브)
#   web:prod     → 스토어 웹 산출물 out/ 생성 (basePath /MyFit/app, DEMO_MODE=false, 배포 보류)
#   web          → web:demo 별칭 (하위호환)
#   android:demo → 직접설치용 APK
#   android:prod → Play Store 제출용 AAB

param(
    [string]$Target = "web:demo",     # web:demo | web:prod | web | android:demo | android:prod | all
    [switch]$SkipAndroid = $false
)

$REPO      = "c:\Users\kgg25\Desktop\MyFit"
$MYFIT_DIR = "$REPO\renewal\myfit-mobile"
$V2_OUT    = "$REPO\v2"

Set-Location $MYFIT_DIR

function Build-Web {
    param([bool]$Demo = $true)
    if ($Demo) {
        Write-Host "`n=== [웹 데모 v2] 빌드 시작 (basePath /MyFit/v2, DEMO_MODE=true) ===" -ForegroundColor Cyan
        $env:NEXT_PUBLIC_BASE_PATH = "/MyFit/v2"
        $env:NEXT_PUBLIC_DEMO_MODE = "true"
    } else {
        Write-Host "`n=== [웹 스토어] 빌드 시작 (basePath /MyFit/app, DEMO_MODE=false) ===" -ForegroundColor Cyan
        $env:NEXT_PUBLIC_BASE_PATH = "/MyFit/app"
        $env:NEXT_PUBLIC_DEMO_MODE = "false"
    }
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Host "[웹] 빌드 실패" -ForegroundColor Red; return $false }
    if ($Demo) {
        if (Test-Path $V2_OUT) { Remove-Item $V2_OUT -Recurse -Force }
        Copy-Item "out" $V2_OUT -Recurse
        Write-Host "[웹 데모] out -> $V2_OUT (커밋+푸시하면 https://kgg2512.github.io/MyFit/v2/ 반영)" -ForegroundColor Green
    } else {
        # 스토어 웹은 신설만: out/ 산출물 생성 확인, 레포 커밋/배포는 회장 결정 대기.
        # 데모 전용 정적 자산은 스토어 산출물에서 제거(데모/스토어 물리 분리 — 코드는 이미 tree-shake).
        if (Test-Path "$MYFIT_DIR\out\demo") { Remove-Item "$MYFIT_DIR\out\demo" -Recurse -Force }
        Write-Host "[웹 스토어] out/ 산출물 생성 완료 (out/demo 제거, 배포 보류 — 레포 커밋 안 함)" -ForegroundColor Green
    }
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
    "web"          { Build-Web -Demo $true }
    "web:demo"     { Build-Web -Demo $true }
    "web:prod"     { Build-Web -Demo $false }
    "android:demo" { Build-Android -Demo $true }
    "android:prod" { Build-Android -Demo $false }
    "all"          { Build-Web -Demo $true; Build-Web -Demo $false; if (!$SkipAndroid) { Build-Android -Demo $true; Build-Android -Demo $false } }
}

Write-Host "`n=== 빌드 완료 ===" -ForegroundColor Yellow
