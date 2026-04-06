import { User } from '../types/user';
import { X, Calendar, Trophy, ShoppingBag, TrendingUp, Clock, Radio } from 'lucide-react';
import { motion } from 'motion/react';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

interface UserProfileProps {
  user: User;
  onClose: () => void;
}

export function UserProfile({ user, onClose }: UserProfileProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 lg:p-8"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-none sm:rounded-2xl shadow-2xl w-full h-full sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:max-w-md md:max-h-[calc(100vh-3rem)] md:max-w-lg lg:max-w-xl border border-amber-500/20 overflow-hidden overflow-y-auto dynasty-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-0 sm:relative h-16 sm:h-20 bg-gradient-to-br from-amber-500/90 via-amber-500/55 to-slate-900/95 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_60%)] opacity-25"></div>
          <div className="absolute inset-x-0 bottom-0 h-6 sm:h-8 bg-gradient-to-b from-transparent to-slate-900/95"></div>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2.5 sm:p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors text-white z-20"
          >
            <X className="w-5 h-5 sm:w-5 sm:h-5" />
          </button>
        </div>

        <div className="relative z-10 px-4 sm:px-6 md:px-8 -mt-10 sm:-mt-12 mb-3 sm:mb-4 pointer-events-none">
          <Avatar className="w-24 h-24 sm:w-28 sm:h-28 border-4 border-slate-900 shadow-xl pointer-events-auto">
            <AvatarImage src={user.avatar} alt={user.nickname} />
            <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-600 text-white text-2xl sm:text-3xl">
              {user.nickname.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="px-4 sm:px-6 md:px-8 pb-6 md:pb-8">
          <div className="mb-4">
            <h2 className="text-white text-xl sm:text-2xl mb-2">{user.nickname}</h2>
            <div className="flex gap-2 flex-wrap">
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[11px] sm:text-xs">
                Rank #{user.rank}
              </Badge>
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[11px] sm:text-xs">
                {user.rating.toLocaleString()} pts
              </Badge>
              <Badge className={`${user.faction === 'darkness' ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'} text-[11px] sm:text-xs`}>
                {user.faction === 'darkness' ? 'Darkness' : 'Light'}
              </Badge>
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 capitalize text-[11px] sm:text-xs">
                {user.tier === 'legendary' ? 'Legendary' : user.tier === 'noble' ? 'Noble Circle' : 'Treasure Hunter'}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
            <ProfileStat
              icon={<Calendar className="w-4 h-4" />}
              label="Joined"
              value={formatDate(user.joinDate)}
            />
            <ProfileStat
              icon={<ShoppingBag className="w-4 h-4" />}
              label="Purchases"
              value={user.purchases.toString()}
            />
            <ProfileStat
              icon={<TrendingUp className="w-4 h-4" />}
              label="Rating"
              value={`${user.rating.toLocaleString()} points`}
              full
            />
            <ProfileStat
              icon={<Clock className="w-4 h-4" />}
              label="Last Activity"
              value={formatRelative(user.lastActive)}
            />
            <ProfileStat
              icon={<ShoppingBag className="w-4 h-4" />}
              label="Lifetime Volume"
              value={currencyFormatter.format(user.totalVolume ?? 0)}
            />
            <ProfileStat
              icon={<Radio className="w-4 h-4" />}
              label="Preferred Channel"
              value={formatChannel(user.preferredChannel)}
            />
          </div>

          {user.achievements.length > 0 && (
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30 mb-4">
              <div className="flex items-center gap-2 text-amber-400 mb-3">
                <Trophy className="w-5 h-5" />
                <span>Achievements</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {user.achievements.map((achievement, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="bg-amber-500/10 text-amber-200 border-amber-500/30"
                  >
                    {achievement}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

interface ProfileStatProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  full?: boolean;
}

function ProfileStat({ icon, label, value, full = false }: ProfileStatProps) {
  return (
    <div className={`bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 ${full ? 'col-span-2' : ''}`}>
      <div className="flex items-center gap-2 text-slate-400 mb-1 text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-white text-base">{value || 'N/A'}</div>
    </div>
  );
}

function formatDate(date?: string) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelative(date?: string) {
  if (!date) return 'N/A';
  const last = new Date(date).getTime();
  const diffHours = (Date.now() - last) / (1000 * 60 * 60);
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

function formatChannel(channel?: string) {
  if (!channel) return '—';
  return channel === 'telegram' ? 'Telegram bot' : 'Website';
}
