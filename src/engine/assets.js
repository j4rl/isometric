export class Assets {
  constructor() {
    this.images = new Map();
  }

  async load(tree) {
    const tasks = [];
    const walk = (obj, prefix = '') => {
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        const name = prefix ? `${prefix}/${key}` : key;
        if (typeof val === 'string') {
          tasks.push(this._loadImage(name, val));
        } else if (val && typeof val === 'object' && val.type === 'sheet') {
          // spritesheet descriptor: {type:'sheet', url, fw, fh, fps?}
          tasks.push(this._loadSheet(name, val));
        } else if (val && typeof val === 'object') {
          walk(val, name);
        }
      }
    };
    walk(tree);
    await Promise.all(tasks);
  }

  async _loadImage(key, url) {
    const img = new Image();
    img.decoding = 'async';
    const p = new Promise((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
    });
    img.src = url;
    const ok = await p;
    if (ok) {
      this.images.set(key, img);
    } else {
      this.images.set(key, null); // mark as missing
    }
  }

  async _loadSheet(key, desc) {
    const { url, fw, fh, fps = 8 } = desc;
    const img = new Image();
    img.decoding = 'async';
    const p = new Promise((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
    });
    img.src = url;
    const ok = await p;
    if (ok) {
      const cols = Math.max(1, Math.floor(img.width / fw));
      const rows = Math.max(1, Math.floor(img.height / fh));
      this.images.set(key, { type: 'sheet', img, fw, fh, fps, cols, rows });
    } else {
      this.images.set(key, null);
    }
  }

  get(key) {
    return this.images.get(key) || null;
  }

  // Lightweight placeholders to ensure visuals without external PNG files
  ensurePlaceholders() {
    const put = (k, imgOrSheet) => {
      if (!this.images.has(k) || this.images.get(k) == null) this.images.set(k, imgOrSheet);
    };
    // Tile placeholders: simple diamonds
    put('tiles/grass', this._makeTileDiamond('#2f7d32', '#1e5621'));
    put('tiles/stone', this._makeTileDiamond('#6b6f7a', '#4a4f57'));
    put('tiles/rock', this._makeTileDiamond('#8b5a2b', '#5c3b1c'));
    put('tiles/water', this._makeTileDiamond('#1e76a8', '#174a6b'));
    put('tiles/bridge', this._makeTileDiamond('#b88d4a', '#8b6a3b'));
    put('tiles/bush', this._makeTileDiamond('#2f7d42', '#245a2f'));
    put('tiles/tree', this._makeTileDiamond('#2f8f4e', '#1b4d2a'));
    put('tiles/tallGrass', this._makeTileDiamond('#58c776', '#2faa45'));
    put('tiles/house', this._makeTileDiamond('#8d939d', '#6b6f7a'));
    put('tiles/hut', this._makeTileDiamond('#a36f4a', '#7d4f2f'));
    put('tiles/dirt', this._makeTileDiamond('#6a4f2b', '#4a371f'));
    put('tiles/portal', this._makeTileDiamond('#6a59c7', '#473e87'));
    // Extra post-apoc placeholders
    put('tiles/road', this._makeTileDiamond('#707070', '#4a4a4a'));
    put('tiles/debris', this._makeTileDiamond('#5d4037', '#3e2723'));
    put('tiles/car', this._makeTileDiamond('#9e9e9e', '#616161'));

    // Entity placeholders: simple capsules and shapes
    put('entities/player', this._makeSheetCapsule('#2ea8ff', '#176d9b'));
    put('entities/enemy', this._makeSheetCapsule('#ff5252', '#a83232'));
    // Enemy variants (0..9) tinted
    const enemyColors = ['#ff5252', '#ffa726', '#ffd54a', '#66bb6a', '#26c6da', '#42a5f5', '#7e57c2', '#ec407a', '#8d6e63', '#bdbdbd'];
    const enemyOutlines = ['#a83232', '#8b5a2b', '#8a7421', '#2f6a3a', '#176d9b', '#176bb5', '#4a3b8a', '#8a325d', '#5c3b2a', '#6b6f7a'];
    for (let i = 0; i < 10; i++) {
      put(`entities/enemy${i}`, this._makeSheetCapsule(enemyColors[i], enemyOutlines[i]));
    }
    put('entities/bullet', this._makeCircle('#ffd54a'));
    put('entities/slash', this._makeSlashSheet('#6cf'));
  }

  _makeCanvas(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    draw(g, w, h);
    const img = new Image();
    img.src = c.toDataURL('image/png');
    return img;
  }

  _makeTileDiamond(color, shadow) {
    const w = 96, h = 48;
    return this._makeCanvas(w, h, (g) => {
      const hw = w / 2, hh = h / 2;
      g.fillStyle = shadow;
      g.beginPath();
      g.moveTo(hw, 0);
      g.lineTo(w, hh);
      g.lineTo(hw, h);
      g.lineTo(0, hh);
      g.closePath();
      g.fill();
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(hw, 4);
      g.lineTo(w - 4, hh);
      g.lineTo(hw, h - 4);
      g.lineTo(4, hh);
      g.closePath();
      g.fill();
    });
  }

  _makeCircle(color) {
    return this._makeCanvas(16, 16, (g, w, h) => {
      g.fillStyle = color;
      g.beginPath();
      g.arc(w/2, h/2, 6, 0, Math.PI * 2);
      g.fill();
    });
  }

  _makeSheetCapsule(color, outline) {
    // Simple 4-frame loop sheet, 1 row with bobbing motion
    const fw = 32, fh = 40, frames = 4;
    const img = this._makeCanvas(fw * frames, fh, (g) => {
      for (let i = 0; i < frames; i++) {
        const x = i * fw; const yOff = Math.round(Math.sin((i / frames) * Math.PI * 2) * 2);
        g.save();
        g.translate(x, yOff);
        g.fillStyle = color;
        g.strokeStyle = outline;
        g.lineWidth = 2;
        const cx = fw/2, cy = fh/2;
        g.beginPath();
        g.moveTo(cx - 8, cy - 10);
        g.lineTo(cx + 8, cy - 10);
        g.quadraticCurveTo(cx + 12, cy, cx + 8, cy + 10);
        g.lineTo(cx - 8, cy + 10);
        g.quadraticCurveTo(cx - 12, cy, cx - 8, cy - 10);
        g.closePath();
        g.fill();
        g.stroke();
        g.restore();
      }
    });
    return { type: 'sheet', img, fw, fh, fps: 8, cols: 4, rows: 1 };
  }

  _makeSlashSheet(color) {
    const fw = 40, fh = 40, frames = 5;
    const img = this._makeCanvas(fw * frames, fh, (g) => {
      for (let i = 0; i < frames; i++) {
        const x = i * fw;
        g.save();
        g.translate(x + fw/2, fh/2 + 6);
        g.rotate(-Math.PI/4);
        g.globalAlpha = 0.4 + 0.12 * i;
        g.strokeStyle = color;
        g.lineWidth = 6 - i * 0.8;
        g.beginPath();
        g.arc(0, 0, 14 + i*2, Math.PI*0.1, Math.PI*1.2);
        g.stroke();
        g.restore();
      }
    });
    return { type: 'sheet', img, fw, fh, fps: 24, cols: frames, rows: 1 };
  }
}
