import { isoToScreen, screenToIso, drawIsoImage, drawIsoTile } from './iso.js';
import { Player, Enemy } from './entity.js';
import { Weapons } from './weapons.js';
import { Pathfinder } from './pathfinding.js';

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
    this.debug = false;
    this.time = 0;
    this.dt = 0;
    this.autopilot = null; // { path: [{x,y}, ...] }
    this._setupInput();
    this.last = performance.now();
  }

  _setupInput() {
    this.input = {
      keys: {},
      mouse: { x: 0, y: 0 },
      mouseWorld: { x: 0, y: 0 }
    };
    window.addEventListener('keydown', (e) => {
      this.input.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.code === 'KeyG') this.debug = !this.debug;
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
    this.canvas.addEventListener('mousemove', updateMouse);
    this.canvas.addEventListener('mouseenter', updateMouse);
    this.canvas.addEventListener('mouseleave', updateMouse);
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || !this.player) return;
      const w = this.input.mouseWorld;
      const tx = Math.round(w.x);
      const ty = Math.round(w.y);
      if (!this.pathfinder) return;
      const path = this.pathfinder.findPath({ x: Math.round(this.player.x), y: Math.round(this.player.y) }, { x: tx, y: ty });
      if (path && path.length) {
        // Convert tile centers to fractional waypoints (tile center is integer)
        this.autopilot = { path: path.map(p => ({ x: p.x, y: p.y })) };
      }
    });
  }

  worldToScreen(wx, wy) {
    const p = isoToScreen(wx, wy, 0, this.tileW, this.tileH, this.originX, this.originY);
    // return the diamond center (top point) for convenience
    return { x: p.x, y: p.y + this.tileH };
  }

  screenToWorld(sx, sy) {
    // Convert from screen pixel to isometric world tile coords (approximate)
    const p = screenToIso(sx, sy - this.tileH, this.tileW, this.tileH, this.originX, this.originY);
    return p; // fractional tile coords
  }

  setMap(map) {
    this.map = map;
    const h = this.map.length;
    const w = h ? this.map[0].length : 0;
    this.pathfinder = new Pathfinder({ width: w, height: h, isBlocked: (x, y) => this.isBlocked(x, y) });
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
    for (const e of this.entities) e.update(dt, this);
    for (const p of this.projectiles) p.update(dt, this);
    for (const fx of this.effects) fx.update(dt, this);
    // cleanup dead
    this.entities = this.entities.filter(e => !e.dead);
    this.projectiles = this.projectiles.filter(p => !p.dead);
    this.effects = this.effects.filter(fx => !fx.dead);
  }

  draw() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0e1013';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // draw map tiles by y+x order to ensure correct stacking
    const h = this.map.length;
    const w = h ? this.map[0].length : 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const key = `tiles/${this.map[y][x]}`;
        const img = this.assets.get(key);
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

    if (this.debug) this._drawDebug();
  }

  _drawDebug() {
    const { ctx } = this;
    ctx.save();
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

  isBlocked(x, y) {
    // integer tile coords
    if (y < 0 || x < 0 || y >= this.map.length || x >= this.map[0].length) return true;
    const t = this.map[y][x];
    return t === 'rock' || t === 'wall' || t === 'water';
  }

  isBlockedAt(wx, wy) {
    // Check tile of fractional coords
    const x = Math.round(wx);
    const y = Math.round(wy);
    return this.isBlocked(x, y);
  }
}
