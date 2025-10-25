import { Game } from './engine/game.js';
import { Assets } from './engine/assets.js';
import { Enemy, createEnemyByType } from './engine/entity.js';
import { loadMapById } from './maps/loader.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

// Configure tile size (isometric diamond base size)
const TILE_W = 96; // width of diamond (px)
const TILE_H = 48; // height of diamond (px)

// Asset loader with PNG support
const assets = new Assets();
await assets.load({
  tiles: {
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
  },
  entities: {
    // Use simple spritesheets for player/enemy if available; placeholders autogen if missing
    player: { type: 'sheet', url: 'assets/entities/player.png', fw: 32, fh: 40, fps: 8 },
    enemy: { type: 'sheet', url: 'assets/entities/enemy.png', fw: 32, fh: 40, fps: 8 },
    bullet: 'assets/entities/bullet.png',
    slash: { type: 'sheet', url: 'assets/entities/slash.png', fw: 40, fh: 40, fps: 24 }
  }
});
// Ensure built-in placeholders if external PNGs are missing
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

// Load map from file `maps/map_X.txt` where X is a number; default to 1 and fallback to 1
const mapId = parseInt(new URLSearchParams(location.search).get('map') || '1', 10) || 1;
let mapDesc = await loadMapById(mapId);
if (!mapDesc && mapId !== 1) {
  mapDesc = await loadMapById(1);
}

game.setMap(mapDesc);
spawnFromMap(mapDesc);
game.start();

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

let currentMapId = mapId;
window.addEventListener('game:portal', async () => {
  currentMapId = (currentMapId || 1) + 1;
  let next = await loadMapById(currentMapId);
  if (!next) {
    currentMapId = 1;
    next = await loadMapById(1);
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
  }
});

function spawnFromMap(desc) {
  if (!desc || !desc.grid || !desc.legend) return;
  const h = desc.grid.length; const w = h ? desc.grid[0].length : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sym = desc.grid[y][x];
      const L = desc.legend[sym];
      if (L && L.spawnEnemy) {
        const type = typeof L.enemyType === 'number' ? L.enemyType : Math.floor(Math.random() * 10);
        game.entities.push(createEnemyByType(type, { x, y }));
      }
    }
  }
}
