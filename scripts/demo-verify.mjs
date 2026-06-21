// MyFit 데모 빌드 시각 검증 — 5종 스크린샷 + 콘솔 에러 캡처
// 실행: node scripts/demo-verify.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://127.0.0.1:8099';
const OUT = 'c:/Users/kgg25/Desktop/G2 Company Ltd/docs/reports/myfit_demo_screens';
mkdirSync(OUT, { recursive: true });

const consoleErrors = [];
const pageErrors = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, // iPhone 12/13 사이즈
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(`[console.error] ${msg.text()} @ ${page.url()}`);
});
page.on('pageerror', (err) => pageErrors.push(`[pageerror] ${err.message}`));
page.on('requestfailed', (req) => consoleErrors.push(`[requestfailed] ${req.failure()?.errorText} ${req.url()}`));
page.on('response', (res) => { if (res.status() >= 400) consoleErrors.push(`[http${res.status()}] ${res.url()}`); });

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`  shot: ${name}.png`);
}

async function waitMount() {
  // mounted 후 spinner 사라질 때까지
  await page.waitForTimeout(800);
}

try {
  // 1) HOME — seed 히스토리(최근 피팅) 보이는지
  console.log('1) HOME');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await waitMount();
  await shot('01_home');

  // 2) PROFILE — seed 치수 채워진 상태
  console.log('2) PROFILE');
  await page.goto(`${BASE}/profile/`, { waitUntil: 'networkidle' });
  await waitMount();
  await shot('02_profile');

  // 3) FIT STEP1 (내 사진)
  console.log('3) FIT step1');
  await page.goto(`${BASE}/fit/`, { waitUntil: 'networkidle' });
  await waitMount();
  await shot('03_fit_step1_person');

  // STEP1: 데모 사진 업로드 (파일 input에 demo 이미지 주입)
  const fileInput = page.locator('input[type="file"][aria-label="신체 사진 파일 선택"]');
  // 데모 이미지 파일을 person으로 사용
  await fileInput.setInputFiles('c:/Users/kgg25/Desktop/G2 Company Ltd/myfit-mobile/public/demo/tops_female.png');
  await page.waitForTimeout(600);
  // 다음: 옷 사진 선택
  await page.getByRole('button', { name: /다음: 옷 사진 선택/ }).click();
  await page.waitForTimeout(500);

  // 4) FIT STEP2 (옷 사진) — 직접 촬영(사진 업로드) 모드로 전환
  // (URL 모드는 https:// 검증이 있어 로컬 http URL이 막히므로 photo 모드로 base64 주입)
  console.log('4) FIT step2');
  await shot('04_fit_step2_garment');
  await page.getByRole('button', { name: /직접 촬영/ }).click();
  await page.waitForTimeout(300);
  const garmentInput = page.locator('input[type="file"][aria-label="옷 사진 파일 선택"]');
  await garmentInput.setInputFiles('c:/Users/kgg25/Desktop/G2 Company Ltd/myfit-mobile/public/demo/tops_male.png');
  await page.waitForTimeout(800);
  await shot('05_fit_step2_filled');

  // AI 피팅 시작 (데모 3.5초)
  console.log('5) FIT start -> result (demo 3.5s)');
  await page.getByRole('button', { name: /AI 피팅 시작/ }).click();
  await page.waitForTimeout(4500); // 3.5s + 여유

  // 6) FIT STEP3 결과
  console.log('6) FIT result');
  await shot('06_fit_step3_result');

  // PMF 피드백 클릭
  const pmfBtn = page.getByRole('button', { name: /도움 됐어요/ });
  if (await pmfBtn.count()) {
    await pmfBtn.click();
    await page.waitForTimeout(400);
    await shot('07_fit_result_after_feedback');
  }

  console.log('\n=== CONSOLE ERRORS ===');
  console.log(consoleErrors.length ? consoleErrors.join('\n') : '(none)');
  console.log('=== PAGE ERRORS ===');
  console.log(pageErrors.length ? pageErrors.join('\n') : '(none)');
  console.log(`\nTOTAL ERRORS: ${consoleErrors.length + pageErrors.length}`);
} catch (e) {
  console.error('SCRIPT FAILED:', e.message);
  await shot('99_failure_state');
  process.exitCode = 1;
} finally {
  await browser.close();
}
