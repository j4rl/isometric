let ctx = null;
function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  return ctx;
}

export function playPortalSound() {
  const ac = ensureCtx();
  if (!ac) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'sine';
  const now = ac.currentTime;
  o.frequency.setValueAtTime(440, now);
  o.frequency.exponentialRampToValueAtTime(880, now + 0.2);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
  o.connect(g).connect(ac.destination);
  o.start(now);
  o.stop(now + 0.4);
}

