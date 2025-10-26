import { isoToScreen, screenToIso, drawIsoImage, drawIsoTile } from './iso.js';
import { Player, Enemy } from './entity.js';
import { Weapons } from './weapons.js';
import { Pathfinder } from './pathfinding.js';
import { HUD } from '../ui/hud.js';
import { PortalBurst } from './effects.js';
import { playPortalSound } from './sfx.js';

export class Game {
  constructor({ canvas, ctx, tileW, tileH, assets }) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.tileW = tileW;
    this.tileH = tileH;
    this.assets = assets;
    this.map = [];
    this.entities = [];
    this.projectiles = [];
    this.effects = [];
    this.player = null;
    this.weapons = new Weapons(this);
    this.originX = canvas.width / 2; // center map horizontally
    this.originY = 64; // vertical offset
    this._bounds = null; // projected map bounds for camera clamping
    this.zoom = 2; // camera zoom (applied via canvas scale)
    this.fitMode = 'manual'; // 'manual' fixed zoom; 'cover'/'contain' auto-fit
    this.cameraFollow = { enabled: true, lerp: 8 };
    this.dpr = 1; // device pixel ratio
    this.currentWeapon = 'melee';
    this.debug = false;
    this.time = 0;
    this.dt = 0;
    this.autopilot = null; // { path: [{x,y}, ...] }
    this.drag = { active: false, lastX: 0, lastY: 0 };
    this.explored = null; // fog-of-war explored mask [y][x] = boolean
    this._setupInput();
    this.last = performance.now();
    this.hud = new HUD(this);
  }

  _setupInput() {
    this.input = {
      keys: {},
      mouse: { x: 0, y: 0 },
      mouseWorld: { x: 0, y: 0 },
      mouseDownL: false
    };
    window.addEventListener('keydown', (e) => {
      this.input.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.code === 'KeyG') this.debug = !this.debug;
      if (e.code === 'Digit1') this.weapons.setActiveSlot(0);
      if (e.code === 'Digit2') this.weapons.setActiveSlot(1);
      if (e.code === 'KeyQ') this.weapons.toggleActiveSlot();
      if (e.code === 'KeyR') this.weapons.reloadActive();
      if (e.code === 'KeyZ') this.weapons.cycleActive(+1);
      if (e.code === 'KeyX') this.weapons.toggleActiveType();
    });
    window.addEventListener('keyup', (e) => {
      this.input.keys[e.code] = false;
    });
    const rect = () => this.canvas.getBoundingClientRect();
    const updateMouse = (e) => {
      const r = rect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      this.input.mouse.x = x;
      this.input.mouse.y = y;
      const w = this.screenToWorld(x, y);
      this.input.mouseWorld = w;
    };
    this.canvas.addEventListener('mousemove', (e) => {
      updateMouse(e);
      if (this.drag.active) {
        const dx = e.movementX || (e.clientX - this.drag.lastX);
        const dy = e.movementY || (e.clientY - this.drag.lastY);
        this.originX += dx;
        this.originY += dy;
        this.drag.lastX = e.clientX;
        this.drag.lastY = e.clientY;
        e.preventDefault();
        this._clampOrigin();
      }
    });
    this.canvas.addEventListener('mouseenter', updateMouse);
    this.canvas.addEventListener('mouseleave', updateMouse);
    this.canvas.addEventListener('mousedown', (e) => {
      // Left-click: attack in mouse direction (use target if present)
      if (e.button === 0 && this.player) {
        this.input.mouseDownL = true;
        // use active slot
        const w = this.input.mouseWorld;
        if (w) {
          const dx = w.x - this.player.x;
          const dy = w.y - this.player.y;
          this.player.facing = Math.atan2(dy, dx);
        }
        const target = this.hoverTarget || null;
        this.weapons.useActive(this.player, target);
      }
      // Middle: drag-pan
      if (e.button === 1) {
        this.drag.active = true;
        this.drag.lastX = e.clientX;
        this.drag.lastY = e.clientY;
        e.preventDefault();
      }
      // Right: set move marker and pathfind move
      if (e.button === 2 && this.player) {
        const w = this.input.mouseWorld;
        const tx = Math.round(w.x);
        const ty = Math.round(w.y);
        this.moveMarker = { x: tx, y: ty, time: this.time };
        if (!this.pathfinder) return;
        const path = this.pathfinder.findPath({ x: Math.round(this.player.x), y: Math.round(this.player.y) }, { x: tx, y: ty });
        if (path && path.length) {
          const smooth = this._smoothPath(path);
          this.autopilot = { path: smooth.map(p => ({ x: p.x, y: p.y })) };
        }
      }
    });
    window.addEventListener('mouseup', (e) => {
      this.drag.active = false;
      if (e.button === 0) this.input.mouseDownL = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  worldToScreen(wx, wy) {
    const p = isoToScreen(wx, wy, 0, this.tileW, this.tileH, this.originX, this.originY);
    // return the diamond center (top point) for convenience
    return { x: p.x, y: p.y + this.tileH };
  }

  screenToWorld(sx, sy) {
    // Convert from screen pixel to isometric world tile coords (approximate)
    const p = screenToIso(sx / this.zoom, sy / this.zoom - this.tileH, this.tileW, this.tileH, this.originX, this.originY);
    return p; // fractional tile coords
  }

  setMap(map) {
    // Accept either a grid of tile keys (strings) or a descriptor { grid: symbols, legend }
    this.legend = null;
    this.symbolGrid = null;
    this.tileTextureGrid = null;
    if (Array.isArray(map)) {
      this.map = map; // tile key grid
    } else if (map && Array.isArray(map.grid) && map.legend) {
      this.legend = map.legend;
      this.symbolGrid = map.grid;
      // Convert symbols to tile keys for rendering
      this.map = this.symbolGrid.map(row => row.map(sym => (this.legend[sym]?.key || 'grass')));
      // Build a parallel texture grid if legend provides textureKey
      this.tileTextureGrid = this.symbolGrid.map(row => row.map(sym => {
        const L = this.legend[sym];
        if (L && L.textureKey) return L.textureKey;
        if (L && L.key) return `tiles/${L.key}`;
        return 'tiles/grass';
      }));
      // Optional: height grid for projectile blocking ('high' blocks projectiles)
      this.tileHeightGrid = this.symbolGrid.map(row => row.map(sym => (this.legend[sym]?.height || 'normal')));
    } else {
      this.map = [];
    }
    const h = this.map.length;
    const w = h ? this.map[0].length : 0;
    this.pathfinder = new Pathfinder({ width: w, height: h, isBlocked: (x, y) => this.isBlocked(x, y) });
    this._computeBounds();
    this._applyFit();
    this._clampOrigin(true);
    // Reset explored mask
    this.explored = new Array(h).fill(0).map(() => new Array(w).fill(false));
  }

  spawnDemo() {
    this.player = new Player({ x: 3, y: 3 });
    this.entities.push(this.player);
    // spawn a few enemies
    this.entities.push(new Enemy({ x: 8, y: 4 }));
    this.entities.push(new Enemy({ x: 6, y: 9 }));
    this.entities.push(new Enemy({ x: 10, y: 8 }));
  }

  start() {
    const step = (t) => {
      const dt = Math.min(0.033, (t - this.last) / 1000);
      this.last = t;
      this.time += dt;
      this.dt = dt;
      this.update(dt);
      this.draw();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  update(dt) {
    // Camera pan with arrow keys
    const panSpeed = 600; // pixels per second
    if (this.input.keys['ArrowLeft']) this.originX += panSpeed * dt;
    if (this.input.keys['ArrowRight']) this.originX -= panSpeed * dt;
    if (this.input.keys['ArrowUp']) this.originY += panSpeed * dt;
    if (this.input.keys['ArrowDown']) this.originY -= panSpeed * dt;
    this._clampOrigin();

    for (const e of this.entities) e.update(dt, this);
    for (const p of this.projectiles) p.update(dt, this);
    for (const fx of this.effects) fx.update(dt, this);
    // cleanup dead
    this.entities = this.entities.filter(e => !e.dead);
    this.projectiles = this.projectiles.filter(p => !p.dead);
    this.effects = this.effects.filter(fx => !fx.dead);
    this._updateCamera(dt);

    // Portal handling: if player stands on a portal tile, request next map
    if (this.player && this.legend && this.symbolGrid) {
      const x = Math.round(this.player.x);
      const y = Math.round(this.player.y);
      if (y >= 0 && x >= 0 && y < this.symbolGrid.length && x < this.symbolGrid[0].length) {
        const sym = this.symbolGrid[y][x];
        const L = this.legend[sym];
        if (L && (L.portal || L.key === 'portal')) {
          if (!this._portalCooldown || (this.time - this._portalCooldown) > 1.0) {
            // visual + audio
            this.effects.push(new PortalBurst(this.player.x, this.player.y));
            try { playPortalSound(); } catch {}
            window.dispatchEvent(new CustomEvent('game:portal', { detail: {} }));
            this._portalCooldown = this.time;
          }
        }
      }
    }

    // Hover target detection near mouse
    this._updateHoverTarget();

    // Hold-to-fire when left mouse is held down
    if (this.player && this.input.mouseDownL) {
      const w = this.input.mouseWorld;
      if (w) {
        const dx = w.x - this.player.x;
        const dy = w.y - this.player.y;
        this.player.facing = Math.atan2(dy, dx);
      }
      const target = this.hoverTarget || null;
      this.weapons.useActive(this.player, target);
    }

    // Update explored mask around player
    this._updateExplored();
  }

  draw() {
    const { ctx, canvas } = this;
    // Reset transform and clear in device pixels
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0e1013';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply DPR scale, then zoom
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.save();
    ctx.scale(this.zoom, this.zoom);
    // draw map tiles by y+x order to ensure correct stacking
    const h = this.map.length;
    const w = h ? this.map[0].length : 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Skip void (non-rectangular maps from bitmap: symbol may be space)
        const sym = this.symbolGrid ? this.symbolGrid[y][x] : null;
        if (sym === ' ' || sym === null) continue;
        let img = null;
        if (this.legend && this.symbolGrid && this.tileTextureGrid) {
          const texKey = this.tileTextureGrid[y][x];
          img = this.assets.get(texKey);
        } else {
          const key = `tiles/${this.map[y][x]}`;
          img = this.assets.get(key);
        }
        if (img) {
          drawIsoImage(ctx, img, x, y, 0, this.tileW, this.tileH, this.originX, this.originY);
        } else {
          drawIsoTile(ctx, x, y, 0, this.tileW, this.tileH, (x + y) % 2 ? '#1b232c' : '#15202b', this.originX, this.originY);
        }
        // overlay blocked marker for debug
        if (this.debug && this.isBlocked(x, y)) {
          const p = this.worldToScreen(x, y);
          ctx.fillStyle = 'rgba(255,80,80,0.35)';
          ctx.beginPath();
          ctx.arc(p.x, p.y + 6, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // sort all drawable objects by depth (x+y then y then x)
    const drawables = [
      ...this.entities,
      ...this.projectiles,
      ...this.effects
    ];
    drawables.sort((a, b) => (a.y + a.x) - (b.y + b.x));
    for (const d of drawables) d.draw(ctx, this);
    // Move marker overlay (draw in world space so it aligns with tiles)
    if (this.moveMarker) {
      const p = this.worldToScreen(this.moveMarker.x, this.moveMarker.y);
      const py = p.y - this.tileH / 2; // shift marker half a tile up
      ctx.save();
      ctx.strokeStyle = '#6cf';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(p.x, py, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x - 8, py);
      ctx.lineTo(p.x + 8, py);
      ctx.moveTo(p.x, py - 8);
      ctx.lineTo(p.x, py + 8);
      ctx.stroke();
      ctx.restore();
      // clear old marker after a while
      if (this.time - (this.moveMarker.time || 0) > 3) this.moveMarker = null;
    }
    ctx.restore();
    // HUD & overlays (DOM-based)
    this.hud.update();
    this.hud.renderMiniMap();
    if (this.debug) this._drawDebug();
  }

  _drawDebug() {
    const { ctx } = this;
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.globalAlpha = 0.85;
    const mw = this.input.mouseWorld;
    ctx.fillText(`t=${this.time.toFixed(2)} mw=(${mw.x.toFixed(2)}, ${mw.y.toFixed(2)}) entities=${this.entities.length} proj=${this.projectiles.length}`, 10, 16);
    if (this.autopilot && this.autopilot.path) {
      const pts = this.autopilot.path;
      if (pts.length) {
        ctx.strokeStyle = '#6cf';
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const p = this.worldToScreen(pts[i].x, pts[i].y);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }


  _smoothPath(path) {
    // String-pull smoothing: remove intermediate points if LOS is clear
    if (!path || path.length <= 2) return path || [];
    const result = [path[0]];
    let i = 0;
    while (i < path.length - 1) {
      let j = path.length - 1;
      // find farthest j such that i -> j has line-of-sight
      for (; j > i + 1; j--) {
        if (this._hasLineOfSight(path[i], path[j])) break;
      }
      result.push(path[j]);
      i = j;
    }
    return result;
  }

  _hasLineOfSight(a, b) {
    // Sample along the line at a few points to ensure no blocked tiles in between
    const ax = a.x + 0.0001, ay = a.y + 0.0001;
    const bx = b.x + 0.0001, by = b.y + 0.0001;
    const dx = bx - ax, dy = by - ay;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(2, Math.ceil(dist * 6));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = ax + dx * t;
      const y = ay + dy * t;
      if (this.isBlockedAt(x, y)) return false;
    }
    return true;
  }

  _computeBounds() {
    const h = this.map.length;
    const w = h ? this.map[0].length : 0;
    if (!w || !h) { this._bounds = null; return; }
    const corners = [ {x:0,y:0}, {x:w-1,y:0}, {x:0,y:h-1}, {x:w-1,y:h-1} ];
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const c of corners) {
      const p = isoToScreen(c.x, c.y, 0, this.tileW, this.tileH, 0, 0);
      left = Math.min(left, p.x - this.tileW / 2);
      right = Math.max(right, p.x + this.tileW / 2);
      top = Math.min(top, p.y);
      bottom = Math.max(bottom, p.y + this.tileH);
    }
    this._bounds = { left, right, top, bottom, width: right - left, height: bottom - top };
  }

  _clampOrigin(forceCenter = false) {
    if (!this._bounds) return;
    const B = this._bounds;
    const cw = this.canvas.width / (this.dpr || 1), ch = this.canvas.height / (this.dpr || 1);
    const z = this.zoom || 1;
    let minOX = (cw / z) - B.right; // originX >= minOX
    let maxOX = -B.left;            // originX <= maxOX
    let minOY = (ch / z) - B.bottom;
    let maxOY = -B.top;
    if (minOX > maxOX || forceCenter) {
      const centerOX = (cw / z - B.width) / 2 - B.left;
      this.originX = centerOX;
    } else {
      this.originX = Math.max(minOX, Math.min(maxOX, this.originX));
    }
    if (minOY > maxOY || forceCenter) {
      const centerOY = (ch / z - B.height) / 2 - B.top;
      this.originY = centerOY;
    } else {
      this.originY = Math.max(minOY, Math.min(maxOY, this.originY));
    }
  }

  _applyFit() {
    if (this.fitMode === 'manual') return;
    if (!this._bounds) return;
    const B = this._bounds;
    const cw = this.canvas.width / (this.dpr || 1), ch = this.canvas.height / (this.dpr || 1);
    const zw = cw / B.width;
    const zh = ch / B.height;
    this.zoom = (this.fitMode === 'contain') ? Math.min(zw, zh) : Math.max(zw, zh);
    // Center after setting zoom
    const z = this.zoom || 1;
    const centerX = (B.left + B.right) / 2;
    const centerY = (B.top + B.bottom) / 2;
    this.originX = cw / (2 * z) - centerX;
    this.originY = ch / (2 * z) - centerY;
  }

  _updateCamera(dt) {
    if (!this.player || !this.cameraFollow?.enabled) return;
    const dpr = this.dpr || 1;
    const cw = this.canvas.width / dpr;
    const ch = this.canvas.height / dpr;
    const z = this.zoom || 1;
    const cx = (cw / z) * 0.5;
    const cy = (ch / z) * 0.5;
    const ws = this.worldToScreen(this.player.x, this.player.y);
    const dx = cx - ws.x;
    const dy = cy - ws.y;
    const t = Math.min(1, (this.cameraFollow.lerp || 8) * dt);
    this.originX += dx * t;
    this.originY += dy * t;
    this._clampOrigin();
  }

  _updateHoverTarget() {
    const mw = this.input.mouseWorld;
    if (!mw) { this.hoverTarget = null; return; }
    // Limit by player's perception (view radius in tiles)
    const per = this.player?.stats?.per ?? 3;
    const view = 4 + (per - 3) * 1.2; // tiles
    let best = null; let bestD = Infinity;
    for (const e of this.entities) {
      if (e.team !== 'enemy' || e.dead) continue;
      const dx = e.x - mw.x;
      const dy = e.y - mw.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.7 && d < bestD) {
        // Also require within player's view
        const pdx = e.x - this.player.x; const pdy = e.y - this.player.y;
        if (Math.hypot(pdx, pdy) <= view) { best = e; bestD = d; }
      }
    }
    this.hoverTarget = best;
  }

  _updateExplored() {
    if (!this.player || !this.explored || !this.map?.length) return;
    const h = this.map.length; const w = this.map[0].length;
    const cx = Math.round(this.player.x);
    const cy = Math.round(this.player.y);
    const per = this.player?.stats?.per ?? 3;
    const radius = Math.max(1, Math.floor(5 + (per - 3) * 1.4));
    const r2 = radius * radius;
    const y0 = Math.max(0, cy - radius), y1 = Math.min(h - 1, cy + radius);
    const x0 = Math.max(0, cx - radius), x1 = Math.min(w - 1, cx + radius);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - this.player.x; const dy = y - this.player.y;
        if (dx*dx + dy*dy <= r2) this.explored[y][x] = true;
      }
    }
  }

  handleResize(dpr = 1) {
    this.dpr = dpr;
    this._applyFit();
    this._clampOrigin(true);
  }

  isBlocked(x, y) {
    // integer tile coords
    if (y < 0 || x < 0 || y >= this.map.length || x >= this.map[0].length) return true;
    if (this.legend && this.symbolGrid) {
      const sym = this.symbolGrid[y][x];
      if (sym === ' ' || sym == null) return true; // void outside shape
      const sym = this.symbolGrid[y][x];
      const L = this.legend[sym];
      return !(L && L.passable);
    }
    const t = this.map[y][x];
    return t === 'rock' || t === 'wall' || t === 'water';
  }

  isBlockedAt(wx, wy) {
    // Check tile of fractional coords
    const x = Math.round(wx);
    const y = Math.round(wy);
    return this.isBlocked(x, y);
  }

  tileHeight(x, y) {
    if (!this.symbolGrid || !this.legend) return 'normal';
    if (y < 0 || x < 0 || y >= this.symbolGrid.length || x >= this.symbolGrid[0].length) return 'normal';
    const sym = this.symbolGrid[y][x];
    return this.legend[sym]?.height || 'normal';
  }

  blocksProjectileAt(wx, wy) {
    const x = Math.round(wx);
    const y = Math.round(wy);
    return this.tileHeight(x, y) === 'high';
  }
}
