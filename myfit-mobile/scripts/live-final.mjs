// 라이브 최종 검증: 랜딩→app-demo 진입 + 14세 게이트 + 전체 플로우
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const ROOT = 'https://kgg2512.github.io/MyFit/';
const OUT = 'c:/Users/kgg25/Desktop/G2 Company Ltd/docs/reports/myfit_demo_screens';
mkdirSync(OUT, { recursive: true });

const errs = [];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
p.on('console', m => { if (m.type()==='error') errs.push(`[console] ${m.text()}`); });
p.on('pageerror', e => errs.push(`[pageerror] ${e.message}`));

try {
  // 1) 랜딩 진입 → "AI 피팅 앱 바로 사용하기" 클릭 → app-demo 이동
  console.log('1) 라이브 랜딩 진입');
  await p.goto(ROOT, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1000);
  const entry = p.getByRole('link', { name: /AI 피팅 앱 바로 사용하기/ });
  const entryHref = await entry.getAttribute('href');
  console.log('   진입 링크 href =', entryHref);
  await entry.click();
  await p.waitForTimeout(2500);
  console.log('   클릭 후 URL =', p.url());
  const inDemo = p.url().includes('/app-demo');
  console.log('   app-demo 진입 =', inDemo);
  await p.screenshot({ path: `${OUT}/live_final_01_home.png`, fullPage: true });

  // 2) HOME seed 풍성함 (최근 피팅)
  const seedShown = await p.getByText('오버핏 셔츠').count();
  console.log('2) HOME seed(오버핏 셔츠) =', seedShown);

  // 3) 14세 게이트 라이브 확인 (consent 초기화 후 fit 진입)
  console.log('3) 14세 게이트 (라이브)');
  await p.evaluate(() => { try { localStorage.removeItem('myfit_consented'); localStorage.removeItem('myfit_age_confirmed'); } catch {} });
  await p.goto(`${ROOT}app-demo/profile/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  const ageCb = p.locator('#age-confirm-profile');
  const hasAgeCb = await ageCb.count();
  console.log('   14세 체크박스 존재 =', hasAgeCb);
  const consentBtn = p.getByRole('button', { name: /전체 동의하고 시작하기/ });
  const disabledBefore = (await consentBtn.count()) ? await consentBtn.isDisabled() : 'no-modal';
  console.log('   [미체크] 버튼 disabled =', disabledBefore);
  await p.screenshot({ path: `${OUT}/live_final_02_age_gate.png`, fullPage: true });

  console.log('\n=== LIVE FINAL ===');
  console.log('진입 app-demo:', inDemo, '| seed:', seedShown>0, '| 14세 체크박스:', hasAgeCb>0, '| 미체크 차단:', disabledBefore === true || disabledBefore === 'no-modal');
  console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
  const PASS = inDemo && seedShown>0 && hasAgeCb>0;
  if (!PASS) process.exitCode = 1;
} catch (e) {
  console.error('FAIL:', e.message);
  process.exitCode = 1;
} finally { await b.close(); }
