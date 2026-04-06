import { memo } from 'react';
import treeImage from 'figma:asset/7a0ac26a85cc417665b38254884871dd22d5b86b.png';

interface RealisticTreeProps {
  isMobile?: boolean;
  lowPowerMobile?: boolean;
  pauseEffects?: boolean;
}

export const RealisticTree = memo(function RealisticTree({
  isMobile = false,
  lowPowerMobile = false,
  pauseEffects = false,
}: RealisticTreeProps) {
  const liteMode = isMobile && lowPowerMobile;
  const treeSize = liteMode ? 2050 : 2200;
  const treeTop = liteMode ? -140 : -160;
  const haloInset = liteMode
    ? '17%'
    : pauseEffects
      ? '18.5% 17.5% 18% 17.5%'
      : '12.5% 14% 16.5% 14%';
  const coreInset = liteMode
    ? '24%'
    : pauseEffects
      ? '26% 24.5% 24.5% 24.5%'
      : '20.5% 21% 22.5% 21%';
  const mobileCanopyInset = '22% 24% 45% 24%';
  const desktopCanopyInset = pauseEffects ? '16% 16.5% 35% 16.5%' : '10.5% 15% 28% 15%';
  const desktopGlowTransitionDuration = pauseEffects ? '180ms' : '1000ms';
  const auraClass = liteMode
    ? 'dynasty-tree-aura dynasty-tree-aura-mobile'
    : 'dynasty-tree-aura dynasty-tree-aura-desktop';
  const coreClass = liteMode
    ? 'dynasty-tree-aura-core dynasty-tree-aura-core-mobile'
    : 'dynasty-tree-aura-core dynasty-tree-aura-core-desktop';
  const desktopBackGlowClass = `absolute inset-0 w-full h-full object-contain pointer-events-none dynasty-tree-image-glow dynasty-tree-image-glow-back dynasty-tree-effect-fade-desktop`;
  const desktopMidGlowClass = `absolute inset-0 w-full h-full object-contain pointer-events-none dynasty-tree-image-glow dynasty-tree-image-glow-mid dynasty-tree-effect-fade-desktop`;
  const desktopSparkGlowClass = `absolute inset-0 w-full h-full object-contain pointer-events-none dynasty-tree-image-glow dynasty-tree-image-glow-spark dynasty-tree-effect-fade-desktop`;
  const mobileBackGlowClass = `absolute inset-0 w-full h-full object-contain pointer-events-none dynasty-tree-image-glow dynasty-tree-image-glow-mobile dynasty-tree-effect-fade-mobile`;
  return (
    <div 
      className="absolute left-1/2 transform -translate-x-1/2 pointer-events-none"
      style={{ 
        zIndex: 1,
        width: `${treeSize}px`,
        height: `${treeSize}px`,
        top: `${treeTop}px`,
        contain: 'layout',
        overflow: 'visible',
      }}
    >
      {!liteMode && (
        <>
          <img
            src={treeImage}
            alt=""
            aria-hidden="true"
            draggable={false}
            className={desktopBackGlowClass}
            style={{
              opacity: pauseEffects ? 0.06 : 0.34,
              filter: 'brightness(0.96) saturate(1.34) blur(54px)',
              mixBlendMode: 'screen',
              transform: 'scale(1.075)',
              zIndex: 0,
              animationPlayState: pauseEffects ? 'paused' : 'running',
              transitionDuration: desktopGlowTransitionDuration,
            }}
            loading="eager"
            decoding="async"
          />
          <img
            src={treeImage}
            alt=""
            aria-hidden="true"
            draggable={false}
            className={desktopMidGlowClass}
            style={{
              opacity: pauseEffects ? 0.03 : 0.22,
              filter: 'brightness(1.02) saturate(1.24) blur(24px)',
              mixBlendMode: 'screen',
              transform: 'scale(1.04)',
              zIndex: 1,
              animationPlayState: pauseEffects ? 'paused' : 'running',
              transitionDuration: desktopGlowTransitionDuration,
            }}
            loading="eager"
            decoding="async"
          />
          <img
            src={treeImage}
            alt=""
            aria-hidden="true"
            draggable={false}
            className={desktopSparkGlowClass}
            style={{
              opacity: pauseEffects ? 0.015 : 0.14,
              filter: 'brightness(1.08) saturate(1.18) blur(10px)',
              mixBlendMode: 'screen',
              transform: 'scale(1.016)',
              zIndex: 2,
              animationPlayState: pauseEffects ? 'paused' : 'running',
              transitionDuration: desktopGlowTransitionDuration,
            }}
            loading="eager"
            decoding="async"
          />
        </>
      )}

      {liteMode && (
        <img
          src={treeImage}
          alt=""
          aria-hidden="true"
          draggable={false}
          className={mobileBackGlowClass}
          style={{
            opacity: pauseEffects ? 0.015 : 0.22,
            filter: 'brightness(0.96) saturate(1.22) blur(18px)',
            mixBlendMode: 'screen',
            transform: 'scale(1.02)',
            zIndex: 0,
            animationPlayState: pauseEffects ? 'paused' : 'running',
          }}
          loading="eager"
          decoding="async"
        />
      )}

      <div
        className={`absolute rounded-full ${liteMode ? 'dynasty-tree-effect-fade-mobile' : 'dynasty-tree-effect-fade-desktop'} ${auraClass}`}
        style={{
          inset: haloInset,
          background: liteMode
            ? 'radial-gradient(circle at 50% 38%, rgba(251, 191, 36, 0.36) 0%, rgba(245, 158, 11, 0.24) 34%, rgba(15, 23, 42, 0) 74%)'
            : 'radial-gradient(circle at 50% 38%, rgba(251, 191, 36, 0.32) 0%, rgba(245, 158, 11, 0.18) 28%, rgba(255, 244, 200, 0.06) 44%, rgba(15, 23, 42, 0) 72%)',
          filter: liteMode ? 'blur(30px)' : 'blur(52px)',
          opacity: pauseEffects ? (liteMode ? 0.04 : 0.18) : liteMode ? 0.48 : 0.42,
          animationPlayState: pauseEffects ? 'paused' : 'running',
          zIndex: 0,
          transitionDuration: liteMode ? undefined : desktopGlowTransitionDuration,
        }}
      />

      {!liteMode && (
        <div
          className="absolute rounded-full dynasty-tree-desktop-canopy dynasty-tree-effect-fade-desktop pointer-events-none"
          style={{
            inset: desktopCanopyInset,
            background:
              'radial-gradient(circle at 50% 40%, rgba(255, 247, 210, 0.34) 0%, rgba(251, 191, 36, 0.24) 24%, rgba(245, 158, 11, 0.1) 48%, rgba(15, 23, 42, 0) 76%)',
            filter: 'blur(28px)',
            mixBlendMode: 'screen',
            opacity: pauseEffects ? 0.06 : 0.28,
            animationPlayState: pauseEffects ? 'paused' : 'running',
            zIndex: 1,
            transitionDuration: desktopGlowTransitionDuration,
          }}
        />
      )}

      {liteMode && (
        <div
          className="absolute rounded-full dynasty-tree-mobile-aura dynasty-tree-effect-fade-mobile pointer-events-none"
          style={{
            inset: mobileCanopyInset,
            background:
              'radial-gradient(circle at 50% 36%, rgba(255, 244, 200, 0.34) 0%, rgba(251, 191, 36, 0.22) 24%, rgba(245, 158, 11, 0.1) 44%, rgba(15, 23, 42, 0) 70%)',
            filter: 'blur(20px)',
            opacity: pauseEffects ? 0.025 : 0.4,
            animationPlayState: pauseEffects ? 'paused' : 'running',
            zIndex: 1,
          }}
        />
      )}

      <div
        className={`absolute rounded-full ${liteMode ? 'dynasty-tree-effect-fade-mobile' : 'dynasty-tree-effect-fade-desktop'} ${coreClass}`}
        style={{
          inset: coreInset,
          background:
            'radial-gradient(circle at 50% 30%, rgba(255, 247, 210, 0.18) 0%, rgba(253, 224, 71, 0.12) 18%, rgba(245, 158, 11, 0.04) 38%, rgba(15, 23, 42, 0) 68%)',
          filter: liteMode ? 'blur(16px)' : 'blur(24px)',
          mixBlendMode: 'screen',
          opacity: pauseEffects ? (liteMode ? 0.02 : 0.06) : liteMode ? 0.24 : 0.24,
          animationPlayState: pauseEffects ? 'paused' : 'running',
          zIndex: 2,
          transitionDuration: liteMode ? undefined : desktopGlowTransitionDuration,
        }}
      />

      <img 
        src={treeImage}
        alt="Dynasty Tree"
        draggable={false}
        className="relative w-full h-full object-contain"
        style={{
          opacity: liteMode ? 0.9 : 0.92,
          filter: liteMode
            ? pauseEffects
              ? 'brightness(0.54) saturate(0.96) drop-shadow(0 4px 10px rgba(0,0,0,0.18))'
              : 'brightness(0.56) saturate(1) drop-shadow(0 0 18px rgba(251, 191, 36, 0.32)) drop-shadow(0 0 34px rgba(245, 158, 11, 0.22)) drop-shadow(0 8px 18px rgba(0,0,0,0.28))'
            : 'brightness(0.5) saturate(0.96) drop-shadow(0 0 34px rgba(251, 191, 36, 0.24)) drop-shadow(0 0 18px rgba(245, 158, 11, 0.18)) drop-shadow(0 10px 24px rgba(0,0,0,0.36))',
          zIndex: 3,
        }}
        loading="eager"
        decoding="async"
      />
    </div>
  );
});
