export class Assets {
  constructor() {
    this.images = new Map();
    this._realisticTune = { brightness: 0, grainScale: 1 };
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

  // Procedural, more elaborate tile art that overrides any loaded PNGs for tiles
  ensureProceduralTiles() {
    const set = (k, img) => { this.images.set(k, img); };
    // Bases
    const baseGrass = this._makeTileDiamond('#2f7d32', '#1e5621');
    const baseStone = this._makeTileDiamond('#6b6f7a', '#4a4f57');
    const baseDirt  = this._makeTileDiamond('#6a4f2b', '#4a371f');
    const baseWater = this._makeTileDiamond('#1e76a8', '#174a6b');
    const baseRoad  = this._makeTileDiamond('#707070', '#4a4a4a');

    set('tiles/grass', this._decorateTile(baseGrass, (g, w, h) => {
      g.save();
      g.strokeStyle = 'rgba(255,255,255,0.10)';
      g.lineWidth = 1;
      for (let i=0;i<6;i++){ g.beginPath(); const x=16+i*10; g.moveTo(x,h*0.65); g.lineTo(x+2,h*0.58); g.stroke(); }
      g.restore();
    }));

    set('tiles/tallGrass', this._decorateTile(baseGrass, (g,w,h)=>{
      g.save();
      g.strokeStyle = '#58c776'; g.lineWidth = 2; g.globalAlpha = 0.9;
      for (let i=0;i<6;i++){ const x=12+i*12; g.beginPath(); g.moveTo(x,h*0.68); g.lineTo(x+2,h*0.55); g.stroke(); }
      g.restore();
    }));

    set('tiles/bush', this._decorateTile(baseGrass, (g,w,h)=>{
      g.save();
      g.fillStyle = '#2f7d42'; g.strokeStyle='#1c4d2a'; g.lineWidth=2;
      g.beginPath(); g.ellipse(w/2, h*0.58, 18, 12, 0, 0, Math.PI*2); g.fill(); g.stroke();
      g.restore();
    }));

    set('tiles/tree', this._decorateTile(baseGrass, (g,w,h)=>{
      g.save();
      // trunk
      g.fillStyle = '#7b4a2b';
      g.fillRect(w/2-3, h*0.56, 6, 12);
      // canopy
      g.fillStyle = '#2f8f4e'; g.strokeStyle='#1b4d2a'; g.lineWidth=2;
      g.beginPath(); g.arc(w/2, h*0.52, 16, 0, Math.PI*2); g.fill(); g.stroke();
      g.restore();
    }));

    set('tiles/rock', this._decorateTile(baseStone, (g,w,h)=>{
      g.save();
      g.fillStyle = '#8b8f99'; g.strokeStyle = '#555a63'; g.lineWidth=2;
      g.beginPath(); g.moveTo(w/2-14,h*0.66); g.lineTo(w/2+10,h*0.66); g.lineTo(w/2+4,h*0.52); g.lineTo(w/2-10,h*0.56); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }));

    set('tiles/stone', this._decorateTile(baseStone, (g,w,h)=>{
      g.save(); g.strokeStyle='rgba(0,0,0,0.25)'; g.lineWidth=1; for(let i=0;i<3;i++){ g.beginPath(); g.moveTo(20+i*18,h*0.70); g.lineTo(30+i*18,h*0.62); g.stroke(); } g.restore();
    }));

    set('tiles/dirt', this._decorateTile(baseDirt, (g,w,h)=>{
      g.save(); g.fillStyle='rgba(0,0,0,0.12)'; for(let i=0;i<8;i++){ g.beginPath(); g.arc(18+i*9, h*0.68, 1.6, 0, Math.PI*2); g.fill(); } g.restore();
    }));

    set('tiles/water', this._decorateTile(baseWater, (g,w,h)=>{
      g.save(); g.strokeStyle='rgba(255,255,255,0.35)'; g.lineWidth=2; for(let i=0;i<3;i++){ g.beginPath(); g.arc(w/2-10+i*12, h*0.6, 10, 0.2, Math.PI-0.2); g.stroke(); } g.restore();
    }));

    set('tiles/bridge', this._decorateTile(baseWater, (g,w,h)=>{
      g.save();
      g.strokeStyle='#8b6a3b'; g.lineWidth=6; g.beginPath(); g.moveTo(w*0.30,h*0.70); g.lineTo(w*0.70,h*0.50); g.stroke();
      g.strokeStyle='#b88d4a'; g.lineWidth=3; for(let i=0;i<5;i++){ const t=i/4; g.beginPath(); g.moveTo(w*(0.30+0.40*t)-4, h*(0.70-0.20*t)); g.lineTo(w*(0.30+0.40*t)+4, h*(0.70-0.20*t)); g.stroke();}
      g.restore();
    }));

    set('tiles/road', this._decorateTile(baseRoad, (g,w,h)=>{
      g.save(); g.strokeStyle='#cfd8dc'; g.setLineDash([6,8]); g.lineWidth=2; g.beginPath(); g.moveTo(w*0.25,h*0.68); g.lineTo(w*0.75,h*0.48); g.stroke(); g.restore();
    }));

    set('tiles/debris', this._decorateTile(baseDirt, (g,w,h)=>{
      g.save(); g.fillStyle='#5d4037'; for(let i=0;i<5;i++){ g.fillRect(18+i*8, h*0.66 - (i%2)*3, 5, 2); } g.restore();
    }));

    set('tiles/car', this._decorateTile(baseRoad, (g,w,h)=>{
      g.save();
      // body
      g.fillStyle='#bdbdbd'; g.strokeStyle='#616161'; g.lineWidth=2;
      g.beginPath(); g.moveTo(w*0.40,h*0.62); g.lineTo(w*0.62,h*0.52); g.lineTo(w*0.58,h*0.46); g.lineTo(w*0.36,h*0.56); g.closePath(); g.fill(); g.stroke();
      // wheels
      g.fillStyle='#263238'; g.beginPath(); g.arc(w*0.41,h*0.62,2.5,0,Math.PI*2); g.fill(); g.beginPath(); g.arc(w*0.59,h*0.53,2.5,0,Math.PI*2); g.fill();
      g.restore();
    }));

    set('tiles/house', this._decorateTile(baseStone, (g,w,h)=>{
      g.save();
      g.fillStyle='#8d939d'; g.fillRect(w*0.44, h*0.50, 16, 10);
      g.fillStyle='#b56551'; g.beginPath(); g.moveTo(w*0.42,h*0.50); g.lineTo(w*0.60,h*0.42); g.lineTo(w*0.60,h*0.50); g.closePath(); g.fill();
      g.restore();
    }));

    set('tiles/hut', this._decorateTile(baseDirt, (g,w,h)=>{
      g.save();
      g.fillStyle='#7d4f2f'; g.fillRect(w*0.46, h*0.52, 12, 10);
      g.fillStyle='#a36f4a'; g.beginPath(); g.moveTo(w*0.44,h*0.52); g.lineTo(w*0.58,h*0.46); g.lineTo(w*0.58,h*0.52); g.closePath(); g.fill();
      g.restore();
    }));

    set('tiles/portal', this._decorateTile(baseStone, (g,w,h)=>{
      g.save();
      const cx=w/2, cy=h*0.58; g.strokeStyle='#b39ddb'; g.lineWidth=3; g.beginPath(); g.arc(cx,cy,10,0,Math.PI*2); g.stroke();
      g.strokeStyle='#7e57c2'; g.lineWidth=2; g.beginPath(); g.arc(cx,cy,6,0,Math.PI*2); g.stroke();
      g.restore();
    }));
  }

  // More realistic tiles: subdued palette, gradients, subtle noise/grain and small details
  ensureRealisticTiles() {
    const set = (k, img) => { this.images.set(k, img); };
    const keepExternal = (k) => {
      const v = this.images.get(k);
      return !!(v && v.width && v.height); // an Image already loaded
    };
    // Bases with gradient + grain
    const t = this._realisticTune || { brightness: 0, grainScale: 1 };
    const base = (mid, edge, grain=0.06) => this._makeRealisticBase(this._tuneColor(mid, t.brightness), this._tuneColor(edge, t.brightness), Math.max(0, grain * (t.grainScale || 1)));

    // Grass
    set('tiles/grass', this._decorateTile(base('#3e6b35', '#2a4524', 0.08), (g,w,h)=>{
      g.save(); g.strokeStyle='rgba(255,255,255,0.08)'; g.lineWidth=1;
      for (let i=0;i<14;i++){ const rx=8+Math.random()*(w-16); const y=h*0.62+Math.random()*8; g.beginPath(); g.moveTo(rx,y); g.lineTo(rx+2,y-4); g.stroke(); }
      g.restore();
    }));
    // Tall grass
    set('tiles/tallGrass', this._decorateTile(base('#446f3a','#2a4524',0.10),(g,w,h)=>{
      g.save(); g.strokeStyle='rgba(120,200,120,0.9)'; g.lineWidth=1.5;
      for (let i=0;i<10;i++){ const rx=6+Math.random()*(w-12); const y=h*0.64+Math.random()*8; g.beginPath(); g.moveTo(rx,y); g.lineTo(rx+2,y-7); g.stroke(); }
      g.restore();
    }));
    // Bush
    set('tiles/bush', this._decorateTile(base('#3e6b35','#2a4524',0.08),(g,w,h)=>{
      g.save(); g.fillStyle='#3f7b4a'; g.strokeStyle='rgba(0,0,0,0.35)'; g.lineWidth=2;
      this._shadowEllipse(g, w*0.52, h*0.66, 18, 6, 0.18);
      g.beginPath(); g.ellipse(w*0.52,h*0.60,18,12,0,0,Math.PI*2); g.fill(); g.stroke(); g.restore();
    }));
    // Tree
    set('tiles/tree', this._decorateTile(base('#3e6b35','#2a4524',0.08),(g,w,h)=>{
      g.save();
      this._shadowEllipse(g, w*0.52, h*0.70, 20, 8, 0.22);
      g.fillStyle='#6b4a2f'; g.fillRect(w*0.49, h*0.56, 6, 12);
      // canopy with radial gradient for volume
      const rg = g.createRadialGradient(w*0.46, h*0.48, 4, w*0.52, h*0.52, 18);
      rg.addColorStop(0, '#4a9b5a'); rg.addColorStop(1, '#2f6b3a');
      g.fillStyle = rg; g.strokeStyle='rgba(0,0,0,0.35)'; g.lineWidth=2;
      g.beginPath(); g.arc(w*0.52, h*0.52, 16, 0, Math.PI*2); g.fill(); g.stroke();
      g.restore();
    }));

    // Stone / Rock / Dirt
    set('tiles/stone', this._decorateTile(base('#6d737c','#454b53',0.05),(g,w,h)=>{
      g.save(); g.strokeStyle='rgba(0,0,0,0.25)'; g.lineWidth=1; for(let i=0;i<3;i++){ g.beginPath(); g.moveTo(22+i*18,h*0.70); g.lineTo(30+i*18,h*0.63); g.stroke(); } g.restore();
    }));
    set('tiles/rock', this._decorateTile(base('#767d86','#4a4f57',0.04),(g,w,h)=>{
      g.save();
      this._shadowEllipse(g, w*0.52, h*0.70, 16, 6, 0.20);
      // faceted rock with light from top-left
      const light = '#9aa2ad', mid = '#7d858f', dark = '#5a616b';
      g.fillStyle = light; g.beginPath(); g.moveTo(w*0.46,h*0.60); g.lineTo(w*0.52,h*0.54); g.lineTo(w*0.58,h*0.58); g.lineTo(w*0.50,h*0.62); g.closePath(); g.fill();
      g.fillStyle = mid; g.beginPath(); g.moveTo(w*0.46,h*0.60); g.lineTo(w*0.50,h*0.62); g.lineTo(w*0.48,h*0.66); g.lineTo(w*0.44,h*0.64); g.closePath(); g.fill();
      g.fillStyle = dark; g.beginPath(); g.moveTo(w*0.50,h*0.62); g.lineTo(w*0.58,h*0.58); g.lineTo(w*0.56,h*0.64); g.lineTo(w*0.48,h*0.66); g.closePath(); g.fill();
      g.restore();
    }));
    set('tiles/dirt', this._decorateTile(base('#6a4f2b','#4a371f',0.08),(g,w,h)=>{
      g.save(); g.fillStyle='rgba(0,0,0,0.18)'; for(let i=0;i<14;i++){ g.beginPath(); g.arc(12+Math.random()*(w-24), h*0.68+Math.random()*6, 1.3, 0, Math.PI*2); g.fill(); } g.restore();
    }));

    // Water + Bridge
    set('tiles/water', this._decorateTile(base('#1a5f8a','#123e56',0.03),(g,w,h)=>{
      g.save();
      const grad=g.createLinearGradient(w*0.3,h*0.5,w*0.7,h*0.7); grad.addColorStop(0,'rgba(255,255,255,0.20)'); grad.addColorStop(1,'rgba(255,255,255,0.0)');
      g.strokeStyle=grad; g.lineWidth=2; for(let i=0;i<3;i++){ g.beginPath(); g.arc(w*0.5-12+i*12,h*0.6,10,0.2,Math.PI-0.2); g.stroke(); }
      g.restore();
    }));
    set('tiles/bridge', this._decorateTile(base('#1a5f8a','#123e56',0.03),(g,w,h)=>{
      g.save();
      // deck beam
      g.strokeStyle='#795b34'; g.lineWidth=7; g.beginPath(); g.moveTo(w*0.30,h*0.70); g.lineTo(w*0.70,h*0.50); g.stroke();
      // planks with slight 3D edges
      for(let i=0;i<6;i++){ const t=i/5; const y=h*(0.70-0.20*t); const x=w*(0.30+0.40*t);
        g.strokeStyle='#b88d4a'; g.lineWidth=4; g.beginPath(); g.moveTo(x-5,y); g.lineTo(x+5,y); g.stroke();
        g.strokeStyle='rgba(0,0,0,0.25)'; g.lineWidth=1; g.beginPath(); g.moveTo(x+5,y); g.lineTo(x+7,y+1); g.stroke();
      }
      g.restore();
    }));

    // Road / Debris / Car
    set('tiles/road', this._decorateTile(base('#5e6166','#3b3e42',0.10),(g,w,h)=>{
      g.save(); g.strokeStyle='rgba(240,220,50,0.9)'; g.setLineDash([8,10]); g.lineWidth=2;
      g.beginPath(); g.moveTo(w*0.25,h*0.68); g.lineTo(w*0.75,h*0.48); g.stroke(); g.restore();
    }));
    set('tiles/debris', this._decorateTile(base('#6a4f2b','#4a371f',0.10),(g,w,h)=>{
      g.save();
      for(let i=0;i<4;i++){
        const bx=14+Math.random()*(w-28); const by=h*0.64+Math.random()*6; const bw=6+Math.random()*6; const bh=3+Math.random()*2;
        this._shadowEllipse(g, bx+bw*0.6, by+bh*0.8, bw, bh*0.6, 0.18);
        // top face
        g.fillStyle='#6e4b36'; g.fillRect(bx, by, bw, bh);
        // right face shadow
        g.fillStyle='rgba(0,0,0,0.25)'; g.fillRect(bx+bw-1, by+1, 2, bh);
      }
      // a plank
      const px=w*0.36, py=h*0.66; this._shadowEllipse(g, px+8, py+2, 12, 3, 0.16);
      g.strokeStyle='#5a4336'; g.lineWidth=3; g.beginPath(); g.moveTo(px,py); g.lineTo(px+16,py-4); g.stroke();
      g.restore();
    }));
    if (!keepExternal('tiles/car')) set('tiles/car', this._decorateTile(base('#5e6166','#3b3e42',0.08),(g,w,h)=>{
      g.save();
      // ground shadow
      this._shadowEllipse(g, w*0.50, h*0.62, 18, 6, 0.22);
      // body as 3D prism (light from top-left)
      const bodyTop = '#b0b7bc', side='#8a949a', dark='#5b6b75';
      // top face
      g.fillStyle=bodyTop; g.beginPath(); g.moveTo(w*0.40,h*0.60); g.lineTo(w*0.58,h*0.52); g.lineTo(w*0.60,h*0.50); g.lineTo(w*0.42,h*0.58); g.closePath(); g.fill();
      // top ridge highlight
      g.strokeStyle='rgba(255,255,255,0.25)'; g.lineWidth=1.5; g.beginPath(); g.moveTo(w*0.42,h*0.58); g.lineTo(w*0.60,h*0.50); g.stroke();
      // left side
      g.fillStyle=side; g.beginPath(); g.moveTo(w*0.40,h*0.60); g.lineTo(w*0.42,h*0.58); g.lineTo(w*0.42,h*0.64); g.lineTo(w*0.40,h*0.66); g.closePath(); g.fill();
      // right side
      g.fillStyle=dark; g.beginPath(); g.moveTo(w*0.58,h*0.52); g.lineTo(w*0.60,h*0.50); g.lineTo(w*0.60,h*0.56); g.lineTo(w*0.58,h*0.58); g.closePath(); g.fill();
      // wheels
      g.fillStyle='#263238'; g.beginPath(); g.arc(w*0.43,h*0.64,2.6,0,Math.PI*2); g.fill(); g.beginPath(); g.arc(w*0.57,h*0.56,2.6,0,Math.PI*2); g.fill();
      g.restore();
    }));

    // Structures
    if (!keepExternal('tiles/house')) set('tiles/house', this._decorateTile(base('#6d737c','#454b53',0.06),(g,w,h)=>{
      g.save();
      this._shadowEllipse(g, w*0.54, h*0.72, 22, 8, 0.22);
      // walls (front and side)
      const wall='#9aa2ad', wallDark='#7c848e';
      g.fillStyle=wall; g.beginPath(); g.moveTo(w*0.46,h*0.56); g.lineTo(w*0.56,h*0.52); g.lineTo(w*0.56,h*0.66); g.lineTo(w*0.46,h*0.70); g.closePath(); g.fill();
      g.fillStyle=wallDark; g.beginPath(); g.moveTo(w*0.56,h*0.52); g.lineTo(w*0.64,h*0.56); g.lineTo(w*0.64,h*0.70); g.lineTo(w*0.56,h*0.66); g.closePath(); g.fill();
      // roof (two faces)
      const roof='#b56551', roofDark='#8a4b3c';
      g.fillStyle=roof; g.beginPath(); g.moveTo(w*0.46,h*0.56); g.lineTo(w*0.56,h*0.50); g.lineTo(w*0.64,h*0.54); g.lineTo(w*0.56,h*0.52); g.closePath(); g.fill();
      g.fillStyle=roofDark; g.beginPath(); g.moveTo(w*0.56,h*0.50); g.lineTo(w*0.64,h*0.54); g.lineTo(w*0.58,h*0.56); g.lineTo(w*0.50,h*0.52); g.closePath(); g.fill();
      // roof highlight
      g.strokeStyle='rgba(255,255,255,0.22)'; g.lineWidth=1.5; g.beginPath(); g.moveTo(w*0.56,h*0.50); g.lineTo(w*0.64,h*0.54); g.stroke();
      // door
      g.fillStyle='#39424e'; g.fillRect(w*0.49, h*0.62, 4, 6);
      g.restore();
    }));
    if (!keepExternal('tiles/hut')) set('tiles/hut', this._decorateTile(base('#6a4f2b','#4a371f',0.08),(g,w,h)=>{
      g.save();
      this._shadowEllipse(g, w*0.54, h*0.72, 18, 7, 0.20);
      const wall='#8b5e3a', wallDark='#6e472a';
      g.fillStyle=wall; g.beginPath(); g.moveTo(w*0.48,h*0.58); g.lineTo(w*0.56,h*0.54); g.lineTo(w*0.56,h*0.66); g.lineTo(w*0.48,h*0.70); g.closePath(); g.fill();
      g.fillStyle=wallDark; g.beginPath(); g.moveTo(w*0.56,h*0.54); g.lineTo(w*0.62,h*0.58); g.lineTo(w*0.62,h*0.70); g.lineTo(w*0.56,h*0.66); g.closePath(); g.fill();
      const roof='#a36f4a', roofDark='#7d4f2f';
      g.fillStyle=roof; g.beginPath(); g.moveTo(w*0.48,h*0.58); g.lineTo(w*0.56,h*0.52); g.lineTo(w*0.62,h*0.56); g.lineTo(w*0.56,h*0.54); g.closePath(); g.fill();
      g.fillStyle=roofDark; g.beginPath(); g.moveTo(w*0.56,h*0.52); g.lineTo(w*0.62,h*0.56); g.lineTo(w*0.58,h*0.58); g.lineTo(w*0.52,h*0.54); g.closePath(); g.fill();
      g.restore();
    }));

    // Portal
    set('tiles/portal', this._decorateTile(base('#6d737c','#454b53',0.04),(g,w,h)=>{
      g.save(); const cx=w/2, cy=h*0.58; this._shadowEllipse(g, cx, cy+6, 10, 4, 0.18);
      g.strokeStyle='rgba(170,150,230,0.9)'; g.lineWidth=3; g.beginPath(); g.arc(cx,cy,10,0,Math.PI*2); g.stroke();
      g.strokeStyle='rgba(120,90,200,0.9)'; g.lineWidth=2; g.beginPath(); g.arc(cx,cy,6,0,Math.PI*2); g.stroke(); g.restore();
    }));
  }

  _makeRealisticBase(midColor, edgeColor, grainAlpha=0.06) {
    const w=96,h=48; const hw=w/2, hh=h/2;
    return this._makeCanvas(w,h,(g)=>{
      // diamond path
      const path = () => { g.beginPath(); g.moveTo(hw,2); g.lineTo(w-2,hh); g.lineTo(hw,h-2); g.lineTo(2,hh); g.closePath(); };
      // gradient fill (top light -> bottom dark)
      const grad = g.createLinearGradient(hw,0,hw,h);
      grad.addColorStop(0, this._tint(midColor, 0.12));
      grad.addColorStop(0.5, midColor);
      grad.addColorStop(1, this._tint(edgeColor, -0.08));
      g.fillStyle = grad; path(); g.fill();
      // subtle inner stroke
      g.strokeStyle='rgba(0,0,0,0.25)'; g.lineWidth=1; path(); g.stroke();
      // grain overlay
      const pat = this._noisePattern(48,24, grainAlpha);
      g.fillStyle = pat; path(); g.fill();
      // ambient occlusion: darken bottom and right edges with soft gradient
      const ao = g.createLinearGradient(hw, hh, hw, h);
      ao.addColorStop(0.0, 'rgba(0,0,0,0.00)');
      ao.addColorStop(0.6, 'rgba(0,0,0,0.00)');
      ao.addColorStop(1.0, 'rgba(0,0,0,0.18)');
      g.fillStyle = ao; path(); g.fill();
      // slight right-edge AO
      const aoR = g.createLinearGradient(w-8, 0, w, 0);
      aoR.addColorStop(0.0, 'rgba(0,0,0,0.00)');
      aoR.addColorStop(1.0, 'rgba(0,0,0,0.10)');
      g.fillStyle = aoR; path(); g.fill();
    });
  }

  _noisePattern(w,h, alpha=0.06) {
    const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d');
    const img=g.createImageData(w,h); for(let i=0;i<img.data.length;i+=4){ const n=(Math.random()*255)|0; img.data[i]=n; img.data[i+1]=n; img.data[i+2]=n; img.data[i+3]=Math.max(0,Math.min(255, alpha*255)); }
    g.putImageData(img,0,0);
    return g.createPattern(c,'repeat');
  }

  _tint(hex, amt=0) {
    // Simple HSL-like lighten/darken on RGB
    const c = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if(!c) return hex; let r=parseInt(c[1],16), g=parseInt(c[2],16), b=parseInt(c[3],16);
    const adj=(v)=>Math.max(0,Math.min(255, Math.round(v + amt*255)));
    return `#${adj(r).toString(16).padStart(2,'0')}${adj(g).toString(16).padStart(2,'0')}${adj(b).toString(16).padStart(2,'0')}`;
  }

  _tuneColor(hex, brightness=0) { return this._tint(hex, brightness); }

  setRealisticTuning({ brightness, grainScale } = {}) {
    if (typeof brightness === 'number') this._realisticTune.brightness = Math.max(-0.5, Math.min(0.5, brightness));
    if (typeof grainScale === 'number') this._realisticTune.grainScale = Math.max(0, Math.min(3, grainScale));
  }

  _shadowEllipse(g, cx, cy, rx, ry, alpha=0.2) {
    g.save();
    g.translate(cx, cy);
    g.scale(1, ry/rx);
    g.fillStyle = `rgba(0,0,0,${alpha})`;
    g.beginPath(); g.arc(0,0, rx, 0, Math.PI*2); g.fill();
    g.restore();
  }

  _decorateTile(baseImg, overlay) {
    const w = baseImg.width || 96, h = baseImg.height || 48;
    return this._makeCanvas(w, h, (g) => {
      g.drawImage(baseImg, 0, 0);
      overlay(g, w, h);
    });
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
