import { Projectile, Slash } from './projectile.js';

export class Weapons {
  constructor(game) {
    this.game = game;
    // Configure weapons
    this.config = {
      melee: { cooldown: 0.35, range: 1.1, arc: Math.PI * 0.9, damage: 34 },
      ranged: { cooldown: 0.25, speed: 11, damage: 18, life: 1.6 }
    };
    this.timers = new Map();
  }

  _canUse(kind, user) {
    const now = this.game.time;
    const key = `${user.team}:${kind}`;
    const next = this.timers.get(key) || 0;
    return now >= next;
  }

  _markUsed(kind, user) {
    const now = this.game.time;
    const cd = this.config[kind]?.cooldown || 0.3;
    const key = `${user.team}:${kind}`;
    this.timers.set(key, now + cd);
  }

  use(kind, user) {
    if (!this._canUse(kind, user)) return;
    if (kind === 'melee') {
      const { range, arc, damage } = this.config.melee;
      const str = user?.stats?.str ?? 3;
      const dmg = Math.round(damage * (1 + (str - 3) * 0.15));
      const slash = new Slash({ x: user.x, y: user.y, angle: user.facing, range, arc, damage: dmg, owner: user });
      this.game.effects.push(slash);
      this._markUsed(kind, user);
    } else if (kind === 'ranged') {
      const { speed, damage, life } = this.config.ranged;
      const per = user?.stats?.per ?? 3;
      const dmg = Math.round(damage * (1 + (per - 3) * 0.05));
      // Accuracy: add small spread inversely with perception
      const baseSpread = 0.2; // radians
      const spread = Math.max(0, baseSpread - (per - 3) * 0.04);
      const angle = user.facing + (Math.random() * 2 - 1) * spread;
      const p = new Projectile({ x: user.x, y: user.y, angle, speed, damage: dmg, life, owner: user });
      this.game.projectiles.push(p);
      this._markUsed(kind, user);
    }
  }
}
