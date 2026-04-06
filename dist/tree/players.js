/**
 * Dynasty Living Tree — слой игроков поверх Canvas-анимации
 * Загружает данные из /api/tree и рисует узлы дерева с SVG
 * Синхронизирует камеру с tree2d.js через window._treeCamera
 */

(function () {
  'use strict';

  // Адрес API бэкенда
  const API_BASE = 'http://127.0.0.1:4000';

  // DOM-элементы
  const overlay = document.getElementById('players-overlay');
  const popup = document.getElementById('player-popup');
  const popupContent = document.getElementById('popup-content');
  const popupClose = document.getElementById('popup-close');
  const loadingOverlay = document.getElementById('loading-overlay');
  const errorOverlay = document.getElementById('error-overlay');
  const errorDetail = document.getElementById('error-detail');
  const retryBtn = document.getElementById('retry-btn');

  let viewW = window.innerWidth, viewH = window.innerHeight;

  // Массив плоских узлов для рендера
  let flatNodes = [];
  let treeData = [];

  // Мобильная адаптация: уменьшаем размеры на маленьких экранах
  function isMobile() { return window.innerWidth <= 600; }
  function getNodeRadius() { return isMobile() ? 16 : 24; }
  function getLevelHeight() { return isMobile() ? 90 : 120; }
  function getMinGap() { return isMobile() ? 30 : 44; }
  function getRootExtraRadius() { return isMobile() ? 5 : 8; }
  function getMaxNameLength() { return isMobile() ? 8 : 12; }

  // === Утилиты ===

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

  function truncateName(name) {
    const max = getMaxNameLength();
    if (name.length <= max) return name;
    return name.slice(0, max - 1) + '\u2026';
  }

  // === Раскладка дерева ===

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
      const width = subtreeWidth(node);
      const spacing = (NODE_RADIUS * 2 + MIN_GAP);

      if (!node.children || node.children.length === 0) {
        const x = leftBound + spacing / 2;
        const y = depth * LEVEL_HEIGHT;
        flat.push({
          ...node,
          x, y,
          radius: NODE_RADIUS,
          depth
        });
        return { x, width: spacing };
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

      return { x, width: width * spacing };
    }

    let currentLeft = 0;
    const spacing = (NODE_RADIUS * 2 + MIN_GAP);
    for (const root of roots) {
      const w = subtreeWidth(root) * spacing;
      layout(root, 0, currentLeft);
      currentLeft += w + spacing;
    }

    if (flat.length > 0) {
      const minX = Math.min(...flat.map(n => n.x));
      const maxX = Math.max(...flat.map(n => n.x));
      const centerX = (minX + maxX) / 2;
      const offsetY = -80;
      for (const node of flat) {
        node.x -= centerX;
        node.y += offsetY;
      }
    }

    return flat;
  }

  // === Рендер SVG (читает камеру из tree2d.js) ===

  function getCamera() {
    const cam = window._treeCamera;
    if (cam) return cam;
    return { x: 0, y: -40, scale: 1 };
  }

  function renderTree() {
    if (!flatNodes.length) return;

    const cam = getCamera();

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${viewW} ${viewH}`);
    svg.style.width = '100%';
    svg.style.height = '100%';

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const tx = viewW / 2 + cam.x * cam.scale;
    const ty = viewH / 2 + cam.y * cam.scale;
    g.setAttribute('transform', `translate(${tx}, ${ty}) scale(${cam.scale})`);

    // Карта id -> позиция для линий
    const posMap = {};
    for (const node of flatNodes) {
      posMap[node.id] = { x: node.x, y: node.y };
    }

    // Линии связей
    for (const node of flatNodes) {
      if (node.parent_id && posMap[node.parent_id]) {
        const parent = posMap[node.parent_id];
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const midY = (parent.y + node.y) / 2;
        line.setAttribute('d', `M ${parent.x} ${parent.y + 24} C ${parent.x} ${midY}, ${node.x} ${midY}, ${node.x} ${node.y - 24}`);
        line.setAttribute('class', 'tree-edge');
        g.appendChild(line);
      }
    }

    // Узлы
    for (const node of flatNodes) {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', 'tree-node');
      group.setAttribute('data-id', node.id);
      group.style.cursor = 'pointer';

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', node.x);
      circle.setAttribute('cy', node.y);
      circle.setAttribute('r', node.radius);
      circle.setAttribute('class', `node-circle ${node.tier}`);
      group.appendChild(circle);

      if (node.avatar_url) {
        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttribute('href', node.avatar_url);
        img.setAttribute('x', node.x - node.radius + 4);
        img.setAttribute('y', node.y - node.radius + 4);
        img.setAttribute('width', (node.radius - 4) * 2);
        img.setAttribute('height', (node.radius - 4) * 2);
        img.setAttribute('clip-path', `circle(${node.radius - 4}px at ${node.radius - 4}px ${node.radius - 4}px)`);
        img.style.borderRadius = '50%';
        group.appendChild(img);
      }

      const initials = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      initials.setAttribute('x', node.x);
      initials.setAttribute('y', node.y);
      initials.setAttribute('class', 'node-initials');
      initials.textContent = getInitials(node.name);
      group.appendChild(initials);

      const nameEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      nameEl.setAttribute('x', node.x);
      nameEl.setAttribute('y', node.y + node.radius + 14);
      nameEl.setAttribute('class', 'node-name');
      nameEl.textContent = truncateName(node.name);
      group.appendChild(nameEl);

      const ratingEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      ratingEl.setAttribute('x', node.x);
      ratingEl.setAttribute('y', node.y + node.radius + 26);
      ratingEl.setAttribute('class', 'node-rating');
      ratingEl.textContent = formatNumber(node.rating) + ' pts';
      group.appendChild(ratingEl);

      if (node.rank <= 3) {
        const rankBadge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        rankBadge.setAttribute('x', node.x + node.radius - 2);
        rankBadge.setAttribute('y', node.y - node.radius + 6);
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

  // === Анимационный цикл — синхронизация с камерой tree2d.js ===

  let lastCamX = NaN, lastCamY = NaN, lastCamScale = NaN;

  function syncLoop() {
    const cam = getCamera();
    // Перерисовываем только если камера изменилась
    if (cam.x !== lastCamX || cam.y !== lastCamY || cam.scale !== lastCamScale) {
      lastCamX = cam.x;
      lastCamY = cam.y;
      lastCamScale = cam.scale;
      renderTree();
    }
    requestAnimationFrame(syncLoop);
  }

  // === Попап профиля ===

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
          <div class="popup-stat-label">Faction</div>
          <div class="popup-stat-value" style="color: var(--${node.faction})">${factionLabel(node.faction)}</div>
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

  // === Overlay не перехватывает события — пропускает на canvas ===
  overlay.style.pointerEvents = 'none';

  // Reset view — синхронизируется автоматически через syncLoop
  // (tree2d.js обрабатывает Reset и обновляет camera)

  // Resize
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

  // === Загрузка данных ===

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

  async function loadTree() {
    showLoading();
    try {
      const response = await fetch(`${API_BASE}/api/tree`);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status} ${response.statusText}`);
      }
      treeData = await response.json();

      if (!Array.isArray(treeData) || treeData.length === 0) {
        throw new Error('No players found in the dynasty tree');
      }

      flatNodes = layoutTree(treeData);

      hideLoading();
      renderTree();

      // Запускаем цикл синхронизации камеры
      syncLoop();
    } catch (err) {
      console.error('Failed to load tree:', err);
      showError(err.message || 'Network error');
    }
  }

  retryBtn.addEventListener('click', loadTree);

  // Запуск
  loadTree();

  // Обработка кликов по узлам через делегирование (overlay pointer-events: none,
  // но SVG-узлы имеют pointer-events: all через CSS)
  // Пробрасываем клики с canvas на overlay для перехвата кликов по узлам
  // Вместо этого слушаем клик на document и проверяем координаты

})();
