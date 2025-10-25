export function isoToScreen(x, y, z, tileW, tileH, originX = 0, originY = 0) {
  const sx = (x - y) * (tileW / 2) + originX;
  const sy = (x + y) * (tileH / 2) - (z || 0) * tileH + originY;
  return { x: sx, y: sy };
}

export function screenToIso(sx, sy, tileW, tileH, originX = 0, originY = 0) {
  // Invert isoToScreen assuming z=0
  const dx = sx - originX;
  const dy = sy - originY;
  const tw2 = tileW / 2;
  const th2 = tileH / 2;
  const x = (dy / th2 + dx / tw2) / 2;
  const y = (dy / th2 - dx / tw2) / 2;
  return { x, y };
}

export function drawIsoTile(ctx, x, y, z, tileW, tileH, color, originX, originY) {
  const p = isoToScreen(x, y, z, tileW, tileH, originX, originY);
  const hw = tileW / 2;
  const hh = tileH / 2;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + hw, p.y + hh);
  ctx.lineTo(p.x, p.y + tileH);
  ctx.lineTo(p.x - hw, p.y + hh);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export function drawIsoImage(ctx, img, x, y, z, tileW, tileH, originX, originY, offsetY = 0) {
  const p = isoToScreen(x, y, z, tileW, tileH, originX, originY);
  // Center the sprite horizontally on the diamond center; place bottom at diamond bottom + offsetY
  const drawX = Math.round(p.x - img.width / 2);
  const drawY = Math.round(p.y + tileH - img.height + offsetY);
  ctx.drawImage(img, drawX, drawY);
}

export function drawIsoSubImage(ctx, img, sx, sy, sw, sh, x, y, z, tileW, tileH, originX, originY, offsetY = 0) {
  const p = isoToScreen(x, y, z, tileW, tileH, originX, originY);
  const drawX = Math.round(p.x - sw / 2);
  const drawY = Math.round(p.y + tileH - sh + offsetY);
  ctx.drawImage(img, sx, sy, sw, sh, drawX, drawY, sw, sh);
}
