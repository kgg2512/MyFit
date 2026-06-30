# MyFit 전체 빌드 스크립트 — 웹(데모/실제) + Android(데모/실제)
# 실행: cd myfit-mobile; .\build-all.ps1
# 개별 실행: .\build-all.ps1 -Target web:demo

param(
    [string]$Target = "all",          # all | web:demo | web:prod | android:demo | android:prod
    [switch]$SkipAndroid = $false     # Android 빌드 건너뛰기 (Java 환경 없을 때)
)

$WEB_OUT   = "c:\Users\kgg25\Desktop\MyFit\app"
$MYFIT_DIR = "c:\Users\kgg25\Desktop\G2 Company Ltd\myfit-mobile"

Set-Location $MYFIT_DIR

function Build-Web {
    param([bool]$Demo)
    $label = if ($Demo) { "웹 데모" } else { "웹 실제" }
    $env  = if ($Demo) { ".env.demo" } else { ".env.production" }
    Write-Host "`n=== [$label] 빌드 시작 ===" -ForegroundColor Cyan

    Copy-Item $env ".env.production.local" -Force
    npm run build
    if (!$?) { Write-Host "[$label] 빌드 실패" -ForegroundColor Red; return $false }

    if ($Demo) {
        $dest = "c:\Users\kgg25\Desktop\MyFit\app-demo"
        if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
        Copy-Item "out" $dest -Recurse
        Write-Host "[$label] → $dest" -ForegroundColor Green
    } else {
        if (Test-Path $WEB_OUT) { Remove-Item $WEB_OUT -Recurse -Force }
        Copy-Item "out" $WEB_OUT -Recurse
        Write-Host "[$label] → $WEB_OUT" -ForegroundColor Green
    }

    Remove-Item ".env.production.local" -ErrorAction SilentlyContinue
    return $true
}

function Build-Android {
    param([bool]$Demo)
    $label = if ($Demo) { "Android 데모 APK" } else { "Android 실제 AAB" }
    $env   = if ($Demo) { ".env.app.demo" } else { ".env.app" }
    Write-Host "`n=== [$label] 빌드 시작 ===" -ForegroundColor Cyan

    Copy-Item $env ".env.production.local" -Force
    npm run build
    if (!$?) { Write-Host "[$label] Next.js 빌드 실패" -ForegroundColor Red; return $false }

    npx cap sync android
    Set-Location android

    if ($Demo) {
        .\gradlew assembleRelease   # APK (직접 설치 가능)
        $apk = Get-ChildItem "app\build\outputs\apk\release\*.apk" | Select-Object -First 1
        if ($apk) {
            $dest = "c:\Users\kgg25\Desktop\MyFit-Demo.apk"
            Copy-Item $apk.FullName $dest -Force
            Write-Host "[$label] → $dest" -ForegroundColor Green
        }
    } else {
        .\gradlew bundleRelease     # AAB (Play Store 제출용)
        $aab = Get-ChildItem "app\build\outputs\bundle\release\*.aab" | Select-Object -First 1
        if ($aab) {
            $dest = "c:\Users\kgg25\Desktop\MyFit-PlayStore.aab"
            Copy-Item $aab.FullName $dest -Force
            Write-Host "[$label] → $dest" -ForegroundColor Green
        }
    }

    Set-Location $MYFIT_DIR
    Remove-Item ".env.production.local" -ErrorAction SilentlyContinue
    return $true
}

# ── 실행 ──
switch ($Target) {
    "web:demo"      { Build-Web -Demo $true }
    "web:prod"      { Build-Web -Demo $false }
    "android:demo"  { Build-Android -Demo $true }
    "android:prod"  { Build-Android -Demo $false }
    "web"           { Build-Web -Demo $true; Build-Web -Demo $false }
    "android"       { Build-Android -Demo $true; Build-Android -Demo $false }
    "all" {
        Build-Web -Demo $true
        Build-Web -Demo $false
        if (!$SkipAndroid) {
            Build-Android -Demo $true
            Build-Android -Demo $false
        }
    }
}

Write-Host "`n=== 빌드 완료 ===" -ForegroundColor Yellow
