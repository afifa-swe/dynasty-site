import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { User } from '../types/user';
import { Trophy, TrendingUp, Medal } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { motion } from 'motion/react';

interface TopListProps {
  users: User[];
  onUserClick: (user: User) => void;
  compact?: boolean;
}

export const TopList = memo(function TopList({ users, onUserClick, compact = false }: TopListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [rowHeight, setRowHeight] = useState(compact ? 72 : 88);
  const rowGap = compact ? 8 : 12;
  const rowStride = rowHeight + rowGap;
  const overscan = 4;
  const shouldAnimate = !compact && users.length <= 40;

  useEffect(() => {
    setRowHeight(compact ? 72 : 88);
  }, [compact]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const parent = listRef.current?.parentElement;
    if (!parent) return;

    const updateScroll = () => {
      setScrollTop(parent.scrollTop);
      setViewportHeight(parent.clientHeight);
    };

    updateScroll();
    parent.addEventListener('scroll', updateScroll, { passive: true });
    const resizeObserver = new ResizeObserver(updateScroll);
    resizeObserver.observe(parent);

    return () => {
      parent.removeEventListener('scroll', updateScroll);
      resizeObserver.disconnect();
    };
  }, []);

  const measureRow = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      const nextHeight = Math.round(node.getBoundingClientRect().height);
      if (nextHeight > 0 && Math.abs(nextHeight - rowHeight) > 2) {
        setRowHeight(nextHeight);
      }
    },
    [rowHeight],
  );

  const totalHeight = Math.max(0, users.length * rowStride - rowGap);
  const effectiveViewport = viewportHeight || rowStride * 10;
  const startIndex = viewportHeight
    ? Math.max(0, Math.floor(scrollTop / rowStride) - overscan)
    : 0;
  const endIndex = viewportHeight
    ? Math.min(users.length, Math.ceil((scrollTop + effectiveViewport) / rowStride) + overscan)
    : users.length;
  const visibleUsers = users.slice(startIndex, endIndex);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-amber-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-slate-300" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return null;
  };

  const getRankColor = (rank: number, faction: 'darkness' | 'light') => {
    if (rank === 1) return 'from-amber-500/20 to-yellow-500/20 border-amber-500/30';
    if (rank === 2) return 'from-slate-400/20 to-slate-500/20 border-slate-400/30';
    if (rank === 3) return 'from-amber-700/20 to-amber-800/20 border-amber-700/30';
    
    if (faction === 'darkness') {
      return 'from-red-900/20 to-red-950/30 border-red-800/30';
    }
    return 'from-amber-900/20 to-amber-950/30 border-amber-800/30';
  };

  return (
    <div ref={listRef} className="relative" style={{ height: `${totalHeight}px` }}>
      {visibleUsers.map((user, index) => {
        const actualIndex = startIndex + index;
        const top = actualIndex * rowStride;
        const baseClass = `bg-gradient-to-r ${getRankColor(
          user.rank,
          user.faction
        )} border rounded-xl ${compact ? 'p-2' : 'p-4'} cursor-pointer hover:scale-[1.02] transition-transform`;
        const style = { position: 'absolute' as const, top, left: 0, right: 0 };

        const content = (
          <div className={`flex items-center ${compact ? 'gap-2' : 'gap-4'}`}>
            <div className={`flex items-center justify-center ${compact ? 'w-8 h-8' : 'w-12 h-12'} rounded-full bg-slate-900/50 border border-slate-700/50`}>
              {compact ? (
                <span className="text-slate-300 text-xs">#{user.rank}</span>
              ) : (
                getRankIcon(user.rank) || (
                  <span className="text-slate-400">#{user.rank}</span>
                )
              )}
            </div>

            <Avatar className={`${compact ? 'w-9 h-9' : 'w-12 h-12'} border-2 border-slate-700/50`}>
              <AvatarImage src={user.avatar} alt={user.nickname} loading="lazy" decoding="async" />
              <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-600 text-white">
                {user.nickname.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <h3 className={`text-white truncate ${compact ? 'text-sm' : ''}`}>{user.nickname}</h3>
              <div className={`flex items-center gap-1 ${compact ? 'text-xs' : 'text-sm'} text-slate-400`}>
                {!compact && <TrendingUp className="w-4 h-4" />}
                <span>{user.rating.toLocaleString()}</span>
              </div>
            </div>

            {compact && (
              <div className="text-xs px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-400 border border-slate-700/30">
                {user.tier === 'legendary' ? 'L' : user.tier === 'noble' ? 'N' : 'T'}
              </div>
            )}

            {!compact && (
              <div className="flex flex-col gap-2 items-end">
                <Badge className={user.faction === 'darkness' ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}>
                  {user.faction === 'darkness' ? 'Darkness' : 'Light'}
                </Badge>
                <span className="text-slate-400 text-sm">{user.purchases} purchases</span>
              </div>
            )}
          </div>
        );

        if (!shouldAnimate) {
          return (
            <div
              key={user.id}
              ref={index === 0 ? measureRow : undefined}
              style={style}
              onClick={() => onUserClick(user)}
              className={baseClass}
            >
              {content}
            </div>
          );
        }

        return (
          <motion.div
            key={user.id}
            ref={index === 0 ? measureRow : undefined}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(0.3, actualIndex * 0.05) }}
            onClick={() => onUserClick(user)}
            className={baseClass}
            style={style}
          >
            {content}
          </motion.div>
        );
      })}
    </div>
  );
});
