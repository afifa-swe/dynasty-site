(function () {
  'use strict';

  const API_BASE = 'http://127.0.0.1:4000';

  const panel = document.getElementById('leaderboard-panel');
  const listEl = document.getElementById('leaderboard-list');
  const toggleBtn = document.getElementById('toggle-leaderboard');
  const closeBtn = document.getElementById('leaderboard-close');
  const filterBtns = document.querySelectorAll('.lb-filter');

  let players = [];
  let currentFilter = 'all';
  let isOpen = false;

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

  function getRankClass(rank) {
    if (rank === 1) return 'gold';
    if (rank === 2) return 'silver';
    if (rank === 3) return 'bronze';
    return '';
  }

  function getRowClass(rank) {
    if (rank <= 3) return `top-${rank}`;
    return '';
  }

  function getRankDisplay(rank) {
    const medals = { 1: '\u{1F451}', 2: '\u{1F948}', 3: '\u{1F949}' };
    return medals[rank] || `#${rank}`;
  }

  function renderList() {
    const filtered = currentFilter === 'all'
      ? players
      : players.filter(p => p.faction === currentFilter);

    if (filtered.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;color:#666;padding:40px 0;font-size:14px">No players found</div>';
      return;
    }

    listEl.innerHTML = filtered.map((p, i) => {
      // Rank based on overall position, not filtered position
      const rank = p.rank || (i + 1);
      const rankClass = getRankClass(rank);
      const rowClass = getRowClass(rank);

      const avatarHtml = p.avatar
        ? `<img class="lb-avatar" src="${p.avatar}" alt="${p.nickname}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          + `<div class="lb-avatar-initials" style="display:none">${getInitials(p.nickname)}</div>`
        : `<div class="lb-avatar-initials">${getInitials(p.nickname)}</div>`;

      return `
        <div class="lb-row ${rowClass}" data-id="${p.id}">
          <div class="lb-rank ${rankClass}">${getRankDisplay(rank)}</div>
          ${avatarHtml}
          <div class="lb-info">
            <div class="lb-name">${p.nickname}</div>
            <div class="lb-meta">
              <span class="lb-tier ${p.tier}">${tierLabel(p.tier)}</span>
              <span class="lb-faction ${p.faction}">${factionLabel(p.faction)}</span>
            </div>
          </div>
          <div class="lb-rating">
            <div class="lb-rating-value">${formatNumber(p.rating)}</div>
            <div class="lb-rating-label">points</div>
          </div>
        </div>
      `;
    }).join('');
  }

  async function loadLeaderboard() {
    try {
      const res = await fetch(`${API_BASE}/api/rating`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      players = data.leaderboard || [];
      renderList();
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
      listEl.innerHTML = '<div style="text-align:center;color:#e74c3c;padding:40px 0;font-size:14px">Failed to load leaderboard</div>';
    }
  }

  function toggle() {
    isOpen = !isOpen;
    if (isOpen) {
      panel.classList.remove('hidden');
      loadLeaderboard();
    } else {
      panel.classList.add('hidden');
    }
  }

  toggleBtn.addEventListener('click', toggle);
  closeBtn.addEventListener('click', () => {
    isOpen = false;
    panel.classList.add('hidden');
  });

  // Faction filter buttons
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderList();
    });
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      isOpen = false;
      panel.classList.add('hidden');
    }
  });

})();
