// Self-contained ASCII map loader with default legend and mapping

export const tileLegend = {
  G: { key: 'grass',     passable: true,  textureKey: 'tiles/grass',      height: 'normal' },
  S: { key: 'stone',     passable: true,  textureKey: 'tiles/stone',      height: 'normal' },
  R: { key: 'rock',      passable: false, textureKey: 'tiles/rock',       height: 'normal' },
  W: { key: 'water',     passable: false, textureKey: 'tiles/water',      height: 'normal' },
  B: { key: 'bridge',    passable: true,  textureKey: 'tiles/bridge',     height: 'normal' },
  b: { key: 'bush',      passable: false, textureKey: 'tiles/bush',       height: 'normal' },
  T: { key: 'tree',      passable: false, textureKey: 'tiles/tree',       height: 'high'   },
  t: { key: 'tallGrass', passable: true,  textureKey: 'tiles/tallGrass',  height: 'normal' },
  H: { key: 'house',     passable: false, textureKey: 'tiles/house',      height: 'high'   },
  h: { key: 'hut',       passable: false, textureKey: 'tiles/hut',        height: 'high'   },
  D: { key: 'dirt',      passable: true,  textureKey: 'tiles/dirt',       height: 'normal' },
  P: { key: 'portal',    passable: true,  textureKey: 'tiles/portal',     height: 'normal', portal: true },
  A: { key: 'arrival',   passable: true,  textureKey: 'tiles/stone',      height: 'normal', spawn: true },
  E:  { key: 'enemySpawn',  passable: true, textureKey: 'tiles/grass',     height: 'normal', spawnEnemy: true, aiLevel: 1 },
  E1: { key: 'enemySpawn1', passable: true, textureKey: 'tiles/grass',     height: 'normal', spawnEnemy: true, aiLevel: 1 },
  E2: { key: 'enemySpawn2', passable: true, textureKey: 'tiles/grass',     height: 'normal', spawnEnemy: true, aiLevel: 2 },
  E3: { key: 'enemySpawn3', passable: true, textureKey: 'tiles/grass',     height: 'normal', spawnEnemy: true, aiLevel: 3 },
  '0': { key: 'enemySpawn0', passable: true, textureKey: 'tiles/grass',   height: 'normal', spawnEnemy: true, enemyType: 0 },
  '1': { key: 'enemySpawn1', passable: true, textureKey: 'tiles/grass',   height: 'normal', spawnEnemy: true, enemyType: 1 },
  '2': { key: 'enemySpawn2', passable: true, textureKey: 'tiles/grass',   height: 'normal', spawnEnemy: true, enemyType: 2 },
  '3': { key: 'enemySpawn3', passable: true, textureKey: 'tiles/grass',   height: 'normal', spawnEnemy: true, enemyType: 3 },
  '4': { key: 'enemySpawn4', passable: true, textureKey: 'tiles/grass',   height: 'normal', spawnEnemy: true, enemyType: 4 },
  '5': { key: 'enemySpawn5', passable: true, textureKey: 'tiles/grass',   height: 'normal', spawnEnemy: true, enemyType: 5 },
  '6': { key: 'enemySpawn6', passable: true, textureKey: 'tiles/grass',   height: 'normal', spawnEnemy: true, enemyType: 6 },
  '7': { key: 'enemySpawn7', passable: true, textureKey: 'tiles/grass',   height: 'normal', spawnEnemy: true, enemyType: 7 },
  '8': { key: 'enemySpawn8', passable: true, textureKey: 'tiles/grass',   height: 'normal', spawnEnemy: true, enemyType: 8 },
  '9': { key: 'enemySpawn9', passable: true, textureKey: 'tiles/grass',   height: 'normal', spawnEnemy: true, enemyType: 9 },
  o:  { key: 'road',       passable: true,  textureKey: 'tiles/road',     height: 'normal' },
  x:  { key: 'debris',     passable: false, textureKey: 'tiles/debris',   height: 'normal' },
  c:  { key: 'car',        passable: false, textureKey: 'tiles/car',      height: 'high'   },
  p:  { key: 'waypoint',   passable: true,  textureKey: 'tiles/stone',    height: 'normal', waypoint: true }
};

// Default ASCII character mapping for quick hand-authored maps
// You can change these to suit your needs.
export const defaultAsciiMapping = {
  // Direct symbol passthrough
  'G': 'G', 'S': 'S', 'R': 'R', 'W': 'W', 'B': 'B', 'b': 'b', 'T': 'T', 't': 't', 'H': 'H', 'h': 'h', 'D': 'D', 'P': 'P', 'A': 'A', 'E': 'E',
  '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
  // Friendly aliases
  '.': 'G',                 // grass
  '=': 'S',                 // stone
  '#': 'R',                 // rock
  '~': 'W',                 // water
  '+': 'B',                 // bridge
  ',': 'D',                 // dirt
  'o': 'o',                 // road
  'x': 'x',                 // debris
  'c': 'c',                 // car
  'p': 'p',                 // waypoint
  '^': 'T',                 // tree
  '*': 'b',                 // bush
  '"': 't',                // tall grass
  '@': 'H',                 // house
  '%': 'h',                 // hut
  '>': 'P',                 // portal
  'a': 'A',                 // arrival
  'e': 'E',                 // enemy spawn
  ' ': 'G'                  // default to grass
};

function stripIndent(ascii) {
  const lines = ascii.split(/\r?\n/);
  const nonEmpty = lines.filter(l => l.trim().length > 0);
  const indent = nonEmpty.length ? Math.min(
    ...nonEmpty.map(l => (l.match(/^\s*/)[0] || '').length)
  ) : 0;
  return lines
    .map(l => l.slice(indent))
    .filter(l => l.length > 0)
    .join('\n');
}

export function parseAsciiGrid(ascii, mapping = defaultAsciiMapping) {
  const cleaned = stripIndent(ascii);
  const rows = cleaned.split(/\r?\n/);
  const grid = rows.map(row => Array.from(row).map(ch => mapping[ch] ?? 'G'));
  return grid;
}

export function asciiToMap(ascii, legend = tileLegend, mapping = defaultAsciiMapping) {
  const grid = parseAsciiGrid(ascii, mapping);
  return { grid, legend };
}

export async function loadMapById(id, { legend = tileLegend, mapping } = {}) {
  const url = `maps/map_${id}.txt`;
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ascii = await res.text();
    return asciiToMap(ascii, legend, mapping);
  } catch (err) {
    console.warn('Could not load map file', url, err);
    return null;
  }
}

// Bitmap loader: interprets colors as symbols via provided palette
// (deduped: older bitmap loader/palette removed; see final versions below)

// Bitmap loader: interprets colors as symbols via provided palette
export async function loadBitmapMap(url, { palette, legend = tileLegend } = {}) {
  try {
    const img = await loadImage(url);
    const cnv = document.createElement('canvas');
    cnv.width = img.width; cnv.height = img.height;
    const ctx = cnv.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, cnv.width, cnv.height);
    const w = cnv.width, h = cnv.height;
    const grid = new Array(h).fill(0).map(() => new Array(w).fill(' '));
    const pal = palette || defaultBitmapPalette();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const a = data[i+3];
        if (a === 0) { grid[y][x] = ' '; continue; } // void/outside map
        const r = data[i], g = data[i+1], b = data[i+2];
        const hex = rgbToHex(r,g,b);
        grid[y][x] = pal[hex] || 'G';
      }
    }
    return { grid, legend };
  } catch (e) {
    console.warn('Bitmap map load failed', url, e);
    return null;
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
function rgbToHex(r,g,b){
  const to2 = (n)=>n.toString(16).padStart(2,'0');
  return `#${to2(r)}${to2(g)}${to2(b)}`.toUpperCase();
}

export function defaultBitmapPalette() {
  // Map colors to symbols (post-apoc theme); customize per-level as needed
  return {
    '#4CAF50': 'G',  // grass
    '#8D6E63': 'D',  // dirt
    '#607D8B': 'o',  // road/stone
    '#2196F3': 'W',  // water/river
    '#795548': 'R',  // rock
    '#2E7D32': 't',  // tall grass
    '#1B5E20': 'b',  // bush
    '#33691E': 'T',  // tree
    '#9E9E9E': 'H',  // house/ruin
    '#5D4037': 'x',  // debris
    '#BDBDBD': 'c',  // burned car
    '#FF5722': 'P',  // portal
    '#FFEB3B': 'A',  // arrival (player spawn)
    '#00E676': 'p',  // waypoint
    '#F44336': 'E1', // enemy spawn AI1
    '#D32F2F': 'E2', // enemy spawn AI2
    '#B71C1C': 'E3', // enemy spawn AI3
  };
}
