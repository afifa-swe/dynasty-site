/**
 * Dynasty Living Tree — слой игроков поверх Canvas-анимации
 * Загружает данные из /api/tree и рисует узлы дерева с SVG
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

  // Состояние камеры (синхронизируется с tree2d.js)
  let camX = 0, camY = -40, camScale = 1;
  let viewW = window.innerWidth, viewH = window.innerHeight;

  // Массив плоских узлов для рендера
  let flatNodes = [];
  let treeData = [];

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

  // === Раскладка дерева ===

  /**
   * Рекурсивно раскладывает узлы дерева сверху вниз
   * Корень вверху, дети ниже. Используем простой алгоритм Рейнгольда-Тилфорда
   */
  function layoutTree(roots) {
    const NODE_RADIUS = 24;
    const LEVEL_HEIGHT = 100;
    const MIN_GAP = 16;
    const flat = [];
    let nextX = 0;

    // Считаем ширину поддерева (количество листьев)
    function subtreeWidth(node) {
      if (!node.children || node.children.length === 0) return 1;
      let w = 0;
      for (const child of node.children) {
        w += subtreeWidth(child);
      }
      return w;
    }

    // Рекурсивная раскладка
    function layout(node, depth, leftBound) {
      const width = subtreeWidth(node);
      const spacing = (NODE_RADIUS * 2 + MIN_GAP);

      if (!node.children || node.children.length === 0) {
        // Лист — ставим в следующую свободную позицию
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

      // Раскладываем детей
      let childLeft = leftBound;
      const childPositions = [];
      for (const child of node.children) {
        const result = layout(child, depth + 1, childLeft);
        childPositions.push(result);
        childLeft += subtreeWidth(child) * spacing;
      }

      // Центрируем родителя над детьми
      const firstChildX = childPositions[0].x;
      const lastChildX = childPositions[childPositions.length - 1].x;
      const x = (firstChildX + lastChildX) / 2;
      const y = depth * LEVEL_HEIGHT;

      flat.push({
        ...node,
        x, y,
        radius: NODE_RADIUS + (depth === 0 ? 8 : 0), // корень чуть больше
        depth
      });

      return { x, width: width * spacing };
    }

    // Раскладываем все корни рядом
    let currentLeft = 0;
    const spacing = (NODE_RADIUS * 2 + MIN_GAP);
    for (const root of roots) {
      const w = subtreeWidth(root) * spacing;
      layout(root, 0, currentLeft);
      currentLeft += w + spacing;
    }

    // Центрируем относительно (0, 0)
    if (flat.length > 0) {
      const minX = Math.min(...flat.map(n => n.x));
      const maxX = Math.max(...flat.map(n => n.x));
      const centerX = (minX + maxX) / 2;
      const offsetY = -80; // Начинаем чуть выше
      for (const node of flat) {
        node.x -= centerX;
        node.y += offsetY;
      }
    }

    return flat;
  }

  // === Рендер SVG ===

  function renderTree() {
    if (!flatNodes.length) return;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${viewW} ${viewH}`);
    svg.style.width = '100%';
    svg.style.height = '100%';

    // Группа с трансформацией камеры
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const tx = viewW / 2 + camX * camScale;
    const ty = viewH / 2 + camY * camScale;
    g.setAttribute('transform', `translate(${tx}, ${ty}) scale(${camScale})`);

    // Карта id -> позиция для линий
    const posMap = {};
    for (const node of flatNodes) {
      posMap[node.id] = { x: node.x, y: node.y };
    }

    // Рисуем линии связей
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

    // Рисуем узлы
    for (const node of flatNodes) {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', 'tree-node');
      group.setAttribute('data-id', node.id);
      group.style.cursor = 'pointer';

      // Круг узла
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', node.x);
      circle.setAttribute('cy', node.y);
      circle.setAttribute('r', node.radius);
      circle.setAttribute('class', `node-circle ${node.tier}`);
      group.appendChild(circle);

      // Аватар или инициалы
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

      // Инициалы поверх (если аватар не загрузится)
      const initials = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      initials.setAttribute('x', node.x);
      initials.setAttribute('y', node.y);
      initials.setAttribute('class', 'node-initials');
      initials.textContent = getInitials(node.name);
      group.appendChild(initials);

      // Имя под узлом
      const nameEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      nameEl.setAttribute('x', node.x);
      nameEl.setAttribute('y', node.y + node.radius + 14);
      nameEl.setAttribute('class', 'node-name');
      nameEl.textContent = node.name;
      group.appendChild(nameEl);

      // Рейтинг
      const ratingEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      ratingEl.setAttribute('x', node.x);
      ratingEl.setAttribute('y', node.y + node.radius + 26);
      ratingEl.setAttribute('class', 'node-rating');
      ratingEl.textContent = formatNumber(node.rating) + ' pts';
      group.appendChild(ratingEl);

      // Бейдж ранга
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

      // Обработчик клика
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

    // Показать backdrop
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

  // === Синхронизация камеры с tree2d.js ===

  // tree2d.js использует глобальную переменную camera через замыкание
  // Мы перехватываем события pan/zoom и повторяем трансформацию
  let dragActive = false;
  let lastPointerX = 0, lastPointerY = 0;

  const canvas = document.getElementById('tree-canvas');

  // Перехватываем события на overlay (он поверх canvas)
  overlay.style.pointerEvents = 'auto';

  overlay.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.tree-node')) return; // клик по узлу — не drag
    dragActive = true;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    overlay.setPointerCapture(e.pointerId);
    overlay.style.cursor = 'grabbing';

    // Пробрасываем событие на canvas
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: e.clientX, clientY: e.clientY,
      pointerId: e.pointerId, bubbles: true
    }));
  });

  overlay.addEventListener('pointermove', (e) => {
    if (dragActive) {
      const dx = (e.clientX - lastPointerX) / camScale;
      const dy = (e.clientY - lastPointerY) / camScale;
      camX += dx;
      camY += dy;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      renderTree();
    }

    // Пробрасываем на canvas
    canvas.dispatchEvent(new PointerEvent('pointermove', {
      clientX: e.clientX, clientY: e.clientY,
      pointerId: e.pointerId, bubbles: true
    }));
  });

  overlay.addEventListener('pointerup', (e) => {
    if (dragActive) {
      dragActive = false;
      try { overlay.releasePointerCapture(e.pointerId); } catch (_) {}
      overlay.style.cursor = 'grab';
    }

    canvas.dispatchEvent(new PointerEvent('pointerup', {
      clientX: e.clientX, clientY: e.clientY,
      pointerId: e.pointerId, bubbles: true
    }));
  });

  overlay.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0012);
    const mx = (e.offsetX - viewW / 2) / camScale - camX;
    const my = (e.offsetY - viewH / 2) / camScale - camY;
    camScale *= factor;
    camX += mx - mx * factor;
    camY += my - my * factor;
    renderTree();

    // Пробрасываем на canvas
    canvas.dispatchEvent(new WheelEvent('wheel', {
      clientX: e.clientX, clientY: e.clientY,
      deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode,
      bubbles: true
    }));
  }, { passive: false });

  // Reset view
  document.getElementById('reset').addEventListener('click', () => {
    camX = 0;
    camY = -40;
    camScale = 1;
    renderTree();
  });

  // Resize
  window.addEventListener('resize', () => {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
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

      // Раскладка
      flatNodes = layoutTree(treeData);

      hideLoading();
      renderTree();
    } catch (err) {
      console.error('Failed to load tree:', err);
      showError(err.message || 'Network error');
    }
  }

  retryBtn.addEventListener('click', loadTree);

  // Запуск
  loadTree();

})();
