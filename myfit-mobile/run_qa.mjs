/**
 * MyFit QA 검증 스크립트 — 독립 실행 (g2-qa-tester)
 * 검증 항목: A1~A5(데모 E2E), A4(콘솔에러), 14세 게이트(C2), B1(privacy 과약)
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = __dirname;
const BASE = 'https://kgg2512.github.io/MyFit';

const results = [];
const consoleErrors = [];

function log(item, status, detail) {
  const sym = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${sym} [${item}] ${detail}`);
  results.push({ item, status, detail });
}

async function shot(page, name) {
  const p = join(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`  📸 ${p}`);
  return p;
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

// 콘솔 에러 수집
page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', err => consoleErrors.push(`pageerror: ${err.message}`));

// ── 검증 1: 랜딩 가용성 + CTA href ──────────────────────────────────
console.log('\n=== [1] 랜딩 루트 ===');
const landingRes = await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 30000 });
const landingStatus = landingRes?.status();
if (landingStatus === 200) {
  log('A5-landing', 'PASS', `랜딩 루트 200 OK`);
} else {
  log('A5-landing', 'FAIL', `HTTP ${landingStatus}`);
}

// CTA href 확인
const ctaHref = await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll('a'));
  const cta = links.find(a => a.href.includes('app-demo') || a.href.includes('/app/'));
  return cta ? cta.href : null;
});
if (ctaHref && ctaHref.includes('app-demo')) {
  log('A5-landing-cta', 'PASS', `CTA → ${ctaHref} (app-demo 정상)`);
} else if (ctaHref && ctaHref.includes('/app/')) {
  log('A5-landing-cta', 'FAIL', `CTA → ${ctaHref} (실모드 링크 — 키 없이 AI피팅 실패 위험)`);
} else {
  log('A5-landing-cta', 'FAIL', `CTA href 미발견: ${ctaHref}`);
}
await shot(page, 'qa_01_landing');

// ── 검증 2: app-demo HOME — seed 데이터 ──────────────────────────────
console.log('\n=== [2] app-demo HOME seed 데이터 ===');
const demoRes = await page.goto(`${BASE}/app-demo/`, { waitUntil: 'networkidle', timeout: 30000 });
const demoStatus = demoRes?.status();
if (demoStatus === 200) {
  log('A5-app-demo', 'PASS', `app-demo 200 OK`);
} else {
  log('A5-app-demo', 'FAIL', `HTTP ${demoStatus}`);
}

// JS 실행 후 seed 대기 (최대 5초)
await page.waitForTimeout(3000);
await shot(page, 'qa_02_home_after_load');

const pageText = await page.evaluate(() => document.body.innerText);
const hasSeedFit = pageText.includes('오버핏') || pageText.includes('와이드') || pageText.includes('니트');
const hasDemoBanner = pageText.includes('데모') || pageText.includes('DEMO') || pageText.includes('샘플');
if (hasSeedFit) {
  log('A2-seed', 'PASS', `seed 데이터 노출 확인 (오버핏/와이드/니트 중 하나 이상)`);
} else {
  log('A2-seed', 'FAIL', `seed 데이터 미확인. 페이지 텍스트 샘플: "${pageText.substring(0, 200)}"`);
}
if (hasDemoBanner) {
  log('A1-demo-banner', 'PASS', `데모 배너 표시 확인`);
} else {
  log('A1-demo-banner', 'INFO', `데모 배너 텍스트 미확인 (다른 형태일 수 있음)`);
}

// ── 검증 3: privacy/terms 가용성 ─────────────────────────────────────
console.log('\n=== [3] privacy / terms 200 확인 ===');
for (const [label, path] of [['privacy', '/privacy.html'], ['terms', '/terms.html']]) {
  const r = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  const st = r?.status();
  log(`A5-${label}`, st === 200 ? 'PASS' : 'FAIL', `${label}.html HTTP ${st}`);
}

// ── 검증 4: privacy.html 과약 검사 ───────────────────────────────────
console.log('\n=== [4] privacy.html 과약 검사 ===');
await page.goto(`${BASE}/privacy.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });
const privText = await page.evaluate(() => document.body.innerText);

const hasAES = /AES-256|AES256/.test(privText);
const hasSupabase = /Supabase/.test(privText);
const hasEmailCollect = /이메일.*수집|수집.*이메일/.test(privText) && !/수집하지 않/.test(privText.substring(privText.search(/이메일.*수집|수집.*이메일/), privText.search(/이메일.*수집|수집.*이메일/) + 100));
const hasLocalStorageMention = /localStorage|브라우저 저장소/.test(privText);
const hasPlainTextMention = /평문|암호화는 적용되지|미암호화/.test(privText);
const hasV12 = /v1\.2/.test(privText);

log('B8-AES256-absent', !hasAES ? 'PASS' : 'FAIL',
  hasAES ? 'AES-256 과약 표현 여전히 존재 — 블로커' : 'AES-256 표현 없음 (정정 완료)');
log('B8-Supabase-absent', !hasSupabase ? 'PASS' : 'FAIL',
  hasSupabase ? 'Supabase 기재 여전히 존재 — 블로커' : 'Supabase 기재 없음 (정정 완료)');
log('B8-localStorage-disclosed', hasLocalStorageMention ? 'PASS' : 'FAIL',
  hasLocalStorageMention ? 'localStorage 저장 사실 고지 확인' : 'localStorage 언급 없음');
log('B8-plaintext-disclosed', hasPlainTextMention ? 'PASS' : 'FAIL',
  hasPlainTextMention ? '평문/미암호화 고지 확인' : '평문 저장 고지 미확인');
log('B8-version', hasV12 ? 'PASS' : 'FAIL',
  hasV12 ? 'v1.2 최신 버전 확인' : 'v1.2 미반영');

await shot(page, 'qa_03_privacy');

// ── 검증 5: app-demo/fit — 14세 게이트 ───────────────────────────────
console.log('\n=== [5] 14세 게이트 (FIT 페이지) ===');
await page.goto(`${BASE}/app-demo/fit/`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

// 동의 모달 표시 여부 (seed가 AGE_CONFIRMED를 자동 세팅하므로 — fresh context 필요)
// 별도 incognito context로 14세 미체크 차단 검증
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page2 = await ctx2.newPage();
page2.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(`fit: ${msg.text()}`); });

await page2.goto(`${BASE}/app-demo/fit/`, { waitUntil: 'networkidle', timeout: 30000 });
await page2.waitForTimeout(3000);
await shot(page2, 'qa_04_fit_fresh');

const fitText = await page2.evaluate(() => document.body.innerText);
const hasConsentModal = fitText.includes('AI 피팅 시작 전 동의') || fitText.includes('동의');
const hasAge14Checkbox = await page2.locator('#age-confirm-fit').count() > 0;
const btnDisabled = await page2.evaluate(() => {
  const btn = document.querySelector('button[disabled]');
  return btn ? btn.textContent?.trim() : null;
});

log('C2-consent-modal', hasConsentModal ? 'PASS' : 'FAIL',
  hasConsentModal ? '동의 모달 표시 확인' : '동의 모달 미표시 — 게이트 없음');
log('C2-age-checkbox-exists', hasAge14Checkbox ? 'PASS' : 'FAIL',
  hasAge14Checkbox ? '#age-confirm-fit 체크박스 존재 확인' : '#age-confirm-fit 체크박스 미발견');

if (hasAge14Checkbox) {
  // 체크박스 미체크 상태에서 버튼 disabled 확인
  const isChecked = await page2.locator('#age-confirm-fit').isChecked();
  const submitBtn = page2.locator('button:has-text("전체 동의하고 AI 피팅 시작")');
  const isDisabled = await submitBtn.isDisabled().catch(() => null);

  log('C2-unchecked-disabled', (!isChecked && isDisabled) ? 'PASS' : 'FAIL',
    `미체크=${!isChecked}, 버튼disabled=${isDisabled}`);

  if (!isChecked) {
    // 체크박스 체크
    await page2.locator('#age-confirm-fit').check();
    await page2.waitForTimeout(500);
    const isDisabledAfter = await submitBtn.isDisabled().catch(() => null);
    log('C2-checked-enabled', !isDisabledAfter ? 'PASS' : 'FAIL',
      `체크 후 버튼enabled=${!isDisabledAfter}`);
    await shot(page2, 'qa_05_age_checked');
  }
}

await ctx2.close();

// ── 검증 6: 콘솔 에러 0 ─────────────────────────────────────────────
console.log('\n=== [6] 콘솔 에러 집계 ===');
const totalErrors = consoleErrors.length;
log('A4-console-errors', totalErrors === 0 ? 'PASS' : 'FAIL',
  totalErrors === 0 ? '콘솔 에러 0' : `에러 ${totalErrors}건: ${consoleErrors.slice(0, 3).join(' | ')}`);

// ── 최종 요약 ────────────────────────────────────────────────────────
console.log('\n========== QA 결과 요약 ==========');
const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
console.log(`PASS: ${passed} / FAIL: ${failed} / TOTAL: ${results.length}`);
results.forEach(r => {
  const sym = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : 'ℹ️';
  console.log(`  ${sym} [${r.item}] ${r.detail}`);
});

writeFileSync(join(SHOT_DIR, 'qa_results.json'), JSON.stringify({ results, consoleErrors, timestamp: new Date().toISOString() }, null, 2));
console.log(`\n결과 저장: ${join(SHOT_DIR, 'qa_results.json')}`);

await browser.close();
process.exit(failed > 0 ? 1 : 0);
