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

// ── 이벤트 바인딩 ──
document.getElementById('btn-start-onboard').addEventListener('click', () => {
  const overlay = document.getElementById('consent-overlay');
  // 최초 실행 시 동의 모달 표시, 이미 동의했으면 바로 manual로
  const hasConsented = localStorage.getItem('myfit_consented');
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

// ── 구매 버튼 ──
document.getElementById('btn-buy').addEventListener('click', () => {
  if (!currentProduct?.url) return;
  // 상품 원본 URL로 이동 (탭에서)
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.update(tabs[0].id, { url: currentProduct.url });
    }
  });
});

// ── 동의 모달 로직 ──
(function initConsent() {
  const overlay    = document.getElementById('consent-overlay');
  const btnConfirm = document.getElementById('btn-consent-confirm');
  const checkAll   = document.getElementById('check-all');
  const checkPrivacy   = document.getElementById('check-privacy');
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
    localStorage.setItem('myfit_consented', '1');
    overlay.classList.add('hidden');
    showScreen('manual');
  });
})();

// ── 실행 ──
init();
