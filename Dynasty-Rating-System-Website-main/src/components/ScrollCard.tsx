import { memo, useCallback } from 'react';
import { User } from '../types/user';

interface ScrollCardProps {
  user: User;
  onClick: (user: User) => void;
  index?: number;
  isNewlyAdded?: boolean;
  showDetails?: boolean;
  size?: 'md' | 'sm';
  reduceEffects?: boolean;
}

export const ScrollCard = memo(function ScrollCard({
  user,
  onClick,
  index = 0,
  isNewlyAdded = false,
  showDetails = true,
  size = 'md',
  reduceEffects = false,
}: ScrollCardProps) {
  const isDarkness = user.faction === 'darkness';
  const isCompact = size === 'sm';
  const cardWidth = isCompact ? 128 : 152;
  const cardHeight = isCompact ? 96 : 114;
  const baseNameSize = isCompact ? 11 : 13;
  const nameLength = user.nickname.length;
  const overflowChars = Math.max(0, nameLength - (isCompact ? 10 : 12));
  const shrinkSteps = Math.min(3, Math.floor(overflowChars / 3));
  const nameSize = `${Math.max(baseNameSize - shrinkSteps, isCompact ? 10 : 12)}px`;
  const ratingSize = isCompact ? '12px' : '14px';
  const ptsSize = isCompact ? '10px' : '12px';
  const isTopLegendary = showDetails && user.rank <= 10 && user.tier === 'legendary';
  const desktopEffects = !reduceEffects && !isCompact;
  const formattedRating = user.rating.toLocaleString();
  const handleClick = useCallback(() => {
    onClick(user);
  }, [onClick, user]);

  return (
    <div
      onClick={handleClick}
      className={`dynasty-scroll-card relative cursor-pointer group touch-manipulation ${
        reduceEffects ? '' : 'interactive'
      } ${isNewlyAdded ? 'dynasty-scroll-card-enter' : ''}`}
      style={{
        width: `${cardWidth}px`,
        height: `${cardHeight}px`,
        animationDelay: isNewlyAdded ? `${Math.min(index * 20, 120)}ms` : undefined,
      }}
    >
      {/* Scroll background */}
      <div
        className="relative dynasty-scroll-card-body"
        style={{
          filter: reduceEffects
            ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))'
            : desktopEffects
              ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
              : 'drop-shadow(0 1px 3px rgba(0,0,0,0.08))',
        }}
      >
        {/* Simplified Scroll SVG - Reusable gradients */}
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 160 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Scroll Paper Body with Darker Texture */}
          <defs>
            <linearGradient id={`scrollGrad${user.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={isDarkness ? '#3D2F24' : '#7A6A54'} />
              <stop offset="50%" stopColor={isDarkness ? '#2E2419' : '#635446'} />
              <stop offset="100%" stopColor={isDarkness ? '#1F1810' : '#4D4035'} />
            </linearGradient>
          </defs>
          
          {/* Main scroll body */}
          <rect
            x="15"
            y="20"
            width="130"
            height="80"
            fill={`url(#scrollGrad${user.id})`}
            stroke={isDarkness ? '#1A130E' : '#2E2419'}
            strokeWidth="2"
            rx="1"
          />
          
          {/* Left Roll - Dark Wood */}
          <g>
            <rect x="8" y="20" width="14" height="80" fill={isDarkness ? '#2E2419' : '#3D2F24'} stroke={isDarkness ? '#1A130E' : '#2E2419'} strokeWidth="2"/>
            <line x1="10" y1="25" x2="20" y2="25" stroke={isDarkness ? '#1A130E' : '#2A1F17'} strokeWidth="0.5" opacity="0.4"/>
            <line x1="10" y1="55" x2="20" y2="55" stroke={isDarkness ? '#1A130E' : '#2A1F17'} strokeWidth="0.5" opacity="0.4"/>
            <line x1="10" y1="85" x2="20" y2="85" stroke={isDarkness ? '#1A130E' : '#2A1F17'} strokeWidth="0.5" opacity="0.4"/>
            <rect x="8" y="35" width="14" height="3" fill={isDarkness ? '#1A130E' : '#221A13'} opacity="0.6"/>
            <rect x="8" y="82" width="14" height="3" fill={isDarkness ? '#1A130E' : '#221A13'} opacity="0.6"/>
            <ellipse cx="15" cy="20" rx="7" ry="3.5" fill={isDarkness ? '#3D2F24' : '#4D4035'} stroke={isDarkness ? '#1A130E' : '#2E2419'} strokeWidth="1.5"/>
            <ellipse cx="15" cy="100" rx="7" ry="3.5" fill={isDarkness ? '#221A13' : '#2E2419'} stroke={isDarkness ? '#1A130E' : '#2E2419'} strokeWidth="1.5"/>
          </g>
          
          {/* Right Roll - Dark Wood */}
          <g>
            <rect x="138" y="20" width="14" height="80" fill={isDarkness ? '#2E2419' : '#3D2F24'} stroke={isDarkness ? '#1A130E' : '#2E2419'} strokeWidth="2"/>
            <line x1="140" y1="25" x2="150" y2="25" stroke={isDarkness ? '#1A130E' : '#2A1F17'} strokeWidth="0.5" opacity="0.4"/>
            <line x1="140" y1="55" x2="150" y2="55" stroke={isDarkness ? '#1A130E' : '#2A1F17'} strokeWidth="0.5" opacity="0.4"/>
            <line x1="140" y1="85" x2="150" y2="85" stroke={isDarkness ? '#1A130E' : '#2A1F17'} strokeWidth="0.5" opacity="0.4"/>
            <rect x="138" y="35" width="14" height="3" fill={isDarkness ? '#1A130E' : '#221A13'} opacity="0.6"/>
            <rect x="138" y="82" width="14" height="3" fill={isDarkness ? '#1A130E' : '#221A13'} opacity="0.6"/>
            <ellipse cx="145" cy="20" rx="7" ry="3.5" fill={isDarkness ? '#3D2F24' : '#4D4035'} stroke={isDarkness ? '#1A130E' : '#2E2419'} strokeWidth="1.5"/>
            <ellipse cx="145" cy="100" rx="7" ry="3.5" fill={isDarkness ? '#221A13' : '#2E2419'} stroke={isDarkness ? '#1A130E' : '#2E2419'} strokeWidth="1.5"/>
          </g>
          
          {/* Inner border */}
          <rect
            x="20"
            y="25"
            width="120"
            height="70"
            fill="none"
            stroke={isDarkness ? '#8B6914' : '#5A4A2A'}
            strokeWidth="0.5"
            opacity="0.3"
            rx="1"
          />
          
          {/* Wax seal (for top ranked) */}
          {isTopLegendary && (
            <g>
              <circle cx="142" cy="26" r="9" fill="#5C0000" opacity="0.95"/>
              <circle cx="142" cy="26" r="7" fill="#7A0000" opacity="0.8"/>
              <circle cx="142" cy="26" r="5" fill="#8B0000" opacity="0.7"/>
              <text x="142" y="29" textAnchor="middle" fill="#B8860B" fontSize="7" fontWeight="bold">★</text>
            </g>
          )}
        </svg>

        {/* Content overlay */}
        {showDetails && (
          <>
            <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="px-2 py-1 rounded-md bg-slate-900/90 text-[10px] text-amber-200 border border-amber-500/30 shadow-lg max-w-[220px] whitespace-normal text-center">
                {user.nickname}
              </div>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4 pt-2">
              <div
                className="text-center truncate w-full px-2 mb-1"
                title={user.nickname}
                style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: nameSize,
                  fontWeight: '600',
                  color: isDarkness ? '#C9A961' : '#DAA520',
                  textShadow: isDarkness 
                    ? '0 2px 6px rgba(0,0,0,0.9), 0 0 15px rgba(201,169,97,0.4)' 
                    : '0 2px 6px rgba(0,0,0,0.8), 0 0 12px rgba(218,165,32,0.3)',
                  letterSpacing: '0.5px',
                }}
              >
                {user.nickname}
              </div>
            <div
              className="mt-1"
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: ratingSize,
                fontWeight: 'bold',
                color: isDarkness ? '#B8860B' : '#CD9B1D',
                textShadow: '0 2px 4px rgba(0,0,0,0.8)',
              }}
            >
              {formattedRating}
            </div>
            <div
              className="text-xs mt-0.5"
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: ptsSize,
                color: isDarkness ? '#8B6914' : '#9A7B1A',
                opacity: 0.7,
              }}
            >
              pts
            </div>
            </div>
          </>
        )}

        {/* Rank badge */}
        {isTopLegendary && (
          <div className={`absolute -top-2 -right-2 ${isCompact ? 'w-7 h-7' : 'w-9 h-9'} rounded-full bg-gradient-to-br from-amber-600 via-amber-700 to-amber-900 border-2 border-amber-950 flex items-center justify-center shadow-xl`}>
            <div className={`text-amber-200 font-bold ${isCompact ? 'text-[10px]' : 'text-xs'}`} style={{ fontFamily: 'Georgia, serif' }}>#{user.rank}</div>
          </div>
        )}

        {/* Subtle glow on hover */}
        {!reduceEffects && (
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none rounded-lg bg-gradient-to-br from-amber-200/6 via-amber-600/8 to-amber-950/12">
          </div>
        )}

        {!reduceEffects && user.rank === 1 && user.tier === 'legendary' && (
          <div
            className="dynasty-scroll-card-king-glow absolute pointer-events-none rounded-full"
            style={{
              inset: '-22px',
              background:
                'radial-gradient(circle at center, rgba(253, 224, 71, 0.24) 0%, rgba(245, 158, 11, 0.18) 42%, rgba(120, 53, 15, 0.02) 72%, transparent 100%)',
              filter: 'blur(14px)',
            }}
          />
        )}

        {!reduceEffects && isNewlyAdded && (
          <div
            className="dynasty-scroll-card-enter absolute inset-0 pointer-events-none rounded-lg"
            style={{
              animationDuration: '700ms',
              animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/25 via-pink-500/20 to-amber-500/18 rounded-lg" />
          </div>
        )}
      </div>
    </div>
  );
});
