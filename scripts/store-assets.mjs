// MyFit 스토어 자산 생성: Play/CWS 스크린샷(1080x1920) + 피처그래픽(1024x500)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const BASE = 'http://127.0.0.1:8099';
const OUT = 'c:/Users/kgg25/Desktop/G2 Company Ltd/docs/reports/myfit_store_kit';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

// ── 1) 스토어 스크린샷 (1080x1920, Play/CWS 권장) ──
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, // demo-verify와 동일 (안정 재현)
  deviceScaleFactor: 3,                  // 3x -> 1170x2532 (스토어 고해상)
});
const page = await ctx.newPage();

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png` }); // viewport(클립) = 1080x1920
  console.log(`  store shot: ${name}.png (1080x1920)`);
}

// HOME
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await shot('store_01_home');

// PROFILE
await page.goto(`${BASE}/profile/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await shot('store_02_profile');

// FIT step1
await page.goto(`${BASE}/fit/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await shot('store_03_fit_person');

// FIT 결과까지 진행 (input은 hidden이므로 대기 후 직접 setInputFiles)
await page.waitForSelector('input[type="file"][aria-label="신체 사진 파일 선택"]', { state: 'attached', timeout: 10000 });
await page.locator('input[type="file"][aria-label="신체 사진 파일 선택"]')
  .setInputFiles('c:/Users/kgg25/Desktop/G2 Company Ltd/myfit-mobile/public/demo/tops_female.png');
await page.waitForTimeout(700);
await page.getByRole('button', { name: /다음: 옷 사진 선택/ }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /직접 촬영/ }).click();
await page.waitForTimeout(300);
await page.waitForSelector('input[type="file"][aria-label="옷 사진 파일 선택"]', { state: 'attached', timeout: 10000 });
await page.locator('input[type="file"][aria-label="옷 사진 파일 선택"]')
  .setInputFiles('c:/Users/kgg25/Desktop/G2 Company Ltd/myfit-mobile/public/demo/tops_male.png');
await page.waitForTimeout(700);
await page.getByRole('button', { name: /AI 피팅 시작/ }).click();
await page.waitForTimeout(4800);
await shot('store_04_result');

await ctx.close();

// ── 2) 피처그래픽 (1024x500) ──
const fgHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1024px; height:500px; overflow:hidden;
    font-family:'Segoe UI','Malgun Gothic',sans-serif;
    background:radial-gradient(circle at 78% 30%, rgba(0,229,255,0.18) 0%, transparent 55%),
               radial-gradient(circle at 20% 80%, rgba(124,77,255,0.20) 0%, transparent 55%),
               linear-gradient(135deg,#0a0a0a 0%,#141422 60%,#0a0a0a 100%);
    display:flex; align-items:center; }
  .wrap { padding:0 70px; display:flex; align-items:center; justify-content:space-between; width:100%; }
  .left { max-width:600px; }
  .logo { display:flex; align-items:center; gap:14px; margin-bottom:26px; }
  .logo .ico { font-size:46px; }
  .logo .name { font-size:40px; font-weight:800; color:#00e5ff; letter-spacing:-1px; }
  h1 { font-size:54px; font-weight:800; color:#f4f4f4; line-height:1.18; margin-bottom:20px; letter-spacing:-1px; }
  h1 .hl { background:linear-gradient(90deg,#00e5ff,#7c4dff); -webkit-background-clip:text; background-clip:text; color:transparent; }
  p { font-size:21px; color:#9a9aa5; line-height:1.5; }
  .badges { margin-top:26px; display:flex; gap:12px; }
  .badge { font-size:15px; color:#cfcfe0; background:rgba(255,255,255,0.06);
    border:1px solid rgba(255,255,255,0.12); padding:9px 16px; border-radius:30px; }
  .phone { font-size:230px; filter:drop-shadow(0 18px 50px rgba(0,229,255,0.28)); }
</style></head><body>
  <div class="wrap">
    <div class="left">
      <div class="logo"><span class="ico">👗</span><span class="name">MyFit</span></div>
      <h1>사진 한 장으로<br><span class="hl">AI 가상 피팅</span></h1>
      <p>구매 전에 미리 입어보세요. 체형 기반 사이즈 추천까지 한 번에.</p>
      <div class="badges">
        <span class="badge">📸 AI 피팅</span>
        <span class="badge">📏 사이즈 추천</span>
        <span class="badge">🔒 사진 즉시 삭제</span>
      </div>
    </div>
    <div class="phone">🧥</div>
  </div>
</body></html>`;

writeFileSync(`${OUT}/_feature_graphic.html`, fgHtml);
const ctx2 = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
const page2 = await ctx2.newPage();
await page2.goto('file:///' + `${OUT}/_feature_graphic.html`.replace(/\\/g, '/'));
await page2.waitForTimeout(400);
await page2.screenshot({ path: `${OUT}/feature_graphic_1024x500.png` });
console.log('  feature graphic: feature_graphic_1024x500.png (1024x500)');
await ctx2.close();

await browser.close();
console.log('DONE');
