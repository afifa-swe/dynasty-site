import { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import { FactionTree } from './components/FactionTree';
import { TopList } from './components/TopList';
import { User } from './types/user';
import { Plus, UserPlus, Menu, X, Shield, Radio, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Button } from './components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';
import { useRatingsEngine } from './lib/ratingsEngine';
import { generateRandomPurchase } from './lib/purchaseGenerator';
import { mockUsers } from './lib/mockData';
const AdminPanel = lazy(() => import('./components/AdminPanel').then((mod) => ({ default: mod.AdminPanel })));
const UserProfile = lazy(() => import('./components/UserProfile').then((mod) => ({ default: mod.UserProfile })));

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export default function App() {
  const TREE_PAGE_SIZE = 100;
  const LEGENDARY_PER_SIDE = 6;
  const NOBLE_PER_SIDE = 12;
  const TREASURE_PER_SIDE = 22;
  const getIsAdminRoute = () => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.replace(/\/$/, '');
    const hash = window.location.hash.replace(/^#/, '').replace(/\/$/, '');
    return path === '/admin' || hash === '/admin' || hash === 'admin';
  };

  const {
    users: rawUsers,
    rules,
    activityLog,
    addUser,
    registerPurchase,
    updateUser,
    deleteUser,
    adjustRating,
    updateRules,
    serverAvailable,
    lastEventAt,
  } = useRatingsEngine(mockUsers);
  const testControlsEnv = (import.meta as any)?.env?.VITE_SHOW_TEST_CONTROLS;
  const defaultTestControlsOpen =
    Boolean((import.meta as any)?.env?.DEV) || testControlsEnv === 'true' || testControlsEnv === '1';
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newlyAddedUserIds, setNewlyAddedUserIds] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isStandaloneAdmin, setIsStandaloneAdmin] = useState(getIsAdminRoute);
  const [testControlsOpen, setTestControlsOpen] = useState(defaultTestControlsOpen);
  const [autoFeedEnabled, setAutoFeedEnabled] = useState(false);
  const [topListQuery, setTopListQuery] = useState('');
  const [leaderboardView, setLeaderboardView] = useState<'split' | 'ranked'>('split');
  const [leaderboardFactionFilter, setLeaderboardFactionFilter] = useState<'all' | 'darkness' | 'light'>('all');
  const usersRef = useRef(rawUsers);
  const adminPanelFallback = (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center text-amber-200 text-sm">
      Loading admin panel...
    </div>
  );

  const rankedUsers = useMemo(() => {
    return [...rawUsers]
      .sort((a, b) => b.rating - a.rating)
      .map((user, index) => ({
        ...user,
        rank: index + 1,
      }));
  }, [rawUsers]);
  const treeUsers = useMemo(() => {
    if (rankedUsers.length === 0) return [];

    const winner = rankedUsers[0];
    const byFaction = {
      darkness: rankedUsers.filter((user) => user.faction === 'darkness' && user.id !== winner.id),
      light: rankedUsers.filter((user) => user.faction === 'light' && user.id !== winner.id),
    };

    const pickRange = (list: User[], start: number, count: number) => list.slice(start, start + count);
    const legendaryDark = pickRange(byFaction.darkness, 0, LEGENDARY_PER_SIDE);
    const legendaryLight = pickRange(byFaction.light, 0, LEGENDARY_PER_SIDE);
    const nobleDark = pickRange(byFaction.darkness, LEGENDARY_PER_SIDE, NOBLE_PER_SIDE);
    const nobleLight = pickRange(byFaction.light, LEGENDARY_PER_SIDE, NOBLE_PER_SIDE);
    const treasureStart = LEGENDARY_PER_SIDE + NOBLE_PER_SIDE;
    const treasureDark = pickRange(byFaction.darkness, treasureStart, TREASURE_PER_SIDE);
    const treasureLight = pickRange(byFaction.light, treasureStart, TREASURE_PER_SIDE);

    const selected = [
      winner,
      ...legendaryDark,
      ...legendaryLight,
      ...nobleDark,
      ...nobleLight,
      ...treasureDark,
      ...treasureLight,
    ];

    const seen = new Set<string>();
    const unique = selected.filter((user) => {
      if (!user || seen.has(user.id)) return false;
      seen.add(user.id);
      return true;
    });

    return unique.slice(0, TREE_PAGE_SIZE);
  }, [LEGENDARY_PER_SIDE, NOBLE_PER_SIDE, TREASURE_PER_SIDE, rankedUsers]);

  useEffect(() => {
    usersRef.current = rankedUsers;
  }, [rankedUsers]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleLocationChange = () => setIsStandaloneAdmin(getIsAdminRoute());
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const handleStandaloneAdminClose = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash && window.location.hash !== '#') {
      window.location.hash = '';
    } else {
      window.history.pushState({}, '', '/');
    }
    setIsStandaloneAdmin(false);
  }, []);

  const trackNewUser = useCallback((userId: string) => {
    setNewlyAddedUserIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
    window.setTimeout(() => {
      setNewlyAddedUserIds((prev) => prev.filter((id) => id !== userId));
    }, 3000);
  }, []);

  useEffect(() => {
    if (!autoFeedEnabled) return;

    const interval = setInterval(() => {
      const { payload, isNewUser } = generateRandomPurchase(usersRef.current);
      registerPurchase(payload);
      if (isNewUser && payload.userId) {
        trackNewUser(payload.userId);
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [autoFeedEnabled, registerPurchase, trackNewUser]);
  
  // Form state for adding user
  const [newUser, setNewUser] = useState({
    nickname: '',
    rating: '',
    faction: 'darkness' as 'darkness' | 'light',
    tier: 'treasure' as 'legendary' | 'noble' | 'treasure',
  });

  const sortedUsers = rankedUsers;

  const filteredAllUsers = useMemo(() => {
    const query = topListQuery.trim().toLowerCase();
    if (!query) return sortedUsers;
    return sortedUsers.filter((user) => user.nickname.toLowerCase().includes(query));
  }, [sortedUsers, topListQuery]);

  const filteredAllUsersByFaction = useMemo(() => {
    if (leaderboardFactionFilter === 'all') return filteredAllUsers;
    return filteredAllUsers.filter((user) => user.faction === leaderboardFactionFilter);
  }, [filteredAllUsers, leaderboardFactionFilter]);

  const filteredDarknessUsers = useMemo(
    () => filteredAllUsers.filter((user) => user.faction === 'darkness'),
    [filteredAllUsers],
  );
  const filteredLightUsers = useMemo(
    () => filteredAllUsers.filter((user) => user.faction === 'light'),
    [filteredAllUsers],
  );

  const leaderboardTitle = leaderboardFactionFilter === 'all' ? 'ALL MEMBERS' : leaderboardFactionFilter.toUpperCase();
  const leaderboardCountLabel = `${filteredAllUsersByFaction.length} Members`;
  const leaderboardListClass = 'flex-1 overflow-y-auto pr-2 dynasty-scrollbar';
  const splitWrapperClass = 'flex-1 min-h-0 overflow-y-auto pr-2 dynasty-scrollbar space-y-4';
  const splitListClass = 'max-h-[65vh] lg:max-h-[55vh] overflow-y-auto pr-2 dynasty-scrollbar';

  useEffect(() => {
    if (!selectedUser) return;
    const updated = rankedUsers.find((user) => user.id === selectedUser.id);
    if (updated && updated !== selectedUser) {
      setSelectedUser(updated);
    }
  }, [rankedUsers, selectedUser]);

  const handleAddUser = useCallback(() => {
    if (!newUser.nickname || !newUser.rating) {
      toast.error('Please fill in all fields');
      return;
    }

    const rating = parseInt(newUser.rating, 10);
    if (isNaN(rating) || rating < 0) {
      toast.error('Please enter a valid rating');
      return;
    }

    const newUserId = `user-${Date.now()}`;
    addUser({
      id: newUserId,
      nickname: newUser.nickname,
      rating,
      faction: newUser.faction,
      tier: newUser.tier,
    });

    trackNewUser(newUserId);
    setIsAddUserOpen(false);
    setNewUser({
      nickname: '',
      rating: '',
      faction: 'darkness',
      tier: 'treasure',
    });
    toast.success(`${newUser.nickname} has been added to the Dynasty!`, {
      description: `Faction: ${newUser.faction === 'darkness' ? 'Darkness' : 'Light'} - Tier: ${
        newUser.tier === 'treasure' ? 'Treasure Hunters' : newUser.tier === 'noble' ? 'Noble Circle' : 'Legendary'
      }`,
      duration: 4000,
    });
  }, [addUser, newUser, trackNewUser]);

  // Simulate automatic registration (from purchase system or Telegram bot)
  const simulateAutoRegistration = useCallback(() => {
    const { payload, isNewUser } = generateRandomPurchase(rankedUsers);
    registerPurchase(payload);

    if (isNewUser && payload.userId) {
      trackNewUser(payload.userId);
    }

    const channelLabel = payload.source === 'telegram' ? 'Telegram bot' : 'Website';
    toast.success(`${channelLabel} purchase processed`, {
      description: `${payload.nickname} spent ${currencyFormatter.format(payload.amount)} on ${
        payload.items?.join(', ') ?? 'Dynasty merch'
      }`,
      duration: 4500,
    });
  }, [registerPurchase, rankedUsers, trackNewUser]);

  const handleToggleTestControls = () => {
    setTestControlsOpen((prev) => {
      if (prev) {
        setAutoFeedEnabled(false);
        setIsAddUserOpen(false);
      }
      return !prev;
    });
  };

  const viewToggle = (
    <Tabs
      value={leaderboardView}
      onValueChange={(value) => setLeaderboardView(value as 'split' | 'ranked')}
      className="w-full"
    >
      <TabsList className="leaderboard-tabs w-full bg-slate-950/90 shadow-inner rounded-xl p-1 gap-1.5 sm:gap-2">
        <TabsTrigger
          value="ranked"
          className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold text-amber-200/90 bg-slate-800/80 border border-amber-800/40 shadow-sm hover:text-amber-50 hover:bg-gradient-to-r hover:from-amber-600/35 hover:to-amber-400/15 hover:border-amber-400/80 hover:shadow-[0_0_16px_rgba(245,158,11,0.4)] hover:-translate-y-px data-[state=active]:text-amber-50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600/40 data-[state=active]:to-amber-400/20 data-[state=active]:border-amber-300/80 data-[state=active]:shadow-[0_0_18px_rgba(245,158,11,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 transition-all duration-200 cursor-pointer"
        >
          Leaderboard
        </TabsTrigger>
        <TabsTrigger
          value="split"
          className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold text-amber-200/90 bg-slate-800/80 border border-amber-800/40 shadow-sm hover:text-amber-50 hover:bg-gradient-to-r hover:from-amber-600/35 hover:to-amber-400/15 hover:border-amber-400/80 hover:shadow-[0_0_16px_rgba(245,158,11,0.4)] hover:-translate-y-px data-[state=active]:text-amber-50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600/40 data-[state=active]:to-amber-400/20 data-[state=active]:border-amber-300/80 data-[state=active]:shadow-[0_0_18px_rgba(245,158,11,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 transition-all duration-200 cursor-pointer"
        >
          Factions
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );

  const factionToggle = (
    <Tabs
      value={leaderboardFactionFilter}
      onValueChange={(value) => setLeaderboardFactionFilter(value as 'all' | 'darkness' | 'light')}
      className="w-full"
    >
      <TabsList className="leaderboard-tabs w-full bg-slate-950/90 shadow-inner rounded-xl p-1 gap-1.5 sm:gap-2">
        <TabsTrigger
          value="all"
          className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold text-amber-200/90 bg-slate-800/80 border border-amber-800/40 shadow-sm hover:text-amber-50 hover:bg-gradient-to-r hover:from-amber-600/35 hover:to-amber-400/15 hover:border-amber-400/80 hover:shadow-[0_0_16px_rgba(245,158,11,0.4)] hover:-translate-y-px data-[state=active]:text-amber-50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600/40 data-[state=active]:to-amber-400/20 data-[state=active]:border-amber-300/80 data-[state=active]:shadow-[0_0_18px_rgba(245,158,11,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 transition-all duration-200 cursor-pointer"
        >
          All
        </TabsTrigger>
        <TabsTrigger
          value="darkness"
          className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold text-amber-200/90 bg-slate-800/80 border border-amber-800/40 shadow-sm hover:text-amber-50 hover:bg-gradient-to-r hover:from-amber-600/35 hover:to-amber-400/15 hover:border-amber-400/80 hover:shadow-[0_0_16px_rgba(245,158,11,0.4)] hover:-translate-y-px data-[state=active]:text-amber-50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600/40 data-[state=active]:to-amber-400/20 data-[state=active]:border-amber-300/80 data-[state=active]:shadow-[0_0_18px_rgba(245,158,11,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 transition-all duration-200 cursor-pointer"
        >
          Darkness
        </TabsTrigger>
        <TabsTrigger
          value="light"
          className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold text-amber-200/90 bg-slate-800/80 border border-amber-800/40 shadow-sm hover:text-amber-50 hover:bg-gradient-to-r hover:from-amber-600/35 hover:to-amber-400/15 hover:border-amber-400/80 hover:shadow-[0_0_16px_rgba(245,158,11,0.4)] hover:-translate-y-px data-[state=active]:text-amber-50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600/40 data-[state=active]:to-amber-400/20 data-[state=active]:border-amber-300/80 data-[state=active]:shadow-[0_0_18px_rgba(245,158,11,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 transition-all duration-200 cursor-pointer"
        >
          Light
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );

  if (isStandaloneAdmin) {
    return (
      <div className="fixed inset-0 bg-black">
        <Suspense fallback={adminPanelFallback}>
          <AdminPanel
            onClose={handleStandaloneAdminClose}
            users={rankedUsers}
            rules={rules}
            activityLog={activityLog}
            serverAvailable={serverAvailable}
            lastEventAt={lastEventAt}
            onAddUser={addUser}
            onUpdateUser={updateUser}
            onAdjustRating={adjustRating}
            onDeleteUser={deleteUser}
            onInjectPurchase={simulateAutoRegistration}
            onUpdateRules={updateRules}
          />
        </Suspense>
        <Toaster />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {/* Mobile Menu Button */}
      {isMobile && (
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`fixed top-4 right-4 z-40 p-2 rounded-lg bg-slate-900/95 text-amber-400 border border-amber-700/50 shadow-xl backdrop-blur-sm ${
            isMenuOpen || selectedUser ? 'opacity-0 pointer-events-none' : ''
          }`}
        >
          {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      )}
      {!isMobile && !isDesktopSidebarOpen && (
        <button
          onClick={() => setIsDesktopSidebarOpen(true)}
          className="fixed bottom-4 right-4 z-[60] p-3 rounded-lg bg-slate-900/95 text-amber-400 border border-amber-700/50 shadow-xl backdrop-blur-sm"
          aria-label="Show leaderboard"
          title="Show leaderboard"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}

      {/* Main Layout */}
      <div className="flex h-full w-full">
        {/* Center - Faction Tree */}
        <div className="flex-1 relative">
          <FactionTree 
            users={treeUsers} 
            onUserClick={setSelectedUser} 
            newlyAddedUserIds={newlyAddedUserIds}
            isMobile={isMobile}
          />
          
          {/* Action Buttons */}
          <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-3">
            <button
              onClick={handleToggleTestControls}
              className={`px-3 lg:px-4 py-2.5 rounded-lg border text-xs lg:text-sm font-semibold flex items-center gap-2 transition-all ${
                testControlsOpen
                  ? 'bg-slate-900/90 border-amber-600/60 text-amber-300 shadow-lg'
                  : 'bg-slate-900/70 border-slate-700 text-slate-300 hover:border-amber-400/40'
              }`}
              aria-pressed={testControlsOpen}
              title="Toggle test controls"
            >
              {testControlsOpen ? <Check className="w-4 h-4 lg:w-5 lg:h-5" /> : <X className="w-4 h-4 lg:w-5 lg:h-5" />}
              <span className="text-xs lg:text-sm font-semibold">
                {testControlsOpen ? 'Test Controls: ON' : 'Test Controls: OFF'}
              </span>
            </button>

            {testControlsOpen && (
              <>
                {/* Add User Button (Admin) */}
                <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                  <DialogTrigger asChild>
                    <button
                      className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-xl hover:shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center border-2 border-amber-400"
                      style={{ boxShadow: '0 0 30px rgba(245, 158, 11, 0.4)' }}
                    >
                      <Plus className="w-6 h-6 lg:w-7 lg:h-7" />
                    </button>
                  </DialogTrigger>
                <DialogContent className="bg-slate-900 border-amber-700/50 text-white max-w-[95vw] lg:max-w-lg mx-4">
                  <DialogHeader>
                    <DialogTitle className="text-xl lg:text-2xl text-amber-400">Add New Member</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="nickname">Nickname</Label>
                      <Input
                        id="nickname"
                        placeholder="Enter nickname"
                        value={newUser.nickname}
                        onChange={(e) => setNewUser({ ...newUser, nickname: e.target.value })}
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rating">Rating</Label>
                      <Input
                        id="rating"
                        type="number"
                        placeholder="Enter rating"
                        value={newUser.rating}
                        onChange={(e) => setNewUser({ ...newUser, rating: e.target.value })}
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="faction">Faction</Label>
                      <Select value={newUser.faction} onValueChange={(value: 'darkness' | 'light') => setNewUser({ ...newUser, faction: value })}>
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700 text-white">
                          <SelectItem value="darkness">Darkness</SelectItem>
                          <SelectItem value="light">Light</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tier">Tier</Label>
                      <Select value={newUser.tier} onValueChange={(value: 'legendary' | 'noble' | 'treasure') => setNewUser({ ...newUser, tier: value })}>
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700 text-white">
                          <SelectItem value="legendary">Legendary</SelectItem>
                          <SelectItem value="noble">Noble Circle</SelectItem>
                          <SelectItem value="treasure">Treasure Hunters</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleAddUser}
                      className="w-full bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 h-11"
                    >
                      Add Member
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Auto Register Button */}
              <button
                onClick={simulateAutoRegistration}
                className="px-3 lg:px-4 py-2.5 lg:py-3 rounded-lg bg-gradient-to-br from-purple-600 to-purple-800 text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-2 border-2 border-purple-400"
                style={{ boxShadow: '0 0 30px rgba(147, 51, 234, 0.4)' }}
                title="Simulate automatic registration"
              >
                <UserPlus className="w-4 h-4 lg:w-5 lg:h-5" />
                <span className="text-xs lg:text-sm font-semibold">Auto Register</span>
              </button>

              {/* Auto Feed Toggle */}
              <button
                onClick={() => setAutoFeedEnabled((prev) => !prev)}
                className={`px-3 lg:px-4 py-2.5 rounded-lg border text-xs lg:text-sm font-semibold flex items-center gap-2 transition-all ${
                  autoFeedEnabled
                    ? 'bg-emerald-600/90 border-emerald-300 text-white shadow-lg shadow-emerald-500/30'
                    : 'bg-slate-900/90 border-slate-700 text-slate-200 hover:border-emerald-400/70'
                }`}
              >
                <Radio className="w-4 h-4 lg:w-5 lg:h-5" />
                {autoFeedEnabled ? 'Auto Feed: ON' : 'Auto Feed: OFF'}
              </button>
            </>
          )}

          {/* Admin Panel Button */}
          <button
            onClick={() => setIsAdminOpen(true)}
            className="px-3 lg:px-4 py-2.5 rounded-lg bg-slate-900/90 text-amber-300 border border-amber-700/40 shadow-lg hover:shadow-2xl hover:translate-y-[-2px] transition-all flex items-center gap-2"
          >
            <Shield className="w-4 h-4 lg:w-5 lg:h-5" />
            <span className="text-xs lg:text-sm font-semibold">Admin Panel</span>
          </button>
          </div>
        </div>

        {/* Right Sidebar - Desktop Only */}
        {!isMobile && isDesktopSidebarOpen && (
          <div className="w-80 bg-gradient-to-bl from-slate-950/60 to-slate-900/40 border-l border-amber-900/20 flex flex-col">
            <div className="p-4 border-b border-amber-900/20 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">{viewToggle}</div>
                <button
                  onClick={() => setIsDesktopSidebarOpen(false)}
                  className="p-2 rounded-lg bg-slate-900/80 text-amber-300 border border-amber-700/40 hover:text-amber-100 hover:border-amber-400/70 transition-colors"
                  aria-label="Hide leaderboard"
                  title="Hide leaderboard"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {leaderboardView === 'ranked' && factionToggle}
            </div>

            <div className="flex-1 flex flex-col gap-3 p-4 min-h-0">
              <Input
                placeholder="Search members"
                value={topListQuery}
                onChange={(e) => setTopListQuery(e.target.value)}
                className="bg-slate-900/70 border-amber-900/30 text-white"
              />
              {leaderboardView === 'split' ? (
                <div className={splitWrapperClass}>
                  <div className="border-b border-red-900/30 pb-4">
                    <div className="mb-2">
                      <h2 className="text-amber-400 text-xl mb-1" style={{ fontFamily: 'Georgia, serif' }}>
                        DARKNESS
                      </h2>
                      <p className="text-amber-400/60 text-sm">{filteredDarknessUsers.length} Members</p>
                    </div>
                    <div className={splitListClass}>
                      <TopList
                        users={filteredDarknessUsers}
                        onUserClick={setSelectedUser}
                        compact
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2">
                      <h2 className="text-amber-400 text-xl mb-1" style={{ fontFamily: 'Georgia, serif' }}>
                        LIGHT
                      </h2>
                      <p className="text-amber-400/60 text-sm">{filteredLightUsers.length} Members</p>
                    </div>
                    <div className={splitListClass}>
                      <TopList
                        users={filteredLightUsers}
                        onUserClick={setSelectedUser}
                        compact
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs uppercase tracking-widest text-amber-300/80">
                    <span>{leaderboardTitle}</span>
                    <span className="normal-case tracking-normal text-amber-300/60">{leaderboardCountLabel}</span>
                  </div>
                  <div className={leaderboardListClass}>
                    <TopList 
                      users={filteredAllUsersByFaction} 
                      onUserClick={setSelectedUser}
                      compact
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Mobile Menu - Slide-in Sheet */}
        {isMobile && (
          <AnimatePresence>
            {isMenuOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                  onClick={() => setIsMenuOpen(false)}
                />
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                  className="fixed inset-0 w-full bg-gradient-to-bl from-slate-950/98 to-slate-900/98 border border-amber-900/30 z-50 shadow-2xl"
                >
                  <div className="flex flex-col h-full">
                    <div className="p-4 sticky top-0 bg-gradient-to-b from-slate-950/95 to-slate-900/90 backdrop-blur-sm z-20 border-b border-amber-900/30 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">{viewToggle}</div>
                        <button
                          onClick={() => setIsMenuOpen(false)}
                          className="p-2 rounded-lg bg-slate-900/90 text-amber-300 border border-amber-700/40 hover:text-amber-100 hover:border-amber-400/70 transition-colors"
                          aria-label="Close leaderboard"
                          title="Close leaderboard"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {leaderboardView === 'ranked' && factionToggle}
                    </div>

                    <div className="flex-1 flex flex-col gap-3 p-4 min-h-0">
                      <Input
                        placeholder="Search members"
                        value={topListQuery}
                        onChange={(e) => setTopListQuery(e.target.value)}
                        className="bg-slate-900/70 border-amber-900/30 text-white"
                      />
                      {leaderboardView === 'split' ? (
                        <div className={splitWrapperClass}>
                          <div className="border-b border-red-900/30 pb-4">
                            <div className="mb-2">
                              <h2 className="text-amber-400 text-lg mb-1" style={{ fontFamily: 'Georgia, serif' }}>
                                DARKNESS
                              </h2>
                              <p className="text-amber-400/60 text-sm">{filteredDarknessUsers.length} Members</p>
                            </div>
                            <div className={splitListClass}>
                              <TopList 
                                users={filteredDarknessUsers} 
                                onUserClick={(user) => {
                                  setSelectedUser(user);
                                  setIsMenuOpen(false);
                                }}
                                compact
                              />
                            </div>
                          </div>

                          <div>
                            <div className="mb-2">
                              <h2 className="text-amber-400 text-lg mb-1" style={{ fontFamily: 'Georgia, serif' }}>
                                LIGHT
                              </h2>
                              <p className="text-amber-400/60 text-sm">{filteredLightUsers.length} Members</p>
                            </div>
                            <div className={splitListClass}>
                              <TopList 
                                users={filteredLightUsers} 
                                onUserClick={(user) => {
                                  setSelectedUser(user);
                                  setIsMenuOpen(false);
                                }}
                                compact
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-amber-300/80">
                            <span>{leaderboardTitle}</span>
                            <span className="normal-case tracking-normal text-amber-300/60">{leaderboardCountLabel}</span>
                          </div>
                          <div className={leaderboardListClass}>
                            <TopList 
                              users={filteredAllUsersByFaction} 
                              onUserClick={(user) => {
                                setSelectedUser(user);
                                setIsMenuOpen(false);
                              }}
                              compact
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* User Profile Modal */}
      <AnimatePresence>
        {selectedUser && (
          <Suspense fallback={null}>
            <UserProfile user={selectedUser} onClose={() => setSelectedUser(null)} />
          </Suspense>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAdminOpen && (
          <Suspense fallback={adminPanelFallback}>
            <AdminPanel
              onClose={() => setIsAdminOpen(false)}
              users={rankedUsers}
              rules={rules}
              activityLog={activityLog}
              serverAvailable={serverAvailable}
              lastEventAt={lastEventAt}
              onAddUser={addUser}
              onUpdateUser={updateUser}
              onAdjustRating={adjustRating}
              onDeleteUser={deleteUser}
              onInjectPurchase={simulateAutoRegistration}
              onUpdateRules={updateRules}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <Toaster />
    </div>
  );
}
