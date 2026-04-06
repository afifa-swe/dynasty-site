import { Users, Activity, TrendingUp, DollarSign, Zap, Crown, Sparkles } from 'lucide-react';

interface StatsSummary {
  activeThisWeek: number;
  avgRating: number;
  totalVolume: number;
}

interface ActivityInsights {
  purchases: number;
  adjustments: number;
  totalDelta: number;
  topMovers: { nickname: string; delta: number }[];
  lastUpdateLabel: string;
}

interface PurchaseInsights {
  total: number;
  websiteCount: number;
  telegramCount: number;
  missingPhone: number;
  missingItems: number;
  latestWebsite?: string;
  latestTelegram?: string;
}

interface AdminInsightsTabProps {
  totalMembers: number;
  stats: StatsSummary;
  activityInsights: ActivityInsights;
  purchaseInsights: PurchaseInsights;
  purchaseAuditStatus: 'idle' | 'loading' | 'error';
  purchaseAuditError: string;
  formatAuditTimestamp: (value?: string) => string;
  onInjectPurchase?: () => void;
}

export function AdminInsightsTab({
  totalMembers,
  stats,
  activityInsights,
  purchaseInsights,
  purchaseAuditStatus,
  purchaseAuditError,
  formatAuditTimestamp,
  onInjectPurchase,
}: AdminInsightsTabProps) {
  return (
    <div className="flex min-h-0 flex-col gap-5 overflow-visible pr-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {[
          {
            label: 'Total Members',
            value: totalMembers,
            icon: <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />,
            right: <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-400/50" />,
            border: 'border-blue-500/30',
            glow: 'from-blue-500/20 to-blue-600/20',
            accent: 'text-blue-400/70',
          },
          {
            label: 'Active This Week',
            value: stats.activeThisWeek,
            icon: <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />,
            right: <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-400/50" />,
            border: 'border-green-500/30',
            glow: 'from-green-500/20 to-green-600/20',
            accent: 'text-green-400/70',
          },
          {
            label: 'Average Rating',
            value: stats.avgRating.toLocaleString(),
            icon: <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />,
            right: <Crown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400/50" />,
            border: 'border-amber-500/30',
            glow: 'from-amber-500/20 to-amber-600/20',
            accent: 'text-amber-400/70',
          },
          {
            label: 'Total Volume',
            value: `$${stats.totalVolume.toLocaleString()}`,
            icon: <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />,
            right: <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-400/50" />,
            border: 'border-purple-500/30',
            glow: 'from-purple-500/20 to-purple-600/20',
            accent: 'text-purple-400/70',
          },
        ].map((card) => (
          <div key={card.label} className="relative group">
            <div className={`absolute inset-0 bg-gradient-to-br ${card.glow} rounded-2xl blur-lg group-hover:blur-xl transition-all`} />
            <div
              className={`relative bg-slate-800/40 backdrop-blur-sm border ${card.border} rounded-2xl p-4 sm:p-5 hover:border-amber-400/50 transition-all`}
            >
              <div className="flex items-center justify-between mb-2">
                {card.icon}
                {card.right}
              </div>
              <div className="text-xl sm:text-2xl text-white">{card.value}</div>
              <div className={`text-[11px] sm:text-xs ${card.accent}`}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="relative bg-slate-800/40 backdrop-blur-sm border border-amber-500/20 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <h2 className="text-sm sm:text-base text-white">Dynamics (7d)</h2>
          <span className="text-[11px] sm:text-xs text-amber-400/60">{activityInsights.lastUpdateLabel}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="rounded-xl bg-slate-900/60 border border-amber-500/20 p-3 sm:p-4">
            <div className="text-[11px] sm:text-xs text-amber-400/60">Purchases</div>
            <div className="text-base sm:text-lg text-white">{activityInsights.purchases}</div>
          </div>
          <div className="rounded-xl bg-slate-900/60 border border-amber-500/20 p-3 sm:p-4">
            <div className="text-[11px] sm:text-xs text-amber-400/60">Adjustments</div>
            <div className="text-base sm:text-lg text-white">{activityInsights.adjustments}</div>
          </div>
          <div className="rounded-xl bg-slate-900/60 border border-amber-500/20 p-3 sm:p-4 col-span-1 sm:col-span-2">
            <div className="text-[11px] sm:text-xs text-amber-400/60">Total rating delta</div>
            <div className="text-base sm:text-lg text-white">
              {activityInsights.totalDelta >= 0 ? '+' : ''}
              {activityInsights.totalDelta}
            </div>
          </div>
        </div>
        <div className="mt-3 sm:mt-4">
          <div className="text-[11px] sm:text-xs text-amber-400/60 mb-1.5 sm:mb-2">Top movers</div>
          {activityInsights.topMovers.length === 0 ? (
            <div className="text-[11px] sm:text-xs text-amber-400/40">No movement recorded yet</div>
          ) : (
            <div className="space-y-1.5 sm:space-y-2">
              {activityInsights.topMovers.map((mover) => (
                <div key={mover.nickname} className="flex items-center justify-between text-[11px] sm:text-xs text-amber-200/80">
                  <span className="truncate">{mover.nickname}</span>
                  <span>
                    {mover.delta >= 0 ? '+' : ''}
                    {mover.delta}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="relative bg-slate-800/40 backdrop-blur-sm border border-amber-500/20 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <h2 className="text-sm sm:text-base text-white">Data Quality</h2>
          <span className="text-[11px] sm:text-xs text-amber-400/60">Purchase audit</span>
        </div>
        {purchaseAuditStatus === 'error' && (
          <div className="text-[11px] sm:text-xs text-red-300 mb-2">{purchaseAuditError}</div>
        )}
        {purchaseAuditStatus === 'loading' && (
          <div className="text-[11px] sm:text-xs text-amber-400/60 mb-2">Loading purchase audit...</div>
        )}
        {purchaseAuditStatus === 'idle' && purchaseInsights.total === 0 && (
          <div className="text-[11px] sm:text-xs text-amber-400/60 mb-2">No audit data loaded yet.</div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="rounded-xl bg-slate-900/60 border border-amber-500/20 p-3 sm:p-4">
            <div className="text-[11px] sm:text-xs text-amber-400/60">Website orders</div>
            <div className="text-base sm:text-lg text-white">{purchaseInsights.websiteCount}</div>
          </div>
          <div className="rounded-xl bg-slate-900/60 border border-amber-500/20 p-3 sm:p-4">
            <div className="text-[11px] sm:text-xs text-amber-400/60">Telegram orders</div>
            <div className="text-base sm:text-lg text-white">{purchaseInsights.telegramCount}</div>
          </div>
          <div className="rounded-xl bg-slate-900/60 border border-amber-500/20 p-3 sm:p-4">
            <div className="text-[11px] sm:text-xs text-amber-400/60">Missing phone</div>
            <div className="text-base sm:text-lg text-white">{purchaseInsights.missingPhone}</div>
          </div>
          <div className="rounded-xl bg-slate-900/60 border border-amber-500/20 p-3 sm:p-4">
            <div className="text-[11px] sm:text-xs text-amber-400/60">Missing items</div>
            <div className="text-base sm:text-lg text-white">{purchaseInsights.missingItems}</div>
          </div>
        </div>
        <div className="mt-3 sm:mt-4 text-[11px] sm:text-xs text-amber-400/60">
          Last website: {formatAuditTimestamp(purchaseInsights.latestWebsite)}
        </div>
        <div className="text-[11px] sm:text-xs text-amber-400/60">
          Last telegram: {formatAuditTimestamp(purchaseInsights.latestTelegram)}
        </div>
      </div>

      {onInjectPurchase && (
        <button
          onClick={onInjectPurchase}
          className="w-full px-4 py-3 sm:px-6 sm:py-3.5 rounded-xl bg-gradient-to-r from-purple-600/80 via-pink-600/80 to-orange-500/80 hover:from-purple-500 hover:via-pink-500 hover:to-orange-400 text-white transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] text-xs sm:text-sm font-medium border border-white/10"
        >
          <span className="flex items-center justify-center gap-2">
            <Zap className="w-4 h-4" />
            <span>Inject Test Purchase</span>
          </span>
        </button>
      )}
    </div>
  );
}
