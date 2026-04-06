import { useState, useRef, useEffect } from 'react';
import { User } from '../types/user';
import { motion } from 'motion/react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface DynastyTreeProps {
  users: User[];
  onUserClick: (user: User) => void;
}

export function DynastyTree({ users, onUserClick }: DynastyTreeProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Organize users by level (inverted tree structure)
  const usersByLevel = users.reduce((acc, user) => {
    const level = user.level ?? 0;
    if (!acc[level]) acc[level] = [];
    acc[level].push(user);
    return acc;
  }, {} as Record<number, User[]>);

  const maxLevel = Math.max(...Object.keys(usersByLevel).map(Number));

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.001;
    const newZoom = Math.min(Math.max(0.5, zoom + delta), 3);
    setZoom(newZoom);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Calculate positions
  const levelHeight = 180;
  const nodeWidth = 120;

  return (
    <div className="relative w-full h-[600px] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-2xl overflow-hidden border border-slate-800">
      {/* Controls */}
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <button
          onClick={() => setZoom(Math.min(zoom + 0.2, 3))}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-white border border-slate-700 transition-colors"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={() => setZoom(Math.max(zoom - 0.2, 0.5))}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-white border border-slate-700 transition-colors"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          onClick={resetView}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-white border border-slate-700 transition-colors"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
      </div>

      {/* Zoom indicator */}
      <div className="absolute top-4 left-4 px-3 py-2 rounded-lg bg-slate-800/80 text-white text-sm border border-slate-700 z-10">
        Zoom: {Math.round(zoom * 100)}%
      </div>

      {/* Tree container */}
      <div
        ref={containerRef}
        className={`w-full h-full overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <motion.div
          className="relative w-full h-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {/* Draw connection lines */}
            {Object.entries(usersByLevel).map(([level, levelUsers]) => {
              const currentLevel = parseInt(level);
              if (currentLevel === maxLevel) return null;

              const nextLevelUsers = usersByLevel[currentLevel + 1] || [];
              const containerWidth = containerRef.current?.offsetWidth || 800;

              return levelUsers.map((user, userIndex) => {
                const userX = containerWidth / 2 + (userIndex - (levelUsers.length - 1) / 2) * nodeWidth;
                const userY = 100 + currentLevel * levelHeight;

                // Calculate how many children this node should connect to
                const childrenPerParent = Math.ceil(nextLevelUsers.length / levelUsers.length);
                const startChildIndex = userIndex * childrenPerParent;
                const endChildIndex = Math.min(startChildIndex + childrenPerParent, nextLevelUsers.length);

                return nextLevelUsers.slice(startChildIndex, endChildIndex).map((_, childIndex) => {
                  const actualChildIndex = startChildIndex + childIndex;
                  const childX = containerWidth / 2 + (actualChildIndex - (nextLevelUsers.length - 1) / 2) * nodeWidth;
                  const childY = 100 + (currentLevel + 1) * levelHeight;

                  return (
                    <line
                      key={`${user.id}-${actualChildIndex}`}
                      x1={userX}
                      y1={userY + 40}
                      x2={childX}
                      y2={childY - 40}
                      stroke="rgba(217, 119, 6, 0.3)"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />
                  );
                });
              });
            })}
          </svg>

          {/* Render nodes by level */}
          {Object.entries(usersByLevel).map(([level, levelUsers]) => {
            const containerWidth = containerRef.current?.offsetWidth || 800;
            const currentLevel = parseInt(level);

            return (
              <div key={level} className="absolute w-full" style={{ top: `${100 + currentLevel * levelHeight}px` }}>
                <div className="flex justify-center items-center gap-4" style={{ minWidth: `${levelUsers.length * nodeWidth}px` }}>
                  {levelUsers.map((user, index) => (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: currentLevel * 0.1 + index * 0.05 }}
                      className="relative cursor-pointer group"
                      onClick={() => onUserClick(user)}
                      style={{ width: `${nodeWidth - 20}px` }}
                    >
                      {/* Glow effect for top ranks */}
                      {user.rank <= 3 && (
                        <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full animate-pulse"></div>
                      )}

                      {/* Node container */}
                      <div className="relative flex flex-col items-center">
                        {/* Avatar with rank badge */}
                        <div className="relative">
                          <Avatar className={`w-16 h-16 border-4 transition-all group-hover:scale-110 ${
                            user.rank === 1 ? 'border-amber-400 shadow-lg shadow-amber-500/50' :
                            user.rank === 2 ? 'border-slate-300 shadow-lg shadow-slate-400/50' :
                            user.rank === 3 ? 'border-amber-600 shadow-lg shadow-amber-600/50' :
                            'border-slate-700'
                          }`}>
                            <AvatarImage src={user.avatar} alt={user.nickname} />
                            <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-600 text-white">
                              {user.nickname.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          
                          {/* Rank badge */}
                          <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                            user.rank === 1 ? 'bg-amber-400 text-slate-900' :
                            user.rank === 2 ? 'bg-slate-300 text-slate-900' :
                            user.rank === 3 ? 'bg-amber-600 text-white' :
                            'bg-slate-700 text-slate-300'
                          } border-2 border-slate-900`}>
                            {user.rank}
                          </div>
                        </div>

                        {/* Name (visible at higher zoom) */}
                        {zoom > 0.8 && (
                          <div className="mt-2 text-center">
                            <div className="text-white text-sm truncate max-w-[100px] group-hover:text-amber-400 transition-colors">
                              {user.nickname}
                            </div>
                            <div className="text-slate-400 text-xs">
                              {user.rating.toLocaleString()} pts
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Root indicator */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
            <div className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-full text-white text-sm shadow-lg">
              🏆 Dynasty Roots
            </div>
          </div>
        </motion.div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-slate-800/80 text-slate-300 text-sm rounded-lg border border-slate-700">
        Scroll to zoom • Drag to pan • Click to view profile
      </div>
    </div>
  );
}
