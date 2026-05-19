# DESIGN.md — Cinderella
> P2P 명품 패션 렌탈 플랫폼 | G2 Company Ltd | 2026

---

## 1. Brand Essence

| Attribute | Definition |
|-----------|-----------|
| **Personality** | 럭셔리하지만 친근한, 설레는, 신뢰할 수 있는 |
| **Voice** | "당신의 특별한 순간을 위해 — 부담 없이, 품격 있게" |
| **Audience** | 20–40대 한국 여성, 특별한 날을 위해 명품을 빌리거나 빌려주고 싶은 사람 |
| **Metaphor** | 요정 할머니가 신데렐라에게 드레스와 마차를 선물하는 순간 |
| **Comparable** | 당근마켓의 신뢰·지역성 + Vogue의 에디토리얼 럭셔리 |

---

## 2. Color System

### Brand Palette

```css
/* ── PRIMARY: Champagne Gold ── */
--color-gold-50:  #FDF8EE;
--color-gold-100: #F7EBCC;
--color-gold-200: #EDD899;
--color-gold-300: #DEC066;
--color-gold-400: #C9A04A;   /* Brand Primary */
--color-gold-500: #B8963E;   /* Default */
--color-gold-600: #9B7B2E;
--color-gold-700: #7A5E1F;
--color-gold-800: #5A4314;
--color-gold-900: #3A2A0A;

/* ── SECONDARY: Deep Charcoal ── */
--color-charcoal-50:  #F5F4F3;
--color-charcoal-100: #E8E6E4;
--color-charcoal-200: #C8C4C0;
--color-charcoal-300: #9B9590;
--color-charcoal-400: #6B6560;
--color-charcoal-500: #3D3935;
--color-charcoal-600: #2E2A26;
--color-charcoal-700: #1C1A18;   /* Default Text */
--color-charcoal-800: #131210;
--color-charcoal-900: #0F0E0C;   /* Deep Black */

/* ── ACCENT: Dusty Rose ── */
--color-rose-300: #E8A0A8;
--color-rose-400: #D4808A;
--color-rose-500: #C4596A;   /* CTA / Badge */
--color-rose-600: #A8404F;

/* ── NEUTRAL: Cream & Ivory ── */
--color-cream-50:  #FFFEF9;
--color-cream-100: #FAF8F3;   /* Page Background */
--color-cream-200: #F2EDE3;   /* Card Surface */
--color-cream-300: #E8E0D3;
--color-cream-400: #D6CCC0;

/* ── SEMANTIC ── */
--color-success: #2E7D32;
--color-success-bg: #E8F5E9;
--color-warning: #E65100;
--color-error: #C62828;
--color-info: #1565C0;
```

### UI Role Mapping

| Role | Token | Hex | Usage |
|------|-------|-----|-------|
| Brand Accent | `--color-gold-500` | `#B8963E` | Buttons, links, active states |
| Brand Gradient | `gold-400 → gold-700` | `#C9A04A → #7A5E1F` | Primary CTAs, badges |
| Page Background | `--color-cream-100` | `#FAF8F3` | App background |
| Card Surface | `white` + cream border | `#FFFFFF` | Item cards, sheets |
| Primary Text | `--color-charcoal-700` | `#1C1A18` | Body, headings |
| Secondary Text | `--color-charcoal-400` | `#6B6560` | Metadata, captions |
| Muted Text | `--color-charcoal-300` | `#9B9590` | Placeholders, disabled |
| Border | `--color-cream-300` | `#E8E0D3` | Dividers, card borders |
| CTA / Alert | `--color-rose-500` | `#C4596A` | Notification dots, badges |

### Dark Hero Sections (판매자 대시보드, 마이페이지)

```css
--hero-bg: linear-gradient(150deg, #1C1A18 0%, #2E2A24 100%);
--hero-text: #FFFEF9;
--hero-subtext: rgba(255,255,255,0.55);
--hero-accent: #D4B86A;   /* gold-lt on dark */
```

---

## 3. Typography

### Typeface System

| Role | Family | Weight | Usage |
|------|--------|--------|-------|
| **Display** | Cormorant Garamond | 300–400 Italic | App logo, hero headlines, item names |
| **Serif** | Playfair Display | 400–700 | Section titles, price, brand names |
| **Body** | Noto Sans KR | 300–700 | All body copy, UI labels, forms |

```css
/* Google Fonts Import */
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Playfair+Display:wght@400;700&family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap');

/* Type Scale */
--text-xs:   10px;   /* labels, caps */
--text-sm:   12px;   /* captions, metadata */
--text-base: 13.5px; /* body default */
--text-md:   15px;   /* prominent body */
--text-lg:   18px;   /* section titles */
--text-xl:   22px;   /* page titles */
--text-2xl:  28px;   /* hero item names (Cormorant) */
--text-3xl:  36px;   /* splash headlines */
--text-hero: 44px;   /* login screen logo */

/* Letter Spacing */
--tracking-tight:  -0.01em;
--tracking-normal:  0;
--tracking-wide:    0.04em;
--tracking-wider:   0.10em;
--tracking-widest:  0.18em;  /* brand tags, uppercase labels */
```

### Tone of Voice — Microcopy Guide

| Context | Tone | Example |
|---------|------|---------|
| **CTA 버튼** | 설레는, 직접적 | "지금 빌리기", "요정 되기" |
| **빈 상태** | 따뜻한, 격려 | "아직 대여 내역이 없어요. 첫 번째 신데렐라 순간을 만들어보세요 ✨" |
| **오류** | 친절한, 해결 중심 | "위치를 가져올 수 없어요. 잠시 후 다시 시도해주세요." |
| **성공** | 기쁜, 간결한 | "예약이 완료됐습니다" |
| **온보딩** | 스토리텔링 | "요정 할머니가 나타났어요. 당신의 특별한 날을 위해." |
| **등록 유도** | 수익 강조 | "사용하지 않는 명품으로 요정이 되어보세요" |

---

## 4. Logo & App Identity

### App Name
- **Full**: Cinderella
- **Short**: C (아이콘, 파비콘 용)
- **Sub-tagline**: 내 동네 명품 렌탈

### Logo Treatment
```css
/* Cinderella 워드마크 */
font-family: 'Cormorant Garamond', serif;
font-style: italic;
font-weight: 300;
letter-spacing: 0.06em;
background: linear-gradient(135deg, #C9A04A, #7A5E1F);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```

### Logo Rules
- 최소 크기: 모바일 20px, 인쇄 12mm
- 클리어 스페이스: 로고 높이의 50% 이상
- 허용 배경: 크림 화이트, 딥 차콜, 투명(밝은 배경 위)
- 금지: 회전, 변형, 채도 변경, 복잡한 배경 위 직접 사용

---

## 5. Iconography

### Style
- **Type**: Line icons (stroke, not filled)
- **Stroke width**: 1.6–1.8px at 22×22px
- **Corner radius**: rounded (`stroke-linecap: round; stroke-linejoin: round`)
- **Grid**: 24×24px viewBox
- **Personality**: 부드럽고 정제된, 날카롭지 않은

### Core Icon Set

```
홈(Home)         → path: M3 9l9-7 9 7v11… (house)
탐색(Search)     → circle cx11 r7 + line
등록(Add)        → circle + cross
마이(Profile)    → person silhouette
위치(Location)   → teardrop pin
알림(Bell)       → bell shape
찜(Heart)        → heart outline / filled
뒤로(Back)       → chevron-left
더보기(More)     → three dots
카메라(Photo)    → camera rectangle
채팅(Chat)       → speech bubble
필터(Filter)     → three lines decreasing
```

### Emoji 사용 원칙
- **허용**: 역할 구분 컨텍스트만 (신데렐라 = 👗, 요정 = ✨)
- **금지**: 네비게이션 바, 버튼, 폼 레이블에 단독 사용 금지

---

## 6. Spacing & Layout

```css
/* Spacing Scale (4px base) */
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;

/* Border Radius */
--radius-sm:  8px;   /* chips, tags */
--radius-md:  14px;  /* cards, inputs */
--radius-lg:  20px;  /* modals, sheets */
--radius-xl:  28px;  /* bottom sheet top */
--radius-full: 9999px; /* pills, avatars */

/* Shadows */
--shadow-sm:   0 1px 8px rgba(15,14,12,.07);
--shadow-md:   0 6px 24px rgba(15,14,12,.11);
--shadow-lg:   0 16px 48px rgba(15,14,12,.16);
--shadow-gold: 0 6px 24px rgba(184,150,62,.28);

/* App Max Width */
--app-max-width: 430px;
--nav-height: 58px;
```

---

## 7. Component Specifications

### Primary Button (CTA)
```css
/* Gold Gradient — 메인 대여 버튼 */
background: linear-gradient(135deg, #C9A04A, #7A5E1F);
color: white;
border-radius: 14px;
padding: 15px 24px;
font-size: 14px;
font-weight: 600;
letter-spacing: 0.06em;
box-shadow: 0 6px 24px rgba(184,150,62,.28);
```

### Secondary Button
```css
background: #1C1A18;
color: white;
border-radius: 14px;
padding: 15px 24px;
```

### Item Card (당근마켓 스타일)
```
[100px 썸네일] [아이템 정보 영역         ] [찜/통계]
               타이틀 (Noto Sans KR 500)
               동네 · 거리 · 시간 (muted)
               가격 (Bold 15px)
               [S급] [가방] tags
```

### 요정 온도 (Fairy Temperature)
- 당근마켓 매너온도 동일 개념
- 범위: 0–100°
- 색상: 0–36° = 파랑, 37–55° = 주황, 56+ = 빨강
- 폰트: 700 weight, #FF6B00

### 탐색 GPS 배너
```
[Gold pin icon] "내 위치 기반 명품을 찾으세요"  [위치 허용 버튼]
배경: rgba(184,150,62,.10) | 보더: rgba(184,150,62,.30)
```

---

## 8. Motion & Animation

```css
/* Transition Defaults */
--transition-fast:   150ms ease;
--transition-base:   200ms ease;
--transition-slow:   300ms ease-in-out;

/* 사용 원칙 */
/* - 카드 탭: scale(0.97) 150ms */
/* - 화면 전환: 없음 (즉각) 또는 opacity 200ms */
/* - 바텀시트: slide-up 300ms ease-out */
/* - 토스트: opacity 250ms */
/* - 중요: 과도한 애니메이션 금지. 럭셔리 = 절제 */
```

---

## 9. Platform Rules

### Mobile First (기준: 430px)
- 최소 터치 영역: 44×44px
- 하단 네비게이션 높이: 58px + safe area
- 상단 바 높이: 50px
- 스크롤: `-webkit-overflow-scrolling: touch`, 스크롤바 숨김

### Google Login Standard (전 G2 앱 공통)
- 공식 Google Sign-In 버튼 스타일 준수
- 색상: 흰 배경, 구글 공식 로고 4색
- 텍스트: "Google 계정으로 시작하기"

---

## 10. claude.ai/design 업로드 가이드

이 DESIGN.md를 claude.ai에서 바로 사용하는 방법:

1. [claude.ai/design](https://claude.ai/design) 접속
2. **"Create new design system"** 클릭
3. **"Add assets"** → 이 DESIGN.md 파일 업로드
4. Claude Design이 색상 토큰, 타입 스케일, 컴포넌트를 자동 스캐폴딩

---

## 11. Quick Reference — CSS Variables

```css
:root {
  /* Brand */
  --gold: #B8963E;
  --gold-grd: linear-gradient(135deg, #C9A04A, #7A5E1F);
  --gold-lt: #D4B86A;

  /* Layout */
  --cream: #FAF8F3;
  --white: #FFFFFF;
  --charcoal: #1C1A18;
  --mid: #5A5248;
  --muted: #9B9089;
  --border: #E2D9CC;
  --rose: #C4596A;

  /* Fonts */
  --f-display: 'Cormorant Garamond', serif;
  --f-serif: 'Playfair Display', serif;
  --f-body: 'Noto Sans KR', sans-serif;

  /* Spacing */
  --nav: 58px;
  --max: 430px;
}
```

---

*Generated by G2 Company CDO — brand-designer agent (imsaif/design-with-claude)*
*Last updated: 2026-05-20*
