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

// State
let gridW = parseInt(wInput.value, 10) || 80;
let gridH = parseInt(hInput.value, 10) || 60;
let currentColor = '#4CAF50';
let drawing = false;
let floodMode = false;
let brushSize = 1;
let grid = null; // Uint32 RGBA pixels for export, but we store as hex strings per cell

const palette = defaultBitmapPalette();
const colors = Object.keys(palette);

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
  colors.forEach(hex => {
    const div = document.createElement('div');
    div.className = 'color' + (currentColor===hex?' active':'');
    div.style.background = hex;
    div.title = hex;
    div.addEventListener('click', ()=>{ currentColor = hex; buildPalette();});
    palEl.appendChild(div);
  });
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
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
canvas.addEventListener('mousedown', (e)=>{ drawing=true; paintAt(e); });
canvas.addEventListener('mousemove', (e)=>{ if (drawing) paintAt(e); });
window.addEventListener('mouseup', ()=> drawing=false);
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
brushInput.addEventListener('change', ()=>{ brushSize = Math.max(1, parseInt(brushInput.value,10)||1); });
floodChk.addEventListener('change', ()=>{ floodMode = !!floodChk.checked; });

function rgbToHex(r,g,b) {
  const to2=n=>n.toString(16).padStart(2,'0');
  return `#${to2(r)}${to2(g)}${to2(b)}`.toUpperCase();
}
