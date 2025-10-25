import { Game } from './engine/game.js';
import { Assets } from './engine/assets.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

// Configure tile size (isometric diamond base size)
const TILE_W = 96; // width of diamond (px)
const TILE_H = 48; // height of diamond (px)

// Asset loader with PNG support (drop your PNGs under assets/...)
const assets = new Assets();
await assets.load({
  tiles: {
    grass: 'assets/tiles/grass.png',
    stone: 'assets/tiles/stone.png',
    rock: 'assets/tiles/rock.png'
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

// Demo map: 18x14 with some obstacles (rock)
const width = 18;
const height = 14;
const map = new Array(height).fill(0).map((_, y) => (
  new Array(width).fill(0).map((_, x) => {
    // edges stone, inside grass
    const base = (x === 0 || y === 0 || x === width - 1 || y === height - 1) ? 'stone' : 'grass';
    return base;
  })
));
// Add some rock obstacles
for (let x = 5; x <= 12; x++) map[6][x] = 'rock';
map[7][8] = 'rock'; map[8][8] = 'rock'; map[9][4] = 'rock';

game.setMap(map);
game.spawnDemo();
game.start();
