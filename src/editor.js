import { defaultBitmapPalette } from './maps/loader.js';

const canvas = document.getElementById('editorCanvas');
const ctx = canvas.getContext('2d');
const palEl = document.getElementById('palette');
const expBtn = document.getElementById('exportPng');
const resizeBtn = document.getElementById('resize');
const wInput = document.getElementById('w');
const hInput = document.getElementById('h');
const importInput = document.getElementById('importPng');
const brushInput = document.getElementById('brush');
const floodChk = document.getElementById('flood');
const brushInfo = document.getElementById('brush-info');
const hoverInfo = document.getElementById('hover-info');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const sidebar = document.getElementById('sidebar');

// State
let gridW = parseInt(wInput.value, 10) || 80;
let gridH = parseInt(hInput.value, 10) || 60;
let currentColor = '#4CAF50';
let drawing = false;
let floodMode = false;
let brushSize = 1;
let grid = null; // Uint32 RGBA pixels for export, but we store as hex strings per cell
let eyeMode = false; // eyedropper toggle (E)
let actionActive = false; // track draw action for history

// History (undo/redo)
const history = [];
const future = [];
const MAX_HISTORY = 50;
function cloneGrid(src) { return src.map(row => row.slice()); }
function pushHistory() {
  if (!grid) return;
  history.push(cloneGrid(grid));
  if (history.length > MAX_HISTORY) history.shift();
  // whenever we paint, redo stack clears
  future.length = 0;
  updateUndoRedoState();
}
function restoreGrid(snap) { grid = cloneGrid(snap); draw(); updateUndoRedoState(); }
function doUndo() {
  if (!history.length) return;
  const snap = history.pop();
  future.push(cloneGrid(grid));
  restoreGrid(snap);
}
function doRedo() {
  if (!future.length) return;
  const snap = future.pop();
  history.push(cloneGrid(grid));
  restoreGrid(snap);
}
function updateUndoRedoState() {
  if (undoBtn) undoBtn.disabled = history.length === 0;
  if (redoBtn) redoBtn.disabled = future.length === 0;
}

const palette = defaultBitmapPalette();
const colors = Object.keys(palette);

// Human-friendly names for symbols in the palette
const symbolNames = {
  G: 'Grass',
  D: 'Dirt',
  S: 'Stone',
  o: 'Road',
  W: 'Water',
  R: 'Rock',
  t: 'Tall Grass',
  b: 'Bush',
  T: 'Tree',
  H: 'Ruin',
  x: 'Debris',
  c: 'Burned Car',
  P: 'Portal',
  A: 'Player Spawn',
  p: 'Waypoint',
  E: 'Enemy Spawn',
  E1: 'Enemy Spawn AI1',
  E2: 'Enemy Spawn AI2',
  E3: 'Enemy Spawn AI3',
};

const paletteEntries = colors.map(hex => {
  const sym = palette[hex];
  const name = symbolNames[sym] || sym || hex;
  return { hex, sym, name };
});

function ensureGrid() {
  grid = new Array(gridH).fill(0).map(() => new Array(gridW).fill(null));
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || canvas.parentElement.clientWidth;
  const cssH = canvas.clientHeight || canvas.parentElement.clientHeight;
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  draw();
}

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#0e1013'; ctx.fillRect(0,0,canvas.width,canvas.height);
  const cellW = canvas.clientWidth / gridW;
  const cellH = canvas.clientHeight / gridH;
  for (let y=0;y<gridH;y++) {
    for (let x=0;x<gridW;x++) {
      const c = grid[y][x];
      if (c) {
        ctx.fillStyle = c; ctx.fillRect(x*cellW, y*cellH, cellW, cellH);
      }
    }
  }
  // grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let x=0;x<=gridW;x++) { ctx.beginPath(); ctx.moveTo(x*cellW,0); ctx.lineTo(x*cellW,gridH*cellH); ctx.stroke();}
  for (let y=0;y<=gridH;y++) { ctx.beginPath(); ctx.moveTo(0,y*cellH); ctx.lineTo(gridW*cellW,y*cellH); ctx.stroke();}
}

function screenToCell(sx, sy) {
  const rect = canvas.getBoundingClientRect();
  const x = sx - rect.left; const y = sy - rect.top;
  const cellW = canvas.clientWidth / gridW;
  const cellH = canvas.clientHeight / gridH;
  const cx = Math.floor(x / cellW); const cy = Math.floor(y / cellH);
  return { cx, cy };
}

function paintAt(evt) {
  const { cx, cy } = screenToCell(evt.clientX, evt.clientY);
  if (cx<0||cy<0||cx>=gridW||cy>=gridH) return;
  // Eyedropper pick
  if (evt.altKey || eyeMode) {
    const picked = grid[cy][cx];
    if (picked) { currentColor = picked; buildPalette(); updateBrushInfo(); }
    return;
  }
  if (floodMode) {
    floodFill(cx, cy, grid[cy][cx], currentColor);
  } else {
    const r = Math.max(1, brushSize|0);
    for (let y=cy - Math.floor(r/2); y<cy - Math.floor(r/2) + r; y++) {
      for (let x=cx - Math.floor(r/2); x<cx - Math.floor(r/2) + r; x++) {
        if (x>=0 && y>=0 && x<gridW && y<gridH) grid[y][x] = currentColor;
      }
    }
  }
  draw();
}

function floodFill(x, y, targetColor, newColor) {
  if (targetColor === newColor) return;
  const q = [];
  const seen = new Set();
  const key=(x,y)=>`${x},${y}`;
  q.push([x,y]); seen.add(key(x,y));
  while (q.length) {
    const [cx, cy] = q.shift();
    if (cx<0||cy<0||cx>=gridW||cy>=gridH) continue;
    if (grid[cy][cx] !== targetColor) continue;
    grid[cy][cx] = newColor;
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{
      const nx=cx+dx, ny=cy+dy;
      const k=key(nx,ny);
      if (!seen.has(k)) { seen.add(k); q.push([nx,ny]); }
    });
  }
}

function buildPalette() {
  palEl.innerHTML = '';
  paletteEntries.forEach(({hex, name}) => {
    const div = document.createElement('div');
    div.className = 'color' + (currentColor===hex?' active':'');
    div.style.background = hex;
    div.title = name;
    div.setAttribute('aria-label', name);
    div.addEventListener('click', ()=>{ currentColor = hex; buildPalette(); updateBrushInfo();});
    palEl.appendChild(div);
  });
}

function buildLegendPanel() {
  if (!sidebar) return;
  // Find the existing legend row and replace its contents for consistency
  const rows = Array.from(sidebar.querySelectorAll('.row'));
  let legendRow = rows.find(r => (r.querySelector('.label')?.textContent || '').toLowerCase().includes('legend'));
  if (!legendRow) {
    legendRow = document.createElement('div');
    legendRow.className = 'row';
    sidebar.appendChild(legendRow);
  }
  // Update label
  let label = legendRow.querySelector('.label');
  if (!label) { label = document.createElement('div'); label.className = 'label'; legendRow.prepend(label); }
  label.textContent = 'Legend';
  // Remove any existing list
  Array.from(legendRow.querySelectorAll('ul')).forEach(u => u.remove());
  // Build list
  const ul = document.createElement('ul');
  ul.id = 'legend-list';
  ul.className = 'legend-list';
  ul.style.fontSize = '12px';
  ul.style.lineHeight = '1.8';
  ul.style.listStyle = 'none';
  ul.style.padding = '0';
  ul.style.margin = '0';
  paletteEntries.forEach(({hex, name}) => {
    const li = document.createElement('li');
    li.className = 'legend-item';
    const sw = document.createElement('span');
    sw.style.display = 'inline-block';
    sw.style.width = '12px';
    sw.style.height = '12px';
    sw.style.background = hex;
    sw.style.border = '1px solid rgba(255,255,255,0.3)';
    sw.style.marginRight = '6px';
    li.appendChild(sw);
    li.appendChild(document.createTextNode(name));
    ul.appendChild(li);
  });
  legendRow.appendChild(ul);
}

function nameForHex(hex) {
  if (!hex) return 'Empty';
  const sym = palette[hex];
  return symbolNames[sym] || sym || hex;
}

function updateBrushInfo() {
  if (!brushInfo) return;
  const name = nameForHex(currentColor);
  const mode = eyeMode ? ' · Eyedropper' : (floodMode ? ' · Flood' : '');
  brushInfo.innerHTML = `<span style="display:inline-block;width:12px;height:12px;background:${currentColor};border:1px solid rgba(255,255,255,0.3);"></span> ${name} · Size ${brushSize}×${brushSize}${mode}`;
}

function updateHoverInfoAt(evt) {
  if (!hoverInfo) return;
  const { cx, cy } = screenToCell(evt.clientX, evt.clientY);
  if (cx<0||cy<0||cx>=gridW||cy>=gridH) { hoverInfo.textContent = ''; return; }
  const hex = grid[cy][cx];
  const name = nameForHex(hex);
  const sw = hex ? `<span style=\"display:inline-block;width:12px;height:12px;background:${hex};border:1px solid rgba(255,255,255,0.3);\"></span> ` : '';
  hoverInfo.innerHTML = `${sw}${name} @ (${cx}, ${cy})`;
}

function exportPNG() {
  const out = document.createElement('canvas');
  out.width = gridW; out.height = gridH;
  const octx = out.getContext('2d');
  const img = octx.createImageData(gridW, gridH);
  for (let y=0;y<gridH;y++) {
    for (let x=0;x<gridW;x++) {
      const i = (y*gridW+x)*4;
      const hex = grid[y][x];
      if (!hex) { img.data[i+3] = 0; continue; }
      const r = parseInt(hex.slice(1,3),16);
      const g = parseInt(hex.slice(3,5),16);
      const b = parseInt(hex.slice(5,7),16);
      img.data[i] = r; img.data[i+1] = g; img.data[i+2] = b; img.data[i+3] = 255;
    }
  }
  octx.putImageData(img,0,0);
  const url = out.toDataURL('image/png');
  const a = document.createElement('a');
  a.download = 'map.png'; a.href = url; a.click();
}

// init
ensureGrid();
buildPalette();
buildLegendPanel();
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
canvas.addEventListener('mousedown', (e)=>{
  drawing=true;
  actionActive = true;
  // Only push history if this action will modify content (not eyedropper)
  if (!(e.altKey || eyeMode)) pushHistory();
  paintAt(e);
  updateHoverInfoAt(e);
});
canvas.addEventListener('mousemove', (e)=>{ if (drawing) paintAt(e); updateHoverInfoAt(e); });
window.addEventListener('mouseup', ()=> { drawing=false; actionActive = false; updateUndoRedoState(); });
expBtn.addEventListener('click', exportPNG);
resizeBtn.addEventListener('click', ()=>{ gridW = parseInt(wInput.value,10)||gridW; gridH = parseInt(hInput.value,10)||gridH; ensureGrid(); draw(); });
importInput.addEventListener('change', (e)=>{
  const file = e.target.files && e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const img = new Image(); img.onload = ()=>{
      gridW = img.width; gridH = img.height; ensureGrid();
      const c = document.createElement('canvas'); c.width=img.width; c.height=img.height; const g=c.getContext('2d'); g.drawImage(img,0,0);
      const {data} = g.getImageData(0,0,c.width,c.height);
      for (let y=0;y<gridH;y++){
        for (let x=0;x<gridW;x++){
          const i=(y*gridW+x)*4; const a=data[i+3]; if (a===0){ grid[y][x]=null; continue; }
          const r=data[i], gg=data[i+1], b=data[i+2];
          grid[y][x] = rgbToHex(r,gg,b);
        }
      }
      wInput.value = gridW; hInput.value = gridH; draw();
    }; img.src = reader.result;
  };
  reader.readAsDataURL(file);
});
brushInput.addEventListener('change', ()=>{ brushSize = Math.max(1, parseInt(brushInput.value,10)||1); updateBrushInfo(); });
floodChk.addEventListener('change', ()=>{ floodMode = !!floodChk.checked; updateBrushInfo(); });
if (undoBtn) undoBtn.addEventListener('click', doUndo);
if (redoBtn) redoBtn.addEventListener('click', doRedo);
// Build a simple eyedropper SVG cursor data URI
const eyeCursor = (() => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>
    <path fill='white' d='M3 21l3-1 9.7-9.7-2.3-2.3L3 17v4z' opacity='0.9'/>
    <path fill='white' d='M15.1 3.9l5 5-1.4 1.4-5-5z' opacity='0.9'/>
  </svg>`;
  return `url("data:image/svg+xml;utf8,${svg.replace(/\n/g,'').replace(/#/g,'%23').replace(/\s+/g,' ')}") 2 2, crosshair`;
})();

function applyCursor() {
  if (eyeMode) { canvas.style.cursor = eyeCursor; return; }
  canvas.style.cursor = 'crosshair';
}

window.addEventListener('keydown', (e)=>{
  if (e.code === 'KeyE') { eyeMode = !eyeMode; applyCursor(); updateBrushInfo(); }
  if (e.altKey) { canvas.style.cursor = eyeCursor; }
  // Undo/Redo shortcuts
  if (e.ctrlKey && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); doUndo(); }
  if ((e.ctrlKey && e.shiftKey && (e.key === 'z' || e.key === 'Z')) || (e.ctrlKey && (e.key === 'y' || e.key === 'Y'))) { e.preventDefault(); doRedo(); }
});
window.addEventListener('keyup', ()=>{ if (!eyeMode) applyCursor(); });

function rgbToHex(r,g,b) {
  const to2=n=>n.toString(16).padStart(2,'0');
  return `#${to2(r)}${to2(g)}${to2(b)}`.toUpperCase();
}

// Initialize brush info display
updateBrushInfo();
updateUndoRedoState();
