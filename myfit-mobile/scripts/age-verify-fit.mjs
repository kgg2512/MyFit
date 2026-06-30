// FIT 페이지 14세 게이트 검증
import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:8099';
const OUT = 'c:/Users/kgg25/Desktop/G2 Company Ltd/docs/reports/myfit_demo_screens';
const errs = [];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
p.on('console', m => { if (m.type()==='error') errs.push(`[console] ${m.text()}`); });
p.on('pageerror', e => errs.push(`[pageerror] ${e.message}`));

// seed 스킵 + 동의/연령 미주입
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('myfit_demo_seeded', '1');
    localStorage.removeItem('myfit_consented');
    localStorage.removeItem('myfit_age_confirmed');
  } catch {}
});

try {
  await p.goto(`${BASE}/fit/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1000);
  // person 업로드
  await p.waitForSelector('input[type="file"][aria-label="신체 사진 파일 선택"]', { state: 'attached', timeout: 8000 });
  await p.locator('input[type="file"][aria-label="신체 사진 파일 선택"]')
    .setInputFiles('c:/Users/kgg25/Desktop/G2 Company Ltd/myfit-mobile/public/demo/tops_female.png');
  await p.waitForTimeout(600);
  await p.getByRole('button', { name: /다음: 옷 사진 선택/ }).click();
  await p.waitForTimeout(400);
  // garment photo
  await p.getByRole('button', { name: /직접 촬영/ }).click();
  await p.waitForTimeout(200);
  await p.locator('input[type="file"][aria-label="옷 사진 파일 선택"]')
    .setInputFiles('c:/Users/kgg25/Desktop/G2 Company Ltd/myfit-mobile/public/demo/tops_male.png');
  await p.waitForTimeout(600);
  // AI 피팅 시작 → 동의 모달
  await p.getByRole('button', { name: /AI 피팅 시작/ }).click();
  await p.waitForTimeout(500);

  const ageCb = p.locator('#age-confirm-fit');
  await ageCb.waitFor({ state: 'attached', timeout: 8000 });
  const consentBtn = p.getByRole('button', { name: /전체 동의하고 AI 피팅 시작/ });
  const disabledBefore = await consentBtn.isDisabled();
  console.log('FIT [미체크] 동의버튼 disabled =', disabledBefore);
  await p.screenshot({ path: `${OUT}/age_03_fit_unchecked.png`, fullPage: true });

  await ageCb.check();
  await p.waitForTimeout(300);
  const disabledAfter = await consentBtn.isDisabled();
  console.log('FIT [체크후] 동의버튼 disabled =', disabledAfter);

  // 통과 → 데모 피팅(3.5s) → 결과
  await consentBtn.click();
  await p.waitForTimeout(4500);
  const resultShown = await p.getByText('AI 피팅 결과').count();
  console.log('FIT [통과] 결과화면 도달 =', resultShown > 0);

  const PASS = disabledBefore && !disabledAfter && resultShown > 0;
  console.log('\n=== FIT 14세 게이트 PASS =', PASS, '===');
  console.log('=== ERRORS:', errs.length ? errs.join('\n') : '(none)', '===');
  if (!PASS) process.exitCode = 1;
} catch (e) {
  console.error('FAIL:', e.message);
  await p.screenshot({ path: `${OUT}/age_99_fit_fail.png`, fullPage: true });
  process.exitCode = 1;
} finally { await b.close(); }
