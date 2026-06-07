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

  // 사이즈 타입 결정
  const sizes = detectSizeType(product);
  const recommendedSize = calcRecommendedSize(measurements, sizes.type);

  renderSizeButtons(sizes.list, recommendedSize);
  selectedSize = recommendedSize;

  // 추천 배지 업데이트
  document.getElementById('rec-size-badge').textContent = '추천: ' + recommendedSize;

  showScreen('fitting');
  initThreeJS(product, recommendedSize);
  updateFitScores(recommendedSize, sizes.type);
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

  const scores = calcFitScores(size, type);

  updateFitRow('fit-shoulder', scores.shoulder);
  updateFitRow('fit-chest', scores.chest);
  updateFitRow('fit-waist', scores.waist);
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

// ──────────────────────────────────────────────
// FASHN AI 피팅 — Cloudflare Worker 프록시 경유
// ──────────────────────────────────────────────

/**
 * CF Worker URL: 배포 후 실제 subdomain으로 교체
 * wrangler deploy 완료 후 터미널 출력에서 확인 가능
 * 예: https://myfit-fashn-proxy.kgg2512.workers.dev
 */
const CF_WORKER_URL = 'https://myfit-fashn-proxy.kgg2512.workers.dev';

/**
 * 이미지 File 객체를 base64 문자열로 변환
 * @param {File} file
 * @returns {Promise<string>} base64 (data: URI prefix 제거)
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // data:image/jpeg;base64,XXXX → XXXX 만 추출
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('base64 변환 실패'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsDataURL(file);
  });
}

/**
 * FASHN 베타 1인1회 쿼터 체크
 * chrome.storage.local의 fashnUsed 플래그로 사용 여부 확인
 * @returns {Promise<boolean>} true = 사용 가능, false = 이미 사용함
 */
async function checkFashnQuota() {
  const { fashnUsed } = await chrome.storage.local.get('fashnUsed');
  if (fashnUsed) {
    showAiFittingError('이미 AI 피팅을 체험하셨어요! 정식 출시 후 무제한으로 이용하실 수 있습니다.');
    return false;
  }
  return true;
}

/**
 * FASHN AI 가상 피팅 요청
 * @param {File} userPhotoFile - 사용자 업로드 사진
 * @param {string} garmentImageUrl - 쇼핑몰 상품 이미지 https:// URL
 * @param {'tops'|'bottoms'} category
 * @returns {Promise<{output_image_url: string}>}
 */
async function requestFashnFit(userPhotoFile, garmentImageUrl, category) {
  // Step 1: File → base64 (메모리 내 처리, 서버 전송 후 JS GC에 의해 해제)
  const base64Image = await fileToBase64(userPhotoFile);

  // Step 2: CF Worker 호출 (Worker → FASHN API)
  const response = await fetch(`${CF_WORKER_URL}/try-on`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      human_image: base64Image,
      garment_image_url: garmentImageUrl,
      category,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    // 크레딧 소진 특별 처리
    if (response.status === 402 || data.code === 'CREDITS_EXHAUSTED') {
      throw new Error('AI 피팅 크레딧이 소진되었습니다. 잠시 후 다시 시도해 주세요.');
    }
    if (response.status === 429) {
      const wait = data.retryAfter ? `${data.retryAfter}초 후` : '잠시 후';
      throw new Error(`요청이 너무 많습니다. ${wait} 다시 시도해 주세요.`);
    }
    throw new Error(data.error || `서버 오류 (${response.status})`);
  }

  if (!data.output_image_url) {
    throw new Error('AI 피팅 결과를 받지 못했습니다.');
  }

  return data;
}

// ── 단계별 로딩 진행 타이머 ──
let _loadingTimers = [];

const LOADING_STEPS = [
  { id: 'ai-step-1', label: '사진 분석 중', tip: '정면 사진일수록 결과가 정확합니다', bar: 10 },
  { id: 'ai-step-2', label: '옷 패턴 매핑', tip: 'AI가 의류의 질감과 형태를 분석합니다', bar: 45 },
  { id: 'ai-step-3', label: '피팅 이미지 생성', tip: '거의 다 됐어요! 잠시만 기다려주세요', bar: 85 },
];

function startLoadingSteps() {
  _loadingTimers.forEach(clearTimeout);
  _loadingTimers = [];

  const bar     = document.getElementById('ai-loading-bar');
  const tipEl   = document.getElementById('ai-loading-tip');
  const stepEls = LOADING_STEPS.map(s => document.getElementById(s.id));

  // 초기화
  stepEls.forEach(el => {
    if (!el) return;
    el.classList.remove('active', 'done');
    const dot = el.querySelector('.ai-step-dot');
    if (dot) { dot.classList.remove('ai-step-dot--active'); }
  });
  if (bar) bar.style.width = '5%';

  // Step 1 즉시 활성
  activateStep(0, bar, tipEl, stepEls);

  // Step 2: 7초 후
  _loadingTimers.push(setTimeout(() => activateStep(1, bar, tipEl, stepEls), 7000));
  // Step 3: 18초 후
  _loadingTimers.push(setTimeout(() => activateStep(2, bar, tipEl, stepEls), 18000));
}

function activateStep(idx, bar, tipEl, stepEls) {
  // 이전 단계 done 처리
  for (let i = 0; i < idx; i++) {
    if (!stepEls[i]) continue;
    stepEls[i].classList.remove('active');
    stepEls[i].classList.add('done');
    const dot = stepEls[i].querySelector('.ai-step-dot');
    if (dot) dot.classList.remove('ai-step-dot--active');
  }
  // 현재 단계 active
  if (stepEls[idx]) {
    stepEls[idx].classList.add('active');
    const dot = stepEls[idx].querySelector('.ai-step-dot');
    if (dot) dot.classList.add('ai-step-dot--active');
  }
  if (bar) bar.style.width = LOADING_STEPS[idx].bar + '%';
  if (tipEl) tipEl.textContent = LOADING_STEPS[idx].tip;
}

function finishLoadingSteps() {
  _loadingTimers.forEach(clearTimeout);
  _loadingTimers = [];
  const bar = document.getElementById('ai-loading-bar');
  if (bar) bar.style.width = '100%';
}

// ── 피팅 탭 UI 상태 헬퍼 ──
function setAiFittingLoading(isLoading, message) {
  const loadingEl  = document.getElementById('ai-loading');
  const loadingTxt = document.getElementById('ai-loading-text');
  const btnFit     = document.getElementById('btn-fashn-fit');

  if (isLoading) {
    loadingEl.classList.remove('hidden');
    loadingEl.classList.add('visible');
    startLoadingSteps();
  } else {
    finishLoadingSteps();
    loadingEl.classList.remove('visible');
    loadingEl.classList.add('hidden');
  }
  btnFit.disabled = isLoading;
  if (message && loadingTxt) loadingTxt.textContent = message;
}

function showAiFittingError(message) {
  const errEl = document.getElementById('ai-error');
  errEl.classList.remove('hidden');
  errEl.textContent = message; // textContent — XSS 방지
}

function clearAiFittingError() {
  const errEl = document.getElementById('ai-error');
  errEl.classList.add('hidden');
  errEl.textContent = '';
}

function showAiFittingResult(imageUrl) {
  const resultWrap = document.getElementById('ai-result-wrap');
  const resultImg  = document.getElementById('fashn-result');
  // hidden/visible 이중 클래스 처리 (CSS에서 visible로 display:flex)
  resultWrap.classList.remove('hidden');
  resultWrap.classList.add('visible');
  resultImg.src = imageUrl;
  resultImg.alt = 'AI 피팅 결과 — ' + (currentProduct?.name || '상품');

  // PMF 버튼 초기화 (재시도 시 리셋)
  document.getElementById('btn-pmf-yes')?.classList.remove('selected');
  document.getElementById('btn-pmf-no')?.classList.remove('selected');
  const thanks = document.querySelector('.ai-pmf-thanks');
  if (thanks) thanks.classList.remove('visible');
}

// ── FASHN 피팅 탭 이벤트 바인딩 ──
(function initFashnTab() {
  const photoInput   = document.getElementById('ai-photo-input');
  const uploadLabel  = document.getElementById('ai-upload-label');
  const uploadText   = document.getElementById('ai-upload-text');
  const previewWrap  = document.getElementById('ai-preview-wrap');
  const previewImg   = document.getElementById('ai-preview-img');
  const btnFit       = document.getElementById('btn-fashn-fit');

  let selectedPhotoFile = null;

  // 사진 선택 핸들러
  photoInput.addEventListener('change', () => {
    const file = photoInput.files[0];
    if (!file) return;

    // 파일 타입 검증
    if (!file.type.startsWith('image/')) {
      showAiFittingError('이미지 파일만 업로드 가능합니다.');
      return;
    }
    // 크기 제한 (5MB)
    if (file.size > 5_242_880) {
      showAiFittingError('이미지 파일 크기는 5MB 이하여야 합니다.');
      return;
    }

    clearAiFittingError();
    selectedPhotoFile = file;
    uploadText.textContent = file.name;

    // 미리보기 표시 (blob URL — 로컬 전용, 서버 전송 없음)
    const objectUrl = URL.createObjectURL(file);
    previewImg.src = objectUrl;
    previewImg.onload = () => URL.revokeObjectURL(objectUrl); // 즉시 해제
    previewWrap.classList.remove('hidden');

    btnFit.disabled = false;
  });

  // AI 피팅 시작 버튼
  btnFit.addEventListener('click', async () => {
    if (!selectedPhotoFile) return;

    // 1인1회 쿼터 체크 (베타 제한)
    const quotaOk = await checkFashnQuota();
    if (!quotaOk) return;

    // 현재 상품의 garment_image_url 가져오기
    const garmentUrl = currentProduct?.imageUrl || currentProduct?.image || null;
    if (!garmentUrl || !garmentUrl.startsWith('https://')) {
      showAiFittingError('상품 이미지 URL을 찾을 수 없습니다. 쇼핑몰 상품 페이지에서 다시 시도해 주세요.');
      return;
    }

    // 카테고리 결정
    const sizeType = currentProduct ? detectSizeType(currentProduct) : { type: 'tops' };
    const category = sizeType.type === 'bottoms' ? 'bottoms' : 'tops';

    clearAiFittingError();
    document.getElementById('ai-result-wrap').classList.add('hidden');
    setAiFittingLoading(true, 'AI가 옷을 입히는 중... (15–30초)');

    try {
      const result = await requestFashnFit(selectedPhotoFile, garmentUrl, category);
      // 피팅 성공 후 1인1회 플래그 저장
      await chrome.storage.local.set({ fashnUsed: true });
      showAiFittingResult(result.output_image_url);
    } catch (err) {
      showAiFittingError(err.message || 'AI 피팅 중 오류가 발생했습니다.');
    } finally {
      setAiFittingLoading(false);
    }
  });
})();

// ── 피팅 탭 전환 로직 ──
(function initFittingTabs() {
  const tab3d    = document.getElementById('tab-3d');
  const tabAi    = document.getElementById('tab-ai');
  const tabFit   = document.getElementById('tab-fit');
  const panel3d  = document.getElementById('panel-3d');
  const panelAi  = document.getElementById('panel-ai');
  const panelFit = document.getElementById('panel-fit');

  function activateTab(t) {
    tab3d.classList.toggle('active', t === '3d');
    tab3d.setAttribute('aria-selected', String(t === '3d'));
    tabAi.classList.toggle('active', t === 'ai');
    tabAi.setAttribute('aria-selected', String(t === 'ai'));
    tabFit.classList.toggle('active', t === 'fit');
    tabFit.setAttribute('aria-selected', String(t === 'fit'));

    panel3d.classList.toggle('hidden', t !== '3d');
    panelAi.classList.toggle('hidden', t !== 'ai');
    panelFit.classList.toggle('hidden', t !== 'fit');

    if (t === 'fit') window.fit2dRefresh?.();
  }

  tab3d.addEventListener('click', () => activateTab('3d'));
  tabAi.addEventListener('click', () => activateTab('ai'));
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
  const checkAi       = document.getElementById('check-ai');
  const checkAffiliate = document.getElementById('check-affiliate');

  function updateAllState() {
    const allChecked = checkPrivacy.classList.contains('checked')
                    && checkAi.classList.contains('checked')
                    && checkAffiliate.classList.contains('checked');
    checkAll.classList.toggle('checked', allChecked);
    btnConfirm.disabled = !allChecked;
  }

  document.getElementById('consent-item-privacy').addEventListener('click', () => {
    checkPrivacy.classList.toggle('checked');
    updateAllState();
  });
  document.getElementById('consent-item-ai').addEventListener('click', () => {
    checkAi.classList.toggle('checked');
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
    checkAi.classList.toggle('checked', target);
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

// ── PMF 피드백 + 결과 저장 버튼 ──
(function initResultActions() {
  // PMF Yes/No
  function handlePmf(selected) {
    document.getElementById('btn-pmf-yes')?.classList.remove('selected');
    document.getElementById('btn-pmf-no')?.classList.remove('selected');
    selected.classList.add('selected');

    // PMF 데이터 저장 (로컬 카운터 — 서버 전송 없음)
    const key = selected.id === 'btn-pmf-yes' ? 'myfit_pmf_yes' : 'myfit_pmf_no';
    chrome.storage.local.get(['myfit_pmf_yes', 'myfit_pmf_no']).then(data => {
      const updated = { [key]: (data[key] || 0) + 1 };
      chrome.storage.local.set(updated);
    });

    // 감사 메시지 표시
    let thanks = document.querySelector('.ai-pmf-thanks');
    if (!thanks) {
      thanks = document.createElement('div');
      thanks.className = 'ai-pmf-thanks';
      thanks.textContent = '피드백 감사합니다!';
      document.querySelector('.ai-pmf-block')?.appendChild(thanks);
    }
    thanks.classList.add('visible');
  }

  document.getElementById('btn-pmf-yes')?.addEventListener('click', function() { handlePmf(this); });
  document.getElementById('btn-pmf-no')?.addEventListener('click', function() { handlePmf(this); });

  // 결과 이미지 저장 (blob → a[download])
  document.getElementById('btn-save-result')?.addEventListener('click', async () => {
    const img = document.getElementById('fashn-result');
    if (!img?.src) return;
    try {
      const resp = await fetch(img.src);
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'myfit-result.jpg';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // 크로스오리진 제한 시 새 탭 열기 폴백
      window.open(img.src, '_blank', 'noopener,noreferrer');
    }
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
    el.innerHTML = `<span>키 ${user.height}cm · 몸무게 ${user.weight}kg</span><span>어깨 ${user.shoulder}cm · 가슴 ${user.chest}cm · 허리 ${user.waist}cm · 엉덩이 ${user.hip}cm</span>`;
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
