(function () {
  'use strict';

  const API_BASE = window.DYNASTY_API_BASE || '';

  const overlay = document.getElementById('players-overlay');
  const popup = document.getElementById('player-popup');
  const popupContent = document.getElementById('popup-content');
  const popupClose = document.getElementById('popup-close');
  const loadingOverlay = document.getElementById('loading-overlay');
  const errorOverlay = document.getElementById('error-overlay');
  const errorDetail = document.getElementById('error-detail');
  const retryBtn = document.getElementById('retry-btn');

  let viewW = window.innerWidth, viewH = window.innerHeight;
  let flatNodes = [];
  let treeData = [];
  let allPlayers = [];

  function isMobile() { return window.innerWidth <= 600; }
  function getNodeRadius() { return isMobile() ? 16 : 24; }
  function getLevelHeight() { return isMobile() ? 90 : 120; }
  function getMinGap() { return isMobile() ? 30 : 44; }
  function getRootExtraRadius() { return isMobile() ? 5 : 8; }
  function getMaxNameLength() { return isMobile() ? 8 : 12; }

  function getInitials(name) {
    return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  function formatNumber(n) {
    return n.toLocaleString('ru-RU');
  }

  function tierLabel(tier) {
    const map = { legendary: 'Legendary', noble: 'Noble', treasure: 'Treasure' };
    return map[tier] || tier;
  }

  function factionLabel(faction) {
    return faction === 'darkness' ? 'Darkness' : 'Light';
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function truncateName(name) {
    const max = getMaxNameLength();
    if (name.length <= max) return name;
    return name.slice(0, max - 1) + '\u2026';
  }

  /**
   * Flatten nested API tree into a plain array of player objects.
   */
  function flattenApiTree(nodes) {
    const result = [];
    function walk(node) {
      const { children, ...player } = node;
      result.push(player);
      if (children && children.length) {
        for (const child of children) walk(child);
      }
    }
    for (const root of nodes) walk(root);
    return result;
  }

  /**
   * Build a balanced tree ordered by rating (highest = root at top).
   * Branching factor of 3 gives a visually appealing dynasty shape.
   * Each node gets a _visualParentId for edge drawing.
   */
  function buildRatingTree(players) {
    const sorted = [...players].sort((a, b) => b.rating - a.rating);
    if (sorted.length === 0) return [];

    const BRANCH_FACTOR = 3;
    const nodes = sorted.map(p => ({ ...p, children: [], _visualParentId: null }));

    const queue = [nodes[0]];
    let idx = 1;

    while (idx < nodes.length && queue.length > 0) {
      const parent = queue.shift();
      for (let i = 0; i < BRANCH_FACTOR && idx < nodes.length; i++) {
        nodes[idx]._visualParentId = parent.id;
        parent.children.push(nodes[idx]);
        queue.push(nodes[idx]);
        idx++;
      }
    }

    return [nodes[0]];
  }

  /**
   * Reingold-Tilford–style layout: root at top, children spread below.
   * Returns flat array of positioned nodes.
   */
  function layoutTree(roots) {

    const NODE_RADIUS = getNodeRadius();
    const LEVEL_HEIGHT = getLevelHeight();
    const MIN_GAP = getMinGap();
    const flat = [];

    function subtreeWidth(node) {
      if (!node.children || node.children.length === 0) return 1;
      let w = 0;
      for (const child of node.children) {
        w += subtreeWidth(child);
      }
      return w;
    }

    function layout(node, depth, leftBound) {
      const spacing = (NODE_RADIUS * 2 + MIN_GAP);

      if (!node.children || node.children.length === 0) {
        const x = leftBound + spacing / 2;
        const y = depth * LEVEL_HEIGHT;
        flat.push({
          ...node,
          x, y,
          radius: NODE_RADIUS + (depth === 0 ? getRootExtraRadius() : 0),
          depth
        });
        return { x };
      }

      let childLeft = leftBound;
      const childPositions = [];
      for (const child of node.children) {
        const result = layout(child, depth + 1, childLeft);
        childPositions.push(result);
        childLeft += subtreeWidth(child) * spacing;
      }

      const firstChildX = childPositions[0].x;
      const lastChildX = childPositions[childPositions.length - 1].x;
      const x = (firstChildX + lastChildX) / 2;
      const y = depth * LEVEL_HEIGHT;

      flat.push({
        ...node,
        x, y,
        radius: NODE_RADIUS + (depth === 0 ? getRootExtraRadius() : 0),
        depth
      });

      return { x };
    }

    const spacing = (NODE_RADIUS * 2 + MIN_GAP);
    let currentLeft = 0;
    for (const root of roots) {
      layout(root, 0, currentLeft);
      currentLeft += subtreeWidth(root) * spacing;
    }

    // Center the entire tree at origin
    if (flat.length > 0) {
      const minX = Math.min(...flat.map(n => n.x));
      const maxX = Math.max(...flat.map(n => n.x));
      const minY = Math.min(...flat.map(n => n.y));
      const maxY = Math.max(...flat.map(n => n.y));
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      for (const node of flat) {
        node.x -= centerX;
        node.y -= centerY;
      }
    }

    return flat;
  }

  // --- Animation state for smooth transitions ---
  let prevPositions = {};
  let animating = false;
  let animStart = 0;
  const ANIM_DURATION = 600;

  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function getAnimatedPos(node) {
    if (!animating) return { x: node.x, y: node.y };
    const elapsed = performance.now() - animStart;
    const t = easeInOutQuad(Math.min(1, elapsed / ANIM_DURATION));
    const old = prevPositions[node.id];
    if (!old) return { x: node.x, y: node.y };
    return {
      x: old.x + (node.x - old.x) * t,
      y: old.y + (node.y - old.y) * t,
    };
  }

  /** Call when flatNodes changes from polling to trigger smooth transition */
  function applyNewLayout(newFlatNodes) {
    const oldPos = {};
    for (const n of flatNodes) oldPos[n.id] = { x: n.x, y: n.y };

    flatNodes = newFlatNodes;

    // Check if any positions actually moved
    let moved = false;
    for (const n of flatNodes) {
      const o = oldPos[n.id];
      if (!o || Math.abs(o.x - n.x) > 0.5 || Math.abs(o.y - n.y) > 0.5) {
        moved = true; break;
      }
    }

    if (moved && Object.keys(oldPos).length > 0) {
      prevPositions = oldPos;
      animating = true;
      animStart = performance.now();
    }
  }

  function getCamera() {
    const cam = window._treeCamera;
    if (cam) return cam;
    return { x: 0, y: 0, scale: 1 };
  }

  // Zoom thresholds for progressive detail
  const ZOOM_SHOW_NAMES = 0.6;
  const ZOOM_SHOW_RATING = 0.8;
  const ZOOM_SHOW_BADGES = 0.7;

  function renderTree() {
    if (!flatNodes.length) return;

    const cam = getCamera();
    const scale = cam.scale || 1;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${viewW} ${viewH}`);
    svg.style.width = '100%';
    svg.style.height = '100%';

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const tx = viewW / 2 + cam.x * cam.scale;
    const ty = viewH / 2 + cam.y * cam.scale;
    g.setAttribute('transform', `translate(${tx}, ${ty}) scale(${cam.scale})`);

    const posMap = {};
    for (const node of flatNodes) {
      const pos = getAnimatedPos(node);
      posMap[node.id] = pos;
    }

    for (const node of flatNodes) {
      const vizParent = node._visualParentId || node.parent_id;
      if (vizParent && posMap[vizParent]) {
        const p = posMap[vizParent];
        const c = posMap[node.id];
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const midY = (p.y + c.y) / 2;
        line.setAttribute('d', `M ${p.x} ${p.y + 24} C ${p.x} ${midY}, ${c.x} ${midY}, ${c.x} ${c.y - 24}`);
        line.setAttribute('class', 'tree-edge');
        g.appendChild(line);
      }
    }

    for (const node of flatNodes) {
      const pos = posMap[node.id];
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', 'tree-node');
      group.setAttribute('data-id', node.id);
      group.style.cursor = 'pointer';

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', pos.x);
      circle.setAttribute('cy', pos.y);
      circle.setAttribute('r', node.radius);
      circle.setAttribute('class', `node-circle ${node.tier}`);
      group.appendChild(circle);

      if (node.avatar_url) {
        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttribute('href', node.avatar_url);
        img.setAttribute('x', pos.x - node.radius + 4);
        img.setAttribute('y', pos.y - node.radius + 4);
        img.setAttribute('width', (node.radius - 4) * 2);
        img.setAttribute('height', (node.radius - 4) * 2);
        img.setAttribute('clip-path', `circle(${node.radius - 4}px at ${node.radius - 4}px ${node.radius - 4}px)`);
        img.style.borderRadius = '50%';
        group.appendChild(img);
      }

      const initials = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      initials.setAttribute('x', pos.x);
      initials.setAttribute('y', pos.y);
      initials.setAttribute('class', 'node-initials');
      initials.textContent = getInitials(node.name);
      group.appendChild(initials);

      if (scale >= ZOOM_SHOW_NAMES) {
        const nameEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        nameEl.setAttribute('x', pos.x);
        nameEl.setAttribute('y', pos.y + node.radius + 14);
        nameEl.setAttribute('class', 'node-name');
        nameEl.textContent = truncateName(node.name);
        group.appendChild(nameEl);
      }

      if (scale >= ZOOM_SHOW_RATING) {
        const ratingEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        ratingEl.setAttribute('x', pos.x);
        ratingEl.setAttribute('y', pos.y + node.radius + 26);
        ratingEl.setAttribute('class', 'node-rating');
        ratingEl.textContent = formatNumber(node.rating) + ' pts';
        group.appendChild(ratingEl);
      }

      if (node.rank <= 3 && scale >= ZOOM_SHOW_BADGES) {
        const rankBadge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        rankBadge.setAttribute('x', pos.x + node.radius - 2);
        rankBadge.setAttribute('y', pos.y - node.radius + 6);
        rankBadge.setAttribute('class', 'node-rank-badge');
        const medals = { 1: '\u{1F451}', 2: '\u{1F948}', 3: '\u{1F949}' };
        rankBadge.textContent = medals[node.rank] || `#${node.rank}`;
        rankBadge.style.fontSize = '14px';
        group.appendChild(rankBadge);
      }

      group.addEventListener('click', (e) => {
        e.stopPropagation();
        showPopup(node);
      });

      g.appendChild(group);
    }

    svg.appendChild(g);
    overlay.innerHTML = '';
    overlay.appendChild(svg);
  }

  let lastCamX = NaN, lastCamY = NaN, lastCamScale = NaN;

  function syncLoop() {
    const cam = getCamera();
    const camChanged = cam.x !== lastCamX || cam.y !== lastCamY || cam.scale !== lastCamScale;

    if (camChanged || animating) {
      lastCamX = cam.x;
      lastCamY = cam.y;
      lastCamScale = cam.scale;
      renderTree();

      if (animating && performance.now() - animStart >= ANIM_DURATION) {
        animating = false;
      }
    }
    requestAnimationFrame(syncLoop);
  }

  function showPopup(node) {
    const avatarHtml = node.avatar_url
      ? `<img class="popup-avatar" src="${node.avatar_url}" alt="${node.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        + `<div class="popup-avatar-initials" style="display:none">${getInitials(node.name)}</div>`
      : `<div class="popup-avatar-initials">${getInitials(node.name)}</div>`;

    const achievementsHtml = node.achievements && node.achievements.length > 0
      ? `<div class="popup-achievements">
           <div class="popup-achievements-title">Achievements</div>
           <div class="popup-achievement-list">
             ${node.achievements.map(a => `<span class="popup-achievement">${a}</span>`).join('')}
           </div>
         </div>`
      : '';

    popupContent.innerHTML = `
      <div class="popup-header">
        ${avatarHtml}
        <div>
          <div class="popup-name">${node.name}</div>
          <div class="popup-faction ${node.faction}">${factionLabel(node.faction)}</div>
          <span class="popup-tier ${node.tier}">${tierLabel(node.tier)}</span>
        </div>
      </div>
      <div class="popup-stats">
        <div class="popup-stat">
          <div class="popup-stat-label">Rank</div>
          <div class="popup-stat-value">#${node.rank}</div>
        </div>
        <div class="popup-stat">
          <div class="popup-stat-label">Rating</div>
          <div class="popup-stat-value">${formatNumber(node.rating)}</div>
        </div>
        <div class="popup-stat">
          <div class="popup-stat-label">Purchases</div>
          <div class="popup-stat-value">${node.purchases || 0}</div>
        </div>
        <div class="popup-stat">
          <div class="popup-stat-label">Joined</div>
          <div class="popup-stat-value" style="font-size:13px">${formatDate(node.join_date)}</div>
        </div>
      </div>
      ${achievementsHtml}
    `;

    let backdrop = document.querySelector('.popup-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'popup-backdrop';
      backdrop.addEventListener('click', hidePopup);
      document.body.appendChild(backdrop);
    }
    backdrop.classList.remove('hidden');
    popup.classList.remove('hidden');
  }

  function hidePopup() {
    popup.classList.add('hidden');
    const backdrop = document.querySelector('.popup-backdrop');
    if (backdrop) backdrop.classList.add('hidden');
  }

  popupClose.addEventListener('click', hidePopup);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hidePopup();
  });

  overlay.style.pointerEvents = 'none';

  let lastIsMobile = isMobile();
  window.addEventListener('resize', () => {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    const nowMobile = isMobile();
    if (nowMobile !== lastIsMobile && treeData.length > 0) {
      lastIsMobile = nowMobile;
      flatNodes = layoutTree(treeData);
    }
    renderTree();
  });

  function showLoading() {
    loadingOverlay.classList.remove('hidden');
    errorOverlay.classList.add('hidden');
  }

  function hideLoading() {
    loadingOverlay.classList.add('hidden');
  }

  function showError(message) {
    hideLoading();
    errorDetail.textContent = message;
    errorOverlay.classList.remove('hidden');
  }


  const POLL_INTERVAL = 15000;
  let pollTimer = null;
  let syncLoopStarted = false;

  async function pollTree() {
    try {
      const response = await fetch(`${API_BASE}/api/tree`);
      if (!response.ok) return;
      const apiData = await response.json();
      if (!Array.isArray(apiData) || apiData.length === 0) return;

      allPlayers = flattenApiTree(apiData);
      treeData = buildRatingTree(allPlayers);
      const newLayout = layoutTree(treeData);
      applyNewLayout(newLayout); // triggers smooth transition
      renderTree();
    } catch (_) { /* silent — next poll will retry */ }
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(pollTree, POLL_INTERVAL);
  }

  async function initialLoad() {
    showLoading();
    try {
      const response = await fetch(`${API_BASE}/api/tree`);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status} ${response.statusText}`);
      }
      const apiData = await response.json();

      if (!Array.isArray(apiData) || apiData.length === 0) {
        throw new Error('No players found in the dynasty tree');
      }

      allPlayers = flattenApiTree(apiData);
      treeData = buildRatingTree(allPlayers);
      flatNodes = layoutTree(treeData);
      hideLoading();
      renderTree();
      if (!syncLoopStarted) { syncLoopStarted = true; syncLoop(); }
      startPolling();
    } catch (err) {
      console.error('Failed to load tree:', err);
      showError(err.message || 'Network error');
    }
  }

  // Expose for leaderboard cross-module communication
  window._dynastyShowPopup = showPopup;
  window._dynastyGetPlayers = function () { return allPlayers; };

  retryBtn.addEventListener('click', initialLoad);
  initialLoad();

})();
