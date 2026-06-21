/**
 * QA: 14세 게이트 최종 — React input 이벤트 직접 발화로 garmentUrl 세팅
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
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

// 실모드 /app/ 사용 (DEMO_MODE=false → seed 없음)
await p.goto('https://kgg2512.github.io/MyFit/app/fit/', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(2000);

const ls0 = await p.evaluate(() => ({
  consented: localStorage.getItem('myfit_consented'),
  age: localStorage.getItem('myfit_age_confirmed'),
}));
console.log('[초기 localStorage]:', JSON.stringify(ls0));

// STEP 1: 신체 사진 업로드
const fc = await p.locator('input[type=file]').count();
console.log('[file input 개수]:', fc);

if (fc === 0) {
  console.log('[FAIL] file input 없음'); await b.close(); process.exit(1);
}

await p.locator('input[type=file]').first().setInputFiles(dummyPath);
await p.waitForTimeout(1500);

// 다음 버튼 클릭
const nb = p.locator('button:has-text("다음")');
if (await nb.count() > 0 && !(await nb.isDisabled())) {
  await nb.click();
  await p.waitForTimeout(1500);
  console.log('[STEP 2 진입]:', (await p.evaluate(() => document.body.innerText)).includes('STEP 2'));
}

// STEP 2: React input 이벤트로 URL 값 주입
const urlInputSel = 'input[type=url]';
const urlInputCount = await p.locator(urlInputSel).count();
console.log('[URL input count]:', urlInputCount);

if (urlInputCount > 0) {
  // React onChange를 트리거하려면 Playwright fill + 네이티브 input 이벤트
  await p.locator(urlInputSel).click();
  await p.locator(urlInputSel).fill('https://kgg2512.github.io/MyFit/demo/tops_female.png');
  // React가 onChange를 감지하도록 추가 keypress 발화
  await p.keyboard.press('Space');
  await p.keyboard.press('Backspace');
  await p.waitForTimeout(1000);

  const urlVal = await p.locator(urlInputSel).inputValue();
  console.log('[URL input 값]:', urlVal);
}

// AI 피팅 시작 버튼 상태
const sbAll = await p.locator('button').all();
const sbTexts = await Promise.all(sbAll.map(b => b.textContent()));
console.log('[버튼 목록]:', JSON.stringify(sbTexts.map(t => t?.trim()).filter(Boolean)));

const sb = p.locator('button').filter({ hasText: /AI 피팅 시작/ });
const sbc = await sb.count();
console.log('[AI 피팅 시작 버튼 count]:', sbc);

if (sbc > 0) {
  const sbd = await sb.first().isDisabled();
  console.log('[버튼 disabled]:', sbd);

  if (!sbd) {
    await sb.first().click();
    await p.waitForTimeout(2000);
    await p.screenshot({ path: join(SHOT_DIR, 'qa_gate5_after_start.png') });

    const dlg = await p.locator('[role=dialog]').count();
    const age14 = await p.locator('#age-confirm-fit').count();
    console.log('[동의 모달 count]:', dlg, '/ [#age-confirm-fit]:', age14);

    if (age14 > 0) {
      const checked = await p.locator('#age-confirm-fit').isChecked();
      const cBtn = p.locator('button:has-text("전체 동의하고 AI 피팅 시작")');
      const cBtnDis = await cBtn.count() > 0 ? await cBtn.isDisabled() : 'not found';
      console.log('[체크박스 초기 checked]:', checked, '/ [동의 버튼 disabled]:', cBtnDis);
      await p.screenshot({ path: join(SHOT_DIR, 'qa_gate5_modal_unchecked.png') });

      // 14세 체크 → 버튼 활성화
      await p.locator('#age-confirm-fit').check();
      await p.waitForTimeout(500);
      const cBtnDisAfter = await cBtn.count() > 0 ? await cBtn.isDisabled() : 'n/a';
      console.log('[체크 후 버튼 disabled]:', cBtnDisAfter);
      await p.screenshot({ path: join(SHOT_DIR, 'qa_gate5_modal_checked.png') });

      if (!checked && cBtnDis === true && cBtnDisAfter === false) {
        console.log('\n[C2 PASS] 14세 미체크 차단 + 체크 활성화 정상 확인');
      } else {
        console.log('\n[C2 상태]:', { checked, cBtnDis, cBtnDisAfter });
      }
    } else if (dlg > 0) {
      const mt = await p.locator('[role=dialog]').first().innerText();
      console.log('[모달 내용]:', mt.substring(0, 400));
      await p.screenshot({ path: join(SHOT_DIR, 'qa_gate5_modal_unknown.png') });
    } else {
      // 모달 미표시
      const pageText = await p.evaluate(() => document.body.innerText.substring(0, 300));
      const lsFinal = await p.evaluate(() => ({
        consented: localStorage.getItem('myfit_consented'),
        age: localStorage.getItem('myfit_age_confirmed'),
      }));
      console.log('[피팅 시작 후 텍스트]:', pageText);
      console.log('[최종 localStorage]:', JSON.stringify(lsFinal));
      // 콘솔에서 에러 확인
      console.log('[에러]:', JSON.stringify(errs));
    }
  } else {
    // 버튼 여전히 disabled — canStartFit 조건 미충족
    const urlVal = await p.locator(urlInputSel).inputValue().catch(() => 'n/a');
    console.log('[URL input 현재값]:', urlVal);
    // validateImageUrl 직접 확인
    const validation = await p.evaluate((url) => {
      // URL 유효성 검사 패턴 추측
      try { new URL(url); return { valid: true, url }; }
      catch { return { valid: false, url }; }
    }, urlVal);
    console.log('[URL 유효성]:', JSON.stringify(validation));
    await p.screenshot({ path: join(SHOT_DIR, 'qa_gate5_step2_final.png') });
  }
}

console.log('\n[콘솔 에러]:', errs.length, errs.length > 0 ? JSON.stringify(errs.slice(0,3)) : '없음');
await b.close();
