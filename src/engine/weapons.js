import { Projectile, Slash } from './projectile.js';

export class Weapons {
  constructor(game) {
    this.game = game;
    // Configure weapons
    this.config = {
      meleeTypes: [
        { key: 'knife', name: 'Knife',  cooldown: 0.18, range: 0.8, arc: Math.PI * 0.9, damage: 20 },
        { key: 'sledge', name: 'Sledge', cooldown: 0.75, range: 1.0, arc: Math.PI * 0.9, damage: 60 }
      ],
      ranged: {
        name: 'Bow', cooldown: 0.25, range: 10.0, speed: 11, damage: 18, life: 1.6,
        projectilesPerShot: 1, magazineSize: 6, reloadTime: 1.4
      }
    };
    this.timers = new Map();
    // Weapon runtime state (e.g., ammo)
    this.state = {
      ranged: { ammo: this.config.ranged.magazineSize, reloadingUntil: 0 },
      meleeIndex: 0
    };
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

  _markUsedWithCooldown(kind, user, cooldown) {
    const now = this.game.time;
    const key = `${user.team}:${kind}`;
    this.timers.set(key, now + (cooldown || 0.3));
  }

  currentMelee() {
    const list = this.config.meleeTypes || [];
    if (!list.length) return { name: 'Melee', cooldown: 0.35, range: 1.0, arc: Math.PI * 0.9, damage: 30 };
    return list[(this.state.meleeIndex || 0) % list.length];
  }

  cycleMelee(dir = 1) {
    const list = this.config.meleeTypes || [];
    if (!list.length) return;
    const n = list.length;
    this.state.meleeIndex = (((this.state.meleeIndex || 0) + dir) % n + n) % n;
  }

  use(kind, user, target = null) {
    if (!this._canUse(kind, user)) return;
    if (kind === 'melee') {
      const m = this.currentMelee();
      const { range, arc, damage } = m;
      const str = user?.stats?.str ?? 3;
      const dmg = Math.round(damage * (1 + (str - 3) * 0.15));
      if (target) {
        const dx = target.x - user.x; const dy = target.y - user.y;
        const dist = Math.hypot(dx, dy);
        user.facing = Math.atan2(dy, dx);
        if (dist > range + (target.radius || 0.3)) return;
      }
      const slash = new Slash({ x: user.x, y: user.y, angle: user.facing, range, arc, damage: dmg, owner: user });
      this.game.effects.push(slash);
      this._markUsedWithCooldown(kind, user, m.cooldown);
    } else if (kind === 'ranged') {
      const { speed, damage, life, range, projectilesPerShot } = this.config.ranged;
      const per = user?.stats?.per ?? 3;
      const dmg = Math.round(damage * (1 + (per - 3) * 0.05));
      // Ammo and reload checks
      const st = this.state.ranged;
      if (this.game.time < (st.reloadingUntil || 0)) return; // still reloading
      if (st.ammo < projectilesPerShot) {
        this.reload('ranged');
        return;
      }
      let angle = user.facing;
      if (target) {
        const dx = target.x - user.x; const dy = target.y - user.y;
        const dist = Math.hypot(dx, dy);
        if (dist > range) return;
        angle = Math.atan2(dy, dx);
      } else {
        // Accuracy: add small spread inversely with perception
        const baseSpread = 0.2; // radians
        const spread = Math.max(0, baseSpread - (per - 3) * 0.04);
        angle = user.facing + (Math.random() * 2 - 1) * spread;
      }
      // Fire N projectiles with slight spread around angle if N>1
      const pellets = Math.max(1, projectilesPerShot|0);
      const spreadTotal = Math.min(0.6, 0.1 * pellets);
      for (let i = 0; i < pellets; i++) {
        const t = pellets === 1 ? 0 : (i / (pellets - 1)) - 0.5; // -0.5..0.5
        const a = angle + t * spreadTotal;
        const p = new Projectile({ x: user.x, y: user.y, angle: a, speed, damage: dmg, life, owner: user });
        this.game.projectiles.push(p);
      }
      st.ammo -= pellets;
      if (st.ammo <= 0) this.reload('ranged');
      this._markUsed(kind, user);
    }
  }

  reload(kind) {
    if (kind !== 'ranged') return;
    const st = this.state.ranged;
    const cfg = this.config.ranged;
    if (this.game.time < (st.reloadingUntil || 0)) return; // already reloading
    if (st.ammo >= cfg.magazineSize) return; // full
    st.reloadingUntil = this.game.time + cfg.reloadTime;
    // schedule refill after reloadTime
    setTimeout(() => { st.ammo = cfg.magazineSize; st.reloadingUntil = 0; }, Math.max(10, cfg.reloadTime * 1000));
  }

  getInfo(kind, user) {
    const k = kind === 'ranged' ? 'ranged' : 'melee';
    const cfg = k === 'melee' ? this.currentMelee() : this.config[k];
    const stats = user?.stats || { str: 3, agi: 3, per: 3 };
    let dmg = cfg.damage;
    if (k === 'melee') dmg = Math.round(cfg.damage * (1 + (stats.str - 3) * 0.15));
    else dmg = Math.round(cfg.damage * (1 + (stats.per - 3) * 0.05));
    const dps = Math.round((dmg / (cfg.cooldown || 1)) * (k === 'ranged' ? (cfg.projectilesPerShot || 1) : 1));
    const info = { name: cfg.name, range: cfg.range, damage: dmg, dps };
    if (k === 'ranged') {
      const st = this.state.ranged;
      info.ammo = `${st.ammo}/${cfg.magazineSize}`;
      info.reloadTime = cfg.reloadTime;
    }
    return info;
  }
}
