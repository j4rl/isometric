import { Game } from './engine/game.js';
import { Assets } from './engine/assets.js';
import { Enemy, createEnemyByType } from './engine/entity.js';
import { initCharacterCreate } from './ui/char_create.js';
import { loadBitmapMap, defaultBitmapPalette } from './maps/loader.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

// Configure tile size (isometric diamond base size)
const TILE_W = 96; // width of diamond (px)
const TILE_H = 48; // height of diamond (px)

// Asset loader with PNG support
const assets = new Assets();
const tileSources = {
  // Tiles now live under maps/tiles/ so map packs can include their own textures
  grass: 'maps/tiles/grass.png',
  stone: 'maps/tiles/stone.png',
  rock:  'maps/tiles/rock.png',
  water: 'maps/tiles/water.png',
  bridge: 'maps/tiles/bridge.png',
  bush: 'maps/tiles/bush.png',
  tree: 'maps/tiles/tree.png',
  tallGrass: 'maps/tiles/tallGrass.png',
  house: 'maps/tiles/house.png',
  hut: 'maps/tiles/hut.png',
  dirt: 'maps/tiles/dirt.png',
  portal: 'maps/tiles/portal.png'
};
await assets.load({
  tiles: tileSources,
  entities: {
    // Use simple spritesheets for player/enemy if available; placeholders autogen if missing
    player: { type: 'sheet', url: 'assets/entities/player.png', fw: 32, fh: 40, fps: 8 },
    enemy: { type: 'sheet', url: 'assets/entities/enemy.png', fw: 32, fh: 40, fps: 8 },
    bullet: 'assets/entities/bullet.png',
    slash: { type: 'sheet', url: 'assets/entities/slash.png', fw: 40, fh: 40, fps: 24 }
  }
});
// Tile visual style: default to 'realistic'. You can override with ?tiles=procedural|png
const params = new URLSearchParams(location.search);
let currentTileStyle = (params.get('tiles') || 'realistic').toLowerCase();
const tuning = { brightness: parseFloat(params.get('tb')||'0')||0, grainScale: parseFloat(params.get('tg')||'1')||1 };
async function applyTileStyle() {
  if (currentTileStyle === 'realistic') { assets.setRealisticTuning(tuning); assets.ensureRealisticTiles(); }
  else if (currentTileStyle === 'procedural') { assets.ensureProceduralTiles(); }
  else if (currentTileStyle === 'png') { await assets.load({ tiles: tileSources }); }
}
await applyTileStyle();
// Always ensure entity placeholders
assets.ensurePlaceholders();

// Create the game
const game = new Game({ canvas, ctx, tileW: TILE_W, tileH: TILE_H, assets });

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  // Set CSS size explicitly so boundingClientRect matches what we render
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  // Backing store size in device pixels
  const w = Math.max(1, Math.floor(window.innerWidth * dpr));
  const h = Math.max(1, Math.floor(window.innerHeight * dpr));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  game.handleResize(dpr);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Prefer bitmap maps by default. You can override via ?bmp=path.png
// Reuse params for map loading below
let bmpPath = params.get('bmp') || 'maps/map1.png';

function parseBmpSeries(path) {
  const m = /^(.*?)(\d+)(\.png)$/i.exec(path);
  if (!m) return null;
  return { base: m[1], index: parseInt(m[2], 10) || 1, suffix: m[3] };
}
let bmpSeries = parseBmpSeries(bmpPath);

let mapDesc = await loadBitmapMap(bmpPath, { palette: defaultBitmapPalette() });
if (!mapDesc && !params.get('bmp')) {
  // Fallback to default if custom bmp missing
  bmpPath = 'maps/map1.png';
  bmpSeries = parseBmpSeries(bmpPath);
  mapDesc = await loadBitmapMap(bmpPath, { palette: defaultBitmapPalette() });
}

game.setMap(mapDesc);
spawnFromMap(mapDesc);
game.start();

// Keep reference to current map descriptor for spawning player via UI
let currentMapDesc = mapDesc;
let currentBmpPath = bmpPath;
let currentSeries = bmpSeries;
initCharacterCreate(game, () => currentMapDesc);
// Live tile style/tuning controls
window.addEventListener('keydown', async (e) => {
  if (e.code === 'KeyT') {
    const styles = ['realistic','procedural','png'];
    const i = styles.indexOf(currentTileStyle);
    currentTileStyle = styles[(i + 1) % styles.length];
    await applyTileStyle();
  }
  if (e.code === 'Equal') { tuning.brightness = Math.min(0.5, tuning.brightness + 0.05); if (currentTileStyle==='realistic') { assets.setRealisticTuning(tuning); assets.ensureRealisticTiles(); } }
  if (e.code === 'Minus') { tuning.brightness = Math.max(-0.5, tuning.brightness - 0.05); if (currentTileStyle==='realistic') { assets.setRealisticTuning(tuning); assets.ensureRealisticTiles(); } }
  if (e.code === 'BracketRight') { tuning.grainScale = Math.min(3, tuning.grainScale + 0.1); if (currentTileStyle==='realistic') { assets.setRealisticTuning(tuning); assets.ensureRealisticTiles(); } }
  if (e.code === 'BracketLeft') { tuning.grainScale = Math.max(0, tuning.grainScale - 0.1); if (currentTileStyle==='realistic') { assets.setRealisticTuning(tuning); assets.ensureRealisticTiles(); } }
});

function findSpawn(desc) {
  if (!desc || !desc.grid || !desc.legend) return { x: 1, y: 1 };
  const h = desc.grid.length; const w = h ? desc.grid[0].length : 0;
  // Prefer explicit arrival spawn 'A'
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sym = desc.grid[y][x];
      const L = desc.legend[sym];
      if (L && L.spawn) return { x, y };
    }
  }
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  const inBounds = (x,y)=>x>=0&&y>=0&&x<w&&y<h;
  const pass = (x,y)=>{ const sym = desc.grid[y][x]; const L = desc.legend[sym]; return !!(L && L.passable); };
  // spiral search from center for first passable tile
  let radius = 0;
  while (radius < Math.max(w, h)) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = cx + dx, y = cy + dy;
        if (inBounds(x,y) && pass(x,y)) return { x, y };
      }
    }
    radius++;
  }
  return { x: 1, y: 1 };
}

window.addEventListener('game:portal', async () => {
  let nextPath = currentBmpPath;
  if (currentSeries) {
    const nextIndex = (currentSeries.index || 1) + 1;
    nextPath = `${currentSeries.base}${nextIndex}${currentSeries.suffix}`;
  } else {
    // If not a numbered series, try a sensible default sequence
    const guess = parseBmpSeries('maps/map1.png');
    currentSeries = guess;
    nextPath = 'maps/map2.png';
  }
  let next = await loadBitmapMap(nextPath, { palette: defaultBitmapPalette() });
  if (!next && currentSeries) {
    // wrap to first
    nextPath = `${currentSeries.base}1${currentSeries.suffix}`;
    next = await loadBitmapMap(nextPath, { palette: defaultBitmapPalette() });
    currentSeries.index = 1;
  }
  if (next) {
    game.setMap(next);
    const spawn = findSpawn(next);
    if (game.player) { game.player.x = spawn.x; game.player.y = spawn.y; }
    // Clear non-player entities/effects/projectiles
    game.entities = game.entities.filter(e => e === game.player);
    game.projectiles = [];
    game.effects = [];
    spawnFromMap(next);
    game.autopilot = null;
    currentMapDesc = next;
    currentBmpPath = nextPath;
    if (currentSeries) currentSeries.index = parseBmpSeries(nextPath)?.index || currentSeries.index;
  }
});

function spawnFromMap(desc) {
  if (!desc || !desc.grid || !desc.legend) return;
  const h = desc.grid.length; const w = h ? desc.grid[0].length : 0;
  // Collect waypoints
  const waypoints = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sym = desc.grid[y][x];
      const L = desc.legend[sym];
      if (L && L.waypoint) waypoints.push({ x, y });
      if (L && L.spawnEnemy) {
        const type = typeof L.enemyType === 'number' ? L.enemyType : Math.floor(Math.random() * 10);
        const e = createEnemyByType(type, { x, y });
        if (typeof L.aiLevel === 'number') e.aiLevel = L.aiLevel;
        if (e.aiLevel === 2 && waypoints.length) e.patrolPoints = waypoints.slice();
        game.entities.push(e);
      }
    }
  }
}
