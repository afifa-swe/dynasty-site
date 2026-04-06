import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { User } from '../types/user';
import { ScrollCard } from './ScrollCard';
import { RealisticTree } from './RealisticTree';
import { ZoomIn, ZoomOut, Maximize2, ChevronRight, Info, X } from 'lucide-react';
import backgroundImage from 'figma:asset/9052ec8062b043d11876db1fa25ead193bb415c2.png';

const TREE_BASE_SIZE = 2400;
const INSTRUCTION_STORAGE_KEY = 'dynasty_tree_instructions_hidden';
const LEGENDARY_ROW_PATTERN = [3, 3];
const NOBLE_ROW_PATTERN = [4, 4, 4];
const TREASURE_ROW_PATTERN = [5];
const LEGENDARY_PER_SIDE = 6;
const NOBLE_PER_SIDE = 12;
const TREASURE_PER_SIDE = 22;
const MOBILE_DRAG_THRESHOLD = 5;
const DRAG_CLICK_SUPPRESS_MS = 250;
const DRAG_VISUAL_START_DELAY_MS = 75;
const DRAG_VISUAL_END_DELAY_MS = 140;

function splitIntoRows<T>(items: T[], pattern: number[], fallback: number) {
  const rows: T[][] = [];
  let index = 0;

  for (const count of pattern) {
    if (index >= items.length) break;
    rows.push(items.slice(index, index + count));
    index += count;
  }

  if (fallback <= 0) return rows;

  while (index < items.length) {
    rows.push(items.slice(index, index + fallback));
    index += fallback;
  }

  return rows;
}

interface FactionTreeProps {
  users: User[];
  onUserClick: (user: User) => void;
  newlyAddedUserIds?: string[];
  isMobile?: boolean;
}

export function FactionTree({
  users,
  onUserClick,
  newlyAddedUserIds,
  isMobile = false,
}: FactionTreeProps) {
  const defaultZoom = isMobile ? 0.25 : 0.5;
  const minZoom = isMobile ? 0.15 : 0.2;
  const mobileAutoZoomFloor = 0.25;

  const [zoom, setZoom] = useState(defaultZoom);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [instructionCollapsed, setInstructionCollapsed] = useState(false);
  const [isMobileDragging, setIsMobileDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const [isDragVisualActive, setIsDragVisualActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const dragRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const pendingPanRef = useRef<{ x: number; y: number } | null>(null);
  const panRafRef = useRef<number | null>(null);
  const dragMovedRef = useRef(false);
  const mobileDraggingRef = useRef(false);
  const pinchDistanceRef = useRef<number | null>(null);
  const pendingZoomRef = useRef<number | null>(null);
  const zoomRafRef = useRef<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const lastDragEndedAtRef = useRef(0);
  const treeLayerRef = useRef<HTMLDivElement>(null);
  const dragVisualStartTimeoutRef = useRef<number | null>(null);
  const dragVisualEndTimeoutRef = useRef<number | null>(null);
  const dragActive = isDragging || isMobileDragging;
  const visualInteractionActive = isPinching || isDragVisualActive;
  const showDetails = isMobile ? !isPinching && zoom >= 0.45 : zoom >= 0.4;
  const reduceCardEffects = visualInteractionActive;
  const cardSize = isMobile ? 'sm' : 'md';
  const mobileControlsContainerClass = 'fixed flex flex-col gap-1.5 pointer-events-auto';
  const desktopControlsContainerClass = 'absolute top-4 right-4 flex gap-1.5 lg:gap-2 z-50 pointer-events-auto';
  const controlsContainerClass = isMobile ? mobileControlsContainerClass : desktopControlsContainerClass;
  const mobileControlButtonClass =
    'p-2 rounded-lg bg-slate-900/95 hover:bg-slate-800/95 active:bg-slate-700/95 text-white border border-amber-700/50 transition-all shadow-lg touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed';
  const desktopControlButtonClass =
    'p-2 lg:p-2.5 rounded-lg bg-slate-900/95 hover:bg-slate-800/95 active:bg-slate-700/95 text-white border border-amber-700/50 transition-all shadow-lg touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed';
  const controlButtonClass = isMobile ? mobileControlButtonClass : desktopControlButtonClass;
  const mobileControlIconClass = 'w-4 h-4';
  const desktopControlIconClass = 'w-4 h-4 lg:w-5 lg:h-5';
  const controlIconClass = isMobile ? mobileControlIconClass : desktopControlIconClass;
  const tierLabelStyle = {
    fontFamily: 'Georgia, serif',
    backgroundColor: '#C9A961',
    color: '#2C1810',
    border: '2px solid #A0826D',
    padding: isMobile ? '0.375rem 1.5rem' : '0.5rem 2rem',
    fontSize: isMobile ? '0.875rem' : '1.25rem',
    letterSpacing: '0.05em',
  };
  const isNewlyAdded = useCallback(
    (userId: string) => (newlyAddedUserIds ? newlyAddedUserIds.includes(userId) : false),
    [newlyAddedUserIds],
  );
  const computeFitZoom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return defaultZoom;

    const widthZoom = container.clientWidth / TREE_BASE_SIZE;
    const heightZoom = container.clientHeight / TREE_BASE_SIZE;
    const fitZoom = Math.min(widthZoom, heightZoom) * 0.9;
    const clampedFitZoom = isMobile ? Math.max(fitZoom, mobileAutoZoomFloor) : fitZoom;

    return Math.max(minZoom, Math.min(defaultZoom, clampedFitZoom || defaultZoom));
  }, [defaultZoom, isMobile, minZoom, mobileAutoZoomFloor]);
  const clampZoom = useCallback((value: number) => {
    return Math.min(Math.max(minZoom, value), 2.0);
  }, [minZoom]);
  const persistInstructionCollapsed = useCallback((collapsed: boolean) => {
    setInstructionCollapsed(collapsed);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(INSTRUCTION_STORAGE_KEY, collapsed ? 'true' : 'false');
    } catch {
      // Ignore storage errors (private mode, storage disabled, etc.).
    }
  }, []);

  const sortedByFaction = useMemo(() => {
    const darkness = users.filter((user) => user.faction === 'darkness').sort((a, b) => b.rating - a.rating);
    const light = users.filter((user) => user.faction === 'light').sort((a, b) => b.rating - a.rating);
    return { darkness, light };
  }, [users]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(INSTRUCTION_STORAGE_KEY);
      if (stored === 'true') {
        setInstructionCollapsed(true);
      }
    } catch {
      // Ignore storage errors.
    }
  }, []);
  const legendaryWinner = useMemo(() => {
    if (users.length === 0) return undefined;
    return users.reduce((best, user) => (best && best.rating >= user.rating ? best : user), users[0]);
  }, [users]);

  const perFactionBuckets = useMemo(() => {
    const winnerId = legendaryWinner?.id;
    const winnerFaction = legendaryWinner?.faction;
    const darknessList =
      winnerFaction === 'darkness' && winnerId
        ? sortedByFaction.darkness.filter((user) => user.id !== winnerId)
        : sortedByFaction.darkness;
    const lightList =
      winnerFaction === 'light' && winnerId
        ? sortedByFaction.light.filter((user) => user.id !== winnerId)
        : sortedByFaction.light;

    const legendaryDark = darknessList.slice(0, LEGENDARY_PER_SIDE);
    const legendaryLight = lightList.slice(0, LEGENDARY_PER_SIDE);

    const nobleStart = LEGENDARY_PER_SIDE;
    const nobleEnd = nobleStart + NOBLE_PER_SIDE;
    const nobleDark = darknessList.slice(nobleStart, nobleEnd);
    const nobleLight = lightList.slice(nobleStart, nobleEnd);

    const treasureStart = nobleEnd;
    const treasureEnd = treasureStart + TREASURE_PER_SIDE;
    const treasureDark = darknessList.slice(treasureStart, treasureEnd);
    const treasureLight = lightList.slice(treasureStart, treasureEnd);

    return {
      legendaryDark,
      legendaryLight,
      nobleDark,
      nobleLight,
      treasureDark,
      treasureLight,
    };
  }, [legendaryWinner, sortedByFaction]);

  const legendaryRows = useMemo(
    () => ({
      darkness: splitIntoRows(perFactionBuckets.legendaryDark, LEGENDARY_ROW_PATTERN, 0),
      light: splitIntoRows(perFactionBuckets.legendaryLight, LEGENDARY_ROW_PATTERN, 0),
    }),
    [perFactionBuckets.legendaryDark, perFactionBuckets.legendaryLight],
  );

  const nobleRows = useMemo(
    () => ({
      darkness: splitIntoRows(perFactionBuckets.nobleDark, NOBLE_ROW_PATTERN, 0),
      light: splitIntoRows(perFactionBuckets.nobleLight, NOBLE_ROW_PATTERN, 0),
    }),
    [perFactionBuckets.nobleDark, perFactionBuckets.nobleLight],
  );

  const treasureRows = useMemo(
    () => ({
      darkness: splitIntoRows(perFactionBuckets.treasureDark, TREASURE_ROW_PATTERN, 5),
      light: splitIntoRows(perFactionBuckets.treasureLight, TREASURE_ROW_PATTERN, 5),
    }),
    [perFactionBuckets.treasureDark, perFactionBuckets.treasureLight],
  );

  const applyTransforms = useCallback((nextPan: { x: number; y: number }, nextZoom: number) => {
    if (treeLayerRef.current) {
      treeLayerRef.current.style.transform = `translate(-50%, -50%) translate3d(${nextPan.x}px, ${nextPan.y}px, 0) scale(${nextZoom})`;
    }
  }, []);

  const queueZoom = useCallback((nextZoom: number) => {
    pendingZoomRef.current = clampZoom(nextZoom);
    if (zoomRafRef.current !== null) return;

    zoomRafRef.current = window.requestAnimationFrame(() => {
      zoomRafRef.current = null;
      const next = pendingZoomRef.current;
      if (next === null) return;
      pendingZoomRef.current = null;
      zoomRef.current = next;
      applyTransforms(panRef.current, next);
      setZoom((prev) => (prev === next ? prev : next));
    });
  }, [applyTransforms, clampZoom]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const delta = e.deltaY * -0.001;
    const baseZoom = pendingZoomRef.current ?? zoomRef.current;
    queueZoom(baseZoom + delta);
  }, [queueZoom]);

  const queuePan = useCallback((nextX: number, nextY: number) => {
    pendingPanRef.current = { x: nextX, y: nextY };
    if (panRafRef.current !== null) return;

    panRafRef.current = window.requestAnimationFrame(() => {
      panRafRef.current = null;
      const next = pendingPanRef.current;
      if (!next) return;
      panRef.current = next;
      applyTransforms(next, zoomRef.current);
    });
  }, [applyTransforms]);

  const setMobileDraggingState = useCallback((value: boolean) => {
    if (mobileDraggingRef.current === value) return;
    mobileDraggingRef.current = value;
    setIsMobileDragging(value);
  }, []);

  const clearDragVisualStartTimeout = useCallback(() => {
    if (dragVisualStartTimeoutRef.current !== null) {
      window.clearTimeout(dragVisualStartTimeoutRef.current);
      dragVisualStartTimeoutRef.current = null;
    }
  }, []);

  const clearDragVisualEndTimeout = useCallback(() => {
    if (dragVisualEndTimeoutRef.current !== null) {
      window.clearTimeout(dragVisualEndTimeoutRef.current);
      dragVisualEndTimeoutRef.current = null;
    }
  }, []);

  const scheduleDragVisualStart = useCallback(() => {
    clearDragVisualEndTimeout();
    if (isDragVisualActive || dragVisualStartTimeoutRef.current !== null) return;

    dragVisualStartTimeoutRef.current = window.setTimeout(() => {
      dragVisualStartTimeoutRef.current = null;
      setIsDragVisualActive(true);
    }, DRAG_VISUAL_START_DELAY_MS);
  }, [clearDragVisualEndTimeout, isDragVisualActive]);

  const scheduleDragVisualEnd = useCallback(() => {
    clearDragVisualStartTimeout();
    if (!isDragVisualActive && dragVisualEndTimeoutRef.current === null) return;

    clearDragVisualEndTimeout();
    dragVisualEndTimeoutRef.current = window.setTimeout(() => {
      dragVisualEndTimeoutRef.current = null;
      setIsDragVisualActive(false);
    }, DRAG_VISUAL_END_DELAY_MS);
  }, [clearDragVisualEndTimeout, clearDragVisualStartTimeout, isDragVisualActive]);

  const stopDragging = useCallback(() => {
    if (dragMovedRef.current) {
      lastDragEndedAtRef.current = Date.now();
    }
    dragRef.current = false;
    dragMovedRef.current = false;
    activePointerIdRef.current = null;
    setIsDragging(false);
    setMobileDraggingState(false);
    setPan((prev) => (prev.x === panRef.current.x && prev.y === panRef.current.y ? prev : panRef.current));
    scheduleDragVisualEnd();
  }, [scheduleDragVisualEnd, setMobileDraggingState]);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!dragRef.current) return;
    if (pinchDistanceRef.current !== null) return;

    const nextX = clientX - dragStartRef.current.x;
    const nextY = clientY - dragStartRef.current.y;
    const dx = nextX - panRef.current.x;
    const dy = nextY - panRef.current.y;
    const dragThreshold = isMobile ? MOBILE_DRAG_THRESHOLD : 3;

    if (!dragMovedRef.current && Math.hypot(dx, dy) < dragThreshold) {
      return;
    }

    if (!dragMovedRef.current) {
      dragMovedRef.current = true;
      setIsDragging(true);
      if (isMobile) {
        setMobileDraggingState(true);
      }
      scheduleDragVisualStart();
    }

    queuePan(nextX, nextY);
  }, [isMobile, queuePan, scheduleDragVisualStart, setMobileDraggingState]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!e.isPrimary || pinchDistanceRef.current !== null) return;

    const target = e.target as HTMLElement;
    if (target.closest('button, [role="button"], a, input, textarea, select')) return;

    dragRef.current = true;
    dragMovedRef.current = false;
    activePointerIdRef.current = e.pointerId;
    dragStartRef.current = {
      x: e.clientX - panRef.current.x,
      y: e.clientY - panRef.current.y,
    };

    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;
    handleDragMove(e.clientX, e.clientY);
  }, [handleDragMove]);

  const handlePointerUp = useCallback((pointerId?: number | null) => {
    if (pointerId !== undefined && pointerId !== null && activePointerIdRef.current !== pointerId) return;
    stopDragging();
  }, [stopDragging]);

  const handleClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (Date.now() - lastDragEndedAtRef.current < DRAG_CLICK_SUPPRESS_MS) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const handleNativeDragStart = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const resetView = useCallback(() => {
    const targetZoom = isMobile ? computeFitZoom() : defaultZoom;
    if (zoomRafRef.current !== null) {
      window.cancelAnimationFrame(zoomRafRef.current);
      zoomRafRef.current = null;
    }
    pendingZoomRef.current = null;
    zoomRef.current = targetZoom;
    setZoom(targetZoom);
    setPan({ x: 0, y: 0 });
    panRef.current = { x: 0, y: 0 };
    applyTransforms({ x: 0, y: 0 }, targetZoom);
  }, [computeFitZoom, defaultZoom, isMobile]);

  // Touch events are only used for custom pinch zoom. Single-finger pan goes through pointer events.
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2) return;

    const distance = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY,
    );

    stopDragging();
    clearDragVisualEndTimeout();
    pinchDistanceRef.current = distance;
    setIsPinching(true);
  }, [clearDragVisualEndTimeout, stopDragging]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2 || pinchDistanceRef.current === null) return;
    e.preventDefault();

    const currentDistance = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY,
    );

    const delta = (currentDistance - pinchDistanceRef.current) * 0.01;
    const baseZoom = pendingZoomRef.current ?? zoomRef.current;
    queueZoom(baseZoom + delta);
    pinchDistanceRef.current = currentDistance;
  }, [queueZoom]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchDistanceRef.current = null;
      setMobileDraggingState(false);
      setIsPinching(false);
      setZoom((prev) => (prev === zoomRef.current ? prev : zoomRef.current));
      if (!dragRef.current) {
        scheduleDragVisualEnd();
      }
    }
  }, [scheduleDragVisualEnd, setMobileDraggingState]);

  useEffect(() => {
    const handleWindowPointerMove = (event: PointerEvent) => {
      if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) return;
      handleDragMove(event.clientX, event.clientY);
    };

    const handleWindowPointerUp = (event: PointerEvent) => {
      handlePointerUp(event.pointerId);
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: true });
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [handleDragMove, handlePointerUp]);

  const treeContainerTransform = useMemo(() => ({
    transform: `translate(-50%, -50%) translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
    willChange: 'transform',
  }), [pan.x, pan.y, zoom]);
  const zoomLabel = `Zoom: ${Math.round(zoom * 100)}%`;
  const instructionText = isMobile
    ? `${zoomLabel} · Names show at 40%+`
    : `Drag to pan - Wheel or buttons to zoom - ${zoomLabel} - Zoom in for names`;

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    zoomRef.current = zoom;
    applyTransforms(panRef.current, zoom);
  }, [applyTransforms, zoom]);

  useEffect(() => {
    applyTransforms(pan, zoomRef.current);
  }, [applyTransforms, pan]);

  useEffect(() => {
    return () => {
      if (panRafRef.current !== null) {
        window.cancelAnimationFrame(panRafRef.current);
      }
      if (zoomRafRef.current !== null) {
        window.cancelAnimationFrame(zoomRafRef.current);
      }
      clearDragVisualStartTimeout();
      clearDragVisualEndTimeout();
    };
  }, [clearDragVisualEndTimeout, clearDragVisualStartTimeout]);

  // Auto-fit the tree on initial load and when switching to mobile/tablet so it stays in view
  useEffect(() => {
    if (!isMobile) {
      setZoom(defaultZoom);
      setPan({ x: 0, y: 0 });
      return;
    }

    const updateZoomToFit = () => {
      setZoom(computeFitZoom());
      setPan({ x: 0, y: 0 });
    };

    updateZoomToFit();
    window.addEventListener('resize', updateZoomToFit);
    return () => window.removeEventListener('resize', updateZoomToFit);
  }, [computeFitZoom, defaultZoom, isMobile]);

  return (
    <div 
      ref={containerRef}
      className={`dynasty-tree-surface relative w-full h-full overflow-hidden ${
        visualInteractionActive ? 'dynasty-tree-surface-dragging' : ''
      } ${
        dragActive ? 'cursor-grabbing' : 'cursor-grab'
      } touch-none`}
      style={{
        touchAction: 'none',
        overscrollBehavior: 'contain',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      onWheel={isMobile ? undefined : handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => handlePointerUp(e.pointerId)}
      onPointerCancel={(e) => handlePointerUp(e.pointerId)}
      onClickCapture={handleClickCapture}
      onDragStart={handleNativeDragStart}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Fallback split-color extension under the main background art */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to right, #730705 0%, #730705 50%, #f3f3f3 50%, #f3f3f3 100%)',
          opacity: 1,
          zIndex: 0,
        }}
      />
      
      {/* Primary solid background art */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: isMobile ? 'auto 1900px' : 'auto 2550px',
          backgroundPosition: 'center top',
          backgroundRepeat: 'repeat-y',
          opacity: 1,
          zIndex: 1,
        }}
      />

      {/* Controls */}
      <div
        className={controlsContainerClass}
        style={isMobile ? { top: 10, left: 10, zIndex: 30 } : undefined}
      >
        <button
          onClick={() => queueZoom((pendingZoomRef.current ?? zoomRef.current) + 0.1)}
          className={controlButtonClass}
          title="Zoom In"
        >
          <ZoomIn className={controlIconClass} />
        </button>
        <button
          onClick={() => queueZoom((pendingZoomRef.current ?? zoomRef.current) - 0.1)}
          className={controlButtonClass}
          title="Zoom Out"
        >
          <ZoomOut className={controlIconClass} />
        </button>
        <button
          onClick={resetView}
          className={controlButtonClass}
          title="Reset View"
        >
          <Maximize2 className={controlIconClass} />
        </button>
        {isMobile && instructionCollapsed && (
          <button
            type="button"
            onClick={() => persistInstructionCollapsed(false)}
            className={controlButtonClass}
            title="Show instructions"
          >
            <Info className={controlIconClass} />
          </button>
        )}
      </div>

      {/* Instructions */}
      {!instructionCollapsed && (
        <div
          className={`absolute top-4 pointer-events-none ${
            isMobile
              ? 'left-1/2 -translate-x-1/2'
              : 'left-4 right-44 flex justify-center'
          }`}
          style={isMobile ? { zIndex: 40 } : { zIndex: 2 }}
        >
          <div className="max-w-full px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg bg-slate-900/95 text-amber-400 border border-amber-700/50 shadow-lg backdrop-blur-sm pointer-events-auto">
            <div className="flex items-center gap-2">
              <span
                className={`min-w-0 text-center ${
                  isMobile ? 'text-[11px] whitespace-nowrap' : 'text-xs lg:text-sm leading-tight'
                }`}
              >
                {instructionText}
              </span>
              {isMobile ? (
                <button
                  type="button"
                  onClick={() => persistInstructionCollapsed(true)}
                  className="p-1 rounded-md bg-black/30 hover:bg-black/50 border border-amber-700/40 text-amber-200"
                  aria-label="Hide instructions"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => persistInstructionCollapsed(true)}
                  className="px-2 py-0.5 text-[10px] lg:text-xs rounded-md bg-black/30 hover:bg-black/50 border border-amber-700/40 text-amber-200"
                >
                  Hide
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {!isMobile && instructionCollapsed && (
        <button
          type="button"
          onClick={() => persistInstructionCollapsed(false)}
          className="absolute top-4 left-4 p-1.5 rounded-md bg-slate-900/95 border border-amber-700/50 text-amber-200 shadow-lg hover:bg-slate-800/95"
          style={{ zIndex: 2 }}
          title="Show instructions"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Tree Container - Centered and Draggable */}
      <div
        ref={treeLayerRef}
        className="absolute left-1/2 top-1/2 pointer-events-none"
        style={{
          ...treeContainerTransform,
          transformOrigin: 'center center',
          width: '100%',
          zIndex: 2,
        }}
      >
        <div
          className={`relative ${visualInteractionActive ? 'pointer-events-none' : 'pointer-events-auto'}`}
          style={{ width: '100%', paddingTop: '20px', paddingBottom: '200px', marginLeft: isMobile ? '-8px' : '0' }}
        >
          {/* Dynasty Title - Split Color - Centered - Above Tree */}
          <div className="absolute text-center" style={{ height: isMobile ? '50px' : '80px', zIndex: 100, top: isMobile ? '-200px' : '-300px', left: '50%', transform: 'translateX(-50%)', width: '100%' }}>
            <div className="flex items-center justify-center overflow-hidden h-full">
              <h1 
                style={{ 
                  fontFamily: 'Georgia, serif',
                  fontWeight: 'bold',
                  fontSize: isMobile ? '2.5rem' : '4.5rem',
                  letterSpacing: '0.1em',
                  background: 'linear-gradient(to right, #C9A961 0%, #C9A961 50%, #2C1810 50%, #2C1810 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: 'none',
                }}
              >
                DYNASTY
              </h1>
            </div>
          </div>

          {/* Faction Labels - Above Tree */}
          <div className="absolute flex justify-between" style={{ zIndex: 100, top: isMobile ? '-120px' : '-180px', left: '0', right: '0', paddingLeft: isMobile ? '2rem' : '10rem', paddingRight: isMobile ? '2rem' : '10rem' }}>
            <div 
              style={{ 
                fontFamily: 'Georgia, serif',
                fontSize: isMobile ? '1.25rem' : '1.875rem',
                letterSpacing: isMobile ? '0.1em' : '0.15em',
                color: '#C9A961',
                textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
              }}
            >
              DARKNESS
            </div>
            <div 
              style={{ 
                fontFamily: 'Georgia, serif',
                fontSize: isMobile ? '1.25rem' : '1.875rem',
                letterSpacing: isMobile ? '0.1em' : '0.15em',
                color: '#2C1810',
                textShadow: '2px 2px 4px rgba(255,255,255,0.3)',
              }}
            >
              LIGHT
            </div>
          </div>

          {/* Tree SVG Background */}
          <RealisticTree isMobile={isMobile} lowPowerMobile={isMobile} pauseEffects={visualInteractionActive} />

          {/* Scrolls positioned on tree */}
          <div className="relative" style={{ zIndex: 10 }}>
            {/* LEGENDARY TIER - Top ranked members near the canopy */}
            <div className="relative mb-12" style={{ zIndex: 10, paddingTop: isMobile ? '10px' : '20px' }}>
              <div className="flex justify-center mb-10">
                <div style={tierLabelStyle}>LEGENDARY</div>
              </div>

              {legendaryWinner ? (
                <div className="flex items-center justify-center mb-16">
                  <ScrollCard
                    user={legendaryWinner}
                    onClick={onUserClick}
                    index={0}
                    isNewlyAdded={isNewlyAdded(legendaryWinner.id)}
                    showDetails={showDetails}
                    size={cardSize}
                    reduceEffects={reduceCardEffects}
                  />
                </div>
              ) : null}

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  gap: '8rem',
                }}
              >
                <div
                  className="flex flex-col"
                  style={{
                    gap: '60px',
                    width: '700px',
                    maxWidth: '700px',
                  }}
                >
                  {legendaryRows.darkness.map((row, rowIndex) =>
                    row.length ? (
                      <div
                        key={`legendary-dark-${rowIndex}`}
                        className="flex items-center justify-center"
                        style={{ gap: '60px' }}
                      >
                        {row.map((user, index) => (
                          <div key={user.id}>
                            <ScrollCard
                              user={user}
                              onClick={onUserClick}
                              index={rowIndex * 4 + index}
                              isNewlyAdded={isNewlyAdded(user.id)}
                              showDetails={showDetails}
                              size={cardSize}
                    reduceEffects={reduceCardEffects}
                            />
                          </div>
                        ))}
                      </div>
                    ) : null,
                  )}
                </div>

                <div
                  className="flex flex-col"
                  style={{
                    gap: '60px',
                    width: '700px',
                    maxWidth: '700px',
                  }}
                >
                  {legendaryRows.light.map((row, rowIndex) =>
                    row.length ? (
                      <div
                        key={`legendary-light-${rowIndex}`}
                        className="flex items-center justify-center"
                        style={{ gap: '60px' }}
                      >
                        {row.map((user, index) => (
                          <div key={user.id}>
                            <ScrollCard
                              user={user}
                              onClick={onUserClick}
                              index={rowIndex * 4 + index}
                              isNewlyAdded={isNewlyAdded(user.id)}
                              showDetails={showDetails}
                              size={cardSize}
                    reduceEffects={reduceCardEffects}
                            />
                          </div>
                        ))}
                      </div>
                    ) : null,
                  )}
                </div>
              </div>
            </div>

            {/* NOBLE CIRCLE TIER - Upper-mid members per faction - On lower branches transitioning to roots */}
            <div className="relative mb-12" style={{ zIndex: 10, paddingTop: isMobile ? '10px' : '20px' }}>
              <div className="flex justify-center mb-10">
                <div style={tierLabelStyle}>NOBLE CIRCLE</div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  gap: '8rem',
                }}
              >
                <div
                  className="flex flex-col"
                  style={{
                    gap: '60px',
                    width: '800px',
                    maxWidth: '800px',
                  }}
                >
                  {nobleRows.darkness.map((row, rowIndex) =>
                    row.length ? (
                      <div
                        key={`noble-dark-${rowIndex}`}
                        className="flex items-center justify-center"
                        style={{ gap: '60px' }}
                      >
                        {row.map((user, index) => (
                          <div key={user.id}>
                            <ScrollCard
                              user={user}
                              onClick={onUserClick}
                              index={rowIndex * 4 + index}
                              isNewlyAdded={isNewlyAdded(user.id)}
                              showDetails={showDetails}
                              size={cardSize}
                    reduceEffects={reduceCardEffects}
                            />
                          </div>
                        ))}
                      </div>
                    ) : null,
                  )}
                </div>

                <div
                  className="flex flex-col"
                  style={{
                    gap: '60px',
                    width: '800px',
                    maxWidth: '800px',
                  }}
                >
                  {nobleRows.light.map((row, rowIndex) =>
                    row.length ? (
                      <div
                        key={`noble-light-${rowIndex}`}
                        className="flex items-center justify-center"
                        style={{ gap: '60px' }}
                      >
                        {row.map((user, index) => (
                          <div key={user.id}>
                            <ScrollCard
                              user={user}
                              onClick={onUserClick}
                              index={rowIndex * 4 + index}
                              isNewlyAdded={isNewlyAdded(user.id)}
                              showDetails={showDetails}
                              size={cardSize}
                    reduceEffects={reduceCardEffects}
                            />
                          </div>
                        ))}
                      </div>
                    ) : null,
                  )}
                </div>
              </div>
            </div>

            {/* TREASURE HUNTERS TIER - All other members - On roots at bottom */}
            <div className="relative mb-12" style={{ zIndex: 10, paddingTop: isMobile ? '30px' : '20px' }}>
              <div className="flex justify-center mb-10">
                <div style={tierLabelStyle}>TREASURE HUNTERS</div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  gap: isMobile ? '7rem' : '5rem',
                  marginTop: '0',
                }}
              >
                <div
                  className="flex flex-col"
                  style={{
                    gap: '55px',
                    width: isMobile ? '1000px' : '1100px',
                    maxWidth: isMobile ? '1000px' : '1100px',
                  }}
                >
                  {treasureRows.darkness.map((row, rowIndex) =>
                    row.length ? (
                      <div
                        key={`treasure-dark-${rowIndex}`}
                        className="flex items-center justify-center"
                        style={{ gap: rowIndex < 3 ? '35px' : '45px' }}
                      >
                        {row.map((user, index) => (
                          <div key={user.id}>
                            <ScrollCard
                              user={user}
                              onClick={onUserClick}
                              index={rowIndex * 4 + index}
                              isNewlyAdded={isNewlyAdded(user.id)}
                              showDetails={showDetails}
                              size={cardSize}
                    reduceEffects={reduceCardEffects}
                            />
                          </div>
                        ))}
                      </div>
                    ) : null,
                  )}
                </div>

                <div
                  className="flex flex-col"
                  style={{
                    gap: '55px',
                    width: isMobile ? '1000px' : '1100px',
                    maxWidth: isMobile ? '1000px' : '1100px',
                  }}
                >
                  {treasureRows.light.map((row, rowIndex) =>
                    row.length ? (
                      <div
                        key={`treasure-light-${rowIndex}`}
                        className="flex items-center justify-center"
                        style={{ gap: rowIndex < 3 ? '35px' : '45px' }}
                      >
                        {row.map((user, index) => (
                          <div key={user.id}>
                            <ScrollCard
                              user={user}
                              onClick={onUserClick}
                              index={rowIndex * 4 + index}
                              isNewlyAdded={isNewlyAdded(user.id)}
                              showDetails={showDetails}
                              size={cardSize}
                    reduceEffects={reduceCardEffects}
                            />
                          </div>
                        ))}
                      </div>
                    ) : null,
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

