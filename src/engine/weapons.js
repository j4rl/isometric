import { Projectile, Slash } from './projectile.js';

export class Weapons {
  constructor(game) {
    this.game = game;
    this.config = {
      meleeTypes: [
        { key: 'knife',  name: 'Knife',  cooldown: 0.18, range: 0.8, arc: Math.PI * 0.9, damage: 20, req: { str: 1, agi: 1, per: 1 } },
        { key: 'sledge', name: 'Sledge', cooldown: 0.75, range: 1.0, arc: Math.PI * 0.9, damage: 60, req: { str: 4, agi: 2, per: 1 } }
      ],
      rangedList: [
        { name: 'Bow',     pps: 4,  range: 10.0, bulletSpeed: 11, damage: 18, life: 1.6, projectilesPerShot: 1,  magazineSize: 6,  reloadTime: 1.4, req: { str: 1, agi: 1, per: 1 } },
        { name: 'Shotgun', pps: 3,  range: 12.0, bulletSpeed: 20, damage: 12, life: 1.2, projectilesPerShot: 6,  magazineSize: 8,  reloadTime: 2.0, req: { str: 3, agi: 2, per: 1 } },
        { name: 'Minigun', pps: 12, range: 14.0, bulletSpeed: 22, damage: 10, life: 1.0, projectilesPerShot: 1,  magazineSize: 120, reloadTime: 3.0, req: { str: 5, agi: 2, per: 1 } }
      ]
    };
    this.timers = new Map();
    this.state = {
      slots: [
        { type: 'melee', index: 0 },
        { type: 'ranged', index: 0 }
      ],
      activeSlot: 0,
      meleeIndex: 0,
      rangedAmmo: [
        { ammo: (this.config.rangedList[0]?.magazineSize || 0), reloadingUntil: 0 },
        { ammo: (this.config.rangedList[0]?.magazineSize || 0), reloadingUntil: 0 }
      ],
      ranged: { ammo: (this.config.rangedList[0]?.magazineSize || 0), reloadingUntil: 0 }
    };
  }

  // timers
  _canUse(timerKey, user) {
    const now = this.game.time;
    const key = `${user.team}:${timerKey}`;
    const next = this.timers.get(key) || 0;
    return now >= next;
  }
  _markUsedWithCooldown(timerKey, user, cooldown) {
    const now = this.game.time;
    const key = `${user.team}:${timerKey}`;
    this.timers.set(key, now + (cooldown || 0.3));
  }

  // slots
  setActiveSlot(idx) {
    const i = Math.max(0, Math.min(1, idx|0));
    const prev = this.state.activeSlot;
    if (this.state.slots[prev]?.type === 'ranged') {
      this.state.rangedAmmo[prev] = { ...this.state.ranged };
    }
    this.state.activeSlot = i;
    if (this.state.slots[i]?.type === 'ranged') {
      this.state.ranged = { ...this.state.rangedAmmo[i] };
    }
  }
  toggleActiveSlot() { this.setActiveSlot(this.state.activeSlot ? 0 : 1); }
  setSlot(slotIndex, type, index) {
    const s = this.state.slots[slotIndex];
    if (!s) return;
    s.type = type; s.index = index|0;
    if (type === 'ranged') {
      const cfg = this.config.rangedList[s.index];
      this.state.rangedAmmo[slotIndex] = { ammo: cfg?.magazineSize || 0, reloadingUntil: 0 };
      if (slotIndex === this.state.activeSlot) this.state.ranged = { ...this.state.rangedAmmo[slotIndex] };
    }
    if (type === 'melee' && slotIndex === this.state.activeSlot) this.state.meleeIndex = s.index;
  }
  cycleActive(dir = 1) {
    const s = this.state.slots[this.state.activeSlot];
    if (s.type === 'melee') {
      const n = (this.config.meleeTypes || []).length; if (!n) return;
      s.index = (((s.index || 0) + dir) % n + n) % n; this.state.meleeIndex = s.index;
    } else {
      const n = (this.config.rangedList || []).length; if (!n) return;
      s.index = (((s.index || 0) + dir) % n + n) % n;
      const cfg = this.config.rangedList[s.index];
      this.state.rangedAmmo[this.state.activeSlot] = { ammo: cfg?.magazineSize || 0, reloadingUntil: 0 };
      this.state.ranged = { ...this.state.rangedAmmo[this.state.activeSlot] };
    }
  }
  toggleActiveType() {
    const s = this.state.slots[this.state.activeSlot];
    if (s.type === 'melee') this.setSlot(this.state.activeSlot, 'ranged', 0); else this.setSlot(this.state.activeSlot, 'melee', 0);
  }

  // use
  useActive(user, target = null) {
    const active = this.state.activeSlot;
    const slot = this.state.slots[active];
    const timerKey = `slot${active}`;
    if (!this._canUse(timerKey, user)) return;
    if (slot.type === 'melee') {
      const m = this.config.meleeTypes[slot.index]; if (!m) return;
      if (!this._meetsReq(user?.stats, m.req)) return;
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
      this._markUsedWithCooldown(timerKey, user, m.cooldown);
    } else {
      const r = this.config.rangedList[slot.index]; if (!r) return;
      if (!this._meetsReq(user?.stats, r.req)) return;
      const { bulletSpeed, damage, life, range, projectilesPerShot, pps } = r;
      const per = user?.stats?.per ?? 3;
      const dmg = Math.round(damage * (1 + (per - 3) * 0.05));
      const st = this.state.ranged;
      if (this.game.time < (st.reloadingUntil || 0)) return;
      if (st.ammo < projectilesPerShot) { this.reloadActive(); return; }
      let angle = user.facing;
      if (target) { const dx = target.x - user.x; const dy = target.y - user.y; const dist = Math.hypot(dx, dy); if (dist > range) return; angle = Math.atan2(dy, dx); }
      else { const baseSpread = 0.2; const spread = Math.max(0, baseSpread - (per - 3) * 0.04); angle = user.facing + (Math.random() * 2 - 1) * spread; }
      const bonusPellets = Math.max(0, Math.floor((per - 5) / 4));
      const pellets = Math.max(1, (projectilesPerShot|0) + bonusPellets);
      const spreadTotal = Math.min(0.6, 0.1 * pellets);
      for (let i = 0; i < pellets; i++) {
        const t = pellets === 1 ? 0 : (i / (pellets - 1)) - 0.5;
        const a = angle + t * spreadTotal;
        const p = new Projectile({ x: user.x, y: user.y, angle: a, speed: bulletSpeed, damage: dmg, life, owner: user });
        this.game.projectiles.push(p);
      }
      st.ammo -= pellets;
      if (st.ammo <= 0) this.reloadActive();
      const cd = pps ? (1 / pps) : 0.25;
      this._markUsedWithCooldown(timerKey, user, cd);
      this.state.rangedAmmo[active] = { ...st };
    }
  }

  reloadActive() {
    const s = this.state.slots[this.state.activeSlot];
    if (s.type !== 'ranged') return;
    const st = this.state.ranged;
    const cfg = this.config.rangedList[s.index];
    if (this.game.time < (st.reloadingUntil || 0)) return;
    if (st.ammo >= cfg.magazineSize) return;
    st.reloadingUntil = this.game.time + cfg.reloadTime;
    setTimeout(() => { st.ammo = cfg.magazineSize; st.reloadingUntil = 0; }, Math.max(10, cfg.reloadTime * 1000));
  }

  getInfoActive(user) {
    const s = this.state.slots[this.state.activeSlot];
    const type = s.type;
    const cfg = type === 'melee' ? this.config.meleeTypes[s.index] : this.config.rangedList[s.index];
    const stats = user?.stats || { str: 3, agi: 3, per: 3 };
    let dmg = cfg?.damage || 0;
    if (type === 'melee') dmg = Math.round(dmg * (1 + (stats.str - 3) * 0.15));
    else dmg = Math.round(dmg * (1 + (stats.per - 3) * 0.05));
    const shotsPerSecond = type === 'ranged' ? (cfg?.pps || (cfg?.cooldown ? 1/(cfg.cooldown) : 1)) : (1 / ((cfg?.cooldown || 1)));
    const pellets = (type === 'ranged') ? ((cfg?.projectilesPerShot || 1) + Math.max(0, Math.floor((stats.per - 5) / 4))) : 1;
    const dps = Math.round(dmg * pellets * shotsPerSecond);
    const locked = !this._meetsReq(stats, cfg?.req);
    const info = { name: cfg?.name || '?', range: cfg?.range || 0, damage: dmg, dps, locked, req: cfg?.req };
    if (type === 'ranged') {
      const st = this.state.ranged;
      info.ammo = `${st.ammo}/${cfg?.magazineSize || 0}`;
      info.reloadTime = cfg?.reloadTime;
      info.pps = shotsPerSecond;
      info.projectilesPerShot = cfg?.projectilesPerShot;
    }
    return info;
  }

  _meetsReq(stats, req) {
    if (!req) return true;
    const s = stats || { str: 1, agi: 1, per: 1 };
    return (s.str >= (req.str || 1)) && (s.agi >= (req.agi || 1)) && (s.per >= (req.per || 1));
  }
}
