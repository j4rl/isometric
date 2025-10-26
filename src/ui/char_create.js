import { Player } from '../engine/entity.js';

export function initCharacterCreate(game, getCurrentMapDesc) {
  const modal = document.getElementById('char-create');
  const startBtn = document.getElementById('start-game');
  const leftEl = document.getElementById('points-left');
  const vs = {
    str: document.getElementById('val-str'),
    agi: document.getElementById('val-agi'),
    per: document.getElementById('val-per'),
  };
  const wepListEl = document.getElementById('wep-list');
  // Prefill a valid 10‑point distribution so Start works immediately
  let stats = { str: 4, agi: 3, per: 3 };
  const MAX = 10;
  const POOL = 10;
  // Build combined catalog
  const meleeList = game.weapons.config.meleeTypes || [];
  const rangedList = game.weapons.config.rangedList || [];
  const catalog = [
    ...meleeList.map((w, i) => ({ type: 'melee', index: i, name: w.name, req: w.req })),
    ...rangedList.map((w, i) => ({ type: 'ranged', index: i, name: w.name, req: w.req }))
  ];
  let selected = []; // array of picks {type,index}

  function refresh() {
    vs.str.textContent = stats.str;
    vs.agi.textContent = stats.agi;
    vs.per.textContent = stats.per;
    const used = stats.str + stats.agi + stats.per;
    const left = Math.max(0, POOL - used);
    leftEl.textContent = left;
    // Require using all points, and stay within bounds
    startBtn.disabled = used !== POOL || stats.str > MAX || stats.agi > MAX || stats.per > MAX;
    // Render weapon list
    if (wepListEl) {
      wepListEl.innerHTML = '';
      catalog.forEach((item, idx) => {
        const allowed = meetsReq(stats, item.req);
        const div = document.createElement('div');
        div.className = 'wep-item' + (allowed ? '' : ' locked');
        if (selected.find(s => s.type===item.type && s.index===item.index)) div.classList.add('selected');
        const badge = document.createElement('span');
        badge.className = 'badge ' + item.type;
        badge.textContent = item.type === 'melee' ? 'Melee' : 'Ranged';
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = item.name;
        const req = document.createElement('span');
        req.className = 'req';
        req.textContent = `STR ${item.req?.str||1} · AGI ${item.req?.agi||1} · PER ${item.req?.per||1}`;
        div.appendChild(badge);
        div.appendChild(name);
        div.appendChild(req);
        if (allowed) {
          div.addEventListener('click', () => {
            const i = selected.findIndex(s => s.type===item.type && s.index===item.index);
            if (i >= 0) {
              selected.splice(i,1);
            } else {
              if (selected.length >= 2) return;
              selected.push({ type: item.type, index: item.index });
            }
            refresh();
          });
        }
        wepListEl.appendChild(div);
      });
    }
    // Enable start only if 2 weapons chosen
    startBtn.disabled = startBtn.disabled || selected.length !== 2;
  }

  function change(key, delta) {
    const val = stats[key] + delta;
    if (val < 0 || val > MAX) return;
    const used = stats.str + stats.agi + stats.per;
    if (delta > 0 && used >= POOL) return;
    stats[key] = val;
    refresh();
  }

  modal.addEventListener('click', (e) => {
    const inc = e.target.getAttribute('data-inc');
    const dec = e.target.getAttribute('data-dec');
    if (inc) change(inc, +1);
    if (dec) change(dec, -1);
  });

  // No prev/next; list click handles selection

  startBtn.addEventListener('click', () => {
    const desc = getCurrentMapDesc();
    // compute spawn
    const spawn = findSpawn(desc);
    const hp = 60 + 8 * stats.str + 5 * stats.agi + 3 * stats.per;
    const player = new Player({ x: spawn.x, y: spawn.y, hp, stats });
    game.player = player;
    game.entities.push(player);
    // Apply chosen weapons
    // Apply two selected weapons in order
    const a = selected[0];
    const b = selected[1];
    if (!a || !b) return;
    game.weapons.setSlot(0, a.type, a.index);
    game.weapons.setSlot(1, b.type, b.index);
    game.weapons.setActiveSlot(0);
    modal.style.display = 'none';
  });

  // Allow Enter to start if allocation is valid
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' && !startBtn.disabled) startBtn.click();
  });

  function findSpawn(desc) {
    if (!desc || !desc.grid || !desc.legend) return { x: 1, y: 1 };
    const h = desc.grid.length; const w = h ? desc.grid[0].length : 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sym = desc.grid[y][x];
        const L = desc.legend[sym];
        if (L && L.spawn) return { x, y };
      }
    }
    const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    const inBounds = (x,y)=>x>=0&&y>=0&&x<w&&y<h;
    const pass = (x,y)=>{ const sym = desc.grid[y][x]; const L = desc.legend[sym]; return !!(L && L.passable); };
    let radius = 0;
    while (radius < Math.max(w, h)) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const x = cx + dx, y = cy + dy;
          if (inBounds(x,y) && pass(x,y)) return { x, y };
        }
      }
      radius++;
    }
    return { x: 1, y: 1 };
  }

  refresh();

  function meetsReq(s, req) {
    if (!req) return true;
    const st = s || { str: 1, agi: 1, per: 1 };
    return (st.str >= (req.str || 1)) && (st.agi >= (req.agi || 1)) && (st.per >= (req.per || 1));
  }

  function pickFirstAllowed(list, preferredIndex, s, isMelee) {
    if (!list || !list.length) return 0;
    if (meetsReq(s, list[preferredIndex]?.req)) return preferredIndex;
    for (let i = 0; i < list.length; i++) {
      if (meetsReq(s, list[i]?.req)) return i;
    }
    return 0;
  }
}
