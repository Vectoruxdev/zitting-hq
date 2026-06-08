import React from 'react';
/* Skeletons — boot splash + per-screen skeleton placeholders. */
function ZHQBootSplash({ fading }) {
  const { LoadingBar } = window.ZittingHQDesignSystem_c9e528;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26,
      background: 'var(--bg-app)',
      opacity: fading ? 0 : 1,
      transition: 'opacity 0.4s var(--ease-out)',
      pointerEvents: fading ? 'none' : 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, animation: 'zt-pulse 1.4s var(--ease-in-out) infinite' }}>
        <img src="/finance/mark.svg" width="44" height="44" alt="" style={{ borderRadius: 13 }} />
        <span className="zt-wordmark" style={{ fontSize: 30, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Zitting <span style={{ color: 'var(--accent)' }}>HQ</span></span>
      </div>
      <div style={{ width: 180 }}>{LoadingBar ? <LoadingBar /> : null}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Securely loading your money…</div>
    </div>
  );
}

function ZHQSkelCard({ children, style }) {
  return <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', padding: 20, boxShadow: 'var(--shadow-md)', ...style }}>{children}</div>;
}

/* A generic dashboard skeleton used while any screen "loads". */
function ZHQScreenSkeleton() {
  const { Skeleton, SkeletonText } = window.ZittingHQDesignSystem_c9e528;
  if (!Skeleton || !SkeletonText) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton width={130} height={11} />
          <Skeleton width={240} height={26} />
        </div>
        <Skeleton width={150} height={38} radius="999px" />
      </div>

      {/* stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[0, 1, 2, 3].map((i) => (
          <ZHQSkelCard key={i}>
            <Skeleton width={80} height={10} />
            <div style={{ height: 14 }} />
            <Skeleton width={130} height={28} />
            <div style={{ height: 12 }} />
            <Skeleton width={90} height={11} />
          </ZHQSkelCard>
        ))}
      </div>

      {/* two panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.05fr', gap: 16 }}>
        <ZHQSkelCard>
          <Skeleton width={180} height={16} />
          <div style={{ height: 18 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <Skeleton circle width={140} height={140} />
            <div style={{ flex: 1 }}><SkeletonText lines={5} gap={13} /></div>
          </div>
        </ZHQSkelCard>
        <ZHQSkelCard>
          <Skeleton width={160} height={16} />
          <div style={{ height: 18 }} />
          <Skeleton width="100%" height={190} radius={14} />
        </ZHQSkelCard>
      </div>

      {/* table */}
      <ZHQSkelCard>
        <Skeleton width={170} height={16} />
        <div style={{ height: 18 }} />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: i === 4 ? 'none' : '1px solid var(--border-hairline)' }}>
            <Skeleton width={48} height={12} />
            <Skeleton circle width={26} height={26} />
            <div style={{ flex: 1 }}><Skeleton width="40%" height={13} /></div>
            <Skeleton width={70} height={20} radius="999px" />
            <Skeleton width={64} height={13} />
          </div>
        ))}
      </ZHQSkelCard>
    </div>
  );
}

Object.assign(window, { ZHQBootSplash, ZHQScreenSkeleton });
