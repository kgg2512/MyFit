/**
 * QA: fit 페이지 14세 게이트 — localStorage 강제 초기화 후 검증
 * 핵심: storageState: {} 옵션으로 완전 초기화된 컨텍스트 생성
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SHOT_DIR = 'C:/Users/kgg25/Desktop/G2 Company Ltd/docs/reports/qa_screenshots';
mkdirSync(SHOT_DIR, { recursive: true });

// 더미 PNG (1x1 투명)
const dummyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const dummyPath = join(SHOT_DIR, 'dummy.png');
writeFileSync(dummyPath, dummyPng);

const b = await chromium.launch({ headless: true });

// storageState: {} + originState 비어있는 컨텍스트 → localStorage 완전 초기화
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 },
  storageState: { cookies: [], origins: [] },  // 완전 초기화
});
const p = await ctx.newPage();
const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

// app-demo/fit/ 진입
await p.goto('https://kgg2512.github.io/MyFit/app-demo/fit/', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(3000);

// localStorage 상태 확인 (완전 초기화 확인)
const ls = await p.evaluate(() => ({
  consented: localStorage.getItem('myfit_consented'),
  age: localStorage.getItem('myfit_age_confirmed'),
  seeded: localStorage.getItem('myfit_demo_seeded'),
}));
console.log('[초기화 확인] localStorage:', JSON.stringify(ls));

// seed 없이 fit 직접 진입 → STEP 1
const step1Text = await p.evaluate(() => document.body.innerText.substring(0, 300));
console.log('[STEP 1 텍스트]:', step1Text);

// file input 확인
const fileCount = await p.locator('input[type=file]').count();
console.log('[file input 개수]:', fileCount);

if (fileCount > 0) {
  // STEP 1: 신체 사진 업로드
  await p.locator('input[type=file]').first().setInputFiles(dummyPath);
  await p.waitForTimeout(2000);
  await p.screenshot({ path: join(SHOT_DIR, 'qa_gate_step1_after_upload.png') });
  console.log('[STEP 1 사진 업로드 후 텍스트]:', (await p.evaluate(() => document.body.innerText)).substring(0,200));

  // '다음' 버튼
  const nextBtns = await p.locator('button').all();
  const nextBtnTexts = await Promise.all(nextBtns.map(b => b.textContent()));
  console.log('[버튼 목록]:', JSON.stringify(nextBtnTexts.map(t => t?.trim())));

  const nextBtn = p.locator('button:has-text("다음")');
  const nextCount = await nextBtn.count();
  if (nextCount > 0) {
    const disabled = await nextBtn.isDisabled();
    console.log('[다음 버튼 disabled]:', disabled);
    if (!disabled) {
      await nextBtn.click();
      await p.waitForTimeout(2000);
      await p.screenshot({ path: join(SHOT_DIR, 'qa_gate_step2.png') });
      const step2Text = await p.evaluate(() => document.body.innerText.substring(0, 300));
      console.log('[STEP 2 텍스트]:', step2Text);

      // STEP 2: 옷 사진 업로드
      const fileCount2 = await p.locator('input[type=file]').count();
      if (fileCount2 > 0) {
        await p.locator('input[type=file]').first().setInputFiles(dummyPath);
        await p.waitForTimeout(2000);

        // 피팅 시작 버튼들
        const allBtns2 = await p.locator('button').all();
        const btn2Texts = await Promise.all(allBtns2.map(b => b.textContent()));
        console.log('[STEP 2 버튼 목록]:', JSON.stringify(btn2Texts.map(t => t?.trim())));

        // "피팅 시작" 또는 "다음" 버튼
        const fitBtn = p.locator('button').filter({ hasText: /피팅|시작|AI/ });
        const fitCount = await fitBtn.count();
        console.log('[피팅 버튼 count]:', fitCount);

        if (fitCount > 0) {
          const fitDisabled = await fitBtn.first().isDisabled();
          if (!fitDisabled) {
            await fitBtn.first().click();
            await p.waitForTimeout(2000);
            await p.screenshot({ path: join(SHOT_DIR, 'qa_gate_after_fit_click.png') });

            // 동의 모달 확인
            const dialogCount = await p.locator('[role=dialog]').count();
            const hasAge14 = await p.locator('#age-confirm-fit').count();
            console.log('[동의 모달 표시]:', dialogCount > 0);
            console.log('[#age-confirm-fit 체크박스]:', hasAge14 > 0);

            if (hasAge14 > 0) {
              const isChecked = await p.locator('#age-confirm-fit').isChecked();
              const consentBtn = p.locator('button:has-text("전체 동의하고 AI 피팅 시작")');
              const consentBtnCount = await consentBtn.count();
              let btnDisabled = null;
              if (consentBtnCount > 0) {
                btnDisabled = await consentBtn.isDisabled();
              }
              console.log('[체크박스 초기 checked]:', isChecked, '/ [동의버튼 disabled]:', btnDisabled);

              await p.screenshot({ path: join(SHOT_DIR, 'qa_gate_modal_unchecked.png') });
              console.log('스크린샷: qa_gate_modal_unchecked.png');

              // 14세 체크 → 버튼 활성화 확인
              await p.locator('#age-confirm-fit').check();
              await p.waitForTimeout(500);
              const btnDisabledAfter = consentBtnCount > 0 ? await consentBtn.isDisabled() : null;
              console.log('[체크 후 버튼 disabled]:', btnDisabledAfter);
              await p.screenshot({ path: join(SHOT_DIR, 'qa_gate_modal_checked.png') });
              console.log('스크린샷: qa_gate_modal_checked.png');

              // 결론
              if (!isChecked && btnDisabled === true && btnDisabledAfter === false) {
                console.log('\n[판정] 14세 게이트: PASS — 미체크 차단, 체크 후 활성화 확인');
              } else {
                console.log('\n[판정] 14세 게이트: 상세 확인 필요 — isChecked:', isChecked, 'disabled:', btnDisabled, 'after:', btnDisabledAfter);
              }
            } else if (dialogCount > 0) {
              console.log('[판정] 모달 표시됐으나 #age-confirm-fit ID 미발견 — 선택자 변경 가능성');
              const modalHTML = await p.locator('[role=dialog]').first().innerHTML();
              console.log('[모달 HTML 요약]:', modalHTML.substring(0, 500));
            } else {
              // 모달 미표시 — 피팅이 바로 시작됐을 수도 있음 (consented 이미 set?)
              const pageText = await p.evaluate(() => document.body.innerText.substring(0,300));
              const lsAfter = await p.evaluate(() => ({
                consented: localStorage.getItem('myfit_consented'),
                age: localStorage.getItem('myfit_age_confirmed'),
              }));
              console.log('[피팅 버튼 클릭 후 텍스트]:', pageText);
              console.log('[localStorage 상태]:', JSON.stringify(lsAfter));
              console.log('[판정] 모달 미표시 — 원인 조사 필요');
            }
          }
        }
      }
    }
  }
}

console.log('\n[콘솔 에러]:', errs.length, errs.length > 0 ? JSON.stringify(errs) : '');
await b.close();
