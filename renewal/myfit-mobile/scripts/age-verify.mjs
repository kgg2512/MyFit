// 14세 체크박스 동작 검증 — 미체크 차단 / 체크 통과
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = 'http://127.0.0.1:8099';
const OUT = 'c:/Users/kgg25/Desktop/G2 Company Ltd/docs/reports/myfit_demo_screens';
mkdirSync(OUT, { recursive: true });

const errs = [];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
p.on('console', m => { if (m.type()==='error') errs.push(`[console] ${m.text()}`); });
p.on('pageerror', e => errs.push(`[pageerror] ${e.message}`));
p.on('requestfailed', r => errs.push(`[reqfail] ${r.failure()?.errorText} ${r.url()}`));

// seed를 건너뛰되 동의/연령은 비운 상태로 만들기 위해, 첫 로드 전 demo_seeded 마커만 주입
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('myfit_demo_seeded', '1'); // seed 스킵 (동의/연령 미주입 상태 재현)
    localStorage.removeItem('myfit_consented');
    localStorage.removeItem('myfit_age_confirmed');
    localStorage.removeItem('myfit_measurements');
    localStorage.removeItem('myfit_fit_history');
  } catch {}
});

async function shot(name) { await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); console.log('  shot:', name); }

try {
  // ── PROFILE: 동의 모달은 진입 즉시 표시 ──
  console.log('PROFILE 동의 모달 14세 체크박스');
  await p.goto(`${BASE}/profile/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1000);

  const ageCb = p.locator('#age-confirm-profile');
  const consentBtn = p.getByRole('button', { name: /전체 동의하고 시작하기/ });

  await ageCb.waitFor({ state: 'attached', timeout: 8000 });
  const disabledBefore = await consentBtn.isDisabled();
  console.log('  [미체크] 동의버튼 disabled =', disabledBefore);
  await shot('age_01_profile_unchecked');

  // 미체크 상태로 버튼 클릭 시도 → 진행 안 됨(모달 유지)
  await consentBtn.click({ force: true }).catch(()=>{});
  await p.waitForTimeout(400);
  const modalStillThere = await p.getByText('MyFit 시작 전 동의').count();
  console.log('  [미체크 클릭후] 모달 유지 =', modalStillThere > 0);

  // 체크 → 버튼 활성화
  await ageCb.check();
  await p.waitForTimeout(300);
  const disabledAfter = await consentBtn.isDisabled();
  console.log('  [체크후] 동의버튼 disabled =', disabledAfter);
  await shot('age_02_profile_checked');

  // 통과 동작: 클릭 → /fit 이동
  await consentBtn.click();
  await p.waitForTimeout(1200);
  console.log('  [체크 클릭후] URL =', p.url());
  const movedToFit = p.url().includes('/fit');
  console.log('  [통과] /fit 이동 =', movedToFit);

  // ── 결과 요약 ──
  const PASS_block = disabledBefore && (modalStillThere>0) && !disabledAfter && movedToFit;
  console.log('\n=== 14세 게이트 PASS =', PASS_block, '===');
  console.log('=== ERRORS:', errs.length ? errs.join('\n') : '(none)', '===');
  if (!PASS_block) process.exitCode = 1;
} catch (e) {
  console.error('FAIL:', e.message);
  await shot('age_99_fail');
  process.exitCode = 1;
} finally { await b.close(); }
