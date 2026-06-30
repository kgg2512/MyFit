/**
 * QA: 14세 게이트 최종 검증
 * 전략: fit 진입 직후 localStorage를 JS로 수동 초기화 →
 *       React re-render 후 consented=false 상태 만들기
 *       then: 파일 업로드 → 피팅 시작 → 모달 트리거
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

// 1. fit 진입
await p.goto('https://kgg2512.github.io/MyFit/app-demo/fit/', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(2000);

// 2. localStorage 수동 초기화 + React state를 다시 읽도록 navigate reload
await p.evaluate(() => {
  localStorage.removeItem('myfit_consented');
  localStorage.removeItem('myfit_age_confirmed');
  localStorage.removeItem('myfit_demo_seeded');
  localStorage.removeItem('myfit_measurements');
  localStorage.removeItem('myfit_fit_history');
  localStorage.removeItem('myfit_last_person_b64');
});

// 3. 페이지 reload → React useEffect가 isConsented()=false로 초기화
await p.reload({ waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(2000);

const lsAfterClear = await p.evaluate(() => ({
  consented: localStorage.getItem('myfit_consented'),
  age: localStorage.getItem('myfit_age_confirmed'),
}));
console.log('[localStorage 초기화 후]:', JSON.stringify(lsAfterClear));

// 4. STEP 1: 신체 사진 업로드
const fileCount = await p.locator('input[type=file]').count();
console.log('[file input 개수]:', fileCount);

if (fileCount === 0) {
  console.log('[FAIL] file input 미발견');
  await b.close();
  process.exit(1);
}

await p.locator('input[type=file]').first().setInputFiles(dummyPath);
await p.waitForTimeout(1500);

// 5. 다음 클릭 → STEP 2
const nextBtn = p.locator('button:has-text("다음")');
if (await nextBtn.count() > 0 && !(await nextBtn.isDisabled())) {
  await nextBtn.click();
  await p.waitForTimeout(1500);
  console.log('[STEP 2 진입 확인]:', (await p.evaluate(() => document.body.innerText)).includes('STEP 2'));
}

// 6. STEP 2: 옷 URL 입력 방식 시도 (URL input이 있으면 더 쉬움)
const urlInput = p.locator('input[placeholder*="URL"]');
if (await urlInput.count() > 0) {
  await urlInput.fill('https://kgg2512.github.io/MyFit/demo/tops_female.png');
  await p.waitForTimeout(500);
}

// 또는 file input으로 직접 업로드
const fileCount2 = await p.locator('input[type=file]').count();
if (fileCount2 > 0) {
  await p.locator('input[type=file]').first().setInputFiles(dummyPath);
  await p.waitForTimeout(1500);
}

// 7. "AI 피팅 시작" 버튼 클릭
const startBtn = p.locator('button').filter({ hasText: /AI 피팅 시작|피팅 시작/ });
const startCount = await startBtn.count();
console.log('[AI 피팅 시작 버튼 count]:', startCount);

if (startCount > 0) {
  const disabled = await startBtn.first().isDisabled();
  console.log('[버튼 disabled]:', disabled);
  if (!disabled) {
    await startBtn.first().click();
    await p.waitForTimeout(2000);

    await p.screenshot({ path: join(SHOT_DIR, 'qa_gate3_after_start.png') });

    // 8. 동의 모달 확인
    const dialogCount = await p.locator('[role=dialog]').count();
    const age14Count = await p.locator('#age-confirm-fit').count();
    console.log('[동의 모달 role=dialog]:', dialogCount);
    console.log('[#age-confirm-fit]:', age14Count);

    if (age14Count > 0) {
      const isChecked = await p.locator('#age-confirm-fit').isChecked();
      const consentBtn = p.locator('button:has-text("전체 동의하고 AI 피팅 시작")');
      const btnDisabled = await consentBtn.count() > 0 ? await consentBtn.isDisabled() : 'button not found';
      console.log('[체크박스 초기 checked]:', isChecked);
      console.log('[동의 버튼 disabled]:', btnDisabled);

      await p.screenshot({ path: join(SHOT_DIR, 'qa_gate3_modal_unchecked.png') });

      // 체크 → 버튼 활성화
      await p.locator('#age-confirm-fit').check();
      await p.waitForTimeout(500);
      const btnDisabledAfter = await consentBtn.count() > 0 ? await consentBtn.isDisabled() : 'n/a';
      console.log('[체크 후 버튼 disabled]:', btnDisabledAfter);
      await p.screenshot({ path: join(SHOT_DIR, 'qa_gate3_modal_checked.png') });

      if (!isChecked && btnDisabled === true && btnDisabledAfter === false) {
        console.log('\n[C2 판정] PASS — 미체크 차단 + 체크 활성화 정상');
      } else {
        console.log('\n[C2 판정] FAIL — 조건 미충족:', { isChecked, btnDisabled, btnDisabledAfter });
      }
    } else if (dialogCount > 0) {
      const modalText = await p.locator('[role=dialog]').first().innerText();
      console.log('[모달 내용]:', modalText.substring(0, 300));
      // 다른 선택자로 연령 체크박스 찾기
      const allInputs = await p.evaluate(() => Array.from(document.querySelectorAll('input')).map(i => ({ id: i.id, type: i.type, placeholder: i.placeholder })));
      console.log('[모달 내 input들]:', JSON.stringify(allInputs));
    } else {
      // 모달 미표시 — consented가 이미 set됐거나 다른 화면으로 이동
      const pageText = await p.evaluate(() => document.body.innerText.substring(0, 300));
      const lsFinal = await p.evaluate(() => ({
        consented: localStorage.getItem('myfit_consented'),
        age: localStorage.getItem('myfit_age_confirmed'),
      }));
      console.log('[피팅 시작 후 텍스트]:', pageText);
      console.log('[최종 localStorage]:', JSON.stringify(lsFinal));
      console.log('[C2 판정] FAIL — 동의 모달 미표시');
    }
  } else {
    // 버튼 disabled인 경우 - URL 입력 등 필요
    const step2FullText = await p.evaluate(() => document.body.innerText);
    console.log('[STEP 2 전체 텍스트]:', step2FullText.substring(0, 400));
    await p.screenshot({ path: join(SHOT_DIR, 'qa_gate3_step2_disabled.png') });
    console.log('[INFO] AI 피팅 시작 버튼 disabled — 옷 이미지 미로드 상태');
  }
} else {
  const allBtns = await p.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()));
  console.log('[현재 버튼 목록]:', JSON.stringify(allBtns));
  await p.screenshot({ path: join(SHOT_DIR, 'qa_gate3_no_startbtn.png') });
}

console.log('\n[콘솔 에러]:', errs.length, errs.length > 0 ? JSON.stringify(errs.slice(0,5)) : '없음');
await b.close();
