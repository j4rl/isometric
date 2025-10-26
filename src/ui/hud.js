export class HUD {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('hud');
    this.hpFill = document.getElementById('hp-fill');
    this.hpText = document.getElementById('hp-text');
    this.weaponText = document.getElementById('weapon-text');
    this.statsText = document.getElementById('stats-text');
    this.mm = document.getElementById('minimap');
    this.mmCtx = this.mm?.getContext('2d');
    this.targetBox = document.getElementById('target-box');
    this.targetText = document.getElementById('target-text');
    this.slot0Ind = document.getElementById('slot0-ind');
    this.slot1Ind = document.getElementById('slot1-ind');
  }

  update() {
    const g = this.game;
    const p = g.player;
    if (p && this.hpFill && this.hpText) {
      const ratio = Math.max(0, Math.min(1, p.hp / p.maxHp));
      this.hpFill.style.width = `${Math.floor(ratio * 100)}%`;
      this.hpFill.style.background = (ratio > 0.5 ? '#4caf50' : (ratio > 0.25 ? '#ffb300' : '#e53935'));
      this.hpText.textContent = `HP ${Math.ceil(p.hp)}/${p.maxHp}`;
    }
    if (this.weaponText) {
      const info = g.weapons.getInfoActive(p);
      const ammo = info.ammo ? ` · Ammo ${info.ammo}` : '';
      const lock = info.locked && info.req ? ` · LOCKED (STR ${info.req.str||1} · AGI ${info.req.agi||1} · PER ${info.req.per||1})` : '';
      this.weaponText.textContent = `Weapon: ${info.name} · DMG ~${info.damage} · DPS ~${info.dps}${ammo}${lock} (Q toggle, 1/2 slots, R reload)`;
    }
    // Slot indicators
    const s0 = g.weapons.state.slots[0];
    const s1 = g.weapons.state.slots[1];
    const active = g.weapons.state.activeSlot;
    if (this.slot0Ind) {
      this.slot0Ind.className = `slot-ind ${active===0?'active':''} ${s0.type}`;
    }
    if (this.slot1Ind) {
      this.slot1Ind.className = `slot-ind ${active===1?'active':''} ${s1.type}`;
    }
    if (this.statsText && p?.stats) {
      const { str, agi, per } = p.stats;
      this.statsText.textContent = `STR ${str} · AGI ${agi} · PER ${per}`;
    }

    // Target info
    const t = g.hoverTarget;
    if (this.targetBox && this.targetText) {
      if (t) {
        const name = t.name || `Enemy ${t.typeIndex ?? ''}`;
        const hp = `${Math.ceil(t.hp)}/${Math.ceil(t.maxHp)}`;
        const stats = t.stats ? ` · STR ${t.stats.str} AGI ${t.stats.agi} PER ${t.stats.per}` : '';
        this.targetText.textContent = `${name} · HP ${hp}${stats}`;
        this.targetBox.style.display = 'block';
      } else {
        this.targetBox.style.display = 'none';
      }
    }
  }

  _miniColorForKey(k) {
    switch (k) {
      case 'grass': return '#335a36';
      case 'stone': return '#59606b';
      case 'rock': return '#7a5436';
      case 'water': return '#205b81';
      case 'bridge': return '#a27b43';
      case 'bush': return '#2b6a3a';
      case 'tree': return '#2f7d42';
      case 'tallGrass': return '#3e9e5a';
      case 'house': return '#7e8591';
      case 'hut': return '#8a603e';
      case 'dirt': return '#6a4f2b';
      default: return '#2a2f36';
    }
  }

  renderMiniMap() {
    if (!this.mm || !this.mmCtx) return;
    const g = this.game;
    const h = g.map.length; if (!h) return;
    const w = g.map[0].length;

    // Ensure hi-DPI crispness
    const dpr = window.devicePixelRatio || 1;
    const rect = this.mm.getBoundingClientRect();
    const cssW = Math.max(1, Math.floor(rect.width));
    const cssH = Math.max(1, Math.floor(rect.height));
    const pxW = Math.max(1, Math.floor(cssW * dpr));
    const pxH = Math.max(1, Math.floor(cssH * dpr));
    if (this.mm.width !== pxW) this.mm.width = pxW;
    if (this.mm.height !== pxH) this.mm.height = pxH;
    const ctx = this.mmCtx;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0, 0, pxW, pxH);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, pxW, pxH);
    ctx.setTransform(dpr,0,0,dpr,0,0);

    // Fit entire map into minimap area
    const sx = cssW / w, sy = cssH / h; const s = Math.min(sx, sy);
    const offX = (cssW - w * s) / 2;
    const offY = (cssH - h * s) / 2;

    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) {
        const key = g.legend && g.symbolGrid ? (g.legend[g.symbolGrid[ty][tx]]?.key || g.map[ty][tx]) : g.map[ty][tx];
        ctx.fillStyle = this._miniColorForKey(key);
        ctx.fillRect(Math.floor(offX + tx * s), Math.floor(offY + ty * s), Math.ceil(s), Math.ceil(s));
      }
    }

    // Unexplored mask: blacken tiles not explored yet
    if (g.explored) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      for (let ty = 0; ty < h; ty++) {
        for (let tx = 0; tx < w; tx++) {
          if (!g.explored[ty]?.[tx]) {
            ctx.fillRect(Math.floor(offX + tx * s), Math.floor(offY + ty * s), Math.ceil(s), Math.ceil(s));
          }
        }
      }
    }

    // Overlay portals and arrival markers
    if (g.legend && g.symbolGrid) {
      for (let ty = 0; ty < h; ty++) {
        for (let tx = 0; tx < w; tx++) {
          const sym = g.symbolGrid[ty][tx];
          const L = g.legend[sym];
          if (!L) continue;
          const px = offX + tx * s;
          const py = offY + ty * s;
          if (L.portal) {
            ctx.fillStyle = '#9c7bff';
            ctx.fillRect(Math.floor(px + s*0.25), Math.floor(py + s*0.25), Math.ceil(s*0.5), Math.ceil(s*0.5));
          } else if (L.spawn) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(Math.floor(px + s*0.2), Math.floor(py + s*0.2), Math.ceil(s*0.6), Math.ceil(s*0.6));
          }
        }
      }
    }

    // Fog of war: dim outside player's perception radius (current visibility only)
    if (g.player) {
      const per = g.player?.stats?.per ?? 3;
      const radiusTiles = 5 + (per - 3) * 1.4; // perception-based
      const px = offX + g.player.x * s;
      const py = offY + g.player.y * s;
      const r0 = Math.max(8, radiusTiles * s);
      const r1 = r0 * 1.6;
      const grad = ctx.createRadialGradient(px, py, r0, px, py, r1);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cssW, cssH);
    }

    // Viewport rectangle
    const vw = g.canvas.width / (g.dpr || 1);
    const vh = g.canvas.height / (g.dpr || 1);
    const tl = g.screenToWorld(0, 0);
    const tr = g.screenToWorld(vw, 0);
    const br = g.screenToWorld(vw, vh);
    const bl = g.screenToWorld(0, vh);
    const minX = Math.min(tl.x, tr.x, br.x, bl.x);
    const maxX = Math.max(tl.x, tr.x, br.x, bl.x);
    const minY = Math.min(tl.y, tr.y, br.y, bl.y);
    const maxY = Math.max(tl.y, tr.y, br.y, bl.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(offX + minX * s, offY + minY * s, (maxX - minX) * s, (maxY - minY) * s);

    // Player & enemies
    const dot = (wx, wy, color) => {
      ctx.fillStyle = color;
      const px = offX + wx * s;
      const py = offY + wy * s;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(2, s * 0.25), 0, Math.PI * 2);
      ctx.fill();
    };
    if (g.player) dot(g.player.x, g.player.y, '#6cf');
    for (const e of g.entities) {
      if (e === g.player) continue;
      if (e.team === 'enemy') dot(e.x, e.y, '#ff6767');
    }
  }
}
