/**
 * QA: 14세 게이트 최종 검증 v4
 * 전략 A: app/(실모드) 경로 — DEMO_MODE=false → seedDemoData 미실행 → 신선 상태
 * 전략 B: DEMO_SEEDED=1 설정 후 consented/age만 지우기 (seed 재실행 방지)
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SHOT_DIR = 'C:/Users/kgg25/Desktop/G2 Company Ltd/docs/reports/qa_screenshots';
mkdirSync(SHOT_DIR, { recursive: true });

const dummyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const dummyPath = join(SHOT_DIR, 'dummy.png');
writeFileSync(dummyPath, dummyPng);

const b = await chromium.launch({ headless: true });

// ── 전략 B: DEMO_SEEDED=1로 seed 재실행 막기 + consented/age 제거 ──
console.log('\n=== 전략 B: seed 재실행 차단 + consented/age 제거 ===');
const ctxB = await b.newContext({ viewport: { width: 390, height: 844 } });
const pB = await ctxB.newPage();
const errsB = [];
pB.on('console', m => { if (m.type() === 'error') errsB.push(m.text()); });

// fit 진입 후 localStorage 조작: DEMO_SEEDED=1(seed 재실행 방지) + consented/age 제거
await pB.goto('https://kgg2512.github.io/MyFit/app-demo/fit/', { waitUntil: 'networkidle', timeout: 30000 });
await pB.waitForTimeout(2000);

// DEMO_SEEDED=1을 세팅하고 consented/age만 지움
await pB.evaluate(() => {
  localStorage.setItem('myfit_demo_seeded', '1'); // seed 재실행 방지
  localStorage.removeItem('myfit_consented');
  localStorage.removeItem('myfit_age_confirmed');
});

// reload → seedDemoData()가 DEMO_SEEDED=1이라 skip → consented/age 미주입
await pB.reload({ waitUntil: 'networkidle', timeout: 30000 });
await pB.waitForTimeout(2000);

const lsB = await pB.evaluate(() => ({
  consented: localStorage.getItem('myfit_consented'),
  age: localStorage.getItem('myfit_age_confirmed'),
  seeded: localStorage.getItem('myfit_demo_seeded'),
}));
console.log('[reload 후 localStorage]:', JSON.stringify(lsB));

if (lsB.consented === null && lsB.age === null) {
  console.log('[상태 확인] consented=null, age=null — 동의 모달 트리거 조건 충족');

  // file input 업로드
  const fc = await pB.locator('input[type=file]').count();
  console.log('[file input]:', fc);

  if (fc > 0) {
    await pB.locator('input[type=file]').first().setInputFiles(dummyPath);
    await pB.waitForTimeout(1500);

    // 다음 버튼
    const nb = pB.locator('button:has-text("다음")');
    if (await nb.count() > 0 && !(await nb.isDisabled())) {
      await nb.click();
      await pB.waitForTimeout(1500);
    }

    // STEP 2: URL 입력
    const urlInput = pB.locator('input[placeholder*="URL"]');
    if (await urlInput.count() > 0) {
      await urlInput.fill('https://kgg2512.github.io/MyFit/demo/tops_female.png');
      await pB.waitForTimeout(800);
    }

    // AI 피팅 시작 버튼
    const sb = pB.locator('button').filter({ hasText: /AI 피팅 시작/ });
    const sc = await sb.count();
    console.log('[AI 피팅 시작 버튼]:', sc);

    if (sc > 0) {
      const sd = await sb.first().isDisabled();
      console.log('[버튼 disabled]:', sd);
      if (!sd) {
        await sb.first().click();
        await pB.waitForTimeout(2000);
        await pB.screenshot({ path: join(SHOT_DIR, 'qa_gate4_after_start.png') });

        const dlg = await pB.locator('[role=dialog]').count();
        const age14 = await pB.locator('#age-confirm-fit').count();
        console.log('[동의 모달]:', dlg > 0, '/ [14세 체크박스]:', age14 > 0);

        if (age14 > 0) {
          const checked = await pB.locator('#age-confirm-fit').isChecked();
          const consentBtn = pB.locator('button:has-text("전체 동의하고 AI 피팅 시작")');
          const btnDis = await consentBtn.count() > 0 ? await consentBtn.isDisabled() : 'not found';
          console.log('[미체크 상태:', checked, '| 버튼 disabled:', btnDis, ']');
          await pB.screenshot({ path: join(SHOT_DIR, 'qa_gate4_modal_unchecked.png') });

          await pB.locator('#age-confirm-fit').check();
          await pB.waitForTimeout(500);
          const btnDisAfter = await consentBtn.count() > 0 ? await consentBtn.isDisabled() : 'n/a';
          console.log('[체크 후 버튼 disabled:', btnDisAfter, ']');
          await pB.screenshot({ path: join(SHOT_DIR, 'qa_gate4_modal_checked.png') });

          if (!checked && btnDis === true && btnDisAfter === false) {
            console.log('\n[C2 PASS] 미체크 차단 + 체크 후 활성화 정상');
          } else {
            console.log('\n[C2 확인 필요]:', { checked, btnDis, btnDisAfter });
          }
        }
      } else {
        // 버튼 disabled 원인 파악
        const step2 = await pB.evaluate(() => document.body.innerText.substring(0, 400));
        console.log('[STEP 2 텍스트]:', step2);
        await pB.screenshot({ path: join(SHOT_DIR, 'qa_gate4_step2.png') });
      }
    }
  }
} else {
  console.log('[오류] 여전히 consented/age가 있음 — seed 재주입 발생:', JSON.stringify(lsB));
}

// ── 전략 A: app/ (실모드, DEMO_MODE=false) ───────────────────────────
console.log('\n=== 전략 A: app/(실모드) fit 페이지 ===');
const ctxA = await b.newContext({
  viewport: { width: 390, height: 844 },
  storageState: { cookies: [], origins: [] },
});
const pA = await ctxA.newPage();
const errsA = [];
pA.on('console', m => { if (m.type() === 'error') errsA.push(m.text()); });

// 실모드 /app/ 진입
const rA = await pA.goto('https://kgg2512.github.io/MyFit/app/fit/', { waitUntil: 'networkidle', timeout: 30000 });
console.log('[app/fit/ HTTP]:', rA?.status());
await pA.waitForTimeout(3000);

const lsA = await pA.evaluate(() => ({
  consented: localStorage.getItem('myfit_consented'),
  age: localStorage.getItem('myfit_age_confirmed'),
  seeded: localStorage.getItem('myfit_demo_seeded'),
}));
console.log('[실모드 localStorage]:', JSON.stringify(lsA));
const step1A = await pA.evaluate(() => document.body.innerText.substring(0, 200));
console.log('[실모드 STEP 1 텍스트]:', step1A);
await pA.screenshot({ path: join(SHOT_DIR, 'qa_gate4_app_fit.png') });

if (lsA.consented === null) {
  // file 업로드 시도
  const fcA = await pA.locator('input[type=file]').count();
  if (fcA > 0) {
    await pA.locator('input[type=file]').first().setInputFiles(dummyPath);
    await pA.waitForTimeout(1500);
    const nbA = pA.locator('button:has-text("다음")');
    if (await nbA.count() > 0 && !(await nbA.isDisabled())) {
      await nbA.click();
      await pA.waitForTimeout(1500);
    }
    const urlA = pA.locator('input[placeholder*="URL"]');
    if (await urlA.count() > 0) {
      await urlA.fill('https://kgg2512.github.io/MyFit/demo/tops_female.png');
      await pA.waitForTimeout(800);
    }
    const sbA = pA.locator('button').filter({ hasText: /AI 피팅 시작/ });
    if (await sbA.count() > 0 && !(await sbA.first().isDisabled())) {
      await sbA.first().click();
      await pA.waitForTimeout(2000);
      const dlgA = await pA.locator('[role=dialog]').count();
      const age14A = await pA.locator('#age-confirm-fit').count();
      console.log('[실모드 동의 모달]:', dlgA > 0, '/ [14세 체크박스]:', age14A > 0);
      if (age14A > 0) {
        const checkedA = await pA.locator('#age-confirm-fit').isChecked();
        const cBtnA = pA.locator('button:has-text("전체 동의하고 AI 피팅 시작")');
        const disA = await cBtnA.isDisabled().catch(() => 'n/a');
        console.log('[실모드 C2] 미체크:', !checkedA, '버튼 disabled:', disA);
        await pA.screenshot({ path: join(SHOT_DIR, 'qa_gate4_realmode_modal.png') });
      }
    }
  }
}

console.log('\n[콘솔 에러 B]:', errsB.length, '[콘솔 에러 A]:', errsA.length);
await b.close();
