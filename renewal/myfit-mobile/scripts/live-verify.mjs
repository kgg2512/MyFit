// 라이브 데모 실접속 검증 — GitHub Pages app-demo
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = 'https://kgg2512.github.io/MyFit/app-demo';
const OUT = 'c:/Users/kgg25/Desktop/G2 Company Ltd/docs/reports/myfit_demo_screens';
mkdirSync(OUT, { recursive: true });

const errs = [];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
p.on('console', m => { if (m.type()==='error') errs.push(`[console] ${m.text()}`); });
p.on('pageerror', e => errs.push(`[pageerror] ${e.message}`));
p.on('requestfailed', r => errs.push(`[reqfail] ${r.failure()?.errorText} ${r.url()}`));

try {
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/live_01_home.png`, fullPage: true });
  const recentFitting = await p.getByText('최근 피팅').count();
  const seedGarment = await p.getByText('오버핏 셔츠').count();
  console.log('LIVE HOME: 최근피팅 섹션=', recentFitting, '| seed(오버핏 셔츠)=', seedGarment);

  await p.goto(`${BASE}/profile/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/live_02_profile.png`, fullPage: true });
  const h = await p.locator('input#field-키--cm-, input').first().inputValue().catch(()=>'?');
  console.log('LIVE PROFILE: 첫 입력값(키)=', h);

  await p.goto(`${BASE}/fit/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/live_03_fit.png`, fullPage: true });
  const demoBanner = await p.getByText('데모 버전').count();
  console.log('LIVE FIT: 데모배너=', demoBanner);

  console.log('\n=== LIVE ERRORS ===');
  console.log(errs.length ? errs.join('\n') : '(none)');
  console.log('TOTAL:', errs.length);
} catch (e) {
  console.error('FAIL:', e.message);
  process.exitCode = 1;
} finally { await b.close(); }
