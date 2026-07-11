# MyFit 신형(renewal) 빌드 스크립트 — 데모/스토어 이원화 (회장 지시 2026-07-10)
# 실행: cd renewal/myfit-mobile;  .\build-all.ps1 -Target web:demo
#   web:demo     → 데모 스테이징 슬롯 /demo/v2 (basePath /MyFit/demo/v2, DEMO_MODE=true, noindex)  ← 작업·검증용
#   web:store    → 스토어 운영 슬롯   /v2      (basePath /MyFit/v2,      DEMO_MODE=false)          ← 실사용자 배포
#   web:prod     → web:store 별칭 (하위호환)
#   web          → web:demo 별칭 (하위호환)
#   android:demo → 직접설치용 APK
#   android:prod → Play Store 제출용 AAB
#
# ⚠️ 승격 원칙(진짜 분리): 데모→스토어 승격은 "폴더 복사(robocopy)"가 아니라
#    반드시 web:store 타깃으로 DEMO_MODE=false 재빌드다. DEMO 플래그가 tree-shaking으로
#    데모 시드/샘플 데이터를 제거하므로, 복사만으로는 데모 데이터가 스토어에 새어든다.

param(
    [string]$Target = "web:demo",     # web:demo | web:store | web:prod | web | android:demo | android:prod | all
    [switch]$SkipAndroid = $false
)

$REPO      = "c:\Users\kgg25\Desktop\MyFit"
$MYFIT_DIR = "$REPO\renewal\myfit-mobile"
$DEMO_OUT  = "$REPO\demo\v2"        # 데모 스테이징 슬롯
$STORE_OUT = "$REPO\v2"             # 스토어 운영 슬롯

Set-Location $MYFIT_DIR

# 데모 빌드 산출물의 모든 HTML에 noindex 메타 주입 (검색 색인 차단 — robots.txt 이중 방어)
function Inject-NoIndex {
    param([string]$OutDir)
    $tag = '<meta name="robots" content="noindex,nofollow">'
    Get-ChildItem $OutDir -Recurse -Filter "*.html" | ForEach-Object {
        $c = [System.IO.File]::ReadAllText($_.FullName)
        if ($c -notmatch 'name="robots"') {
            $c = [regex]::Replace($c, '(?i)(<head[^>]*>)', "`$1$tag", 1)
            [System.IO.File]::WriteAllText($_.FullName, $c, (New-Object System.Text.UTF8Encoding($false)))
        }
    }
    Write-Host "[noindex] $OutDir 내 HTML에 noindex 메타 주입 완료" -ForegroundColor DarkGray
}

function Build-Web {
    param([bool]$Demo = $true)
    if ($Demo) {
        Write-Host "`n=== [데모 스테이징 /demo/v2] 빌드 (basePath /MyFit/demo/v2, DEMO_MODE=true) ===" -ForegroundColor Cyan
        $env:NEXT_PUBLIC_BASE_PATH = "/MyFit/demo/v2"
        $env:NEXT_PUBLIC_DEMO_MODE = "true"
        $target = $DEMO_OUT
    } else {
        Write-Host "`n=== [스토어 운영 /v2] 빌드 (basePath /MyFit/v2, DEMO_MODE=false) ===" -ForegroundColor Cyan
        $env:NEXT_PUBLIC_BASE_PATH = "/MyFit/v2"
        $env:NEXT_PUBLIC_DEMO_MODE = "false"
        $target = $STORE_OUT
    }
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Host "[웹] 빌드 실패" -ForegroundColor Red; return $false }

    if ($Demo) { Inject-NoIndex "$MYFIT_DIR\out" }

    if (Test-Path $target) { Remove-Item $target -Recurse -Force }
    Copy-Item "out" $target -Recurse
    $url = if ($Demo) { "https://kgg2512.github.io/MyFit/demo/v2/" } else { "https://kgg2512.github.io/MyFit/v2/" }
    Write-Host "[웹] out -> $target (커밋+푸시하면 $url 반영)" -ForegroundColor Green
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
    "web:store"    { Build-Web -Demo $false }
    "web:prod"     { Build-Web -Demo $false }
    "android:demo" { Build-Android -Demo $true }
    "android:prod" { Build-Android -Demo $false }
    "all"          { Build-Web -Demo $true; Build-Web -Demo $false; if (!$SkipAndroid) { Build-Android -Demo $true; Build-Android -Demo $false } }
}

Write-Host "`n=== 빌드 완료 ===" -ForegroundColor Yellow
