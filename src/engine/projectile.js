import { drawIsoImage, drawIsoTile, drawIsoSubImage } from './iso.js';

export class Projectile {
  constructor({ x, y, angle, speed = 9, life = 1.6, damage = 20, owner, key = 'entities/bullet' }) {
    this.x = x; this.y = y; this.z = 0;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = life;
    this.damage = damage;
    this.owner = owner; // entity who fired
    this.key = key;
    this.radius = 0.15;
    this.dead = false;
    this.team = owner?.team || 'player';
  }

  update(dt, game) {
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // collide against enemies if player fired; or player if enemy fired (not used yet)
    const targets = game.entities.filter(e => !e.dead && e.team !== this.team);
    for (const t of targets) {
      const dx = t.x - this.x;
      const dy = t.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d < (t.radius + this.radius)) {
        t.takeDamage(this.damage);
        this.dead = true;
        break;
      }
    }
  }

  draw(ctx, game) {
    const asset = game.assets.get(this.key);
    if (asset && asset.type === 'sheet') {
      // Use first frame
      const { img, fw, fh } = asset;
      drawIsoSubImage(ctx, img, 0, 0, fw, fh, this.x, this.y, 0, game.tileW, game.tileH, game.originX, game.originY, -6);
    } else if (asset) {
      drawIsoImage(ctx, asset, this.x, this.y, 0, game.tileW, game.tileH, game.originX, game.originY, -6);
    } else {
      drawIsoTile(ctx, this.x, this.y, 0, game.tileW, game.tileH, '#b44', game.originX, game.originY);
    }
  }
}

export class Slash {
  // short-lived melee effect area
  constructor({ x, y, angle, range = 1.0, arc = Math.PI / 2, damage = 35, life = 0.12, owner }) {
    this.x = x; this.y = y; this.angle = angle;
    this.range = range; this.arc = arc;
    this.damage = damage; this.life = life;
    this.owner = owner; this.dead = false;
    this.key = 'entities/slash';
  }

  update(dt, game) {
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    // Apply damage on first frame to targets within arc
    if (!this._applied) {
      const targets = game.entities.filter(e => !e.dead && e.team !== this.owner.team);
      for (const t of targets) {
        const dx = t.x - this.x;
        const dy = t.y - this.y;
        const d = Math.hypot(dx, dy);
        if (d <= this.range) {
          const ang = Math.atan2(dy, dx);
          let da = Math.atan2(Math.sin(ang - this.angle), Math.cos(ang - this.angle));
          if (Math.abs(da) <= this.arc / 2) {
            t.takeDamage(this.damage);
          }
        }
      }
      this._applied = true;
    }
  }

  draw(ctx, game) {
    const asset = game.assets.get(this.key);
    if (asset && asset.type === 'sheet') {
      const { img, fw, fh, cols } = asset;
      const lifeFrac = 1 - Math.max(0, Math.min(1, this.life / 0.12));
      const frame = Math.min(cols - 1, Math.floor(lifeFrac * cols));
      const sx = frame * fw; const sy = 0;
      const ox = Math.cos(this.angle) * (game.tileW / 4);
      const oy = Math.sin(this.angle) * (game.tileH / 4);
      const fx = this.x + ox / game.tileW;
      const fy = this.y + oy / game.tileH;
      drawIsoSubImage(ctx, img, sx, sy, fw, fh, fx, fy, 0, game.tileW, game.tileH, game.originX, game.originY, -4);
    } else if (asset) {
      const ox = Math.cos(this.angle) * (game.tileW / 4);
      const oy = Math.sin(this.angle) * (game.tileH / 4);
      const fx = this.x + ox / game.tileW;
      const fy = this.y + oy / game.tileH;
      drawIsoImage(ctx, asset, fx, fy, 0, game.tileW, game.tileH, game.originX, game.originY, -4);
    } else {
      // fallback: semi-transparent arc
      const p = game.worldToScreen(this.x, this.y);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#6cf';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 32, this.angle - this.arc / 2, this.angle + this.arc / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}
