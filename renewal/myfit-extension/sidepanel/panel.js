/**
 * MyFit Extension — Side Panel JS
 *
 * CSP: script-src 'self' — 외부 CDN 금지
 * Three.js: lib/three.module.min.js (로컬 번들 필수)
 *
 * 보안:
 *  - innerHTML 사용 금지 → DOM API 직접 생성
 *  - 신체 사진 저장 금지 (측정 수치만 암호화 저장)
 *  - eval() 사용 금지
 */

'use strict';

// ── 상수 ──
const SIZES_TOPS    = ['XS','S','M','L','XL','2XL'];
const SIZES_BOTTOMS = ['26','28','30','32','34','36'];
const SIZES_SHOES   = ['250','255','260','265','270','275','280'];

const SIZE_CHART = {
  // 상의 — 가슴 기준 (cm)
  tops: { XS:84, S:88, M:92, L:96, XL:100, '2XL':106 },
  // 하의 — 허리 기준 (cm)
  bottoms: { '26':62,'28':67,'30':72,'32':77,'34':82,'36':87 },
};

// ── 상태 ──
let measurements = null;  // { height, weight, shoulder, chest, waist, hip }
let currentProduct = null;
let selectedSize = null;
let fitResult = null;     // FitEngine.predict() 결과 (실측 사이즈표 추출 성공 시). null이면 일반추정 fallback.
let threeScene = null;
let threeCamera = null;
let threeRenderer = null;
let clothingGroup = null;
let bodyGroup = null;

// ── DOM 레퍼런스 ──
const screens = {
  onboard:  document.getElementById('s-onboard'),
  manual:   document.getElementById('s-manual'),
  waiting:  document.getElementById('s-waiting'),
  fitting:  document.getElementById('s-fitting'),
};

// ── 화면 전환 ──
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ── 빠른 사이즈 입력 차트 ──
const QUICK_SIZE_MAP = {
  XS: { height: 163, weight: 50, shoulder: 37, chest: 82, waist: 62, hip: 86 },
  S:  { height: 167, weight: 57, shoulder: 39, chest: 88, waist: 67, hip: 90 },
  M:  { height: 171, weight: 65, shoulder: 41, chest: 94, waist: 74, hip: 96 },
  L:  { height: 174, weight: 72, shoulder: 43, chest: 100, waist: 80, hip: 102 },
  XL: { height: 177, weight: 80, shoulder: 45, chest: 106, waist: 87, hip: 108 },
};

// ── 이벤트 바인딩 ──
document.getElementById('btn-start-onboard').addEventListener('click', async () => {
  const overlay = document.getElementById('consent-overlay');
  // 최초 실행 시 동의 모달 표시, 이미 동의했으면 바로 manual로
  // SEC-006 수정: localStorage → chrome.storage.local (Extension 전용 격리 스토리지)
  const stored = await chrome.storage.local.get('myfit_consented');
  const hasConsented = stored.myfit_consented;
  if (hasConsented) {
    showScreen('manual');
  } else {
    overlay.classList.remove('hidden');
  }
});
document.getElementById('btn-back-onboard').addEventListener('click', () => showScreen('onboard'));
document.getElementById('btn-save-measurements').addEventListener('click', saveMeasurements);
document.getElementById('btn-edit-profile').addEventListener('click', () => showScreen('manual'));
document.getElementById('btn-back-waiting').addEventListener('click', () => showScreen('waiting'));

// ── 빠른 사이즈 버튼 이벤트 ──
document.querySelectorAll('.quick-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const size = btn.getAttribute('data-size');
    const preset = QUICK_SIZE_MAP[size];
    if (!preset) return;
    for (const [key, val] of Object.entries(preset)) {
      const el = document.getElementById('inp-' + key);
      if (el) el.value = val;
    }
    // 현재 선택 표시
    document.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ── 초기화 ──
async function init() {
  await loadMeasurements();
  if (measurements) {
    renderProfileSummary();
    showScreen('waiting');
  } else {
    showScreen('onboard');
  }
}

// ── 측정값 저장 (암호화 via background) ──
async function saveMeasurements() {
  const data = {
    height:   parseFloat(document.getElementById('inp-height').value)   || 175,
    weight:   parseFloat(document.getElementById('inp-weight').value)   || 70,
    shoulder: parseFloat(document.getElementById('inp-shoulder').value) || 43,
    chest:    parseFloat(document.getElementById('inp-chest').value)    || 94,
    waist:    parseFloat(document.getElementById('inp-waist').value)    || 78,
    hip:      parseFloat(document.getElementById('inp-hip').value)      || 90,
  };

  const response = await chrome.runtime.sendMessage({
    type: 'STORE_MEASUREMENTS',
    payload: data
  });

  if (response?.ok) {
    measurements = data;
    renderProfileSummary();
    showScreen('waiting');
  }
}

// ── 측정값 로드 ──
async function loadMeasurements() {
  const response = await chrome.runtime.sendMessage({ type: 'LOAD_MEASUREMENTS' });
  if (response?.ok && response.data) {
    measurements = response.data;
    // 입력 필드도 채워두기
    for (const [k, v] of Object.entries(measurements)) {
      const el = document.getElementById('inp-' + k);
      if (el) el.value = v;
    }
  }
}

// ── 프로필 요약 렌더 ──
function renderProfileSummary() {
  if (!measurements) return;
  const wrap = document.getElementById('profile-summary');
  wrap.textContent = ''; // innerHTML 금지 → textContent 초기화 후 DOM 생성

  const items = [
    { label: '키', value: measurements.height, unit: 'cm' },
    { label: '몸무게', value: measurements.weight, unit: 'kg' },
    { label: '가슴', value: measurements.chest, unit: 'cm' },
  ];

  items.forEach(({ label, value, unit }) => {
    const chip = document.createElement('div');
    chip.className = 'profile-chip';

    const lbl = document.createElement('div');
    lbl.className = 'profile-chip-label';
    lbl.textContent = label;

    const val = document.createElement('div');
    val.className = 'profile-chip-value';
    val.textContent = value;

    const ut = document.createElement('div');
    ut.className = 'profile-chip-unit';
    ut.textContent = unit;

    chip.appendChild(lbl);
    chip.appendChild(val);
    chip.appendChild(ut);
    wrap.appendChild(chip);
  });
}

// ── 배경으로부터 상품 데이터 수신 ──
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'PRODUCT_DATA' && message.payload) {
    currentProduct = message.payload;
    startFitting(currentProduct);
  }
});

// ── 피팅 시작 ──
function startFitting(product) {
  if (!measurements) {
    showScreen('manual');
    return;
  }

  // 제품명 설정
  const titleEl = document.getElementById('fitting-product-name');
  titleEl.textContent = product.name || '가상 피팅';

  // ★ P3-2: 실측 사이즈표(content.js parseMusinsaSizeChart) 추출 성공 시 → FitEngine 경로.
  //   사용자 입력 단위계 변환: '가슴 둘레' → 단면(/2), '어깨 너비'는 옷 어깨너비와 직접 비교.
  fitResult = null;
  const chart = product.sizeChart;
  if (chart && Array.isArray(chart.sizes) && chart.sizes.length && window.MyFitEngine) {
    const body = {
      height: measurements.height,
      chestHalf: (Number(measurements.chest) || 0) / 2,
      shoulder: Number(measurements.shoulder) || 0,
    };
    // stretchFromChart:false — 검증된 회장 케이스 판정과 동일(신축 보정 미적용).
    fitResult = window.MyFitEngine.predict(chart, body, { stretchFromChart: false });
    if (!fitResult || !fitResult.sizes.length) fitResult = null;
  }

  let sizeList, recommendedSize, sizeType;
  if (fitResult) {
    // 실측 사이즈표의 진짜 사이즈(M/L/XL/XXL) + 엔진 추천
    sizeList = fitResult.sizes.map(s => s.size);
    recommendedSize = fitResult.recommended || sizeList[0];
    sizeType = fitResult.category || 'tops';
  } else {
    // fallback: 일반 브랜드 추정 (사이즈표 없는 Nike/Zara 등 또는 파싱 실패)
    const sizes = detectSizeType(product);
    sizeType = sizes.type;
    sizeList = sizes.list;
    recommendedSize = calcRecommendedSize(measurements, sizeType);
  }

  renderSizeButtons(sizeList, recommendedSize);
  selectedSize = recommendedSize;

  // 추천 배지 업데이트
  document.getElementById('rec-size-badge').textContent = '추천: ' + recommendedSize;

  showScreen('fitting');
  initThreeJS(product, recommendedSize);
  updateFitScores(recommendedSize, sizeType);
}

// ── 사이즈 타입 감지 ──
function detectSizeType(product) {
  const name = (product.name || '').toLowerCase();
  if (name.includes('신발') || name.includes('shoe') || name.includes('sneaker')) {
    return { type: 'shoes', list: SIZES_SHOES };
  }
  if (name.includes('팬츠') || name.includes('바지') || name.includes('pant') || name.includes('jean')) {
    return { type: 'bottoms', list: SIZES_BOTTOMS };
  }
  return { type: 'tops', list: SIZES_TOPS };
}

// ── 추천 사이즈 계산 ──
function calcRecommendedSize(m, type) {
  if (type === 'tops') {
    const chart = SIZE_CHART.tops;
    let best = 'M';
    let minDiff = Infinity;
    for (const [size, ref] of Object.entries(chart)) {
      const diff = Math.abs(m.chest - ref);
      if (diff < minDiff) { minDiff = diff; best = size; }
    }
    return best;
  }
  if (type === 'bottoms') {
    const chart = SIZE_CHART.bottoms;
    let best = '30';
    let minDiff = Infinity;
    for (const [size, ref] of Object.entries(chart)) {
      const diff = Math.abs(m.waist - ref);
      if (diff < minDiff) { minDiff = diff; best = size; }
    }
    return best;
  }
  // 신발: 키 기반 대략치
  const h = m.height;
  if (h < 160) return '250';
  if (h < 165) return '255';
  if (h < 170) return '260';
  if (h < 175) return '265';
  if (h < 180) return '270';
  if (h < 185) return '275';
  return '280';
}

// ── 사이즈 버튼 렌더 ──
function renderSizeButtons(sizes, recommended) {
  const wrap = document.getElementById('size-btns');
  wrap.textContent = '';

  sizes.forEach(size => {
    const btn = document.createElement('button');
    btn.className = 'size-btn' + (size === recommended ? ' active recommended' : '');
    btn.setAttribute('type', 'button');
    btn.textContent = size;

    btn.addEventListener('click', () => {
      wrap.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedSize = size;
      document.getElementById('rec-size-badge').textContent = size;
      updateClothingScale(size);
      updateFitScores(size, detectSizeType(currentProduct).type);
    });

    wrap.appendChild(btn);
  });
}

// ── 핏 점수 계산 및 렌더 ──
function updateFitScores(size, type) {
  if (!measurements) return;

  // ★ P3-2: 실측 사이즈표 기반 FitEngine 결과가 있으면 정성 핏 카드로 렌더
  if (fitResult) {
    renderFitFromEngine(size);
    return;
  }

  // fallback: 일반추정 % 바 카드
  document.getElementById('fit-engine-card')?.classList.add('hidden');
  document.getElementById('fit-score-card')?.classList.remove('hidden');

  const scores = calcFitScores(size, type);
  updateFitRow('fit-shoulder', scores.shoulder);
  updateFitRow('fit-chest', scores.chest);
  updateFitRow('fit-waist', scores.waist);
}

// ── 실측 사이즈표 기반 핏 렌더 (FitEngine) ──
// 선택된 사이즈의 부위별(가슴/어깨/총장) 판정을 정성 카드로 출력. innerHTML 금지 → DOM API.
function renderFitFromEngine(size) {
  const card = document.getElementById('fit-engine-card');
  const legacy = document.getElementById('fit-score-card');
  if (!card) return;
  legacy?.classList.add('hidden');
  card.classList.remove('hidden');
  card.textContent = ''; // 초기화 (innerHTML 미사용)

  const sf = fitResult.sizes.find(s => s.size === size);
  if (!sf) return;

  // 요약 라인: 엔진 추천 사이즈 + 신축성(있을 때)
  const summary = document.createElement('div');
  summary.className = 'fe-summary';
  const recB = document.createElement('b');
  recB.textContent = fitResult.recommended || size;
  summary.appendChild(document.createTextNode('실측 기반 추천 '));
  summary.appendChild(recB);
  if (fitResult.stretchApplied) {
    summary.appendChild(document.createTextNode(' · 신축 보정 적용'));
  }
  card.appendChild(summary);

  // 부위 순서: 가슴(대표) → 어깨 → 총장
  const ORDER = [
    { key: '가슴단면', label: '가슴' },
    { key: '어깨너비', label: '어깨' },
    { key: '총장', label: '총장' },
  ];
  ORDER.forEach(({ key, label }) => {
    const part = sf.parts.find(p => p.measureKey === key);
    if (part) card.appendChild(buildFeRow(label, part));
  });
}

// 핏 한 줄 [부위] [판정칩] [여유분] [옷 실측]
function buildFeRow(label, part) {
  const row = document.createElement('div');
  row.className = 'fe-row';

  const lbl = document.createElement('span');
  lbl.className = 'fe-lbl';
  lbl.textContent = label;
  row.appendChild(lbl);

  const chip = document.createElement('span');
  const toneClass = part.level === 'impossible' ? 'bad' : (part.tone || 'standard');
  chip.className = 'fe-chip fe-chip--' + toneClass;
  chip.textContent = part.label;
  row.appendChild(chip);

  const ease = document.createElement('span');
  ease.className = 'fe-ease';
  // 여유분 = 옷 - 몸 (cm). null이면(민소매 어깨/총장 등) 빈칸.
  ease.textContent = (part.ease !== null && part.ease !== undefined)
    ? ((part.ease > 0 ? '+' : '') + part.ease + 'cm')
    : '';
  row.appendChild(ease);

  const gar = document.createElement('span');
  gar.className = 'fe-gar';
  gar.textContent = (part.garment !== null && part.garment !== undefined) ? ('옷 ' + part.garment + 'cm') : '';
  row.appendChild(gar);

  return row;
}

function updateFitRow(baseId, score) {
  const fill = document.getElementById(baseId);
  const val = document.getElementById(baseId + '-val');
  if (!fill || !val) return;
  const pct = Math.round(score * 100);
  fill.style.width = pct + '%';
  fill.style.background = pct >= 80
    ? 'linear-gradient(90deg, #00c853, #00e676)'
    : pct >= 60
    ? 'linear-gradient(90deg, #ff6f00, #ffab40)'
    : 'linear-gradient(90deg, #b71c1c, #ff5252)';
  val.textContent = pct + '%';
}

function calcFitScores(size, type) {
  if (!measurements) return { shoulder: 0.8, chest: 0.8, waist: 0.8 };

  const m = measurements;
  // 단순 차이 기반 점수 (실제 사이즈 차트와 비교)
  const shoulderRef = { XS:36, S:38, M:40, L:42, XL:44, '2XL':47 };
  const chestRef = SIZE_CHART.tops;

  const sRef = shoulderRef[size] || 40;
  const cRef = chestRef[size] || 92;

  const sDiff = Math.abs(m.shoulder - sRef);
  const cDiff = Math.abs(m.chest - cRef);
  const wDiff = Math.abs(m.waist - (cRef * 0.83));

  const toScore = (diff) => Math.max(0, 1 - diff / 12);

  return {
    shoulder: toScore(sDiff),
    chest: toScore(cDiff),
    waist: toScore(wDiff),
  };
}

// ──────────────────────────────────────────────
// Three.js 3D 피팅 렌더러
// Phase 1: lib/three.module.min.js 로컬 번들 필요
// ──────────────────────────────────────────────

async function initThreeJS(product, initSize) {
  const canvas = document.getElementById('fitting-canvas');
  const wrap = canvas.parentElement;

  // Three.js 동적 임포트 (로컬 파일만, CDN 금지)
  let THREE;
  try {
    // manifest.json web_accessible_resources에 등록된 로컬 파일
    const threeUrl = chrome.runtime.getURL('lib/three.module.min.js');
    const mod = await import(threeUrl);
    THREE = mod;
  } catch (e) {
    console.warn('[MyFit] Three.js 로드 실패 — 2D 폴백 모드', e);
    renderFallback2D(canvas, product, initSize);
    return;
  }

  // Scene 설정
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x141414);

  const W = wrap.clientWidth;
  const H = wrap.clientHeight;
  const camera = new THREE.PerspectiveCamera(45, W / H, 0.01, 100);
  camera.position.set(0, 0.8, 2.2);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // 조명
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0x00e5ff, 0.8);
  dir.position.set(1, 2, 3);
  scene.add(dir);
  const dir2 = new THREE.DirectionalLight(0x7c4dff, 0.4);
  dir2.position.set(-1, 1, -2);
  scene.add(dir2);

  // 신체 모델 생성 (기존 myfit_index.html 로직 포팅)
  bodyGroup = buildBodyMesh(THREE, measurements);
  scene.add(bodyGroup);

  // 의류 모델
  clothingGroup = buildClothingMesh(THREE, measurements, product, initSize);
  scene.add(clothingGroup);

  // 드래그 회전
  let isDragging = false;
  let prevX = 0;
  canvas.addEventListener('mousedown', e => { isDragging = true; prevX = e.clientX; });
  canvas.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const dx = e.clientX - prevX;
    bodyGroup.rotation.y += dx * 0.01;
    clothingGroup.rotation.y += dx * 0.01;
    prevX = e.clientX;
  });
  canvas.addEventListener('mouseup', () => { isDragging = false; });
  canvas.addEventListener('mouseleave', () => { isDragging = false; });

  // 터치 지원
  let touchStartX = 0;
  canvas.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  canvas.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - touchStartX;
    bodyGroup.rotation.y += dx * 0.008;
    clothingGroup.rotation.y += dx * 0.008;
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  // 렌더 루프
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();

  threeScene = scene;
  threeCamera = camera;
  threeRenderer = renderer;
}

// ── 2D 폴백 (Three.js 로드 실패 시) ──
function renderFallback2D(canvas, product, size) {
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
  ctx.fillStyle = '#141414';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#00e5ff';
  ctx.font = '48px serif';
  ctx.textAlign = 'center';
  ctx.fillText('👗', canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#aaaaaa';
  ctx.fillText('3D 렌더링 로드 중...', canvas.width / 2, canvas.height / 2 + 30);
}

// ── 신체 메쉬 빌더 (myfit_index.html 로직 포팅) ──
function buildBodyMesh(THREE, m) {
  const g = new THREE.Group();
  const sk = new THREE.MeshPhongMaterial({ color: 0xd4a574, shininess: 30 });

  const H   = m.height / 100;
  const W   = m.weight;
  const bmi = W / (H * H);

  const headR   = H * 0.076;
  const neckH   = H * 0.040;
  const torsoH  = H * 0.305;
  const hipH    = H * 0.090;
  const thighH  = H * 0.235;
  const shinH   = H * 0.225;
  const footH   = H * 0.040;

  const fatFactor = 1 + Math.max(0, (bmi - 22) * 0.012);
  const chR = (m.chest / 100) / (2 * Math.PI) * fatFactor;
  const wR  = (m.waist / 100) / (2 * Math.PI) * fatFactor;
  const hR  = (m.hip   / 100) / (2 * Math.PI) * fatFactor;
  const shR = (m.shoulder / 100) / (2 * Math.PI) * 1.08;

  let y = 0;
  const mk = (geo, mat, x, yp, z) => {
    const mesh = new THREE.Mesh(geo, mat || sk);
    mesh.position.set(x || 0, yp, z || 0);
    g.add(mesh);
    return mesh;
  };

  // 발 → 머리 방향 쌓기
  // 발
  [-1,1].forEach(s => mk(new THREE.BoxGeometry(hR*0.9, footH, hR*2.4), sk, hR*0.35*s, footH/2, hR*0.9));
  y += footH;
  // 정강이
  [-1,1].forEach(s => mk(new THREE.CylinderGeometry(hR*0.22, hR*0.18, shinH, 14), sk, hR*0.36*s, y+shinH/2));
  y += shinH;
  // 허벅지
  [-1,1].forEach(s => mk(new THREE.CylinderGeometry(hR*0.29, hR*0.24, thighH, 14), sk, hR*0.35*s, y+thighH/2));
  y += thighH;
  // 엉덩이 + 복부
  mk(new THREE.CylinderGeometry(hR*1.03, hR*0.98, hipH, 20), sk, 0, y+hipH/2);
  y += hipH;
  mk(new THREE.CylinderGeometry(chR*1.0, wR*1.0, torsoH*0.5, 20), sk, 0, y+torsoH*0.25);
  mk(new THREE.CylinderGeometry(shR*0.95, chR*0.98, torsoH*0.5, 20), sk, 0, y+torsoH*0.75);
  y += torsoH;
  // 목
  mk(new THREE.CylinderGeometry(headR*0.55, headR*0.6, neckH, 12), sk, 0, y+neckH/2);
  y += neckH;
  // 머리
  mk(new THREE.SphereGeometry(headR, 16, 12), sk, 0, y+headR);
  // 팔
  const armY = y - torsoH * 0.15;
  const uAR = shR * 0.195;
  const lAR = uAR * 0.82;
  const uAH = H * 0.165;
  const lAH = H * 0.145;
  [-1,1].forEach(s => {
    mk(new THREE.CylinderGeometry(uAR, uAR*0.85, uAH, 12), sk, (shR+uAR)*s, armY-uAH/2);
    mk(new THREE.CylinderGeometry(lAR*0.9, lAR*0.75, lAH, 12), sk, (shR+uAR)*s, armY-uAH-lAH/2);
  });

  return g;
}

// ── 의류 메쉬 빌더 ──
function buildClothingMesh(THREE, m, product, size) {
  const g = new THREE.Group();
  const c = 0x2196F3; // 기본 파란색
  const mat = new THREE.MeshPhongMaterial({ color: c, shininess: 50, transparent: true, opacity: 0.92 });

  const H = m.height / 100;
  const chR = (m.chest / 100) / (2 * Math.PI);
  const wR  = (m.waist / 100) / (2 * Math.PI);
  const hR  = (m.hip   / 100) / (2 * Math.PI);
  const shR = (m.shoulder / 100) / (2 * Math.PI) * 1.08;

  const torsoH = H * 0.305;
  const hipH   = H * 0.090;
  const thighH = H * 0.235;
  const shinH  = H * 0.225;
  const footH  = H * 0.040;
  const neckH  = H * 0.040;
  const uAH    = H * 0.165;
  const lAH    = H * 0.145;
  const uAR    = shR * 0.195;
  const lAR    = uAR * 0.82;

  const crotchY = footH + shinH + thighH;
  const shoulderY = crotchY + torsoH + hipH * 0.5;
  const armX = (shR + uAR) * 1.02;

  const mk = (geo, yp, x) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x || 0, yp, 0);
    g.add(mesh);
  };

  const t = guessClothType(product?.name || '');

  if (t === 'tshirt' || t === 'shirt' || t === 'jacket') {
    mk(new THREE.CylinderGeometry(chR*1.09, wR*1.07, torsoH*0.6, 24), crotchY+hipH+torsoH*0.35);
    mk(new THREE.CylinderGeometry(chR*1.11, chR*1.09, torsoH*0.28, 24), crotchY+hipH+torsoH*0.76);
    const sleeveLen = t === 'tshirt' ? uAH*0.45 : (t === 'shirt' ? uAH : uAH);
    [-1,1].forEach(s => mk(new THREE.CylinderGeometry(uAR*1.12, uAR*1.08, sleeveLen, 14), shoulderY-sleeveLen/2, armX*s));
    if (t === 'shirt' || t === 'jacket') {
      [-1,1].forEach(s => mk(new THREE.CylinderGeometry(lAR*1.1, lAR*1.08, lAH, 14), shoulderY-uAH-lAH/2, armX*s));
    }
  }

  if (t === 'pants') {
    mk(new THREE.CylinderGeometry(hR*1.07, hR*1.05, hipH*0.7, 24), crotchY+hipH*0.35);
    [-1,1].forEach(s => {
      mk(new THREE.CylinderGeometry(hR*0.31, hR*0.28, thighH, 16), crotchY-thighH/2, hR*0.38*s);
      mk(new THREE.CylinderGeometry(hR*0.25, hR*0.22, shinH, 14), footH+shinH/2, hR*0.37*s);
    });
  }

  // 사이즈 스케일 적용
  applyScaleForSize(g, size);

  return g;
}

function guessClothType(name) {
  const n = name.toLowerCase();
  if (n.includes('재킷') || n.includes('jacket') || n.includes('코트') || n.includes('coat')) return 'jacket';
  if (n.includes('셔츠') || n.includes('shirt') || n.includes('블라우스')) return 'shirt';
  if (n.includes('팬츠') || n.includes('pants') || n.includes('바지') || n.includes('jean')) return 'pants';
  return 'tshirt';
}

const SIZE_SCALE_MAP = {
  XS:0.92, S:0.96, M:1.00, L:1.04, XL:1.09, '2XL':1.15,
  '26':0.92,'28':0.96,'30':0.99,'32':1.02,'34':1.06,'36':1.11,
  '250':0.96,'255':0.98,'260':1.01,'265':1.03,'270':1.05,'275':1.07,'280':1.10,
};

function applyScaleForSize(group, size) {
  const s = SIZE_SCALE_MAP[size] || 1.0;
  group.scale.set(s, 1.0, s);
}

function updateClothingScale(size) {
  if (!clothingGroup) return;
  applyScaleForSize(clothingGroup, size);
}

// ── 피팅 탭 전환 로직 ──
(function initFittingTabs() {
  const tab3d    = document.getElementById('tab-3d');
  const tabFit   = document.getElementById('tab-fit');
  const panel3d  = document.getElementById('panel-3d');
  const panelFit = document.getElementById('panel-fit');

  function activateTab(t) {
    tab3d.classList.toggle('active', t === '3d');
    tab3d.setAttribute('aria-selected', String(t === '3d'));
    tabFit.classList.toggle('active', t === 'fit');
    tabFit.setAttribute('aria-selected', String(t === 'fit'));

    panel3d.classList.toggle('hidden', t !== '3d');
    panelFit.classList.toggle('hidden', t !== 'fit');

    if (t === 'fit') window.fit2dRefresh?.();
  }

  tab3d.addEventListener('click', () => activateTab('3d'));
  tabFit.addEventListener('click', () => activateTab('fit'));
})();

// ── 구매 버튼 ──
// SEC-002 수정: chrome.tabs.update → window.open (tabs 권한 불필요, MV3 권고 방식)
document.getElementById('btn-buy').addEventListener('click', () => {
  if (!currentProduct?.url) return;
  // 상품 원본 URL을 새 탭에서 열기 (tabs 권한 없이 동작)
  window.open(currentProduct.url, '_blank', 'noopener,noreferrer');
});

// ── 동의 모달 로직 (CLO: 3항목 모두 필수) ──
(function initConsent() {
  const overlay    = document.getElementById('consent-overlay');
  const btnConfirm = document.getElementById('btn-consent-confirm');
  const checkAll      = document.getElementById('check-all');
  const checkPrivacy  = document.getElementById('check-privacy');
  const checkAffiliate = document.getElementById('check-affiliate');

  function updateAllState() {
    const allChecked = checkPrivacy.classList.contains('checked')
                    && checkAffiliate.classList.contains('checked');
    checkAll.classList.toggle('checked', allChecked);
    btnConfirm.disabled = !allChecked;
  }

  document.getElementById('consent-item-privacy').addEventListener('click', () => {
    checkPrivacy.classList.toggle('checked');
    updateAllState();
  });
  document.getElementById('consent-item-affiliate').addEventListener('click', () => {
    checkAffiliate.classList.toggle('checked');
    updateAllState();
  });
  document.getElementById('consent-all-btn').addEventListener('click', () => {
    const target = !checkAll.classList.contains('checked');
    checkAll.classList.toggle('checked', target);
    checkPrivacy.classList.toggle('checked', target);
    checkAffiliate.classList.toggle('checked', target);
    btnConfirm.disabled = !target;
  });

  btnConfirm.addEventListener('click', () => {
    // SEC-006 수정: localStorage → chrome.storage.local
    chrome.storage.local.set({ myfit_consented: '1' });
    overlay.classList.add('hidden');
    showScreen('manual');
  });
})();

// ── 2D 핏 분석 탭 ──
(function initFit2DTab() {
  // ── roundRect 폴리필 (Safari/구버전 Chrome) ──
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
      this.beginPath();
      this.moveTo(x + r, y);
      this.lineTo(x + w - r, y);
      this.quadraticCurveTo(x + w, y, x + w, y + r);
      this.lineTo(x + w, y + h - r);
      this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      this.lineTo(x + r, y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - r);
      this.lineTo(x, y + r);
      this.quadraticCurveTo(x, y, x + r, y);
      this.closePath();
    };
  }

  const SIZE_CHARTS = {
    nike: {
      tshirt: { XS:{shoulder:41,chest:88,length:68,sleeve:19}, S:{shoulder:43,chest:93,length:70,sleeve:20}, M:{shoulder:45,chest:98,length:72,sleeve:21}, L:{shoulder:47,chest:103,length:74,sleeve:22}, XL:{shoulder:49,chest:108,length:76,sleeve:23}, '2XL':{shoulder:52,chest:116,length:79,sleeve:24} },
      shirt:  { XS:{shoulder:43,chest:92,length:71,sleeve:59}, S:{shoulder:45,chest:97,length:73,sleeve:61}, M:{shoulder:47,chest:102,length:75,sleeve:63}, L:{shoulder:49,chest:107,length:77,sleeve:65}, XL:{shoulder:51,chest:112,length:79,sleeve:67}, '2XL':{shoulder:54,chest:120,length:82,sleeve:69} },
      hoodie: { XS:{shoulder:44,chest:96,length:65,sleeve:60}, S:{shoulder:46,chest:102,length:67,sleeve:62}, M:{shoulder:48,chest:108,length:69,sleeve:64}, L:{shoulder:50,chest:114,length:71,sleeve:66}, XL:{shoulder:52,chest:120,length:73,sleeve:68}, '2XL':{shoulder:55,chest:128,length:76,sleeve:70} },
      pants:  { XS:{waist:64,hip:88,length:98,thigh:52}, S:{waist:69,hip:93,length:100,thigh:55}, M:{waist:74,hip:98,length:102,thigh:58}, L:{waist:80,hip:104,length:104,thigh:61}, XL:{waist:86,hip:110,length:106,thigh:64}, '2XL':{waist:94,hip:118,length:108,thigh:68} },
    },
    uniqlo: {
      tshirt: { XS:{shoulder:40,chest:86,length:65,sleeve:18}, S:{shoulder:42,chest:90,length:67,sleeve:19}, M:{shoulder:44,chest:96,length:69,sleeve:20}, L:{shoulder:46,chest:102,length:71,sleeve:21}, XL:{shoulder:48,chest:108,length:73,sleeve:22}, '2XL':{shoulder:51,chest:116,length:76,sleeve:23} },
      shirt:  { XS:{shoulder:41,chest:88,length:68,sleeve:57}, S:{shoulder:43,chest:92,length:70,sleeve:59}, M:{shoulder:45,chest:98,length:72,sleeve:61}, L:{shoulder:47,chest:104,length:74,sleeve:63}, XL:{shoulder:49,chest:110,length:76,sleeve:65}, '2XL':{shoulder:52,chest:118,length:79,sleeve:67} },
      hoodie: { XS:{shoulder:42,chest:92,length:62,sleeve:58}, S:{shoulder:44,chest:98,length:64,sleeve:60}, M:{shoulder:46,chest:104,length:66,sleeve:62}, L:{shoulder:48,chest:110,length:68,sleeve:64}, XL:{shoulder:50,chest:116,length:70,sleeve:66}, '2XL':{shoulder:53,chest:124,length:73,sleeve:68} },
      pants:  { XS:{waist:62,hip:86,length:96,thigh:50}, S:{waist:67,hip:91,length:98,thigh:53}, M:{waist:72,hip:96,length:100,thigh:56}, L:{waist:78,hip:102,length:102,thigh:59}, XL:{waist:84,hip:108,length:104,thigh:62}, '2XL':{waist:92,hip:116,length:106,thigh:66} },
    },
    zara: {
      tshirt: { XS:{shoulder:40,chest:84,length:66,sleeve:17}, S:{shoulder:42,chest:88,length:68,sleeve:18}, M:{shoulder:44,chest:94,length:70,sleeve:19}, L:{shoulder:46,chest:100,length:72,sleeve:20}, XL:{shoulder:48,chest:106,length:74,sleeve:21}, '2XL':{shoulder:51,chest:114,length:77,sleeve:22} },
      shirt:  { XS:{shoulder:42,chest:88,length:70,sleeve:58}, S:{shoulder:44,chest:94,length:72,sleeve:60}, M:{shoulder:46,chest:100,length:74,sleeve:62}, L:{shoulder:48,chest:106,length:76,sleeve:64}, XL:{shoulder:50,chest:112,length:78,sleeve:66}, '2XL':{shoulder:53,chest:120,length:81,sleeve:68} },
      hoodie: { XS:{shoulder:43,chest:90,length:63,sleeve:58}, S:{shoulder:45,chest:96,length:65,sleeve:60}, M:{shoulder:47,chest:102,length:67,sleeve:62}, L:{shoulder:49,chest:108,length:69,sleeve:64}, XL:{shoulder:51,chest:114,length:71,sleeve:66}, '2XL':{shoulder:54,chest:122,length:74,sleeve:68} },
      pants:  { XS:{waist:60,hip:84,length:95,thigh:49}, S:{waist:65,hip:89,length:97,thigh:52}, M:{waist:70,hip:94,length:99,thigh:55}, L:{waist:76,hip:100,length:101,thigh:58}, XL:{waist:82,hip:106,length:103,thigh:61}, '2XL':{waist:90,hip:114,length:105,thigh:65} },
    },
    generic: {
      tshirt: { XS:{shoulder:40,chest:86,length:66,sleeve:18}, S:{shoulder:42,chest:90,length:68,sleeve:19}, M:{shoulder:44,chest:96,length:70,sleeve:20}, L:{shoulder:46,chest:102,length:72,sleeve:21}, XL:{shoulder:48,chest:108,length:74,sleeve:22}, '2XL':{shoulder:51,chest:116,length:77,sleeve:23} },
      shirt:  { XS:{shoulder:42,chest:88,length:70,sleeve:58}, S:{shoulder:44,chest:94,length:72,sleeve:60}, M:{shoulder:46,chest:100,length:74,sleeve:62}, L:{shoulder:48,chest:106,length:76,sleeve:64}, XL:{shoulder:50,chest:112,length:78,sleeve:66}, '2XL':{shoulder:53,chest:120,length:81,sleeve:68} },
      hoodie: { XS:{shoulder:43,chest:92,length:64,sleeve:59}, S:{shoulder:45,chest:98,length:66,sleeve:61}, M:{shoulder:47,chest:104,length:68,sleeve:63}, L:{shoulder:49,chest:110,length:70,sleeve:65}, XL:{shoulder:51,chest:116,length:72,sleeve:67}, '2XL':{shoulder:54,chest:124,length:75,sleeve:69} },
      pants:  { XS:{waist:62,hip:86,length:96,thigh:50}, S:{waist:67,hip:91,length:98,thigh:53}, M:{waist:72,hip:96,length:100,thigh:56}, L:{waist:78,hip:102,length:102,thigh:59}, XL:{waist:84,hip:108,length:104,thigh:62}, '2XL':{waist:92,hip:116,length:106,thigh:66} },
    },
  };

  // ── 상태 ──
  let f2ShowBody = true, f2ShowCloth = true, f2ShowFitColor = true;
  let f2Result = null;

  // ── DOM ──
  const canvas   = document.getElementById('fit2d-canvas');
  const ctx      = canvas.getContext('2d');
  const selType  = document.getElementById('fit2d-type');
  const selBrand = document.getElementById('fit2d-brand');

  // ── 캔버스 크기 동기화 ──
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    canvas.width  = rect.width  * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    if (f2Result) drawFitting(f2Result);
  }
  window.addEventListener('resize', resizeCanvas);
  // expose refresh for tab activation
  window.fit2dRefresh = () => { resizeCanvas(); autoRun(); };

  // ── 핏 계산 ──
  function calcFit(user, chart, type) {
    if (type === 'pants') {
      return {
        waist:  { diff: chart.waist - user.waist,            label: '허리 여유',   chartVal: chart.waist },
        hip:    { diff: chart.hip   - user.hip,              label: '엉덩이 여유', chartVal: chart.hip },
        length: { diff: null, label: '총장',                   chartVal: chart.length },
        thigh:  { diff: chart.thigh - (user.hip * 0.55),     label: '허벅지 여유', chartVal: chart.thigh },
      };
    }
    return {
      shoulder: { diff: chart.shoulder - user.shoulder, label: '어깨 여유',  chartVal: chart.shoulder },
      chest:    { diff: chart.chest    - user.chest,    label: '가슴 여유',  chartVal: chart.chest },
      length:   { diff: null, label: '총장',              chartVal: chart.length },
      sleeve:   { diff: null, label: '소매길이',           chartVal: chart.sleeve },
    };
  }

  function fitGrade(diff) {
    if (diff === null) return 'neutral';
    if (diff < -2)  return 'tight';
    if (diff > 12)  return 'loose';
    if (diff >= 4 && diff <= 10) return 'good';
    if (diff >= -2 && diff < 4)  return 'snug';
    return 'warn';
  }

  function gradeColor(grade) {
    return { tight:'#ff5252', snug:'#ff9800', good:'#00c853', loose:'#00b0ff', warn:'#ff9800', neutral:'#888888' }[grade] || '#888';
  }

  function gradeLabel(grade, diff) {
    if (diff === null) return '—';
    if (grade === 'tight') return `끼임 ${Math.abs(diff).toFixed(1)}cm`;
    if (grade === 'snug')  return `슬림 +${diff.toFixed(1)}cm`;
    if (grade === 'good')  return `적정 +${diff.toFixed(1)}cm`;
    if (grade === 'loose') return `여유 +${diff.toFixed(1)}cm`;
    return `+${diff.toFixed(1)}cm`;
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function recommendSize(user, brand, type) {
    const chart = SIZE_CHARTS[brand]?.[type];
    if (!chart) return 'M';
    let best = 'M', minScore = Infinity;
    const isPants = type === 'pants';
    Object.entries(chart).forEach(([size, d]) => {
      const score = isPants
        ? Math.abs(d.waist - user.waist - 5) + Math.abs(d.hip - user.hip - 5)
        : Math.abs(d.shoulder - user.shoulder - 3) + Math.abs(d.chest - user.chest - 6);
      if (score < minScore) { minScore = score; best = size; }
    });
    return best;
  }

  // ── 캔버스 드로잉 함수 ──
  function drawFitLabel(ctx, x, y, text, color, align = 'left') {
    ctx.save();
    ctx.font = 'bold 10px -apple-system, sans-serif';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const pad = 4, tw = ctx.measureText(text).width;
    const bx = align === 'center' ? x - tw/2 - pad : x - pad;
    ctx.fillStyle = 'rgba(10,10,10,0.75)';
    ctx.beginPath(); ctx.roundRect(bx, y-7, tw + pad*2, 14, 3); ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawLegend(ctx, W, H) {
    const items = [{color:'#ff5252',label:'끼임'},{color:'#ff9800',label:'슬림'},{color:'#00c853',label:'적정'},{color:'#00b0ff',label:'여유'}];
    let x = 8;
    ctx.save(); ctx.font = '9px sans-serif'; ctx.textBaseline = 'middle';
    items.forEach(({color,label}) => {
      ctx.fillStyle = color; ctx.fillRect(x, H-12, 7, 7);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillText(label, x+10, H-8);
      x += ctx.measureText(label).width + 22;
    });
    ctx.restore();
  }

  function drawBodySilhouette(ctx, user, scale, cx, topY, W, H) {
    const h   = user.height;
    const bmi = user.weight / ((h/100)**2);
    const fat = Math.max(1, 1+(bmi-22)*0.018);
    const headH=h*0.130, neckH=h*0.040, torsoH=h*0.300, hipH=h*0.080, thighH=h*0.230, shinH=h*0.220;
    const shoulderW=user.shoulder*scale*fat, chestW=(user.chest/Math.PI)*scale*fat;
    const waistW=(user.waist/Math.PI)*scale*fat*0.92, hipW=(user.hip/Math.PI)*scale*fat;
    const thighW=hipW*0.52, shinW=thighW*0.65, ankleW=shinW*0.70;
    const headR=headH*scale*0.42, neckW=shoulderW*0.22;

    let y = topY;
    const headCY = y + headR;
    ctx.beginPath(); ctx.ellipse(cx, headCY, headR*0.78, headR, 0, 0, Math.PI*2);
    ctx.fillStyle='rgba(190,155,120,0.30)'; ctx.fill();
    ctx.strokeStyle='rgba(190,155,120,0.55)'; ctx.lineWidth=1.5; ctx.stroke();

    y += headH*scale + neckH*scale*0.3;
    const shoulderY=y, torsoEndY=y+torsoH*scale, hipEndY=torsoEndY+hipH*scale;

    ctx.beginPath();
    ctx.moveTo(cx-neckW*0.5, shoulderY);
    ctx.bezierCurveTo(cx-shoulderW*0.5,shoulderY+2, cx-waistW*0.5,torsoEndY-10, cx-hipW*0.5,hipEndY);
    ctx.lineTo(cx, hipEndY+4);
    ctx.lineTo(cx+hipW*0.5, hipEndY);
    ctx.bezierCurveTo(cx+waistW*0.5,torsoEndY-10, cx+shoulderW*0.5,shoulderY+2, cx+neckW*0.5,shoulderY);
    ctx.closePath();
    ctx.fillStyle='rgba(190,155,120,0.22)'; ctx.fill();
    ctx.strokeStyle='rgba(190,155,120,0.50)'; ctx.lineWidth=1.5; ctx.stroke();

    const armTopY=shoulderY+4, armBotY=shoulderY+(torsoH*0.78)*scale, armW=shoulderW*0.16;
    ['left','right'].forEach(side => {
      const sign=side==='left'?-1:1, ax=cx+sign*(shoulderW*0.5+armW*0.3);
      ctx.beginPath();
      ctx.moveTo(ax-armW*sign*0.1, armTopY);
      ctx.quadraticCurveTo(ax+sign*armW*0.6,(armTopY+armBotY)/2, ax+sign*armW*0.2,armBotY);
      ctx.lineWidth=armW*1.1; ctx.lineCap='round';
      ctx.strokeStyle='rgba(190,155,120,0.30)'; ctx.stroke(); ctx.lineCap='butt';
    });

    const legTopY=hipEndY, legMidY=legTopY+thighH*scale, legBotY=legMidY+shinH*scale;
    [[-1,thighW,shinW,ankleW],[1,thighW,shinW,ankleW]].forEach(([sign,tw,sw,aw]) => {
      const legCX=cx+sign*hipW*0.25;
      ctx.beginPath();
      ctx.moveTo(legCX-sign*tw*0.4, legTopY);
      ctx.bezierCurveTo(legCX-sign*tw*0.5,legTopY+thighH*scale*0.4, legCX-sign*sw*0.4,legTopY+thighH*scale*0.7, legCX-sign*sw*0.3,legMidY);
      ctx.lineTo(legCX-sign*aw*0.3,legBotY); ctx.lineTo(legCX+sign*aw*0.3,legBotY); ctx.lineTo(legCX+sign*sw*0.3,legMidY);
      ctx.bezierCurveTo(legCX+sign*sw*0.4,legTopY+thighH*scale*0.7, legCX+sign*tw*0.5,legTopY+thighH*scale*0.4, legCX+sign*tw*0.4,legTopY);
      ctx.closePath();
      ctx.fillStyle='rgba(190,155,120,0.20)'; ctx.fill();
      ctx.strokeStyle='rgba(190,155,120,0.40)'; ctx.lineWidth=1.2; ctx.stroke();
    });
  }

  function drawTopSilhouette(ctx, user, chart, fit, type, scale, cx, topY, W, H) {
    const h=user.height, headH=h*0.130, neckH=h*0.040;
    const topStartY=topY+(headH+neckH)*scale;
    const cShoulderW=chart.shoulder*scale, cChestW=(chart.chest/Math.PI)*scale;
    const cLength=chart.length*scale, cSleeve=chart.sleeve*scale;
    const shoulderGrade=fit.shoulder?fitGrade(fit.shoulder.diff):'neutral';
    const chestGrade=fit.chest?fitGrade(fit.chest.diff):'neutral';
    const clothEndY=topStartY+cLength, shWidth=cShoulderW*0.5, chWidth=cChestW*0.5;

    ctx.beginPath();
    ctx.moveTo(cx-shWidth*0.18, topStartY);
    ctx.lineTo(cx-shWidth, topStartY+cLength*0.06);
    if (type!=='tshirt') {
      ctx.lineTo(cx-shWidth-cSleeve, topStartY+cLength*0.06+cSleeve*0.22);
      ctx.lineTo(cx-shWidth-cSleeve, topStartY+cLength*0.06+cSleeve*0.22+8);
      ctx.lineTo(cx-shWidth, topStartY+cLength*0.13);
    } else {
      ctx.lineTo(cx-shWidth-cSleeve*0.28, topStartY+cLength*0.08);
      ctx.lineTo(cx-shWidth, topStartY+cLength*0.14);
    }
    ctx.bezierCurveTo(cx-chWidth*0.92,topStartY+cLength*0.5, cx-chWidth*0.98,topStartY+cLength*0.75, cx-chWidth*0.95,clothEndY);
    ctx.lineTo(cx+chWidth*0.95, clothEndY);
    ctx.bezierCurveTo(cx+chWidth*0.98,topStartY+cLength*0.75, cx+chWidth*0.92,topStartY+cLength*0.5, cx+shWidth,topStartY+cLength*0.13);
    if (type!=='tshirt') {
      ctx.lineTo(cx+shWidth+cSleeve, topStartY+cLength*0.06+cSleeve*0.22+8);
      ctx.lineTo(cx+shWidth+cSleeve, topStartY+cLength*0.06+cSleeve*0.22);
      ctx.lineTo(cx+shWidth, topStartY+cLength*0.06);
    } else {
      ctx.lineTo(cx+shWidth+cSleeve*0.28, topStartY+cLength*0.08);
      ctx.lineTo(cx+shWidth, topStartY+cLength*0.06);
    }
    ctx.lineTo(cx+shWidth*0.18, topStartY);
    ctx.closePath();

    if (f2ShowFitColor) {
      const avg=shoulderGrade==='tight'||chestGrade==='tight'?'tight':shoulderGrade==='good'&&chestGrade==='good'?'good':'warn';
      ctx.fillStyle=hexToRgba(gradeColor(avg),0.18);
    } else { ctx.fillStyle='rgba(100,100,200,0.15)'; }
    ctx.fill();
    ctx.lineWidth=2;
    ctx.strokeStyle=f2ShowFitColor?gradeColor(shoulderGrade):'rgba(150,150,255,0.7)';
    ctx.stroke();

    if (f2ShowFitColor && fit.shoulder?.diff!==null) {
      drawFitLabel(ctx, cx-shWidth*0.7, topStartY+cLength*0.08, `어깨 ${gradeLabel(fitGrade(fit.shoulder.diff),fit.shoulder.diff)}`, gradeColor(fitGrade(fit.shoulder.diff)));
    }
    if (f2ShowFitColor && fit.chest?.diff!==null) {
      drawFitLabel(ctx, cx-chWidth*0.6, topStartY+cLength*0.35, `가슴 ${gradeLabel(fitGrade(fit.chest.diff),fit.chest.diff)}`, gradeColor(fitGrade(fit.chest.diff)));
    }
  }

  function drawPantsSilhouette(ctx, user, chart, fit, scale, cx, topY, W, H) {
    const h=user.height, headH=h*0.130, neckH=h*0.040, torsoH=h*0.300, hipH=h*0.080;
    const pantsTopY=topY+(headH+neckH+torsoH+hipH)*scale;
    const cLength=chart.length*scale, cHipW=(chart.hip/Math.PI)*scale;
    const cWaistW=(chart.waist/Math.PI)*scale, cThighW=chart.thigh*scale*0.32;
    const pantsEndY=pantsTopY+cLength;
    const waistGrade=fit.waist?fitGrade(fit.waist.diff):'neutral';
    const hipGrade=fit.hip?fitGrade(fit.hip.diff):'neutral';

    ctx.beginPath();
    ctx.moveTo(cx-cWaistW*0.45, pantsTopY);
    ctx.bezierCurveTo(cx-cHipW*0.5,pantsTopY+cLength*0.15, cx-cThighW*0.9,pantsTopY+cLength*0.5, cx-cThighW*0.55,pantsEndY);
    ctx.lineTo(cx-cThighW*0.1,pantsEndY); ctx.lineTo(cx,pantsTopY+cLength*0.62); ctx.lineTo(cx,pantsTopY+cLength*0.15);
    ctx.lineTo(cx-cWaistW*0.45,pantsTopY); ctx.closePath();
    ctx.fillStyle=f2ShowFitColor?hexToRgba(gradeColor(waistGrade),0.18):'rgba(100,180,100,0.15)'; ctx.fill();
    ctx.strokeStyle=f2ShowFitColor?gradeColor(waistGrade):'rgba(100,200,100,0.6)'; ctx.lineWidth=2; ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx+cWaistW*0.45, pantsTopY);
    ctx.bezierCurveTo(cx+cHipW*0.5,pantsTopY+cLength*0.15, cx+cThighW*0.9,pantsTopY+cLength*0.5, cx+cThighW*0.55,pantsEndY);
    ctx.lineTo(cx+cThighW*0.1,pantsEndY); ctx.lineTo(cx,pantsTopY+cLength*0.62); ctx.lineTo(cx,pantsTopY+cLength*0.15);
    ctx.lineTo(cx+cWaistW*0.45,pantsTopY); ctx.closePath();
    ctx.fillStyle=f2ShowFitColor?hexToRgba(gradeColor(hipGrade),0.18):'rgba(100,180,100,0.15)'; ctx.fill();
    ctx.strokeStyle=f2ShowFitColor?gradeColor(hipGrade):'rgba(100,200,100,0.6)'; ctx.lineWidth=2; ctx.stroke();

    if (f2ShowFitColor && fit.waist?.diff!==null) {
      drawFitLabel(ctx, cx-cWaistW*0.5, pantsTopY+cLength*0.05, `허리 ${gradeLabel(waistGrade,fit.waist.diff)}`, gradeColor(waistGrade));
    }
  }

  function drawFitting(result) {
    const { user, chart, fit, type } = result;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width || canvas.offsetWidth || 260;
    const H = rect.height || canvas.offsetHeight || 320;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle='#0a0a0a'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(255,255,255,0.03)'; ctx.lineWidth=1;
    for (let x2=0; x2<W; x2+=40) { ctx.beginPath(); ctx.moveTo(x2,0); ctx.lineTo(x2,H); ctx.stroke(); }
    for (let y2=0; y2<H; y2+=40) { ctx.beginPath(); ctx.moveTo(0,y2); ctx.lineTo(W,y2); ctx.stroke(); }

    const scale=(H*0.88)/user.height, cx=W*0.5, topY=H*0.06;

    if (f2ShowBody) drawBodySilhouette(ctx, user, scale, cx, topY, W, H);
    if (f2ShowCloth) {
      if (type==='pants') drawPantsSilhouette(ctx, user, chart, fit, scale, cx, topY, W, H);
      else drawTopSilhouette(ctx, user, chart, fit, type, scale, cx, topY, W, H);
    }
    drawLegend(ctx, W, H);
  }

  function renderFit2DCards(result) {
    const { fit, chart, type } = result;
    const container = document.getElementById('fit2d-cards');
    container.textContent = '';

    Object.values(fit).forEach(({ diff, label, chartVal }) => {
      const grade = fitGrade(diff);
      const card = document.createElement('div');
      card.className = 'fit2d-card ' + (grade==='good'?'good':grade==='tight'?'tight':'warn');

      const lEl = document.createElement('div'); lEl.className='fit2d-card-label'; lEl.textContent=label;
      const vEl = document.createElement('div'); vEl.className='fit2d-card-value';
      const dEl = document.createElement('div'); dEl.className='fit2d-card-detail';

      if (diff !== null) {
        vEl.textContent = gradeLabel(grade, diff);
        vEl.style.color = gradeColor(grade);
        dEl.textContent = `옷 ${chartVal}cm`;
      } else {
        vEl.textContent = (chartVal||0)+'cm';
        vEl.style.color = '#888';
        dEl.textContent = '차트 기준';
      }
      card.appendChild(lEl); card.appendChild(vEl); card.appendChild(dEl);
      container.appendChild(card);
    });

    const best = recommendSize(result.user, result.brand, result.type);
    document.getElementById('fit2d-rec-badge').textContent = best;

    const recCard = document.createElement('div'); recCard.className='fit2d-card good'; recCard.style.borderLeftColor='#00e5ff';
    const rl=document.createElement('div'); rl.className='fit2d-card-label'; rl.textContent='추천 사이즈';
    const rv=document.createElement('div'); rv.className='fit2d-card-value'; rv.textContent=best; rv.style.color='#00e5ff';
    const rd=document.createElement('div'); rd.className='fit2d-card-detail'; rd.textContent=`${result.brand.toUpperCase()} ${result.type} 기준`;
    recCard.appendChild(rl); recCard.appendChild(rv); recCard.appendChild(rd);
    container.appendChild(recCard);
  }

  function updateBodyInfo(user) {
    const el = document.getElementById('fit2d-body-info');
    if (!el) return;
    // SEC-CISO: innerHTML 금지 → DOM API 직접 생성
    el.textContent = '';
    const s1 = document.createElement('span');
    s1.textContent = `키 ${user.height}cm · 몸무게 ${user.weight}kg`;
    const s2 = document.createElement('span');
    s2.textContent = `어깨 ${user.shoulder}cm · 가슴 ${user.chest}cm · 허리 ${user.waist}cm · 엉덩이 ${user.hip}cm`;
    el.appendChild(s1);
    el.appendChild(s2);
  }

  function getUser() {
    return {
      height:   measurements.height   || 175,
      weight:   measurements.weight   || 70,
      shoulder: measurements.shoulder || 42,
      chest:    measurements.chest    || 94,
      waist:    measurements.waist    || 78,
      hip:      measurements.hip      || 96,
    };
  }

  function getSelectedSize() {
    const active = document.querySelector('#fit2d-size-btns .fit2d-size-btn.active');
    return active?.dataset.size || 'M';
  }

  function autoRun() {
    resizeCanvas();
    const user  = getUser();
    const brand = selBrand.value;
    const type  = selType.value;
    const size  = getSelectedSize();
    const chart = SIZE_CHARTS[brand]?.[type]?.[size];
    if (!chart) return;

    const fit = calcFit(user, chart, type);
    f2Result  = { user, chart, fit, brand, type, size };
    drawFitting(f2Result);
    renderFit2DCards(f2Result);
    updateBodyInfo(user);
  }

  // ── 이벤트 연결 ──
  selType.addEventListener('change', autoRun);
  selBrand.addEventListener('change', autoRun);

  document.getElementById('fit2d-size-btns').addEventListener('click', e => {
    const btn = e.target.closest('.fit2d-size-btn');
    if (!btn) return;
    document.querySelectorAll('#fit2d-size-btns .fit2d-size-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    autoRun();
  });

  function bindTog(id, setter) {
    const btn = document.getElementById(id);
    btn?.addEventListener('click', () => {
      btn.classList.toggle('active');
      setter(btn.classList.contains('active'));
      if (f2Result) drawFitting(f2Result);
    });
  }
  bindTog('fit2d-tog-body',     v => f2ShowBody = v);
  bindTog('fit2d-tog-cloth',    v => f2ShowCloth = v);
  bindTog('fit2d-tog-fitcolor', v => f2ShowFitColor = v);
})();

// ── 실행 ──
init();

