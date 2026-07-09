'use client';

import { useRouter } from 'next/navigation';

/* 뒤로가기 아이콘 (privacy 화면과 동일 패턴) */
const IconArrowLeft = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const EFFECTIVE = '2026년 6월 6일';
const VERSION = '1.0';
const CONTACT = 'kgg2512@gmail.com';

export default function TermsPage() {
  const router = useRouter();

  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--myfit-bg)', minHeight: '100dvh', color: 'var(--myfit-text)' }}>
      {/* 헤더 */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(16px + var(--safe-top)) 20px 8px' }}>
        <button
          onClick={() => router.back()}
          aria-label="뒤로가기"
          style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--myfit-text-sub)' }}
        >
          {IconArrowLeft}
        </button>
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--myfit-text)' }}>이용약관</span>
      </header>

      <div className="scroll-area" style={{ flex: 1, padding: '8px 20px calc(24px + var(--safe-bottom))', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 12, color: 'var(--myfit-text-muted)', margin: 0 }}>
          시행일 {EFFECTIVE} · 버전 {VERSION} · G2 Company Ltd.
        </p>

        <Article title="제1조 (목적)">
          <P>본 약관은 G2 Company Ltd.(이하 &quot;회사&quot;)가 제공하는 MyFit AI 피팅 서비스(이하 &quot;서비스&quot;)의 이용 조건 및 절차, 이용자와 회사의 권리·의무 및 책임에 관한 사항을 규정합니다.</P>
        </Article>

        <Article title="제2조 (서비스 내용)">
          <P>회사는 다음 서비스를 제공합니다.</P>
          <List items={[
            '신체 치수 기반 AI 핏 예측 및 사이즈 추천',
            '사용자 사진과 의류 이미지를 기반으로 한 AI 가상 피팅 결과 생성',
            '핏 예측·피팅 결과 저장 및 히스토리 관리(이 기기 내 저장)',
            '쇼핑몰 상품 연동 및 구매 링크 제공',
          ]} />
        </Article>

        <Article title="제3조 (사진·치수 데이터 이용)">
          <Callout>
            신체 치수·핏 기록·신체 사진은 이 기기(브라우저)에만 저장되며 회사 서버로 전송·보관하지 않습니다. AI 가상 피팅 이용 시에만 신체 사진이 별도 동의 하에 외부 처리 서버(TryOnCloud)로 전송되며, 처리 완료 즉시 삭제됩니다. 회사는 이용자의 사진을 별도로 저장하거나 마케팅 목적으로 사용하지 않습니다.
          </Callout>
          <List items={[
            '타인의 사진을 무단으로 사용하는 행위는 금지됩니다.',
            '만 14세 미만의 사진 업로드는 허용되지 않습니다.',
          ]} />
        </Article>

        <Article title="제4조 (이용자의 의무)">
          <List items={[
            '타인의 개인정보·사진을 무단으로 사용하는 행위 금지',
            '서비스의 정상적인 운영을 방해하는 행위 금지',
            '불법 콘텐츠(음란물, 혐오 표현 등) 업로드 금지',
            '서비스를 통한 상업적 스팸 행위 금지',
            '관련 법령 및 본 약관 준수',
          ]} />
        </Article>

        <Article title="제5조 (제휴 마케팅 고지)">
          <P>MyFit은 쿠팡파트너스 등 제휴 마케팅 활동의 일환으로, 이용자가 서비스 내 링크를 통해 상품을 구매할 경우 회사가 소정의 수수료를 받을 수 있습니다. 이는 이용자에게 추가 비용을 발생시키지 않습니다.</P>
        </Article>

        <Article title="제6조 (AI 생성 결과 고지)">
          <Callout>
            핏 예측 결과 및 가상 피팅 이미지는 AI 기술로 생성된 참고용 결과물입니다. 실제 착용감, 색상, 사이즈와 차이가 있을 수 있으며, 회사는 결과의 정확성을 보장하지 않습니다.
          </Callout>
        </Article>

        <Article title="제7조 (서비스 이용 제한)">
          <P>회사는 이용자가 제4조의 의무를 위반한 경우 사전 통지 없이 서비스 이용을 제한할 수 있습니다.</P>
        </Article>

        <Article title="제8조 (면책 조항)">
          <List items={[
            'AI 핏 예측·피팅 결과는 참고용이며, 실제 착용감과 차이가 있을 수 있습니다.',
            '회사는 천재지변, 서버 장애 등 불가항력으로 인한 서비스 중단에 대해 책임을 지지 않습니다.',
            '이용자가 제공한 정보의 부정확성으로 인한 결과에 대해 회사는 책임을 지지 않습니다.',
          ]} />
        </Article>

        <Article title="제9조 (준거법 및 분쟁 해결)">
          <P>본 약관은 대한민국 법률에 따라 해석되며, 분쟁 발생 시 회사 소재지 관할 법원을 제1심 관할 법원으로 합니다.</P>
          <P>문의: <a href={`mailto:${CONTACT}`} style={{ color: 'var(--myfit-primary)', fontWeight: 600 }}>{CONTACT}</a></P>
        </Article>

        <button
          type="button"
          onClick={() => router.push('/privacy')}
          style={{ width: '100%', textAlign: 'center', background: 'var(--myfit-surface2)', border: '1px solid var(--myfit-border)', borderRadius: 'var(--myfit-radius)', padding: '14px 16px', fontSize: 13, fontWeight: 700, color: 'var(--myfit-primary)', marginTop: 4 }}
        >
          내 데이터 · 개인정보처리방침 →
        </button>

        <p style={{ fontSize: 11, color: 'var(--myfit-text-muted)', textAlign: 'center', margin: '4px 0 0' }}>
          © 2026 G2 Company Ltd. · MyFit 이용약관 v{VERSION}
        </p>
      </div>
    </main>
  );
}

/* ─── 조항 카드 ─── */
function Article({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--myfit-text)', margin: 0, paddingLeft: 12, borderLeft: '3px solid var(--myfit-primary)' }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: 'var(--myfit-text-sub)', lineHeight: 1.7, margin: 0 }}>{children}</p>;
}

function List({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--myfit-text-sub)', lineHeight: 1.7 }}>
      {items.map((it, i) => (
        <li key={i} style={{ marginBottom: 4 }}>{it}</li>
      ))}
    </ul>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--myfit-primary-soft)', border: '1px solid #a5f0fc', borderRadius: 'var(--myfit-radius)', padding: '14px 16px', fontSize: 12.5, color: 'var(--myfit-text-sub)', lineHeight: 1.7 }}>
      {children}
    </div>
  );
}
