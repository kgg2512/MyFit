'use client';

/**
 * /community — MyFit 핏 자랑 커뮤니티 (골모드)
 *
 * 컨셉(회장): "나는 키 N·몸무게 M·평소 이런 스타일인데, 이 브랜드 이 사이즈를 입으니 이런 핏"을
 * 서로 공유·자랑. 인스타식 OOTD가 아니라 **핏 데이터** 커뮤니티.
 * 킬러 기능 = "나와 비슷한 체형" 필터 → 핏 예측 본업과 직결.
 *
 * 현 단계 = 백엔드 없음. 데모 seed + 내 글(localStorage). 실 UGC = 다음 단계 백엔드.
 * globals.css 토큰/클래스(.mf-*, .fit-tag--*, .badge, .card)만 사용.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { loadMeasurements, type Measurements } from '@/lib/storage';
import {
  DEMO_POSTS,
  loadMyPosts,
  addMyPost,
  deleteMyPost,
  bodySimilarity,
  isSimilarBody,
  SIMILAR_THRESHOLD,
  bodyDiffLabel,
  resolveElapsedMs,
  relativeTime,
  TONE_LABEL,
  STYLE_OPTIONS,
  type CommunityPost,
  type FitTone,
} from '@/lib/community';

// ── 아이콘 (SVG, Lucide 스타일 — 이모지 금지) ──
const IconArrowLeft = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
);
const IconHeart = (filled: boolean) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);
const IconComment = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconPlus = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14"/>
  </svg>
);
const IconUsers = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconRuler = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21.3 8.7 8.7 21.3a2.4 2.4 0 0 1-3.4 0l-2.6-2.6a2.4 2.4 0 0 1 0-3.4L15.3 2.7a2.4 2.4 0 0 1 3.4 0l2.6 2.6a2.4 2.4 0 0 1 0 3.4Z"/>
  </svg>
);
const IconX = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconShield = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IconTrash = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

type Filter = 'all' | 'similar' | FitTone;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'similar', label: '나와 비슷한 체형' },
  { key: 'standard', label: '딱 맞음' },
  { key: 'oversized', label: '오버핏' },
  { key: 'tight', label: '타이트' },
];

const CATEGORY_LABEL: Record<CommunityPost['category'], string> = {
  tops: '상의', bottoms: '하의', outer: '아우터',
};

const initial = (name: string) => name.trim().charAt(0) || '?';

export default function CommunityPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(0);
  const [measurements, setMeasurements] = useState<Measurements | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>(DEMO_POSTS);
  const [filter, setFilter] = useState<Filter>('all');
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [popId, setPopId] = useState<string>('');
  const [showCompose, setShowCompose] = useState(false);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    setMeasurements(loadMeasurements());
    setPosts([...loadMyPosts(), ...DEMO_POSTS]);
  }, []);

  const hasBody = !!(measurements && measurements.height && measurements.weight);

  // 필터 + 정렬 적용
  const visible = useMemo(() => {
    let list = posts;
    if (filter === 'similar') {
      if (!hasBody) return [];
      list = posts
        .map(p => ({ p, sim: bodySimilarity(measurements!, p.user) }))
        .filter(({ sim }) => sim >= SIMILAR_THRESHOLD)
        .sort((a, b) => b.sim - a.sim)
        .map(({ p }) => p);
    } else if (filter !== 'all') {
      list = posts.filter(p => p.fitOverall === filter);
    }
    return list;
  }, [posts, filter, hasBody, measurements]);

  const handleLike = (id: string) => {
    setLiked(prev => ({ ...prev, [id]: !prev[id] }));
    setPopId(id);
    setTimeout(() => setPopId(''), 320);
  };

  const handleCreate = (post: CommunityPost) => {
    const updated = addMyPost(post);
    setPosts([...updated, ...DEMO_POSTS]);
    setShowCompose(false);
    setFilter('all');
  };

  const handleDelete = (id: string) => {
    const remaining = deleteMyPost(id);
    setPosts([...remaining, ...DEMO_POSTS]);
  };

  if (!mounted) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--myfit-bg)', minHeight: '100dvh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <main className="mf-page-enter" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--myfit-bg)', minHeight: '100dvh', color: 'var(--myfit-text)' }}>
      {/* 헤더 */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(16px + var(--safe-top)) 20px 8px' }}>
        <button
          onClick={() => router.push('/')}
          aria-label="홈으로 돌아가기"
          style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--myfit-text-sub)' }}
        >
          {IconArrowLeft}
        </button>
        <div>
          <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--myfit-text)' }}>핏 커뮤니티</span>
          <div style={{ fontSize: 11, color: 'var(--myfit-text-muted)', marginTop: 1 }}>
            같은 체형이 이 브랜드 이 사이즈를 어떻게 입었나
          </div>
        </div>
      </header>

      {/* 필터 칩 */}
      <div style={{ padding: '10px 20px 8px' }}>
        <div className="mf-chips" role="tablist" aria-label="피드 필터">
          {FILTERS.map(f => {
            const isActive = filter === f.key;
            const isSimilar = f.key === 'similar';
            return (
              <button
                key={f.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setFilter(f.key)}
                className={`mf-chip${isActive ? ' mf-chip--active' : ''}`}
              >
                {isSimilar && <span style={{ display: 'flex' }}>{IconUsers}</span>}
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="scroll-area" style={{ flex: 1, padding: '8px 20px calc(96px + var(--safe-bottom))', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* "나와 비슷한 체형" 필터인데 치수 없음 → 유도 */}
        {filter === 'similar' && !hasBody && (
          <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center', padding: '28px 20px' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--myfit-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--myfit-primary)' }}>
              {IconRuler}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--myfit-text)', marginBottom: 4 }}>내 치수를 먼저 입력하세요</div>
              <div style={{ fontSize: 13, color: 'var(--myfit-text-sub)', lineHeight: 1.6 }}>키·몸무게를 알려주면 나와 비슷한 체형의 사람들이<br />이 옷을 어떻게 입었는지 골라서 보여드려요</div>
            </div>
            <button className="btn-primary" onClick={() => router.push('/profile')} style={{ maxWidth: 260 }}>
              내 치수 입력하기
            </button>
          </section>
        )}

        {/* "나와 비슷한 체형" 활성 + 치수 있음 → 요약 배너 */}
        {filter === 'similar' && hasBody && (
          <section
            style={{ background: 'var(--myfit-ink)', borderRadius: 'var(--myfit-radius)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}
            aria-label="내 체형 기준"
          >
            <span style={{ color: 'rgba(255,255,255,0.7)', display: 'flex' }}>{IconUsers}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                내 체형: 키 {measurements!.height}cm · {measurements!.weight}kg
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                유사도 높은 순으로 {visible.length}명의 착용 핏
              </div>
            </div>
          </section>
        )}

        {/* 피드 */}
        {visible.map(post => {
          const sim = hasBody ? bodySimilarity(measurements!, post.user) : null;
          const isSimilar = sim !== null && isSimilarBody(measurements!, post.user);
          const likeCount = post.likes + (liked[post.id] ? 1 : 0);
          return (
            <article
              key={post.id}
              className={`mf-post${filter === 'similar' && isSimilar ? ' mf-post--similar' : ''}`}
              aria-label={`${post.user.nickname}님의 ${post.brand} ${post.garmentName} 핏`}
            >
              {/* 작성자 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="mf-avatar" style={{ background: post.user.avatarColor }} aria-hidden="true">
                  {initial(post.user.nickname)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--myfit-text)' }}>{post.user.nickname}</span>
                    {post.mine && <span className="badge" style={{ fontSize: 10, padding: '2px 7px' }}>내 글</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--myfit-text-sub)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ display: 'flex', color: 'var(--myfit-text-muted)' }}>{IconRuler}</span>
                      {post.user.height}cm · {post.user.weight}kg
                    </span>
                    {post.user.styleTags.length > 0 && (
                      <span style={{ color: 'var(--myfit-text-muted)' }}>· {post.user.styleTags.join('·')}</span>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--myfit-text-muted)', whiteSpace: 'nowrap', alignSelf: 'flex-start' }}>
                  {relativeTime(resolveElapsedMs(post, now))}
                </span>
              </div>

              {/* 체형 유사도 칩 (내 치수 있을 때) */}
              {sim !== null && (
                <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: isSimilar ? 'var(--myfit-primary-soft)' : 'var(--myfit-surface2)', color: isSimilar ? 'var(--myfit-primary)' : 'var(--myfit-text-sub)', border: `1px solid ${isSimilar ? '#a5f0fc' : 'var(--myfit-border)'}` }}>
                  {isSimilar && <span style={{ display: 'flex' }}>{IconUsers}</span>}
                  {isSimilar ? '나와 비슷한 체형' : '체형'} · {bodyDiffLabel(measurements!, post.user)}
                </div>
              )}

              {/* 옷 정보 */}
              <div style={{ background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)', borderRadius: 'var(--myfit-radius)', padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--myfit-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      {post.brand} · {CATEGORY_LABEL[post.category]}
                    </div>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--myfit-text)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {post.garmentName}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', flexShrink: 0, background: 'var(--myfit-surface)', border: '1px solid var(--myfit-border)', borderRadius: 10, padding: '6px 12px' }}>
                    <div style={{ fontSize: 9, color: 'var(--myfit-text-muted)', letterSpacing: '0.04em' }}>SIZE</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--myfit-text)', letterSpacing: '-0.5px', lineHeight: 1.1 }}>{post.sizeWorn}</div>
                  </div>
                </div>

                {/* 핏 판정 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <span className={`fit-tag fit-tag--${post.fitOverall}`}>
                    {TONE_LABEL[post.fitOverall]}
                  </span>
                  {post.partFits.map(pf => (
                    <span key={pf.label} className={`fit-tag fit-tag--${pf.tone}`} style={{ background: 'transparent', border: '1px solid var(--myfit-border)', color: 'var(--myfit-text-sub)' }}>
                      {pf.label} {TONE_LABEL[pf.tone]}
                    </span>
                  ))}
                </div>
              </div>

              {/* 후기 */}
              <p style={{ fontSize: 13.5, color: 'var(--myfit-text)', lineHeight: 1.6, margin: 0 }}>{post.caption}</p>

              {/* 액션 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, paddingTop: 2 }}>
                <button
                  onClick={() => handleLike(post.id)}
                  aria-label={liked[post.id] ? '좋아요 취소' : '좋아요'}
                  aria-pressed={!!liked[post.id]}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: liked[post.id] ? 'var(--myfit-error)' : 'var(--myfit-text-sub)', minHeight: 44 }}
                >
                  <span className={popId === post.id ? 'mf-like--on' : ''} style={{ display: 'flex' }}>{IconHeart(!!liked[post.id])}</span>
                  {likeCount}
                </button>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--myfit-text-sub)' }}>
                  <span style={{ display: 'flex' }}>{IconComment}</span>
                  {post.comments}
                </span>
                {post.mine && (
                  <button
                    onClick={() => handleDelete(post.id)}
                    aria-label="내 글 삭제"
                    style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--myfit-text-muted)', minHeight: 44 }}
                  >
                    <span style={{ display: 'flex' }}>{IconTrash}</span> 삭제
                  </button>
                )}
              </div>
            </article>
          );
        })}

        {/* 빈 상태 (필터 결과 없음, similar-무치수 케이스는 위에서 처리) */}
        {visible.length === 0 && !(filter === 'similar' && !hasBody) && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--myfit-text-muted)', fontSize: 13 }}>
            해당하는 핏 후기가 아직 없어요.
          </div>
        )}

        {/* 프라이버시/데모 고지 (🔒) */}
        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'flex-start', padding: '12px 14px', background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)', borderRadius: 'var(--myfit-radius-sm)' }}>
          <span style={{ color: 'var(--myfit-text-muted)', flexShrink: 0, marginTop: 1 }}>{IconShield}</span>
          <div style={{ fontSize: 11.5, color: 'var(--myfit-text-sub)', lineHeight: 1.6 }}>
            현재 커뮤니티는 <b>미리보기(데모)</b>입니다. 내가 올린 글은 이 기기에만 저장되며 외부로 전송·공개되지 않습니다.
            닉네임·키·몸무게·스타일만 표시되고 실명·얼굴 사진은 수집하지 않습니다.
          </div>
        </div>
      </div>

      {/* 핏 자랑하기 FAB */}
      <button className="mf-fab" onClick={() => setShowCompose(true)} aria-label="내 핏 자랑하기">
        <span style={{ display: 'flex' }}>{IconPlus}</span> 핏 자랑
      </button>

      {/* 컴포즈 시트 */}
      {showCompose && (
        <ComposeSheet
          measurements={measurements}
          onClose={() => setShowCompose(false)}
          onCreate={handleCreate}
          onNeedBody={() => { setShowCompose(false); router.push('/profile'); }}
        />
      )}
    </main>
  );
}

// ─────────────────────────────────────────────────────────────
// 컴포즈 시트 (핏 자랑하기)
// ─────────────────────────────────────────────────────────────
const BRAND_PRESETS = ['무신사 스탠다드', '나이키', '자라', '유니클로', '아디다스', '커버낫', '폴로 랄프로렌'];
const AVATAR_COLORS = ['#0891b2', '#db2777', '#16a34a', '#d97706', '#7c3aed', '#0e7490', '#dc2626', '#111827'];

function ComposeSheet({
  measurements,
  onClose,
  onCreate,
  onNeedBody,
}: {
  measurements: Measurements | null;
  onClose: () => void;
  onCreate: (post: CommunityPost) => void;
  onNeedBody: () => void;
}) {
  const [nickname, setNickname] = useState('나');
  const [brand, setBrand] = useState('');
  const [garmentName, setGarmentName] = useState('');
  const [category, setCategory] = useState<CommunityPost['category']>('tops');
  const [sizeWorn, setSizeWorn] = useState('');
  const [fitOverall, setFitOverall] = useState<FitTone>('standard');
  const [styleTags, setStyleTags] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [agreed, setAgreed] = useState(false);

  const hasBody = !!(measurements && measurements.height && measurements.weight);
  const valid = hasBody && agreed && brand.trim() && garmentName.trim() && sizeWorn.trim();

  const toggleStyle = (s: string) => {
    setStyleTags(prev => prev.includes(s) ? prev.filter(x => x !== s) : prev.length < 3 ? [...prev, s] : prev);
  };

  const submit = () => {
    if (!valid || !measurements) return;
    const post: CommunityPost = {
      id: `my-${Date.now()}`,
      user: {
        nickname: nickname.trim() || '나',
        height: measurements.height,
        weight: measurements.weight,
        styleTags,
        avatarColor: AVATAR_COLORS[Math.abs(hashStr(nickname)) % AVATAR_COLORS.length],
      },
      brand: brand.trim(),
      garmentName: garmentName.trim(),
      category,
      sizeWorn: sizeWorn.trim(),
      fitOverall,
      partFits: [],
      caption: caption.trim() || `${brand.trim()} ${sizeWorn.trim()} 착용, ${TONE_LABEL[fitOverall]} 핏.`,
      likes: 0,
      comments: 0,
      createdAt: Date.now(),
      mine: true,
    };
    onCreate(post);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compose-title"
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}
    >
      <div
        className="mf-step"
        style={{ width: '100%', maxHeight: '92dvh', background: 'var(--myfit-surface)', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(20px + var(--safe-bottom))', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 id="compose-title" style={{ fontSize: 18, fontWeight: 800, color: 'var(--myfit-text)' }}>핏 자랑하기</h2>
          <button onClick={onClose} aria-label="닫기" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--myfit-text-sub)' }}>
            {IconX}
          </button>
        </div>

        {!hasBody ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 0 8px' }}>
            <p style={{ fontSize: 13.5, color: 'var(--myfit-text-sub)', lineHeight: 1.6 }}>
              핏 자랑에는 <b>내 키·몸무게</b>가 함께 표시됩니다(핏 비교의 핵심). 먼저 치수를 입력해 주세요.
            </p>
            <button className="btn-primary" onClick={onNeedBody}>내 치수 입력하러 가기</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 내 체형 (자동 첨부) */}
            <div style={{ background: 'var(--myfit-primary-soft)', border: '1px solid #a5f0fc', borderRadius: 12, padding: '10px 14px', fontSize: 12.5, color: 'var(--myfit-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'flex' }}>{IconRuler}</span>
              키 {measurements!.height}cm · {measurements!.weight}kg 으로 게시됩니다
            </div>

            {/* 닉네임 */}
            <Field label="닉네임 (실명 금지)">
              <input value={nickname} onChange={e => setNickname(e.target.value)} maxLength={12} placeholder="예: 민준" style={{ height: 46 }} />
            </Field>

            {/* 브랜드 */}
            <Field label="브랜드">
              <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="예: 무신사 스탠다드" style={{ height: 46 }} />
              <div className="mf-chips" style={{ marginTop: 8 }}>
                {BRAND_PRESETS.map(b => (
                  <button key={b} type="button" onClick={() => setBrand(b)} className={`mf-chip${brand === b ? ' mf-chip--active' : ''}`}>{b}</button>
                ))}
              </div>
            </Field>

            {/* 상품명 */}
            <Field label="상품명">
              <input value={garmentName} onChange={e => setGarmentName(e.target.value)} placeholder="예: 오버핏 옥스퍼드 셔츠" style={{ height: 46 }} />
            </Field>

            {/* 카테고리 + 사이즈 */}
            <div style={{ display: 'flex', gap: 12 }}>
              <Field label="카테고리">
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['tops', 'bottoms', 'outer'] as const).map(c => (
                    <button key={c} type="button" onClick={() => setCategory(c)} className={`mf-chip${category === c ? ' mf-chip--active' : ''}`} style={{ flex: 1, justifyContent: 'center' }}>
                      {CATEGORY_LABEL[c]}
                    </button>
                  ))}
                </div>
              </Field>
              <div style={{ width: 100 }}>
                <Field label="사이즈">
                  <input value={sizeWorn} onChange={e => setSizeWorn(e.target.value)} placeholder="M" maxLength={5} style={{ height: 46, textAlign: 'center', fontWeight: 700 }} />
                </Field>
              </div>
            </div>

            {/* 핏 판정 */}
            <Field label="전체 핏">
              <div style={{ display: 'flex', gap: 6 }}>
                {(['tight', 'standard', 'oversized'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFitOverall(t)}
                    className={`mf-chip${fitOverall === t ? ' mf-chip--active' : ''}`}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    {TONE_LABEL[t]}
                  </button>
                ))}
              </div>
            </Field>

            {/* 스타일 태그 */}
            <Field label="평소 스타일 (최대 3개)">
              <div className="mf-chips" style={{ flexWrap: 'wrap' }}>
                {STYLE_OPTIONS.map(s => (
                  <button key={s} type="button" onClick={() => toggleStyle(s)} className={`mf-chip${styleTags.includes(s) ? ' mf-chip--active' : ''}`}>{s}</button>
                ))}
              </div>
            </Field>

            {/* 후기 */}
            <Field label="한줄 후기 (선택)">
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                maxLength={140}
                rows={3}
                placeholder="예: 어깨 넓은 편인데 L 딱 좋아요."
                style={{ resize: 'none', lineHeight: 1.5, padding: '12px 14px' }}
              />
            </Field>

            {/* 🔒 공개 동의 */}
            <label htmlFor="community-agree" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', padding: '4px 0' }}>
              <input id="community-agree" type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ width: 20, height: 20, flexShrink: 0, marginTop: 1, accentColor: 'var(--myfit-primary)' }} />
              <span style={{ fontSize: 12, color: 'var(--myfit-text-sub)', lineHeight: 1.55 }}>
                닉네임·키·몸무게·스타일이 이 글에 <b>공개로 표시</b>되는 것에 동의합니다. (데모 단계 — 이 기기에만 저장)
              </span>
            </label>

            <button className="btn-primary" onClick={submit} disabled={!valid} style={{ opacity: valid ? 1 : 0.45 }}>
              게시하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--myfit-text-sub)', marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0;
  return h;
}
