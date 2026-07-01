/**
 * QA: fit 페이지 14세 게이트 상세 검증
 * 동의 모달 트리거 조건 = canStartFit() && !consented
 * canStartFit() = personBase64 && garmentBase64 모두 채워져야 함
 * 따라서 fresh context에서 사진 두 장을 simulate해야 모달이 뜬다
 */
import { chromium } from 'playwright';

const b = await chromium.launch({ headless: true });

// ── 테스트 A: fresh context, fit 직접 진입 ─────────────────────────
console.log('\n=== 테스트 A: fresh context 직접 진입 ===');
const ctxA = await b.newContext({ viewport: { width: 390, height: 844 } });
const pA = await ctxA.newPage();
const errsA = [];
pA.on('console', m => { if (m.type()==='error') errsA.push(m.text()); });

await pA.goto('https://kgg2512.github.io/MyFit/app-demo/fit/', { waitUntil: 'networkidle', timeout: 30000 });
await pA.waitForTimeout(3000);

const lsA = await pA.evaluate(() => ({
  consented: localStorage.getItem('myfit_consented'),
  age: localStorage.getItem('myfit_age_confirmed'),
  seeded: localStorage.getItem('myfit_demo_seeded'),
}));
console.log('localStorage (fresh):', JSON.stringify(lsA));

// JS를 통해 React state를 우회하지 않고, localStorage에서 동의 없는 상태 확인
// → isConsented()=false(consented=null), 즉 사진 두 장 완성 시 모달 뜨는 구조
// 직접 personBase64/garmentBase64를 주입해서 handleStartFit 동작 트리거
const modalTriggered = await pA.evaluate(() => {
  // React DevTools 없이 DOM에서 직접 확인
  // 방법: personBase64가 필요한 '다음' 버튼을 찾아 canStartFit 우회
  // 실제로는 이미지 파일 input을 통해야 함 — 여기서는 모달이 뜨는 조건 자체를 확인

  // setShowConsent(true)는 handleStartFit -> !consented 일 때 호출
  // consented=null이면 false이므로 사진만 채우면 모달 뜸
  return {
    hasAgeInput: !!document.getElementById('age-confirm-fit'),
    hasDialog: document.querySelectorAll('[role=dialog]').length > 0,
    localStorage_consented: localStorage.getItem('myfit_consented'),
  };
});
console.log('DOM 상태:', JSON.stringify(modalTriggered));

// ── 테스트 B: demo seed 있는 상태 (HOME 통해 seed 주입 후 fit 진입) ─
console.log('\n=== 테스트 B: HOME → FIT 이동 (seed 주입 경로) ===');
const ctxB = await b.newContext({ viewport: { width: 390, height: 844 } });
const pB = await ctxB.newPage();
const errsB = [];
pB.on('console', m => { if (m.type()==='error') errsB.push(m.text()); });

// HOME 먼저 방문 → seed 주입 → seed가 AGE_CONFIRMED+CONSENTED를 1로 세팅
await pB.goto('https://kgg2512.github.io/MyFit/app-demo/', { waitUntil: 'networkidle', timeout: 30000 });
await pB.waitForTimeout(3000);

const lsB_home = await pB.evaluate(() => ({
  consented: localStorage.getItem('myfit_consented'),
  age: localStorage.getItem('myfit_age_confirmed'),
  seeded: localStorage.getItem('myfit_demo_seeded'),
}));
console.log('HOME 후 localStorage:', JSON.stringify(lsB_home));

// FIT 탭 클릭
await pB.goto('https://kgg2512.github.io/MyFit/app-demo/fit/', { waitUntil: 'networkidle', timeout: 30000 });
await pB.waitForTimeout(2000);

const lsB_fit = await pB.evaluate(() => ({
  consented: localStorage.getItem('myfit_consented'),
  age: localStorage.getItem('myfit_age_confirmed'),
  hasDialog: document.querySelectorAll('[role=dialog]').length > 0,
  hasAgeInput: !!document.getElementById('age-confirm-fit'),
}));
console.log('FIT 탭 이동 후 상태:', JSON.stringify(lsB_fit));

// seed가 consented+age를 자동 주입했으므로 FIT에서 모달 안 뜨는 것이 설계 의도
if (lsB_home.consented === '1' && lsB_home.age === '1') {
  console.log('결론: seed가 CONSENTED+AGE_CONFIRMED 자동 주입 → FIT 페이지 모달 skip (투자 데모 시연 흐름 유지 — 설계 의도)');
  console.log('14세 게이트 테스트를 위해서는 fresh(비seed) 경로에서 사진 제출 시 모달 발동 확인 필요');
}

// ── 테스트 C: fresh context에서 사진 파일 업로드 simulate → 모달 트리거 ─
console.log('\n=== 테스트 C: fresh + 파일업로드 simulate → 모달 트리거 ===');
const ctxC = await b.newContext({ viewport: { width: 390, height: 844 } });
const pC = await ctxC.newPage();
const errsC = [];
pC.on('console', m => { if (m.type()==='error') errsC.push(m.text()); });

await pC.goto('https://kgg2512.github.io/MyFit/app-demo/fit/', { waitUntil: 'networkidle', timeout: 30000 });
await pC.waitForTimeout(3000);

// file input 찾기
const fileInputCount = await pC.locator('input[type=file]').count();
console.log('file input 개수:', fileInputCount);

// 작은 더미 PNG 생성 (1x1 투명 PNG)
const dummyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
import { writeFileSync } from 'fs';
writeFileSync('/tmp/dummy.png', dummyPng);

if (fileInputCount > 0) {
  // STEP 1: 신체 사진 업로드
  const input1 = pC.locator('input[type=file]').first();
  await input1.setInputFiles('/tmp/dummy.png');
  await pC.waitForTimeout(1500);
  console.log('사진 1 업로드 후 텍스트:', (await pC.evaluate(() => document.body.innerText)).substring(0, 200));

  // '다음' 버튼 클릭 → STEP 2로 이동
  const nextBtn = pC.locator('button:has-text("다음")');
  const nextCount = await nextBtn.count();
  console.log('다음 버튼 count:', nextCount);
  if (nextCount > 0) {
    const isDisabled = await nextBtn.isDisabled();
    console.log('다음 버튼 disabled:', isDisabled);
    if (!isDisabled) {
      await nextBtn.click();
      await pC.waitForTimeout(1500);
      console.log('STEP 2 텍스트:', (await pC.evaluate(() => document.body.innerText)).substring(0, 200));
    }
  }
}

// STEP 2에서 옷 사진 업로드 후 '시작' 버튼 → 동의 모달
const step2Text = await pC.evaluate(() => document.body.innerText);
const isStep2 = step2Text.includes('STEP 2') || step2Text.includes('옷 사진');
console.log('STEP 2 진입:', isStep2);

if (isStep2) {
  const fileInput2 = await pC.locator('input[type=file]').count();
  if (fileInput2 > 0) {
    await pC.locator('input[type=file]').first().setInputFiles('/tmp/dummy.png');
    await pC.waitForTimeout(1500);

    // 피팅 시작 버튼
    const startBtn = pC.locator('button:has-text("피팅")');
    const startCount = await startBtn.count();
    console.log('피팅 시작 버튼 count:', startCount);
    if (startCount > 0) {
      await startBtn.click();
      await pC.waitForTimeout(1500);
      // 모달 확인
      const dialogCount = await pC.locator('[role=dialog]').count();
      const hasAge14 = await pC.locator('#age-confirm-fit').count();
      console.log('모달 표시:', dialogCount, '/ 14세 체크박스:', hasAge14);
      if (hasAge14 > 0) {
        const isChecked = await pC.locator('#age-confirm-fit').isChecked();
        const btnDisabled = await pC.locator('button:has-text("전체 동의하고")').isDisabled().catch(() => 'n/a');
        console.log('체크박스 초기상태:', isChecked, '버튼 disabled:', btnDisabled);
      }
    }
  }
}

console.log('\n=== 콘솔 에러 집계 ===');
console.log('A:', errsA.length, 'B:', errsB.length, 'C:', errsC.length);
if ([...errsA, ...errsB, ...errsC].length > 0) {
  console.log('에러 내역:', JSON.stringify([...errsA, ...errsB, ...errsC]));
}

await b.close();
