import { RefreshCw } from 'lucide-react';
import { Badge } from '../ui/badge';
import type { ActivityLogEntry, RankHistoryEntry } from '../../types/system';

interface AdminActivityTabProps {
  activityLog: ActivityLogEntry[];
  userRankLookup: Map<string, number>;
  loadRankHistory: () => void;
  rankHistoryStatus: 'idle' | 'loading' | 'error';
  rankHistoryError: string;
  rankHistoryDisplay: RankHistoryEntry[];
}

export function AdminActivityTab({
  activityLog,
  userRankLookup,
  loadRankHistory,
  rankHistoryStatus,
  rankHistoryError,
  rankHistoryDisplay,
}: AdminActivityTabProps) {
  return (
    <div className="flex min-h-0 flex-col gap-5 overflow-visible pr-1">
      <div className="relative bg-slate-800/40 backdrop-blur-sm border border-amber-500/20 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <h2 className="text-sm sm:text-base text-white">Recent Activity</h2>
          <span className="text-[11px] sm:text-xs text-amber-400/60">Live updates</span>
        </div>
        <div className="space-y-2.5 sm:space-y-3 max-h-[380px] overflow-y-auto pr-2">
          {activityLog.length === 0 && (
            <div className="text-[11px] sm:text-sm text-amber-400/40">No activity yet</div>
          )}
          {activityLog.slice(0, 25).map((entry) => {
            const timestamp = new Date(entry.timestamp).toLocaleString();
            const typeLabel = entry.type.replace('_', '-');
            const rank = entry.userId ? userRankLookup.get(entry.userId) : undefined;
            return (
              <div key={entry.id} className="rounded-lg border border-amber-500/10 bg-slate-900/50 px-3.5 py-2.5 sm:px-4 sm:py-3">
                <div className="flex items-center justify-between text-[11px] sm:text-xs text-amber-400/60">
                  <span className="uppercase tracking-wide">{typeLabel}</span>
                  <span>{timestamp}</span>
                </div>
                <div className="text-xs sm:text-sm text-white mt-1">{entry.description}</div>
                <div className="text-[11px] sm:text-xs text-amber-400/60 mt-1">
                  {entry.userNickname}
                  {rank ? ` | Rank #${rank}` : ''}
                  {entry.source ? ` | ${entry.source}` : ''}
                  {typeof entry.delta === 'number' ? ` | ${entry.delta >= 0 ? '+' : ''}${entry.delta}` : ''}
                  {typeof entry.amount === 'number' ? ` | $${entry.amount}` : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative bg-slate-800/40 backdrop-blur-sm border border-amber-500/20 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <h2 className="text-sm sm:text-base text-white">Rank History</h2>
          <button
            onClick={loadRankHistory}
            disabled={rankHistoryStatus === 'loading'}
            className="flex items-center gap-2 text-[11px] sm:text-xs text-amber-300/80 hover:text-amber-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${rankHistoryStatus === 'loading' ? 'animate-spin' : ''}`} />
            {rankHistoryStatus === 'loading' ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        {rankHistoryStatus === 'error' && (
          <div className="text-[11px] sm:text-xs text-red-300 mb-2">{rankHistoryError}</div>
        )}
        {rankHistoryStatus === 'loading' && (
          <div className="text-[11px] sm:text-xs text-amber-400/60 mb-2">Loading rank history...</div>
        )}
        <div className="space-y-2.5 sm:space-y-3 max-h-[320px] overflow-y-auto pr-2">
          {rankHistoryStatus === 'idle' && rankHistoryDisplay.length === 0 && (
            <div className="text-[11px] sm:text-sm text-amber-400/40">No rank changes recorded</div>
          )}
          {rankHistoryDisplay.map((entry) => {
            const timestamp = new Date(entry.timestamp).toLocaleString();
            const delta = entry.fromRank - entry.toRank;
            const deltaLabel = delta === 0 ? '+/-0' : delta > 0 ? `+${delta}` : `${delta}`;
            const fromLabel = entry.fromRank > 0 ? `#${entry.fromRank}` : 'New';

            return (
              <div key={entry.id} className="rounded-lg border border-amber-500/10 bg-slate-900/50 px-3.5 py-2.5 sm:px-4 sm:py-3">
                <div className="flex items-center justify-between text-[11px] sm:text-xs text-amber-400/60">
                  <span className="uppercase tracking-wide">Rank change</span>
                  <span>{timestamp}</span>
                </div>
                <div className="text-xs sm:text-sm text-white mt-1 flex items-center gap-2">
                  <span className="truncate">{entry.user.nickname}</span>
                  <Badge variant="outline" className="bg-slate-900/60 text-amber-200 border-amber-500/40">
                    {`${fromLabel} -> #${entry.toRank}`}
                  </Badge>
                </div>
                <div className="text-[11px] sm:text-xs text-amber-400/60 mt-1">
                  Delta {deltaLabel} | Rating {entry.rating.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
