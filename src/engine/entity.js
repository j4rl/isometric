import { drawIsoImage, drawIsoTile, drawIsoSubImage } from './iso.js';

export class Entity {
  constructor({ x = 0, y = 0, z = 0, key = 'entities/player', radius = 0.4, speed = 3, hp = 100, stats } = {}) {
    this.x = x; this.y = y; this.z = z;
    this.key = key; // assets key
    this.radius = radius; // collision radius in tile units
    this.baseSpeed = speed; // tiles per second
    this.hp = hp;
    this.maxHp = hp;
    this.dead = false;
    this.facing = 0; // radians
    this.team = 'player';
    // Stats: strength, agility, perception
    const defaults = { str: 3, agi: 3, per: 3 };
    this.stats = Object.assign(defaults, stats || {});
    this._recalcDerived();
  }

  _recalcDerived() {
    const { str, agi, per } = this.stats;
    // Movement speed affected by agility
    this.speed = this.baseSpeed * (1 + (agi - 3) * 0.08);
    // Toughness reduces incoming damage
    this.toughness = Math.max(0, Math.min(0.35, (str - 3) * 0.03));
    // Dodge chance from agility
    this.dodge = Math.max(0, Math.min(0.3, (agi - 3) * 0.03));
    // Max HP weighted by stats (STR most important, then AGI, then PER)
    const maxHp = 60 + Math.max(0, 8 * str) + Math.max(0, 5 * agi) + Math.max(0, 3 * per);
    this.maxHp = maxHp;
    if (this.hp > this.maxHp) this.hp = this.maxHp;
  }

  get pos() { return { x: this.x, y: this.y, z: this.z }; }

  takeDamage(dmg, { kind = 'generic', attacker = null } = {}) {
    // Dodge check (less effective vs melee)
    const dodgeChance = kind === 'melee' ? this.dodge * 0.5 : this.dodge;
    if (Math.random() < dodgeChance) return; // dodged
    // Reduce by toughness
    const reduced = dmg * (1 - (this.toughness || 0));
    this.hp -= reduced;
    if (this.hp <= 0) {
      this.dead = true;
    }
  }

  update(dt, game) {
    // base entity does nothing
  }

  draw(ctx, game) {
    const asset = game.assets.get(this.key);
    if (asset && asset.type === 'sheet') {
      const { img, fw, fh, cols, rows } = asset;
      this.animTime = (this.animTime || 0) + game.dt;
      const fps = asset.fps || 8;
      // Directional rows: if rows>=4, pick row by facing (N,E,S,W ordering as 0..3)
      let rowIndex = 0;
      if (rows >= 4) {
        const ang = this.facing; // -pi..pi
        const dir = Math.round((ang / (Math.PI/2))) & 3; // 0..3
        // Map: 0≈right(E)->row1, 1≈down(S)->row2, 2≈left(W)->row3, 3≈up(N)->row0
        const map = [1, 2, 3, 0];
        rowIndex = map[dir] || 0;
      }
      const frame = Math.floor(this.animTime * fps) % cols;
      drawIsoSubImage(ctx, img, frame * fw, rowIndex * fh, fw, fh, this.x, this.y, this.z, game.tileW, game.tileH, game.originX, game.originY);
    } else if (asset) {
      drawIsoImage(ctx, asset, this.x, this.y, this.z, game.tileW, game.tileH, game.originX, game.originY);
    } else {
      drawIsoTile(ctx, this.x, this.y, this.z, game.tileW, game.tileH, '#446', game.originX, game.originY);
    }
  }
}

export class Player extends Entity {
  constructor(opts = {}) {
    super({ key: 'entities/player', speed: 4, radius: 0.35, hp: 120, stats: { str: 4, agi: 4, per: 4 }, ...opts });
    this.team = 'player';
    this.cooldowns = { melee: 0, ranged: 0 };
  }

  update(dt, game) {
    // Keep dt for animations
    this.animTime = (this.animTime || 0) + dt;
    // movement from input
    const dir = { x: 0, y: 0 };
    if (game.input.keys['KeyW']) dir.y -= 1;
    if (game.input.keys['KeyS']) dir.y += 1;
    if (game.input.keys['KeyA']) dir.x -= 1;
    if (game.input.keys['KeyD']) dir.x += 1;
    const len = Math.hypot(dir.x, dir.y) || 1;
    if (Math.hypot(dir.x, dir.y) > 0.1) {
      // Cancel autopilot on manual input
      game.autopilot = null;
    }

    // Autopilot path following from clickable movement
    if (game.autopilot && game.autopilot.path && game.autopilot.path.length) {
      const target = game.autopilot.path[0];
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.hypot(dx, dy);
      const step = this.speed * dt;
      if (dist <= 0.05) {
        game.autopilot.path.shift();
      } else {
        const nx = this.x + (dx / dist) * step;
        const ny = this.y + (dy / dist) * step;
        if (!game.isBlockedAt(nx, ny)) { this.x = nx; this.y = ny; }
      }
    } else {
      const vx = (dir.x / len) * this.speed * dt;
      const vy = (dir.y / len) * this.speed * dt;
      const nx = this.x + vx;
      const ny = this.y + vy;
      if (!game.isBlockedAt(nx, ny)) { this.x = nx; this.y = ny; }
    }

    // aim towards mouse in world coords
    const aim = game.input.mouseWorld;
    if (aim) {
      const dx = aim.x - this.x;
      const dy = aim.y - this.y;
      this.facing = Math.atan2(dy, dx);
    }

    // cooldowns decay
    this.cooldowns.melee = Math.max(0, this.cooldowns.melee - dt);
    this.cooldowns.ranged = Math.max(0, this.cooldowns.ranged - dt);

    // attacks are handled via mouse in Game input; no key-based attacks
  }
}

export class Enemy extends Entity {
  constructor(opts = {}) {
    super({ key: 'entities/enemy', speed: 2.2, radius: 0.35, hp: 60, stats: { str: 3, agi: 3, per: 2 }, ...opts });
    this.team = 'enemy';
    this.aiLevel = opts.aiLevel || 1;
    this._path = null; this._pathTimer = 0;
  }

  update(dt, game) {
    const player = game.player;
    if (!player) return;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.facing = Math.atan2(dy, dx);
    // Patrol behavior (aiLevel 2): follow waypoints if provided
    if (this.aiLevel === 2 && this.patrolPoints && this.patrolPoints.length) {
      if (this._patrolIndex == null) this._patrolIndex = 0;
      const tgt = this.patrolPoints[this._patrolIndex % this.patrolPoints.length];
      const tx = tgt.x - this.x; const ty = tgt.y - this.y;
      const td = Math.hypot(tx, ty) || 1;
      if (td < 0.2) { this._patrolIndex = (this._patrolIndex + 1) % this.patrolPoints.length; }
      else {
        const step = this.speed * dt;
        const nx = this.x + (tx/td) * step;
        const ny = this.y + (ty/td) * step;
        if (!game.isBlockedAt(nx, ny)) { this.x = nx; this.y = ny; }
      }
      return;
    }
    if (this.aiLevel >= 3 && game.pathfinder) {
      // pathfind occasionally
      this._pathTimer -= dt;
      if (!this._path || this._pathTimer <= 0) {
        const path = game.pathfinder.findPath({ x: Math.round(this.x), y: Math.round(this.y) }, { x: Math.round(player.x), y: Math.round(player.y) });
        this._path = path && path.length ? path.slice(1) : null;
        this._pathTimer = 0.5 + Math.random() * 0.5;
      }
      if (this._path && this._path.length) {
        const tgt = this._path[0];
        const tx = tgt.x - this.x; const ty = tgt.y - this.y;
        const td = Math.hypot(tx, ty) || 1;
        const step = this.speed * dt;
        if (td < 0.1) { this._path.shift(); }
        else {
          const nx = this.x + (tx/td) * step;
          const ny = this.y + (ty/td) * step;
          if (!game.isBlockedAt(nx, ny)) { this.x = nx; this.y = ny; }
        }
        return;
      }
    }
    // simple chase fallback
    const want = Math.min(this.speed * dt, d - 0.001);
    const nx = this.x + (dx / d) * want;
    const ny = this.y + (dy / d) * want;
    if (!game.isBlockedAt(nx, ny)) { this.x = nx; this.y = ny; }
  }
}

export function createEnemyByType(typeIndex = 0, pos = { x: 0, y: 0 }) {
  // Define 10 enemy archetypes with distinct stats
  const types = [
    { name: 'Grunt', hp: 60, speed: 2.2, stats: { str: 3, agi: 3, per: 2 } },
    { name: 'Runner', hp: 50, speed: 3.2, stats: { str: 2, agi: 5, per: 3 } },
    { name: 'Brute', hp: 110, speed: 1.8, stats: { str: 6, agi: 2, per: 2 } },
    { name: 'Scout', hp: 55, speed: 3.0, stats: { str: 2, agi: 5, per: 5 } },
    { name: 'Shooter', hp: 65, speed: 2.4, stats: { str: 3, agi: 3, per: 6 } },
    { name: 'Assassin', hp: 70, speed: 3.4, stats: { str: 4, agi: 6, per: 4 } },
    { name: 'Tank', hp: 150, speed: 1.6, stats: { str: 7, agi: 1, per: 2 } },
    { name: 'Skirmisher', hp: 80, speed: 2.8, stats: { str: 4, agi: 4, per: 4 } },
    { name: 'Sniper', hp: 60, speed: 2.5, stats: { str: 3, agi: 3, per: 7 } },
    { name: 'Elder', hp: 120, speed: 2.0, stats: { str: 5, agi: 2, per: 6 } },
  ];
  const idx = (typeIndex|0) % types.length;
  const cfg = types[idx];
  return new Enemy({ x: pos.x, y: pos.y, hp: cfg.hp, speed: cfg.speed, stats: cfg.stats, name: cfg.name, key: `entities/enemy${idx}`, typeIndex: idx });
}
