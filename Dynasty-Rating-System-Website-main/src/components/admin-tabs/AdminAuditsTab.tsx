import { RefreshCw } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { IngestEventEntry, PurchaseAuditEntry, PurchaseSource } from '../../types/system';

interface AdminAuditsTabProps {
  purchaseAuditStatus: 'idle' | 'loading' | 'error';
  purchaseAuditError: string;
  purchaseAuditQuery: string;
  setPurchaseAuditQuery: (value: string) => void;
  purchaseAuditSource: 'all' | PurchaseSource;
  setPurchaseAuditSource: (value: 'all' | PurchaseSource) => void;
  filteredPurchaseAudit: PurchaseAuditEntry[];
  purchaseAuditDisplay: PurchaseAuditEntry[];
  purchaseAuditRangeLabel: string;
  purchaseAuditPageSafe: number;
  purchaseAuditTotalPages: number;
  setPurchaseAuditPage: (value: number) => void;
  loadPurchaseAudit: () => void;
  ingestStatus: 'idle' | 'loading' | 'error';
  ingestError: string;
  ingestQuery: string;
  setIngestQuery: (value: string) => void;
  ingestSource: 'all' | PurchaseSource;
  setIngestSource: (value: 'all' | PurchaseSource) => void;
  ingestResultFilter: 'all' | 'success' | 'error';
  setIngestResultFilter: (value: 'all' | 'success' | 'error') => void;
  filteredIngestEvents: IngestEventEntry[];
  ingestDisplay: IngestEventEntry[];
  ingestRangeLabel: string;
  ingestPageSafe: number;
  ingestTotalPages: number;
  setIngestPage: (value: number) => void;
  loadIngestEvents: () => void;
  auditCurrencyFormatter: Intl.NumberFormat;
  summarizePayload: (payload: unknown) => string;
}

export function AdminAuditsTab({
  purchaseAuditStatus,
  purchaseAuditError,
  purchaseAuditQuery,
  setPurchaseAuditQuery,
  purchaseAuditSource,
  setPurchaseAuditSource,
  filteredPurchaseAudit,
  purchaseAuditDisplay,
  purchaseAuditRangeLabel,
  purchaseAuditPageSafe,
  purchaseAuditTotalPages,
  setPurchaseAuditPage,
  loadPurchaseAudit,
  ingestStatus,
  ingestError,
  ingestQuery,
  setIngestQuery,
  ingestSource,
  setIngestSource,
  ingestResultFilter,
  setIngestResultFilter,
  filteredIngestEvents,
  ingestDisplay,
  ingestRangeLabel,
  ingestPageSafe,
  ingestTotalPages,
  setIngestPage,
  loadIngestEvents,
  auditCurrencyFormatter,
  summarizePayload,
}: AdminAuditsTabProps) {
  return (
    <div className="flex min-h-0 flex-col gap-5 overflow-visible pr-1">
      <div className="relative bg-slate-800/40 backdrop-blur-sm border border-amber-500/20 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <h2 className="text-sm sm:text-base text-white">Purchase Audit</h2>
          <button
            onClick={loadPurchaseAudit}
            disabled={purchaseAuditStatus === 'loading'}
            className="flex items-center gap-2 text-[11px] sm:text-xs text-amber-300/80 hover:text-amber-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${purchaseAuditStatus === 'loading' ? 'animate-spin' : ''}`} />
            {purchaseAuditStatus === 'loading' ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:flex-wrap sm:items-center">
          <Input
            placeholder="Search nickname, phone, items, order"
            value={purchaseAuditQuery}
            onChange={(e) => setPurchaseAuditQuery(e.target.value)}
            className="h-10 sm:h-11 text-sm sm:text-base bg-slate-900/60 border-amber-500/20 text-white sm:flex-[1_1_320px] sm:max-w-[480px] lg:max-w-[520px]"
          />
          <div className="sm:w-[300px] md:w-[340px]">
            <Select value={purchaseAuditSource} onValueChange={(value) => setPurchaseAuditSource(value as 'all' | PurchaseSource)}>
              <SelectTrigger className="h-10 sm:h-11 text-xs sm:text-sm bg-slate-900/60 border-amber-500/20 text-white whitespace-nowrap">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-amber-500/30 text-white">
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="website">Website</SelectItem>
                <SelectItem value="telegram">Telegram</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {purchaseAuditStatus === 'error' && (
          <div className="text-[11px] sm:text-xs text-red-300 mb-2">{purchaseAuditError}</div>
        )}
        {purchaseAuditStatus === 'loading' && (
          <div className="text-[11px] sm:text-xs text-amber-400/60 mb-2">Loading purchase history...</div>
        )}
        {purchaseAuditStatus === 'idle' && (
          <div className="text-[11px] sm:text-xs text-amber-400/60 mb-2">
            Showing {purchaseAuditRangeLabel} of {filteredPurchaseAudit.length}
          </div>
        )}

        <div className="space-y-2.5 sm:space-y-3 max-h-[480px] overflow-y-auto pr-2">
          {purchaseAuditStatus === 'idle' && purchaseAuditDisplay.length === 0 && (
            <div className="text-[11px] sm:text-sm text-amber-400/40">No purchases found</div>
          )}
          {purchaseAuditDisplay.map((entry) => {
            const timestamp = new Date(entry.createdAt).toLocaleString();
            const itemsLabel = entry.items?.length ? entry.items.join(', ') : 'No items';
            const amountLabel = auditCurrencyFormatter.format(entry.amount);
            const deltaLabel =
              typeof entry.ratingDelta === 'number'
                ? `${entry.ratingDelta >= 0 ? '+' : ''}${entry.ratingDelta}`
                : 'N/A';
            const sourceLabel = entry.source === 'telegram' ? 'Telegram' : 'Website';

            return (
              <div key={entry.id} className="rounded-lg border border-amber-500/10 bg-slate-900/50 px-3.5 py-2.5 sm:px-4 sm:py-3">
                <div className="flex items-center justify-between text-[11px] sm:text-xs text-amber-400/60">
                  <span className="uppercase tracking-wide">{sourceLabel}</span>
                  <span>{timestamp}</span>
                </div>
                <div className="text-xs sm:text-sm text-white mt-1 flex items-center gap-2">
                  <span className="truncate">{entry.user?.nickname ?? 'Unknown'}</span>
                  <Badge variant="outline" className="bg-slate-900/60 text-amber-200 border-amber-500/40">
                    #{entry.user?.rank ?? '--'}
                  </Badge>
                </div>
                <div className="text-[11px] sm:text-xs text-amber-400/60 mt-1">
                  {amountLabel} | Delta {deltaLabel} | {itemsLabel}
                </div>
                <div className="text-[11px] sm:text-xs text-amber-400/60 mt-1">
                  {entry.orderId ? `Order: ${entry.orderId}` : 'Order: N/A'}
                  {entry.factionPreference ? ` | Pref: ${entry.factionPreference}` : ''}
                </div>
                <div className="text-[11px] sm:text-xs text-amber-400/60 mt-1">
                  Phone: {entry.user?.phone ?? 'N/A'}
                </div>
              </div>
            );
          })}
        </div>

        {purchaseAuditStatus === 'idle' && filteredPurchaseAudit.length > 0 && (
          <div className="mt-4 sm:mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-amber-500/10 pt-4 pb-1 text-[11px] sm:text-xs text-amber-400/60">
            <span>
              Page {purchaseAuditPageSafe} of {purchaseAuditTotalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPurchaseAuditPage(Math.max(1, purchaseAuditPageSafe - 1))}
                disabled={purchaseAuditPageSafe === 1}
                className="h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg bg-slate-900/60 border border-amber-500/30 text-amber-200 hover:bg-slate-800/80 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPurchaseAuditPage(Math.min(purchaseAuditTotalPages, purchaseAuditPageSafe + 1))}
                disabled={purchaseAuditPageSafe === purchaseAuditTotalPages}
                className="h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg bg-slate-900/60 border border-amber-500/30 text-amber-200 hover:bg-slate-800/80 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="relative bg-slate-800/40 backdrop-blur-sm border border-amber-500/20 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <h2 className="text-sm sm:text-base text-white">Ingest Events</h2>
          <button
            onClick={loadIngestEvents}
            disabled={ingestStatus === 'loading'}
            className="flex items-center gap-2 text-[11px] sm:text-xs text-amber-300/80 hover:text-amber-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${ingestStatus === 'loading' ? 'animate-spin' : ''}`} />
            {ingestStatus === 'loading' ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:flex-wrap sm:items-center">
          <Input
            placeholder="Search nickname, phone, error, order"
            value={ingestQuery}
            onChange={(e) => setIngestQuery(e.target.value)}
            className="h-10 sm:h-11 text-sm sm:text-base bg-slate-900/60 border-amber-500/20 text-white sm:flex-[1_1_320px] sm:max-w-[480px] lg:max-w-[520px]"
          />
          <div className="sm:w-[260px] md:w-[300px] lg:w-[320px]">
            <Select value={ingestSource} onValueChange={(value) => setIngestSource(value as 'all' | PurchaseSource)}>
              <SelectTrigger className="h-10 sm:h-11 text-xs sm:text-sm bg-slate-900/60 border-amber-500/20 text-white whitespace-nowrap">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-amber-500/30 text-white">
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="website">Website</SelectItem>
                <SelectItem value="telegram">Telegram</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:w-[260px] md:w-[300px] lg:w-[320px]">
            <Select value={ingestResultFilter} onValueChange={(value) => setIngestResultFilter(value as 'all' | 'success' | 'error')}>
              <SelectTrigger className="h-10 sm:h-11 text-xs sm:text-sm bg-slate-900/60 border-amber-500/20 text-white whitespace-nowrap">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-amber-500/30 text-white">
                <SelectItem value="error">Errors only</SelectItem>
                <SelectItem value="success">Success only</SelectItem>
                <SelectItem value="all">All statuses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {ingestStatus === 'error' && (
          <div className="text-[11px] sm:text-xs text-red-300 mb-2">{ingestError}</div>
        )}
        {ingestStatus === 'loading' && (
          <div className="text-[11px] sm:text-xs text-amber-400/60 mb-2">Loading ingest events...</div>
        )}
        {ingestStatus === 'idle' && (
          <div className="text-[11px] sm:text-xs text-amber-400/60 mb-2">
            Showing {ingestRangeLabel} of {filteredIngestEvents.length}
          </div>
        )}

        <div className="space-y-2.5 sm:space-y-3 max-h-[480px] overflow-y-auto pr-2">
          {ingestStatus === 'idle' && ingestDisplay.length === 0 && (
            <div className="text-[11px] sm:text-sm text-amber-400/40">No ingest events found</div>
          )}
          {ingestDisplay.map((entry) => {
            const timestamp = new Date(entry.createdAt).toLocaleString();
            const sourceLabel = entry.source === 'telegram' ? 'Telegram' : 'Website';
            const amountLabel =
              typeof entry.amount === 'number'
                ? auditCurrencyFormatter.format(entry.amount)
                : 'Amount N/A';

            return (
              <div key={entry.id} className="rounded-lg border border-amber-500/10 bg-slate-900/50 px-3.5 py-2.5 sm:px-4 sm:py-3">
                <div className="flex items-center justify-between text-[11px] sm:text-xs text-amber-400/60">
                  <span className="uppercase tracking-wide">
                    {sourceLabel} | {entry.status}
                  </span>
                  <span>{timestamp}</span>
                </div>
                <div className="text-xs sm:text-sm text-white mt-1 flex items-center gap-2">
                  <span className="truncate">{entry.nickname ?? entry.user?.nickname ?? 'Unknown'}</span>
                  <Badge variant="outline" className="bg-slate-900/60 text-amber-200 border-amber-500/40">
                    {amountLabel}
                  </Badge>
                </div>
                {entry.errorMessage && (
                  <div className="text-[11px] sm:text-xs text-red-300 mt-1">{entry.errorMessage}</div>
                )}
                <div className="text-[11px] sm:text-xs text-amber-400/60 mt-1">
                  {entry.orderId ? `Order: ${entry.orderId}` : 'Order: N/A'}
                </div>
                <div className="text-[11px] sm:text-xs text-amber-400/60 mt-1">
                  {entry.phone ? `Phone: ${entry.phone}` : 'Phone: N/A'}
                </div>
                <div className="text-[11px] sm:text-xs text-amber-400/60 mt-1 break-words">
                  Payload: {summarizePayload(entry.rawPayload)}
                </div>
              </div>
            );
          })}
        </div>

        {ingestStatus === 'idle' && filteredIngestEvents.length > 0 && (
          <div className="mt-4 sm:mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-amber-500/10 pt-4 pb-1 text-[11px] sm:text-xs text-amber-400/60">
            <span>
              Page {ingestPageSafe} of {ingestTotalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIngestPage(Math.max(1, ingestPageSafe - 1))}
                disabled={ingestPageSafe === 1}
                className="h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg bg-slate-900/60 border border-amber-500/30 text-amber-200 hover:bg-slate-800/80 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setIngestPage(Math.min(ingestTotalPages, ingestPageSafe + 1))}
                disabled={ingestPageSafe === ingestTotalPages}
                className="h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg bg-slate-900/60 border border-amber-500/30 text-amber-200 hover:bg-slate-800/80 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
