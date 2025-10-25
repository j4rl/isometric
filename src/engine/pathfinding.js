export class Pathfinder {
  constructor({ width, height, isBlocked }) {
    this.width = width;
    this.height = height;
    this.isBlocked = isBlocked; // (x,y) => boolean
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  neighbors(x, y) {
    // 8-directional with corner-cut prevention for diagonals
    const res = [];
    for (const dy of [-1, 0, 1]) {
      for (const dx of [-1, 0, 1]) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (!this.inBounds(nx, ny) || this.isBlocked(nx, ny)) continue;
        if (dx !== 0 && dy !== 0) {
          // diagonal: ensure we aren't cutting corners
          if (this.isBlocked(x + dx, y) || this.isBlocked(x, y + dy)) continue;
        }
        const cost = (dx !== 0 && dy !== 0) ? Math.SQRT2 : 1;
        res.push({ x: nx, y: ny, cost });
      }
    }
    return res;
  }

  heuristic(a, b) {
    // Octile distance suitable for 8-directional grids
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    const F = Math.SQRT2 - 1;
    return (dx < dy) ? F * dx + dy : F * dy + dx;
  }

  findPath(start, goal, maxIterations = 800) {
    const s = { x: Math.round(start.x), y: Math.round(start.y) };
    const g = { x: Math.round(goal.x), y: Math.round(goal.y) };
    if (!this.inBounds(g.x, g.y) || this.isBlocked(g.x, g.y)) return null;
    const key = (p) => `${p.x},${p.y}`;
    const open = new Set([key(s)]);
    const came = new Map();
    const gScore = new Map([[key(s), 0]]);
    const fScore = new Map([[key(s), this.heuristic(s, g)]]);

    let iter = 0;
    while (open.size && iter++ < maxIterations) {
      // find node in open with lowest f
      let current = null; let currentK = null; let bestF = Infinity;
      for (const k of open) {
        const f = fScore.get(k) ?? Infinity;
        if (f < bestF) { bestF = f; currentK = k; }
      }
      const [cx, cy] = currentK.split(',').map(Number);
      current = { x: cx, y: cy };
      if (cx === g.x && cy === g.y) {
        // reconstruct path
        const path = [g];
        let k = key(g);
        while (came.has(k)) {
          const p = came.get(k);
          path.push(p);
          k = key(p);
        }
        path.reverse();
        return path;
      }
      open.delete(currentK);
      const curG = gScore.get(currentK) ?? Infinity;
      for (const n of this.neighbors(current.x, current.y)) {
        const nk = key(n);
        const stepCost = n.cost || 1;
        const tentative = curG + stepCost;
        if (tentative < (gScore.get(nk) ?? Infinity)) {
          came.set(nk, current);
          gScore.set(nk, tentative);
          fScore.set(nk, tentative + this.heuristic(n, g));
          open.add(nk);
        }
      }
    }
    return null;
  }
}
