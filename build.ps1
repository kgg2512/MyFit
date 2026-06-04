# MyFit Chrome Extension — 빌드 스크립트 (PowerShell)
# Three.js 로컬 번들링 + 아이콘 생성
# 실행: .\build.ps1

Write-Host "[MyFit Build] 시작..." -ForegroundColor Cyan

# ── 1. Three.js 다운로드 (CDN → 로컬, 빌드 시 1회만) ──
$threeUrl = "https://unpkg.com/three@0.160.0/build/three.module.min.js"
$threeOut  = "$PSScriptRoot\lib\three.module.min.js"

if (-not (Test-Path $threeOut)) {
    Write-Host "[1/4] Three.js r160 다운로드 중..." -ForegroundColor Yellow
    try {
        Invoke-WebRequest -Uri $threeUrl -OutFile $threeOut -UseBasicParsing
        Write-Host "  ✓ Three.js 저장: $threeOut" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ Three.js 다운로드 실패: $_" -ForegroundColor Red
        Write-Host "  → 수동으로 $threeUrl 에서 받아 lib/three.module.min.js 에 저장하세요."
    }
} else {
    Write-Host "[1/4] Three.js 이미 존재 — 스킵" -ForegroundColor Gray
}

# ── 2. MediaPipe Pose WASM 다운로드 (선택적, Phase 1 미사용) ──
Write-Host "[2/4] MediaPipe: Phase 1에서는 수동 측정 입력 방식 → 스킵" -ForegroundColor Gray

# ── 3. 아이콘 생성 (placeholder SVG → PNG 변환은 수동 또는 별도 도구 필요) ──
Write-Host "[3/4] 아이콘 파일 확인..." -ForegroundColor Yellow
$iconSizes = @(16, 48, 128)
foreach ($size in $iconSizes) {
    $path = "$PSScriptRoot\icons\icon${size}.png"
    if (-not (Test-Path $path)) {
        Write-Host "  ⚠ icons/icon${size}.png 없음 — 수동 생성 필요" -ForegroundColor Red
        Write-Host "    → SVG 소스: icons/icon.svg 를 ${size}x${size}px PNG로 변환하세요"
    } else {
        Write-Host "  ✓ icon${size}.png 존재" -ForegroundColor Green
    }
}

# ── 4. 패키지 크기 체크 (node_modules 제외) ──
Write-Host "[4/4] 패키지 크기 분석 (node_modules 제외)..." -ForegroundColor Yellow
$totalSize = 0
Get-ChildItem -Path $PSScriptRoot -Recurse -File | Where-Object { $_.FullName -notmatch 'node_modules' } | ForEach-Object {
    $totalSize += $_.Length
}
$sizeMB = [math]::Round($totalSize / 1MB, 2)
Write-Host "  전체 크기: ${sizeMB} MB" -ForegroundColor Cyan
if ($sizeMB -gt 10) {
    Write-Host "  ⚠ Chrome Web Store 권장 10MB 초과" -ForegroundColor Red
} else {
    Write-Host "  ✓ 크기 OK" -ForegroundColor Green
}


# ── 5. Chrome Web Store 제출용 ZIP 패키징 ──
Write-Host "[5/5] CWS 제출용 ZIP 패키징..." -ForegroundColor Yellow
$zipPath = "$PSScriptRoot\..\myfit-extension.zip"

# 포함할 파일/폴더 (node_modules, .git, build.ps1, package*.json 제외)
$includeItems = @(
    "$PSScriptRoot\manifest.json",
    "$PSScriptRoot\privacy-policy.html",
    "$PSScriptRoot\icons",
    "$PSScriptRoot\sidepanel",
    "$PSScriptRoot\src",
    "$PSScriptRoot\lib"
)

# popup 폴더가 있으면 포함
if (Test-Path "$PSScriptRoot\popup") {
    $includeItems += "$PSScriptRoot\popup"
}

# 기존 ZIP 삭제 후 재생성
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

# 임시 폴더에 복사 후 압축
$tempDir = "$env:TEMP\myfit-build-$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

foreach ($item in $includeItems) {
    if (Test-Path $item) {
        $dest = Join-Path $tempDir (Split-Path $item -Leaf)
        Copy-Item -Path $item -Destination $dest -Recurse -Force
    } else {
        Write-Host "  ⚠ 없음: $item" -ForegroundColor Red
    }
}

Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -Force
Remove-Item $tempDir -Recurse -Force

if (Test-Path $zipPath) {
    $zipSize = [math]::Round((Get-Item $zipPath).Length / 1KB, 1)
    Write-Host "  ✓ ZIP 생성: myfit-extension.zip ($zipSize KB)" -ForegroundColor Green
} else {
    Write-Host "  ✗ ZIP 생성 실패" -ForegroundColor Red
}

Write-Host ""
Write-Host "[MyFit Build] 완료!" -ForegroundColor Cyan
Write-Host ""
Write-Host "다음 단계:"
Write-Host "  1. chrome://extensions 열기"
Write-Host "  2. '개발자 모드' 켜기"
Write-Host "  3. '압축 해제된 확장 프로그램 로드' → myfit-extension/ 폴더 선택"
Write-Host "  4. 무신사/Nike/Zara 상품 페이지 방문 → 버튼 확인"
Write-Host "  5. CWS 제출: myfit-extension.zip → chrome.google.com/webstore/devconsole"
