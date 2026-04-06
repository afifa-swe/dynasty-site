import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import {
  Activity,
  DollarSign,
  Eye,
  EyeOff,
  Edit2,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  TrendingUp,
  Users,
  X,
  Zap,
  Crown,
  Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { fetchActivityInsights, fetchAdminPurchases, fetchIngestEvents, fetchRankHistory, getApiBase, loginAdmin, verifyAdminToken } from '../lib/ratingsEngine';
import { normalizePhone, phoneDigits, sanitizePhoneInput } from '../lib/phone';
import { User } from '../types/user';
import { ActivityInsightsPayload, ActivityLogEntry, IngestEventEntry, ManualUserPayload, PurchaseAuditEntry, PurchaseSource, RankHistoryEntry, RatingAdjustmentPayload, RatingRules } from '../types/system';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useIsMobile } from './ui/use-mobile';

const AdminInsightsTab = lazy(() => import('./admin-tabs/AdminInsightsTab').then((mod) => ({ default: mod.AdminInsightsTab })));
const AdminRulesTab = lazy(() => import('./admin-tabs/AdminRulesTab').then((mod) => ({ default: mod.AdminRulesTab })));
const AdminActivityTab = lazy(() => import('./admin-tabs/AdminActivityTab').then((mod) => ({ default: mod.AdminActivityTab })));
const AdminAuditsTab = lazy(() => import('./admin-tabs/AdminAuditsTab').then((mod) => ({ default: mod.AdminAuditsTab })));

const auditCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const formatAuditTimestamp = (value?: string) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString();
};

const formatPayload = (payload: unknown) => {
  if (payload === null || payload === undefined) return 'N/A';
  try {
    const text = JSON.stringify(payload);
    return text || 'N/A';
  } catch {
    return String(payload);
  }
};

const toDateInputValue = (value?: string) => {
  if (!value) return '';
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const getTodayInputValue = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const normalizeOptionalInput = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const isValidDateInput = (value: string) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const isFutureDateInput = (value: string, todayValue: string) => value > todayValue;

const isValidUrlInput = (value: string) => {
  if (!value) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const MEMBERS_PAGE_SIZE = 12;
const PURCHASE_AUDIT_PAGE_SIZE = 12;
const INGEST_PAGE_SIZE = 12;

interface AdminPanelProps {
  users: User[];
  rules: RatingRules;
  activityLog: ActivityLogEntry[];
  serverAvailable?: boolean;
  lastEventAt?: string | null;
  onClose: () => void;
  onUpdateUser: (userId: string, updates: Partial<User>) => boolean | void | Promise<boolean | void>;
  onAddUser?: (payload: ManualUserPayload) => void;
  /**
   * Optional backend-aware adjuster. If provided, rating changes
   * will be sent here so they persist server-side.
   */
  onAdjustRating?: (payload: RatingAdjustmentPayload) => boolean | void | Promise<boolean | void>;
  onDeleteUser: (userId: string) => void;
  onInjectPurchase?: () => void;
  onUpdateRules: (payload: Partial<RatingRules>) => boolean | void | Promise<boolean | void>;
}

export const AdminPanel = memo(function AdminPanel({
  users,
  rules,
  activityLog,
  serverAvailable = false,
  lastEventAt,
  onClose,
  onUpdateUser,
  onAddUser,
  onAdjustRating,
  onDeleteUser,
  onInjectPurchase,
  onUpdateRules,
}: AdminPanelProps) {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState('');
  const [factionFilter, setFactionFilter] = useState<'all' | 'darkness' | 'light'>('all');
  const [tierFilter, setTierFilter] = useState<'all' | 'legendary' | 'noble' | 'treasure'>('all');
  const [adminTab, setAdminTab] = useState<'members' | 'insights' | 'rules' | 'activity' | 'audits'>('members');
  const [membersPage, setMembersPage] = useState(1);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    nickname: '',
    rating: '',
    phone: '',
    avatar: '',
    joinDate: '',
    tier: '',
    faction: '',
  });
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    nickname: '',
    rating: '',
    phone: '',
    avatar: '',
    joinDate: '',
    faction: 'darkness' as 'darkness' | 'light',
    tier: 'treasure' as 'legendary' | 'noble' | 'treasure',
  });
  const [addUserNotice, setAddUserNotice] = useState<string | null>(null);
  const [rulesForm, setRulesForm] = useState({
    basePointsPerDollar: '',
    websiteBonusPercent: '',
    telegramBonusPercent: '',
    highValueThreshold: '',
    highValueBonusPercent: '',
    decayPerDay: '',
  });
  const [adminToken, setAdminToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [showTokenLogin, setShowTokenLogin] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [activityInsightsRemote, setActivityInsightsRemote] = useState<ActivityInsights | null>(null);
  const [loginStatus, setLoginStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [loginError, setLoginError] = useState('');
  const [adminTokenStatus, setAdminTokenStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid' | 'unverified'>(
    'idle',
  );
  const [purchaseAudit, setPurchaseAudit] = useState<PurchaseAuditEntry[]>([]);
  const [purchaseAuditStatus, setPurchaseAuditStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [purchaseAuditError, setPurchaseAuditError] = useState('');
  const [purchaseAuditSource, setPurchaseAuditSource] = useState<'all' | PurchaseSource>('all');
  const [purchaseAuditQuery, setPurchaseAuditQuery] = useState('');
  const [purchaseAuditPage, setPurchaseAuditPage] = useState(1);
  const [ingestEvents, setIngestEvents] = useState<IngestEventEntry[]>([]);
  const [ingestStatus, setIngestStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [ingestError, setIngestError] = useState('');
  const [ingestSource, setIngestSource] = useState<'all' | PurchaseSource>('all');
  const [ingestResultFilter, setIngestResultFilter] = useState<'all' | 'success' | 'error'>('error');
  const [ingestQuery, setIngestQuery] = useState('');
  const [ingestPage, setIngestPage] = useState(1);
  const [rankHistory, setRankHistory] = useState<RankHistoryEntry[]>([]);
  const [rankHistoryStatus, setRankHistoryStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [rankHistoryError, setRankHistoryError] = useState('');
  const membersScrollRef = useRef<HTMLDivElement>(null);
  const membersListRef = useRef<HTMLDivElement>(null);
  const membersProbeRef = useRef<HTMLDivElement>(null);
  const [membersScrollTop, setMembersScrollTop] = useState(0);
  const [membersViewportHeight, setMembersViewportHeight] = useState(0);
  const defaultMembersRowHeight = isMobile ? 360 : 180;
  const [membersRowHeight, setMembersRowHeight] = useState(defaultMembersRowHeight);

  useEffect(() => {
    setMembersRowHeight(defaultMembersRowHeight);
  }, [defaultMembersRowHeight]);

  const verifyToken = async (token: string, options: { silent?: boolean } = {}) => {
    if (typeof window === 'undefined') return;
    const trimmed = token.trim();
    if (!trimmed) return;

    const apiBase = getApiBase();
    if (!apiBase) {
      window.localStorage.setItem('dynasty_admin_token', trimmed);
      setAdminTokenStatus('unverified');
      if (!options.silent) {
        toast('Admin token saved', {
          description: 'Backend not detected to verify yet.',
        });
      }
      return;
    }

    setAdminTokenStatus('checking');
    try {
      const result = await verifyAdminToken(apiBase, trimmed);
      if (result.ok) {
        window.localStorage.setItem('dynasty_admin_token', trimmed);
        setAdminTokenStatus('valid');
        if (!options.silent) {
          toast.success('Admin token verified');
        }
        return;
      }

      window.localStorage.removeItem('dynasty_admin_token');
      setAdminTokenStatus('invalid');
      if (!options.silent) {
        toast.error(result.error ?? 'Invalid admin token');
      }
    } catch (error) {
      window.localStorage.setItem('dynasty_admin_token', trimmed);
      setAdminTokenStatus('unverified');
      if (!options.silent) {
        toast('Admin token saved', {
          description: 'Unable to verify (server unreachable).',
        });
      }
    }
  };

  useEffect(() => {
    setRulesForm({
      basePointsPerDollar: rules.basePointsPerDollar.toString(),
      websiteBonusPercent: rules.websiteBonusPercent.toString(),
      telegramBonusPercent: rules.telegramBonusPercent.toString(),
      highValueThreshold: rules.highValueThreshold.toString(),
      highValueBonusPercent: rules.highValueBonusPercent.toString(),
      decayPerDay: rules.decayPerDay.toString(),
    });
  }, [rules]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('dynasty_admin_token') ?? '';
    setAdminToken(saved);
    if (saved.trim()) {
      void verifyToken(saved, { silent: true });
    }
  }, []);

  useEffect(() => {
    setPurchaseAuditPage(1);
  }, [purchaseAuditQuery, purchaseAuditSource]);

  useEffect(() => {
    setIngestPage(1);
  }, [ingestQuery, ingestSource, ingestResultFilter]);

  useEffect(() => {
    setMembersPage(1);
  }, [searchQuery, factionFilter, tierFilter]);

  const userRankLookup = useMemo(() => {
    return new Map(users.map((user) => [user.id, user.rank]));
  }, [users]);

  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const activeThisWeek = users.filter((u) => {
      if (!u.lastActive) return false;
      const last = new Date(u.lastActive);
      return !Number.isNaN(last.getTime()) && last >= weekAgo;
    }).length;

    const avgRating = users.length
      ? Math.round(users.reduce((sum, u) => sum + u.rating, 0) / users.length)
      : 0;

    const totalVolume = users.reduce((sum, u) => sum + (u.totalVolume ?? 0), 0);

    return { activeThisWeek, avgRating, totalVolume };
  }, [users]);

  const localActivityInsights = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = activityLog.filter((entry) => {
      const time = new Date(entry.timestamp).getTime();
      return Number.isFinite(time) && time >= cutoff;
    });

    const purchases = recent.filter((entry) => entry.type === 'purchase');
    const adjustments = recent.filter((entry) => entry.type === 'adjustment');
    const totalDelta = recent.reduce((sum, entry) => sum + (entry.delta ?? 0), 0);

    const moversMap = new Map<string, { nickname: string; delta: number }>();
    recent.forEach((entry) => {
      if (!entry.userId || typeof entry.delta !== 'number') return;
      const existing = moversMap.get(entry.userId);
      const nextDelta = (existing?.delta ?? 0) + entry.delta;
      moversMap.set(entry.userId, { nickname: entry.userNickname, delta: nextDelta });
    });

    const topMovers = Array.from(moversMap.values())
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3);

    const lastUpdate = recent.reduce((latest, entry) => {
      const time = new Date(entry.timestamp).getTime();
      return Number.isFinite(time) && time > latest ? time : latest;
    }, 0);

    return {
      purchases: purchases.length,
      adjustments: adjustments.length,
      totalDelta,
      topMovers,
      lastUpdateLabel: lastUpdate ? new Date(lastUpdate).toLocaleString() : 'No recent activity',
    };
  }, [activityLog]);

  const activityInsights = activityInsightsRemote ?? localActivityInsights;
  const dynamicsLabel = activityInsightsRemote ? 'Dynamics (7d)' : 'Dynamics (recent activity)';

  const purchaseInsights = useMemo(() => {
    const total = purchaseAudit.length;
    const website = purchaseAudit.filter((entry) => entry.source === 'website');
    const telegram = purchaseAudit.filter((entry) => entry.source === 'telegram');
    const missingPhone = purchaseAudit.filter((entry) => !entry.user?.phone).length;
    const missingItems = purchaseAudit.filter((entry) => !entry.items || entry.items.length === 0).length;

    const latestWebsite = purchaseAudit.find((entry) => entry.source === 'website')?.createdAt;
    const latestTelegram = purchaseAudit.find((entry) => entry.source === 'telegram')?.createdAt;

    return {
      total,
      websiteCount: website.length,
      telegramCount: telegram.length,
      missingPhone,
      missingItems,
      latestWebsite,
      latestTelegram,
    };
  }, [purchaseAudit]);

  const tokenStatusMeta = useMemo(() => {
    switch (adminTokenStatus) {
      case 'checking':
        return { label: 'Checking token...', dot: 'bg-slate-300', text: 'text-slate-200' };
      case 'valid':
        return { label: 'Token verified', dot: 'bg-emerald-400', text: 'text-emerald-300' };
      case 'invalid':
        return { label: 'Token invalid', dot: 'bg-red-400', text: 'text-red-300' };
      case 'unverified':
        return { label: 'Backend unavailable', dot: 'bg-amber-400', text: 'text-amber-300/80' };
      default:
        return { label: 'Token not verified', dot: 'bg-amber-400/70', text: 'text-amber-300/70' };
    }
  }, [adminTokenStatus]);

  const isAuthenticated = adminTokenStatus === 'valid';
  const tierLocked = serverAvailable;
  const tabTriggerClass =
    'flex-1 min-w-0 px-1.5 sm:px-3 text-[10px] sm:text-xs uppercase tracking-normal sm:tracking-wide font-semibold text-amber-200/80 ' +
    'data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-100 data-[state=active]:border-amber-500/40 ' +
    'hover:text-amber-100';
  const tabFallback = (
    <div className="rounded-2xl border border-amber-500/20 bg-slate-900/40 p-6 text-[11px] sm:text-xs text-amber-300/70">
      Loading tab...
    </div>
  );

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch = user.nickname.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFaction = factionFilter === 'all' || user.faction === factionFilter;
      const matchesTier = tierFilter === 'all' || user.tier === tierFilter;
      return matchesSearch && matchesFaction && matchesTier;
    });
  }, [users, searchQuery, factionFilter, tierFilter]);

  const shouldVirtualizeMembers = isMobile || filteredUsers.length > MEMBERS_PAGE_SIZE;

  useEffect(() => {
    if (shouldVirtualizeMembers && membersPage !== 1) {
      setMembersPage(1);
    }
  }, [shouldVirtualizeMembers, membersPage]);

  const membersTotalPages = useMemo(() => {
    if (shouldVirtualizeMembers) return 1;
    return Math.max(1, Math.ceil(filteredUsers.length / MEMBERS_PAGE_SIZE));
  }, [filteredUsers.length, shouldVirtualizeMembers]);

  const membersPageSafe = Math.min(membersPage, membersTotalPages);

  const membersDisplay = useMemo(() => {
    if (shouldVirtualizeMembers) return filteredUsers;
    const start = (membersPageSafe - 1) * MEMBERS_PAGE_SIZE;
    return filteredUsers.slice(start, start + MEMBERS_PAGE_SIZE);
  }, [filteredUsers, membersPageSafe, shouldVirtualizeMembers]);

  const membersRangeLabel = useMemo(() => {
    if (filteredUsers.length === 0) return '0';
    if (shouldVirtualizeMembers) return `1-${filteredUsers.length}`;
    const start = (membersPageSafe - 1) * MEMBERS_PAGE_SIZE + 1;
    const end = Math.min(filteredUsers.length, start + MEMBERS_PAGE_SIZE - 1);
    return `${start}-${end}`;
  }, [filteredUsers.length, membersPageSafe, shouldVirtualizeMembers]);

  const updateMembersViewport = useCallback(() => {
    const scrollEl = membersScrollRef.current;
    if (!scrollEl) return;
    setMembersViewportHeight(scrollEl.clientHeight);

    const listEl = membersListRef.current;
    if (!listEl) {
      setMembersScrollTop(scrollEl.scrollTop);
      return;
    }

    const scrollRect = scrollEl.getBoundingClientRect();
    const listRect = listEl.getBoundingClientRect();
    const listOffsetTop = listRect.top - scrollRect.top + scrollEl.scrollTop;
    const nextScrollTop = Math.max(0, scrollEl.scrollTop - listOffsetTop);
    setMembersScrollTop(nextScrollTop);
  }, []);

  useEffect(() => {
    if (adminTab !== 'members') return;
    const scrollEl = membersScrollRef.current;
    if (!scrollEl) return;

    updateMembersViewport();
    const handleScroll = () => updateMembersViewport();
    scrollEl.addEventListener('scroll', handleScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(handleScroll);
      resizeObserver.observe(scrollEl);
    }

    return () => {
      scrollEl.removeEventListener('scroll', handleScroll);
      resizeObserver?.disconnect();
    };
  }, [adminTab, updateMembersViewport]);

  useEffect(() => {
    if (adminTab !== 'members') return;
    requestAnimationFrame(() => updateMembersViewport());
    const timer = window.setTimeout(() => updateMembersViewport(), 220);
    return () => window.clearTimeout(timer);
  }, [adminTab, membersDisplay.length, updateMembersViewport]);

  useLayoutEffect(() => {
    if (adminTab !== 'members') return;
    const probe = membersProbeRef.current;
    if (!probe) return;

    const updateProbeHeight = () => {
      const nextHeight = Math.ceil(probe.getBoundingClientRect().height);
      if (nextHeight > 0 && nextHeight !== membersRowHeight) {
        setMembersRowHeight(Math.max(nextHeight, defaultMembersRowHeight));
      }
    };

    updateProbeHeight();
    if (typeof ResizeObserver === 'undefined') return;
    const resizeObserver = new ResizeObserver(updateProbeHeight);
    resizeObserver.observe(probe);

    return () => resizeObserver.disconnect();
  }, [adminTab, defaultMembersRowHeight, membersRowHeight]);

  const membersRowGap = isMobile ? 18 : 16;
  const membersRowStride = membersRowHeight + membersRowGap;
  const membersTotalHeight = Math.max(0, membersDisplay.length * membersRowStride - membersRowGap);
  const membersOverscan = 3;
  const membersViewport = membersViewportHeight || membersScrollRef.current?.clientHeight || membersRowStride * 6;
  const todayInput = getTodayInputValue();
  const membersStartIndex = shouldVirtualizeMembers
    ? Math.max(0, Math.floor(membersScrollTop / membersRowStride) - membersOverscan)
    : 0;
  const membersEndIndex = shouldVirtualizeMembers
    ? Math.min(membersDisplay.length, Math.ceil((membersScrollTop + membersViewport) / membersRowStride) + membersOverscan)
    : membersDisplay.length;
  const visibleMembers = membersDisplay.slice(membersStartIndex, membersEndIndex);

  const memberProbeUser = useMemo<User>(
    () => ({
      id: 'probe',
      nickname: 'CelestialLongName',
      rating: 999999,
      rank: 99,
      faction: 'darkness',
      tier: 'legendary',
      avatar: '',
      joinDate: new Date().toISOString(),
      purchases: 999,
      achievements: [],
      lastActive: new Date().toISOString(),
      totalVolume: 0,
    }),
    [],
  );

  const renderMemberCard = (user: User, options: { fixedHeight?: boolean } = {}) => {
    const { fixedHeight = true } = options;

    return (
    <>
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none" />
      <div
        className={`relative isolate border border-amber-500/20 rounded-2xl p-4 sm:p-5 hover:border-amber-500/40 transition-all overflow-hidden ${fixedHeight ? 'h-full' : ''}`}
      >
        <div className="absolute inset-0 rounded-2xl bg-slate-800/30 backdrop-blur-sm pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-3 sm:gap-4 h-full">
          <Avatar className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 border-2 border-amber-500/30">
            <AvatarImage src={user.avatar} alt={user.nickname} loading="lazy" decoding="async" />
            <AvatarFallback className="bg-gradient-to-br from-amber-500 to-amber-700 text-white text-base sm:text-lg">
              {user.nickname.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
              <h3 className="text-base sm:text-lg text-white truncate">{user.nickname}</h3>
              <Badge variant="outline" className="bg-slate-900/60 text-amber-200 border-amber-500/40">
                #{user.rank}
              </Badge>
              <Badge
                variant="outline"
                className={
                  user.faction === 'darkness'
                    ? 'bg-red-500/20 text-red-300 border-red-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }
              >
                {user.faction === 'darkness' ? 'Darkness' : 'Light'}
              </Badge>
              <Badge variant="outline" className="bg-slate-700/50 text-amber-300 border-amber-500/30">
                {user.tier === 'legendary'
                  ? 'Legendary'
                  : user.tier === 'noble'
                  ? 'Noble Circle'
                  : 'Treasure Hunters'}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-amber-400/70">
              <span className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                {user.rating.toLocaleString()} pts
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                {user.purchases.toLocaleString()} purchases
              </span>
              <span className="text-[11px] sm:text-xs text-amber-200/60">
                Last: {user.lastActive ?? user.joinDate ?? 'N/A'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full lg:w-auto lg:ml-auto pt-2 lg:pt-0 mt-auto lg:mt-0">
            <Dialog>
              <DialogTrigger asChild>
                <button
                  onClick={() => handleEdit(user)}
                  className="px-3 h-9 sm:px-4 sm:h-10 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-2 text-xs sm:text-sm"
                >
                  <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Edit</span>
                </button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900/95 backdrop-blur-xl border-amber-500/30 text-white rounded-2xl px-5 py-3 sm:px-7 sm:py-5 md:px-8 md:py-6 lg:px-10 lg:py-6 gap-2 sm:gap-4 max-h-[85vh] sm:max-h-[90vh] w-[94vw] sm:w-full max-w-[560px] sm:max-w-[640px] md:max-w-[720px] lg:max-w-[760px] overflow-hidden flex flex-col min-h-0">
                <DialogHeader className="gap-1 sm:gap-2">
                  <DialogTitle className="text-sm sm:text-lg text-amber-400">Edit {user.nickname}</DialogTitle>
                </DialogHeader>

                <div className="space-y-2 sm:space-y-3 flex-1 min-h-0 overflow-y-auto pr-1 sm:pr-2 pl-2 sm:pl-3">
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-amber-400/80 text-[11px] sm:text-sm">Nickname</Label>
                    <Input
                      value={editForm.nickname}
                      onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                      className="bg-slate-800/60 border-amber-500/30 text-white rounded-xl h-8 sm:h-11 px-4"
                    />
                  </div>

                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-amber-400/80 text-[11px] sm:text-sm">Rating</Label>
                    <Input
                      type="number"
                      value={editForm.rating}
                      onChange={(e) => setEditForm({ ...editForm, rating: e.target.value })}
                      className="bg-slate-800/60 border-amber-500/30 text-white rounded-xl h-8 sm:h-11 px-4"
                    />
                  </div>

                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-amber-400/80 text-[11px] sm:text-sm">Faction</Label>
                    <Select value={editForm.faction} onValueChange={(value) => setEditForm({ ...editForm, faction: value })}>
                      <SelectTrigger className="bg-slate-800/60 border-amber-500/30 text-white rounded-xl h-8 sm:h-11 px-4">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-amber-500/30 text-white">
                        <SelectItem value="darkness">Darkness</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                      </SelectContent>
                    </Select>
                    {tierLocked && (
                      <div className="text-[10px] sm:text-xs text-amber-200/60">
                        Tier is derived from rating while the backend is online.
                      </div>
                    )}
                  </div>

                  {!tierLocked && (
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-amber-400/80 text-[11px] sm:text-sm">Tier</Label>
                      <Select value={editForm.tier} onValueChange={(value) => setEditForm({ ...editForm, tier: value })}>
                        <SelectTrigger className="bg-slate-800/60 border-amber-500/30 text-white rounded-xl h-8 sm:h-11 px-4">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-amber-500/30 text-white">
                          <SelectItem value="legendary">Legendary</SelectItem>
                          <SelectItem value="noble">Noble Circle</SelectItem>
                          <SelectItem value="treasure">Treasure Hunters</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-amber-400/80 text-[11px] sm:text-sm">Phone</Label>
                    <Input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: sanitizePhoneInput(e.target.value) })}
                      className="bg-slate-800/60 border-amber-500/30 text-white rounded-xl h-8 sm:h-11 px-4"
                    />
                  </div>

                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-amber-400/80 text-[11px] sm:text-sm">Avatar URL</Label>
                    <Input
                      type="url"
                      value={editForm.avatar}
                      onChange={(e) => setEditForm({ ...editForm, avatar: e.target.value })}
                      className="bg-slate-800/60 border-amber-500/30 text-white rounded-xl h-8 sm:h-11 px-4"
                    />
                  </div>

                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-amber-400/80 text-[11px] sm:text-sm">Join Date</Label>
                    <Input
                      type="date"
                      value={editForm.joinDate}
                      max={todayInput}
                      onChange={(e) => setEditForm({ ...editForm, joinDate: e.target.value })}
                      className="bg-slate-800/60 border-amber-500/30 text-white rounded-xl h-8 sm:h-11 px-4"
                    />
                  </div>
                </div>

                <DialogFooter className="gap-1 sm:gap-2 pt-2">
                  <Button
                    onClick={handleSaveEdit}
                    disabled={isSavingEdit}
                    className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-xl h-8 sm:h-11"
                  >
                    {isSavingEdit ? 'Saving...' : 'Save Changes'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <button
              onClick={() => handleQuickAdjust(user.id, 100)}
              title="Increase rating by 100"
              className="px-3 h-9 sm:px-4 sm:h-10 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 transition-all flex items-center gap-2 text-xs sm:text-sm"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>100</span>
            </button>
            <button
              onClick={() => handleQuickAdjust(user.id, -100)}
              title="Decrease rating by 100"
              className="px-3 h-9 sm:px-4 sm:h-10 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/40 transition-all flex items-center gap-2 text-xs sm:text-sm"
            >
              <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>100</span>
            </button>
            <button
              onClick={() => handleDelete(user)}
              className="px-3 h-9 sm:px-4 sm:h-10 rounded-xl bg-slate-900/60 hover:bg-slate-900 text-amber-200 border border-amber-500/30 transition-all flex items-center gap-2 text-xs sm:text-sm"
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
    </>
    );
  };

  const filteredPurchaseAudit = useMemo(() => {
    const query = purchaseAuditQuery.trim().toLowerCase();
    const queryDigits = phoneDigits(query);

    return purchaseAudit.filter((entry) => {
      if (purchaseAuditSource !== 'all' && entry.source !== purchaseAuditSource) {
        return false;
      }
      if (!query) return true;

      const nickname = entry.user?.nickname?.toLowerCase() ?? '';
      const phone = phoneDigits(entry.user?.phone);
      const items = entry.items?.join(' ').toLowerCase() ?? '';
      const orderId = entry.orderId?.toLowerCase() ?? '';
      const phoneMatch = queryDigits ? phone.includes(queryDigits) : false;
      return nickname.includes(query) || phoneMatch || items.includes(query) || orderId.includes(query);
    });
  }, [purchaseAudit, purchaseAuditQuery, purchaseAuditSource]);

  const purchaseAuditTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredPurchaseAudit.length / PURCHASE_AUDIT_PAGE_SIZE));
  }, [filteredPurchaseAudit.length]);

  const purchaseAuditPageSafe = Math.min(purchaseAuditPage, purchaseAuditTotalPages);

  const purchaseAuditDisplay = useMemo(() => {
    const start = (purchaseAuditPageSafe - 1) * PURCHASE_AUDIT_PAGE_SIZE;
    return filteredPurchaseAudit.slice(start, start + PURCHASE_AUDIT_PAGE_SIZE);
  }, [filteredPurchaseAudit, purchaseAuditPageSafe]);

  const purchaseAuditRangeLabel = useMemo(() => {
    if (filteredPurchaseAudit.length === 0) return '0';
    const start = (purchaseAuditPageSafe - 1) * PURCHASE_AUDIT_PAGE_SIZE + 1;
    const end = Math.min(filteredPurchaseAudit.length, start + PURCHASE_AUDIT_PAGE_SIZE - 1);
    return `${start}-${end}`;
  }, [filteredPurchaseAudit.length, purchaseAuditPageSafe]);

  const filteredIngestEvents = useMemo(() => {
    const query = ingestQuery.trim().toLowerCase();
    const queryDigits = phoneDigits(query);

    return ingestEvents.filter((entry) => {
      if (ingestSource !== 'all' && entry.source !== ingestSource) return false;
      if (ingestResultFilter !== 'all' && entry.status !== ingestResultFilter) return false;

      if (!query) return true;
      const nickname = entry.nickname?.toLowerCase() ?? '';
      const phone = phoneDigits(entry.phone);
      const items = entry.items?.join(' ').toLowerCase() ?? '';
      const error = entry.errorMessage?.toLowerCase() ?? '';
      const orderId = entry.orderId?.toLowerCase() ?? '';
      const phoneMatch = queryDigits ? phone.includes(queryDigits) : false;
      return nickname.includes(query) || phoneMatch || items.includes(query) || error.includes(query) || orderId.includes(query);
    });
  }, [ingestEvents, ingestQuery, ingestResultFilter, ingestSource]);

  const ingestTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredIngestEvents.length / INGEST_PAGE_SIZE));
  }, [filteredIngestEvents.length]);

  const ingestPageSafe = Math.min(ingestPage, ingestTotalPages);

  const ingestDisplay = useMemo(() => {
    const start = (ingestPageSafe - 1) * INGEST_PAGE_SIZE;
    return filteredIngestEvents.slice(start, start + INGEST_PAGE_SIZE);
  }, [filteredIngestEvents, ingestPageSafe]);

  const ingestRangeLabel = useMemo(() => {
    if (filteredIngestEvents.length === 0) return '0';
    const start = (ingestPageSafe - 1) * INGEST_PAGE_SIZE + 1;
    const end = Math.min(filteredIngestEvents.length, start + INGEST_PAGE_SIZE - 1);
    return `${start}-${end}`;
  }, [filteredIngestEvents.length, ingestPageSafe]);

  const rankHistoryDisplay = useMemo(() => rankHistory.slice(0, 20), [rankHistory]);

  const handleQuickAdjust = (userId: string, delta: number) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;

    if (onAdjustRating) {
      onAdjustRating({ userId, delta, reason: 'Quick adjust' });
    } else {
      const newRating = Math.max(0, target.rating + delta);
      onUpdateUser(userId, { rating: newRating });
    }

    toast.success(`${target.nickname}'s rating ${delta > 0 ? 'increased' : 'decreased'} by ${Math.abs(delta)}`);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({
      nickname: user.nickname,
      rating: user.rating.toString(),
      phone: sanitizePhoneInput(user.phone ?? ''),
      avatar: user.avatar ?? '',
      joinDate: toDateInputValue(user.joinDate),
      tier: user.tier,
      faction: user.faction,
    });
  };

  const resetNewUser = () => {
    setNewUser({
      nickname: '',
      rating: '',
      phone: '',
      avatar: '',
      joinDate: '',
      faction: 'darkness',
      tier: 'treasure',
    });
  };

  const handleAddUserOpenChange = (open: boolean) => {
    setIsAddUserOpen(open);
    if (!open) {
      resetNewUser();
    }
  };

  const handleAddUser = () => {
    if (!onAddUser) {
      toast.error('Add member is unavailable.');
      return;
    }

    const nickname = newUser.nickname.trim();
    if (!nickname || !newUser.rating) {
      toast.error('Please fill in all fields');
      return;
    }

    const rating = parseInt(newUser.rating, 10);
    if (Number.isNaN(rating) || rating < 0) {
      toast.error('Please enter a valid rating');
      return;
    }

    const rawPhone = newUser.phone;
    const phone = normalizePhone(rawPhone);
    const avatar = normalizeOptionalInput(newUser.avatar);
    const joinDate = normalizeOptionalInput(newUser.joinDate);

    if (!isValidDateInput(joinDate ?? '')) {
      toast.error('Please enter a valid join date');
      return;
    }
    if (joinDate && isFutureDateInput(joinDate, todayInput)) {
      toast.error('Join date cannot be in the future');
      return;
    }

    if (avatar && !isValidUrlInput(avatar)) {
      toast.error('Avatar must be a valid URL');
      return;
    }
    if (rawPhone.trim().length > 0 && !phone) {
      toast.error('Phone must include digits');
      return;
    }

    const payload: ManualUserPayload = {
      nickname,
      rating,
      faction: newUser.faction,
    };

    if (!serverAvailable) {
      payload.tier = newUser.tier;
    }
    if (phone) {
      payload.phone = phone;
    }
    if (avatar) {
      payload.avatar = avatar;
    }
    if (joinDate) {
      payload.joinDate = joinDate;
    }

    onAddUser(payload);

    setAddUserNotice(`${nickname} has been added to Dynasty.`);
    const tierLabel = serverAvailable
      ? 'Tier derived from rating'
      : `Tier: ${
          newUser.tier === 'legendary' ? 'Legendary' : newUser.tier === 'noble' ? 'Noble Circle' : 'Treasure Hunters'
        }`;
    toast.success(`${nickname} added to Dynasty`, {
      description: `Faction: ${newUser.faction === 'darkness' ? 'Darkness' : 'Light'} - ${tierLabel}`,
      duration: 4000,
    });

    setIsAddUserOpen(false);
    resetNewUser();
  };

  const handleSaveEdit = async () => {
    if (!editingUser || isSavingEdit) return;

    const rating = parseInt(editForm.rating, 10);
    if (Number.isNaN(rating) || rating < 0) {
      toast.error('Please enter a valid rating');
      return;
    }

    const nickname = editForm.nickname.trim();
    if (!nickname) {
      toast.error('Nickname is required');
      return;
    }

    const rawPhone = editForm.phone;
    const phone = normalizePhone(rawPhone);
    const avatar = normalizeOptionalInput(editForm.avatar);
    const joinDate = normalizeOptionalInput(editForm.joinDate);

    if (!isValidDateInput(joinDate ?? '')) {
      toast.error('Please enter a valid join date');
      return;
    }
    if (joinDate && isFutureDateInput(joinDate, todayInput)) {
      toast.error('Join date cannot be in the future');
      return;
    }

    if (avatar && !isValidUrlInput(avatar)) {
      toast.error('Avatar must be a valid URL');
      return;
    }
    if (rawPhone.trim().length > 0 && !phone) {
      toast.error('Phone must include digits');
      return;
    }

    const updates: Partial<User> = {};
    if (nickname !== editingUser.nickname) {
      updates.nickname = nickname;
    }
    if (phone && phone !== normalizePhone(editingUser.phone)) {
      updates.phone = phone;
    }
    if (avatar && avatar !== (editingUser.avatar ?? '')) {
      updates.avatar = avatar;
    }
    if (joinDate) {
      const currentJoinDate = toDateInputValue(editingUser.joinDate);
      if (joinDate !== currentJoinDate) {
        updates.joinDate = joinDate;
      }
    }
    if (editForm.faction !== editingUser.faction) {
      updates.faction = editForm.faction as User['faction'];
    }
    if (!serverAvailable && editForm.tier !== editingUser.tier) {
      updates.tier = editForm.tier as User['tier'];
    }

    const delta = rating - editingUser.rating;
    const shouldAdjust = delta !== 0 && Boolean(onAdjustRating);
    if (delta !== 0 && !onAdjustRating) {
      updates.rating = rating;
    }

    setIsSavingEdit(true);
    try {
      let profileOk = true;
      if (Object.keys(updates).length > 0) {
        const result = await onUpdateUser(editingUser.id, updates);
        profileOk = result !== false;
      }

      let ratingOk = true;
      if (shouldAdjust && onAdjustRating) {
        const result = await onAdjustRating({ userId: editingUser.id, delta, reason: 'Admin edit' });
        ratingOk = result !== false;
      }

      if (profileOk && ratingOk) {
        toast.success('Changes saved', {
          description: `${nickname} updated successfully`,
        });
        setEditingUser(null);
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  const parseRuleInt = (raw: string, label: string) => {
    const value = Number(raw);
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
      toast.error(`${label} must be a non-negative integer`);
      return null;
    }
    return value;
  };

  const handleSaveRules = async () => {
    const basePointsPerDollar = parseRuleInt(rulesForm.basePointsPerDollar, 'Base points');
    if (basePointsPerDollar === null) return;
    const websiteBonusPercent = parseRuleInt(rulesForm.websiteBonusPercent, 'Website bonus');
    if (websiteBonusPercent === null) return;
    const telegramBonusPercent = parseRuleInt(rulesForm.telegramBonusPercent, 'Telegram bonus');
    if (telegramBonusPercent === null) return;
    const highValueThreshold = parseRuleInt(rulesForm.highValueThreshold, 'High value threshold');
    if (highValueThreshold === null) return;
    const highValueBonusPercent = parseRuleInt(rulesForm.highValueBonusPercent, 'High value bonus');
    if (highValueBonusPercent === null) return;
    const decayPerDay = parseRuleInt(rulesForm.decayPerDay, 'Decay per day');
    if (decayPerDay === null) return;

    const payload = {
      basePointsPerDollar,
      websiteBonusPercent,
      telegramBonusPercent,
      highValueThreshold,
      highValueBonusPercent,
      decayPerDay,
    };

    toast('Save rating rules?', {
      description: 'This will apply to new purchases going forward.',
      duration: 8000,
      action: {
        label: 'Save',
        onClick: () => {
          void (async () => {
            const result = await onUpdateRules(payload);
            if (result !== false) {
              toast.success('Rules updated');
            }
          })();
        },
      },
      cancel: {
        label: 'Cancel',
        onClick: () => {},
      },
    });
  };

  const handleLogin = useCallback(async () => {
    const apiBase = getApiBase();
    const username = loginForm.username.trim();
    const password = loginForm.password;

    if (!apiBase) {
      toast.error('Backend not detected.');
      return;
    }

    if (!username || !password) {
      toast.error('Enter admin username and password.');
      return;
    }

    setLoginStatus('loading');
    setLoginError('');

    try {
      const result = await loginAdmin(apiBase, username, password);
      setAdminToken(result.token);
      await verifyToken(result.token, { silent: true });
      setLoginForm({ username: '', password: '' });
      setTokenInput('');
      setShowTokenLogin(false);
      setLoginStatus('idle');
      toast.success('Admin session started');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      setLoginStatus('error');
      setLoginError(message);
      toast.error(message);
    }
  }, [loginForm, verifyToken]);

  const handleTokenLogin = () => {
    if (typeof window === 'undefined') return;
    const trimmed = tokenInput.trim();
    if (!trimmed) {
      toast.error('Enter an access token.');
      return;
    }
    setAdminToken(trimmed);
    void verifyToken(trimmed);
    setTokenInput('');
    setShowTokenLogin(false);
  };

  const handleLogout = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem('dynasty_admin_token');
    setAdminToken('');
    setTokenInput('');
    setLoginForm({ username: '', password: '' });
    setAdminTokenStatus('idle');
    setLoginStatus('idle');
    setLoginError('');
    setShowTokenLogin(false);
    toast.success('Signed out');
  };

  const buildActivityInsights = (payload: ActivityInsightsPayload): ActivityInsights => ({
    purchases: payload.purchases ?? 0,
    adjustments: payload.adjustments ?? 0,
    totalDelta: payload.totalDelta ?? 0,
    topMovers: payload.topMovers ?? [],
    lastUpdateLabel: payload.lastUpdate ? new Date(payload.lastUpdate).toLocaleString() : 'No recent activity',
  });

  const loadActivityInsights = useCallback(async () => {
    const apiBase = getApiBase();
    const trimmedToken = adminToken.trim();

    if (!apiBase || !trimmedToken) {
      setActivityInsightsRemote(null);
      return;
    }

    try {
      const payload = await fetchActivityInsights(apiBase, { days: 7 });
      setActivityInsightsRemote(buildActivityInsights(payload));
    } catch (error) {
      console.error('Failed to load activity insights', error);
      setActivityInsightsRemote(null);
    }
  }, [adminToken]);

  const loadPurchaseAudit = useCallback(async () => {
    const apiBase = getApiBase();
    const trimmedToken = adminToken.trim();

    if (!apiBase) {
      setPurchaseAuditStatus('error');
      setPurchaseAuditError('Backend not detected.');
      return;
    }

    if (!trimmedToken) {
      setPurchaseAuditStatus('error');
      setPurchaseAuditError('Sign in to load purchase audit data.');
      return;
    }

    setPurchaseAuditStatus('loading');
    setPurchaseAuditError('');

    try {
      const purchases = await fetchAdminPurchases(apiBase, {
        limit: 150,
        source: purchaseAuditSource === 'all' ? undefined : purchaseAuditSource,
      });
      setPurchaseAudit(purchases);
      setPurchaseAuditStatus('idle');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load purchases';
      setPurchaseAuditStatus('error');
      setPurchaseAuditError(message);
    }
  }, [adminToken, purchaseAuditSource]);

  const loadIngestEvents = useCallback(async () => {
    const apiBase = getApiBase();
    const trimmedToken = adminToken.trim();

    if (!apiBase) {
      setIngestStatus('error');
      setIngestError('Backend not detected.');
      return;
    }

    if (!trimmedToken) {
      setIngestStatus('error');
      setIngestError('Sign in to load ingest data.');
      return;
    }

    setIngestStatus('loading');
    setIngestError('');

    try {
      const events = await fetchIngestEvents(apiBase, {
        limit: 150,
        source: ingestSource === 'all' ? undefined : ingestSource,
        status: ingestResultFilter === 'all' ? undefined : ingestResultFilter,
      });
      setIngestEvents(events);
      setIngestStatus('idle');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load ingest events';
      setIngestStatus('error');
      setIngestError(message);
    }
  }, [adminToken, ingestResultFilter, ingestSource]);

  const loadRankHistory = useCallback(async () => {
    const apiBase = getApiBase();
    const trimmedToken = adminToken.trim();

    if (!apiBase) {
      setRankHistoryStatus('error');
      setRankHistoryError('Backend not detected.');
      return;
    }

    if (!trimmedToken) {
      setRankHistoryStatus('error');
      setRankHistoryError('Sign in to load rank history.');
      return;
    }

    setRankHistoryStatus('loading');
    setRankHistoryError('');

    try {
      const history = await fetchRankHistory(apiBase, { limit: 120 });
      setRankHistory(history);
      setRankHistoryStatus('idle');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load rank history';
      setRankHistoryStatus('error');
      setRankHistoryError(message);
    }
  }, [adminToken]);

  const handleDelete = (user: User) => {
    toast(`Delete ${user.nickname}?`, {
      description: 'This will permanently remove the member and their history.',
      duration: 8000,
      action: {
        label: 'Delete',
        onClick: () => {
          onDeleteUser(user.id);
          toast.success(`${user.nickname} has been removed`);
        },
      },
      cancel: {
        label: 'Cancel',
        onClick: () => {},
      },
    });
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadActivityInsights();
    void loadPurchaseAudit();
    void loadIngestEvents();
    void loadRankHistory();
  }, [isAuthenticated, loadActivityInsights, loadIngestEvents, loadPurchaseAudit, loadRankHistory]);

  useEffect(() => {
    if (!addUserNotice) return;
    const timer = window.setTimeout(() => setAddUserNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [addUserNotice]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] overflow-hidden"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[96vw] max-w-7xl h-[94vh] overflow-hidden lg:w-screen lg:h-screen lg:max-w-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 overflow-hidden rounded-3xl lg:rounded-none">
          <motion.div
            animate={{
              background: [
                'radial-gradient(circle at 0% 0%, rgba(251, 191, 36, 0.15) 0%, transparent 50%)',
                'radial-gradient(circle at 100% 0%, rgba(251, 191, 36, 0.15) 0%, transparent 50%)',
                'radial-gradient(circle at 100% 100%, rgba(251, 191, 36, 0.15) 0%, transparent 50%)',
                'radial-gradient(circle at 0% 100%, rgba(251, 191, 36, 0.15) 0%, transparent 50%)',
                'radial-gradient(circle at 0% 0%, rgba(251, 191, 36, 0.15) 0%, transparent 50%)',
              ],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-black/95 backdrop-blur-xl" />
        </div>

        <div className="relative h-full min-h-0 flex flex-col rounded-3xl lg:rounded-none border border-amber-500/20 overflow-hidden">
          <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-amber-500/20">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-xl">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl text-white tracking-wide">Dynasty Control</h1>
                <p className="text-[11px] sm:text-xs text-amber-400/60">Administrative Dashboard</p>
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
              {isAuthenticated && (
                <Button
                  onClick={handleLogout}
                  className="h-8 px-2.5 text-[11px] sm:h-9 sm:px-3.5 sm:text-xs bg-slate-900/70 hover:bg-slate-800/80 border border-amber-500/30 text-amber-200"
                >
                  Sign Out
                </Button>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-amber-400 transition-all"
              >
                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
          {!isAuthenticated ? (
            <div className="flex-1 min-h-0 flex items-center justify-center px-6 py-10">
              <div className="w-full max-w-xl rounded-2xl border border-amber-500/20 bg-slate-900/60 p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-lg text-white">Admin Sign In</div>
                    <div className="text-xs text-amber-400/60">Access the Dynasty admin tools.</div>
                  </div>
                </div>

                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleLogin();
                  }}
                >
                  <div className="space-y-2">
                    <Label className="text-amber-400/70 text-xs">Username</Label>
                    <Input
                      placeholder="admin"
                      value={loginForm.username}
                      onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                      className="h-11 bg-slate-800/70 border-amber-500/30 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-amber-400/70 text-xs">Password</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                        className="h-11 bg-slate-800/70 border-amber-500/30 text-white pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-200/70 hover:text-amber-200 transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button
                    onClick={handleLogin}
                    disabled={loginStatus === 'loading'}
                    className="h-11 w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                  >
                    {loginStatus === 'loading' ? 'Signing in...' : 'Sign In'}
                  </Button>
                  {loginStatus === 'error' && (
                    <div className="text-xs text-red-300">{loginError}</div>
                  )}
                </form>

                <div className="mt-4 flex items-center justify-between text-xs text-amber-400/60">
                  <span>{serverAvailable ? 'Server online' : 'Backend offline'}</span>
                  <button
                    type="button"
                    onClick={() => setShowTokenLogin((prev) => !prev)}
                    className="text-amber-300 hover:text-amber-200"
                  >
                    {showTokenLogin ? 'Hide access token' : 'Use access token'}
                  </button>
                </div>

                {showTokenLogin && (
                  <div className="mt-4 space-y-2">
                    <Label className="text-amber-400/70 text-xs">Access token</Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        type="password"
                        placeholder="Paste access token"
                        value={tokenInput}
                        onChange={(e) => {
                          setTokenInput(e.target.value);
                          setAdminTokenStatus('idle');
                        }}
                        className="h-11 bg-slate-800/70 border-amber-500/30 text-white"
                      />
                      <Button
                        onClick={handleTokenLogin}
                        disabled={adminTokenStatus === 'checking'}
                        className="h-11 bg-slate-900/70 hover:bg-slate-800/80 border border-amber-500/30 text-amber-200"
                      >
                        {adminTokenStatus === 'checking' ? 'Verifying...' : 'Use Token'}
                      </Button>
                    </div>
                    {adminTokenStatus === 'invalid' && (
                      <div className="text-xs text-red-300">Token is invalid.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div
                ref={membersScrollRef}
                onScroll={updateMembersViewport}
                className="flex-1 min-h-0 px-4 pb-6 pt-3 sm:px-8 sm:pb-8 sm:pt-4 overflow-y-auto"
              >
                <div className="grid grid-cols-1 gap-5 sm:gap-6">
                  <div className="flex flex-col gap-3 sm:gap-4 rounded-2xl border border-amber-500/20 bg-slate-900/50 p-4 sm:p-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div>
                      <div className="text-xs sm:text-sm text-white">Session active</div>
                      <div className="text-[11px] sm:text-xs text-amber-400/60">Signed in as admin</div>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] sm:text-xs sm:mt-0">
                      <span className={`h-2 w-2 rounded-full ${tokenStatusMeta.dot}`} />
                      <span className={tokenStatusMeta.text}>{tokenStatusMeta.label}</span>
                    </div>
                    <div className="mt-1 text-[11px] sm:text-xs text-amber-400/50 sm:mt-0">
                      {serverAvailable
                        ? lastEventAt
                          ? `Live updates: ${formatAuditTimestamp(lastEventAt)}`
                          : 'Live updates: waiting for events'
                        : 'Backend offline'}
                    </div>
                  </div>

                  {addUserNotice && (
                    <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs sm:text-sm text-emerald-100">
                      <Sparkles className="w-4 h-4 text-emerald-200" />
                      <span>{addUserNotice}</span>
                    </div>
                  )}

                  <Tabs
                    value={adminTab}
                    onValueChange={(value) => setAdminTab(value as 'members' | 'insights' | 'rules' | 'activity' | 'audits')}
                    className="w-full"
                  >
                    <TabsList className="h-auto w-full flex flex-wrap gap-1 sm:gap-2 bg-slate-900/60 border border-amber-500/20 rounded-2xl p-1">
                      <TabsTrigger value="members" className={tabTriggerClass}>
                        Members
                      </TabsTrigger>
                      <TabsTrigger value="insights" className={tabTriggerClass}>
                        Insights
                      </TabsTrigger>
                      <TabsTrigger value="rules" className={tabTriggerClass}>
                        Rules
                      </TabsTrigger>
                      <TabsTrigger value="activity" className={tabTriggerClass}>
                        Activity
                      </TabsTrigger>
                      <TabsTrigger value="audits" className={tabTriggerClass}>
                        Audits
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="members" className="mt-4">
                      <div className="flex min-h-0 flex-col gap-4">
                    <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-amber-400/40" />
                        <Input
                          placeholder="Search members..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 sm:pl-12 h-10 sm:h-11 text-sm sm:text-base bg-slate-800/40 border-amber-500/20 text-white placeholder:text-amber-400/30 rounded-xl focus:border-amber-500/50"
                        />
                      </div>
                      <Select value={factionFilter} onValueChange={(value) => setFactionFilter(value as 'all' | 'darkness' | 'light')}>
                        <SelectTrigger className="w-full lg:w-44 !h-10 sm:!h-11 text-sm sm:text-base bg-slate-800/40 border-amber-500/20 text-white rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-amber-500/30 text-white">
                          <SelectItem value="all">All Factions</SelectItem>
                          <SelectItem value="darkness">Darkness</SelectItem>
                          <SelectItem value="light">Light</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={tierFilter} onValueChange={(value) => setTierFilter(value as 'all' | 'legendary' | 'noble' | 'treasure')}>
                        <SelectTrigger className="w-full lg:w-44 !h-10 sm:!h-11 text-sm sm:text-base bg-slate-800/40 border-amber-500/20 text-white rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-amber-500/30 text-white">
                          <SelectItem value="all">All Tiers</SelectItem>
                          <SelectItem value="legendary">Legendary</SelectItem>
                          <SelectItem value="noble">Noble Circle</SelectItem>
                          <SelectItem value="treasure">Treasure Hunters</SelectItem>
                        </SelectContent>
                      </Select>
                      <Dialog open={isAddUserOpen} onOpenChange={handleAddUserOpenChange}>
                        <DialogTrigger asChild>
                          <Button className="w-full lg:w-auto h-10 sm:h-11 px-4 sm:px-5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl flex items-center gap-2 text-sm sm:text-base">
                            <Plus className="w-4 h-4" />
                            Add Member
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-900/95 backdrop-blur-xl border-amber-500/30 text-white rounded-2xl px-5 py-3 sm:px-7 sm:py-5 md:px-8 md:py-6 lg:px-10 lg:py-6 gap-2 sm:gap-4 max-h-[85vh] sm:max-h-[90vh] w-[94vw] sm:w-full max-w-[560px] sm:max-w-[640px] md:max-w-[720px] lg:max-w-[760px] overflow-hidden flex flex-col min-h-0">
                          <DialogHeader className="gap-1 sm:gap-2">
                            <DialogTitle className="text-sm sm:text-lg text-amber-400">Add Member</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-1 sm:space-y-2 py-1 sm:py-2 flex-1 min-h-0 overflow-y-auto pr-2 pl-2 md:pr-3 md:pl-3">
                            <div className="space-y-1 sm:space-y-2">
                              <Label className="text-amber-400/80 text-[11px] sm:text-sm">Nickname</Label>
                              <Input
                                placeholder="Enter nickname"
                                value={newUser.nickname}
                                onChange={(e) => setNewUser({ ...newUser, nickname: e.target.value })}
                                className="bg-slate-800/60 border-amber-500/30 text-white rounded-xl h-8 sm:h-11 px-4"
                              />
                            </div>
                            <div className="space-y-1 sm:space-y-2">
                              <Label className="text-amber-400/80 text-[11px] sm:text-sm">Rating</Label>
                              <Input
                                type="number"
                                placeholder="Enter rating"
                                value={newUser.rating}
                                onChange={(e) => setNewUser({ ...newUser, rating: e.target.value })}
                                className="bg-slate-800/60 border-amber-500/30 text-white rounded-xl h-8 sm:h-11 px-4"
                              />
                            </div>
                            <div className="space-y-1 sm:space-y-2">
                              <Label className="text-amber-400/80 text-[11px] sm:text-sm">Faction</Label>
                              <Select value={newUser.faction} onValueChange={(value) => setNewUser({ ...newUser, faction: value as 'darkness' | 'light' })}>
                                <SelectTrigger className="bg-slate-800/60 border-amber-500/30 text-white rounded-xl h-8 sm:h-11 px-4">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-amber-500/30 text-white">
                                  <SelectItem value="darkness">Darkness</SelectItem>
                                  <SelectItem value="light">Light</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {!tierLocked ? (
                              <div className="space-y-1 sm:space-y-2">
                                <Label className="text-amber-400/80 text-[11px] sm:text-sm">Tier</Label>
                                <Select
                                  value={newUser.tier}
                                  onValueChange={(value) => setNewUser({ ...newUser, tier: value as 'legendary' | 'noble' | 'treasure' })}
                                >
                                  <SelectTrigger className="bg-slate-800/60 border-amber-500/30 text-white rounded-xl h-8 sm:h-11 px-4">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-slate-800 border-amber-500/30 text-white">
                                    <SelectItem value="legendary">Legendary</SelectItem>
                                    <SelectItem value="noble">Noble Circle</SelectItem>
                                    <SelectItem value="treasure">Treasure Hunters</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              <div className="text-[10px] sm:text-[11px] leading-tight text-amber-400/60">
                                Tier is derived from rating while the backend is online.
                              </div>
                            )}
                            <div className="space-y-1 sm:space-y-2">
                              <Label className="text-amber-400/80 text-[11px] sm:text-sm">Phone</Label>
                              <Input
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                placeholder="Optional phone"
                                value={newUser.phone}
                                onChange={(e) => setNewUser({ ...newUser, phone: sanitizePhoneInput(e.target.value) })}
                                className="bg-slate-800/60 border-amber-500/30 text-white rounded-xl h-8 sm:h-11 px-4"
                              />
                            </div>
                            <div className="space-y-1 sm:space-y-2">
                              <Label className="text-amber-400/80 text-[11px] sm:text-sm">Avatar URL</Label>
                              <Input
                                type="url"
                                placeholder="https://example.com/avatar.png"
                                value={newUser.avatar}
                                onChange={(e) => setNewUser({ ...newUser, avatar: e.target.value })}
                                className="bg-slate-800/60 border-amber-500/30 text-white rounded-xl h-8 sm:h-11 px-4"
                              />
                            </div>
                            <div className="space-y-1 sm:space-y-2">
                              <Label className="text-amber-400/80 text-[11px] sm:text-sm">Join Date</Label>
                              <Input
                                type="date"
                                value={newUser.joinDate}
                                max={todayInput}
                                onChange={(e) => setNewUser({ ...newUser, joinDate: e.target.value })}
                                className="bg-slate-800/60 border-amber-500/30 text-white rounded-xl h-8 sm:h-11 px-4"
                              />
                            </div>
                          </div>
                          <DialogFooter className="gap-1 sm:gap-2 pt-2">
                            <Button
                              onClick={handleAddUser}
                              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-xl h-8 sm:h-11"
                            >
                              Add Member
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <div className="flex-1 min-h-0 overflow-visible pr-2">
                      {filteredUsers.length > 0 && (
                        <div className="relative h-0 w-full overflow-hidden">
                          <div
                            ref={membersProbeRef}
                            className="pointer-events-none absolute left-0 top-0 w-full opacity-0"
                            aria-hidden="true"
                          >
                            {renderMemberCard(memberProbeUser, { fixedHeight: false })}
                          </div>
                        </div>
                      )}
                      {filteredUsers.length === 0 ? (
                        <div className="text-center py-16">
                          <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                            <Search className="w-10 h-10 text-amber-400/40" />
                          </div>
                          <p className="text-amber-400/50 text-lg">No members found</p>
                          <p className="text-amber-400/30 text-sm mt-2">Try adjusting your filters</p>
                        </div>
                      ) : shouldVirtualizeMembers ? (
                        <div ref={membersListRef} className="relative" style={{ height: `${membersTotalHeight}px` }}>
                          {visibleMembers.map((user, index) => {
                            const rowIndex = membersStartIndex + index;
                            const top = rowIndex * membersRowStride;
                            return (
                              <div
                                key={user.id}
                                className="group relative"
                                style={{
                                  position: 'absolute',
                                  top: `${top}px`,
                                  left: 0,
                                  right: 0,
                                  height: `${membersRowHeight}px`,
                                }}
                              >
                                {renderMemberCard(user)}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {membersDisplay.map((user, index) => (
                            <motion.div
                              key={user.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.03 }}
                              className="group relative"
                              style={{ height: `${membersRowHeight}px` }}
                            >
                              {renderMemberCard(user)}
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>

                {filteredUsers.length > 0 && (
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-3 border-t border-amber-500/10 pt-4 pb-1 text-[11px] sm:text-xs text-amber-400/60">
                    <span>
                      Showing {membersRangeLabel} of {filteredUsers.length} (Page {membersPageSafe} of {membersTotalPages})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setMembersPage(Math.max(1, membersPageSafe - 1))}
                        disabled={membersPageSafe === 1}
                        className="h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg bg-slate-900/60 border border-amber-500/30 text-amber-200 hover:bg-slate-800/80 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setMembersPage(Math.min(membersTotalPages, membersPageSafe + 1))}
                        disabled={membersPageSafe === membersTotalPages}
                        className="h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg bg-slate-900/60 border border-amber-500/30 text-amber-200 hover:bg-slate-800/80 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

                    </TabsContent>

                    <TabsContent value="insights" className="mt-4">
                      <div className="flex min-h-0 flex-col gap-5 overflow-visible pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {[
                    {
                      label: 'Total Members',
                      value: users.length,
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
                    <h2 className="text-sm sm:text-base text-white">{dynamicsLabel}</h2>
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
                    </TabsContent>

                    <TabsContent value="rules" className="mt-4">
                      <div className="flex min-h-0 flex-col gap-5 overflow-visible pr-1">
                <div className="relative bg-slate-800/40 backdrop-blur-sm border border-amber-500/20 rounded-2xl p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-4 sm:mb-5">
                    <h2 className="text-sm sm:text-base text-white">Rules</h2>
                    <span className="text-[11px] sm:text-xs text-amber-400/60">Scoring configuration</span>
                  </div>
                  <div className="mb-3 sm:mb-4 text-[11px] sm:text-xs text-amber-400/60 leading-relaxed">
                    <div>Formula: base = amount * base points. Total = base + source bonus % (+ high value bonus % when amount &gt;= threshold).</div>
                    <div>Decay per day is reserved (not applied yet). Changes affect new purchases only.</div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label className="text-amber-400/70 text-xs">Base points</Label>
                      <Input
                        type="number"
                        value={rulesForm.basePointsPerDollar}
                        onChange={(e) => setRulesForm({ ...rulesForm, basePointsPerDollar: e.target.value })}
                        className="h-10 sm:h-11 text-sm sm:text-base bg-slate-900/60 border-amber-500/20 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-amber-400/70 text-xs">Website bonus %</Label>
                      <Input
                        type="number"
                        value={rulesForm.websiteBonusPercent}
                        onChange={(e) => setRulesForm({ ...rulesForm, websiteBonusPercent: e.target.value })}
                        className="h-10 sm:h-11 text-sm sm:text-base bg-slate-900/60 border-amber-500/20 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-amber-400/70 text-xs">Telegram bonus %</Label>
                      <Input
                        type="number"
                        value={rulesForm.telegramBonusPercent}
                        onChange={(e) => setRulesForm({ ...rulesForm, telegramBonusPercent: e.target.value })}
                        className="h-10 sm:h-11 text-sm sm:text-base bg-slate-900/60 border-amber-500/20 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-amber-400/70 text-xs">High value threshold</Label>
                      <Input
                        type="number"
                        value={rulesForm.highValueThreshold}
                        onChange={(e) => setRulesForm({ ...rulesForm, highValueThreshold: e.target.value })}
                        className="h-10 sm:h-11 text-sm sm:text-base bg-slate-900/60 border-amber-500/20 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-amber-400/70 text-xs">High value bonus %</Label>
                      <Input
                        type="number"
                        value={rulesForm.highValueBonusPercent}
                        onChange={(e) => setRulesForm({ ...rulesForm, highValueBonusPercent: e.target.value })}
                        className="h-10 sm:h-11 text-sm sm:text-base bg-slate-900/60 border-amber-500/20 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-amber-400/70 text-xs">Decay per day</Label>
                      <Input
                        type="number"
                        value={rulesForm.decayPerDay}
                        onChange={(e) => setRulesForm({ ...rulesForm, decayPerDay: e.target.value })}
                        className="h-10 sm:h-11 text-sm sm:text-base bg-slate-900/60 border-amber-500/20 text-white"
                      />
                    </div>
                  </div>
                  <div className="mt-3 sm:mt-4">
                    <Button
                      onClick={handleSaveRules}
                      className="h-10 sm:h-11 w-full text-sm sm:text-base bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                    >
                      Save Rules
                    </Button>
                  </div>
                </div>

                      </div>
                    </TabsContent>

                    <TabsContent value="activity" className="mt-4">
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
                    </TabsContent>

                    <TabsContent value="audits" className="mt-4">
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

                  <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_220px] lg:grid-cols-[minmax(0,1fr)_260px] gap-3 mb-4">
                    <Input
                      placeholder="Search nickname, phone, items, order"
                      value={purchaseAuditQuery}
                      onChange={(e) => setPurchaseAuditQuery(e.target.value)}
                      className="h-10 sm:h-11 text-sm sm:text-base bg-slate-900/60 border-amber-500/20 text-white"
                    />
                    <Select
                      value={purchaseAuditSource}
                      onValueChange={(value) => setPurchaseAuditSource(value as 'all' | PurchaseSource)}
                    >
                      <SelectTrigger className="h-10 sm:h-11 !h-10 sm:!h-11 text-sm sm:text-base bg-slate-900/60 border-amber-500/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-amber-500/30 text-white">
                        <SelectItem value="all">All sources</SelectItem>
                        <SelectItem value="website">Website</SelectItem>
                        <SelectItem value="telegram">Telegram</SelectItem>
                      </SelectContent>
                    </Select>
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

                  <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_200px_200px] lg:grid-cols-[minmax(0,1fr)_240px_240px] gap-3 mb-4">
                    <Input
                      placeholder="Search nickname, phone, error, order"
                      value={ingestQuery}
                      onChange={(e) => setIngestQuery(e.target.value)}
                      className="h-10 sm:h-11 text-sm sm:text-base bg-slate-900/60 border-amber-500/20 text-white"
                    />
                    <Select
                      value={ingestSource}
                      onValueChange={(value) => setIngestSource(value as 'all' | PurchaseSource)}
                    >
                      <SelectTrigger className="h-10 sm:h-11 !h-10 sm:!h-11 text-sm sm:text-base bg-slate-900/60 border-amber-500/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-amber-500/30 text-white">
                        <SelectItem value="all">All sources</SelectItem>
                        <SelectItem value="website">Website</SelectItem>
                        <SelectItem value="telegram">Telegram</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={ingestResultFilter}
                      onValueChange={(value) => setIngestResultFilter(value as 'all' | 'success' | 'error')}
                    >
                      <SelectTrigger className="h-10 sm:h-11 !h-10 sm:!h-11 text-sm sm:text-base bg-slate-900/60 border-amber-500/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-amber-500/30 text-white">
                        <SelectItem value="error">Errors only</SelectItem>
                        <SelectItem value="success">Success only</SelectItem>
                        <SelectItem value="all">All statuses</SelectItem>
                      </SelectContent>
                    </Select>
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
                            Payload: {formatPayload(entry.rawPayload)}
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
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
          </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
});




