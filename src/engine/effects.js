export class PortalBurst {
  constructor(x, y) {
    this.x = x; this.y = y; this.z = 0;
    this.life = 0.6; // seconds
    this.dead = false;
  }
  update(dt, game) {
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx, game) {
    const t = Math.max(0, Math.min(1, 1 - this.life / 0.6));
    const rings = 3;
    for (let i = 0; i < rings; i++) {
      const frac = (t + i * 0.15) % 1;
      const size = 8 + frac * 28;
      const alpha = 0.6 * (1 - frac);
      const p = game.worldToScreen(this.x, this.y);
      ctx.save();
      ctx.setTransform(game.dpr || 1, 0, 0, game.dpr || 1, 0, 0);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#9c7bff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 8, size, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

