// Extracts fighter poses from sprite sheet and removes background.
// Layout: 4 cols x 2 rows, frame size computed from image dimensions.
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

let FRAME_W = 512, FRAME_H = 512;
const COLS = 4, ROWS = 2;
const POSES = ['idle','jab','kick','guard','takedown','ground_control','defeat','ko'];

// Background removal: flood-fill from border pixels matching corner color.
function removeBackground(ctx, w, h, tolerance = 40) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  function getPixel(x, y) {
    const i = (y * w + x) * 4;
    return [d[i], d[i+1], d[i+2], d[i+3]];
  }
  function colorDist(a, b) {
    return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
  }

  // Sample background from many border points for robustness
  const corners = [
    getPixel(0, 0), getPixel(w-1, 0),
    getPixel(0, h-1), getPixel(w-1, h-1),
    getPixel(w>>1, 0), getPixel(0, h>>1),
    getPixel(w-1, h>>1), getPixel(w>>1, h-1),
    getPixel(w>>2, 0), getPixel(w*3>>2, 0),
    getPixel(w>>2, h-1), getPixel(w*3>>2, h-1),
  ];

  const visited = new Uint8Array(w * h);
  const queue = [];

  for (let x = 0; x < w; x++) { queue.push(x, 0); queue.push(x, h - 1); }
  for (let y = 0; y < h; y++) { queue.push(0, y); queue.push(w - 1, y); }

  let qi = 0;
  while (qi < queue.length) {
    const x = queue[qi++], y = queue[qi++];
    if (x < 0 || x >= w || y < 0 || y >= h) continue;
    const idx = y * w + x;
    if (visited[idx]) continue;
    const px = getPixel(x, y);
    if (px[3] === 0) { visited[idx] = 1; continue; }
    if (!corners.some(c => colorDist(px, c) < tolerance)) continue;
    visited[idx] = 1;
    d[idx * 4 + 3] = 0;
    queue.push(x+1,y, x-1,y, x,y+1, x,y-1);
  }

  ctx.putImageData(img, 0, 0);
}

// Keep only the largest connected blob of non-transparent pixels.
// This removes stray fragments bleeding in from adjacent frames.
function keepLargestBlob(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const total = w * h;
  const label = new Int32Array(total); // 0=unvisited, -1=transparent

  for (let i = 0; i < total; i++) {
    if (d[i * 4 + 3] < 10) label[i] = -1;
  }

  const components = [];
  let currentLabel = 1;
  const queue = [];

  for (let start = 0; start < total; start++) {
    if (label[start] !== 0) continue;
    const pixels = [];
    queue.length = 0;
    queue.push(start);
    label[start] = currentLabel;
    let qi = 0;
    while (qi < queue.length) {
      const idx = queue[qi++];
      pixels.push(idx);
      const x = idx % w, y = (idx / w) | 0;
      const neighbors = [
        x > 0   ? idx - 1 : -1,
        x < w-1 ? idx + 1 : -1,
        y > 0   ? idx - w : -1,
        y < h-1 ? idx + w : -1,
      ];
      for (const n of neighbors) {
        if (n >= 0 && label[n] === 0) { label[n] = currentLabel; queue.push(n); }
      }
    }
    components.push({ lbl: currentLabel, pixels });
    currentLabel++;
  }

  if (components.length === 0) return;

  // Keep largest, erase all others
  let largest = components[0];
  for (const c of components) if (c.pixels.length > largest.pixels.length) largest = c;

  for (const c of components) {
    if (c.lbl === largest.lbl) continue;
    for (const idx of c.pixels) d[idx * 4 + 3] = 0;
  }

  ctx.putImageData(img, 0, 0);
}

function autoCrop(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y*w+x)*4+3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (minX > maxX || minY > maxY) return createCanvas(4, 4);

  const pad = 8;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w-1, maxX + pad);
  maxY = Math.min(h-1, maxY + pad);

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const out = createCanvas(cw, ch);
  out.getContext('2d').putImageData(ctx.getImageData(minX, minY, cw, ch), 0, 0);
  return out;
}

async function extract(fighterName) {
  const src = path.join(__dirname, 'Public/Fighters', fighterName + '.png');
  const outDir = path.join(__dirname, 'Public/Fighters/sprites');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const sheet = await loadImage(src);
  FRAME_W = Math.floor(sheet.width / COLS);
  FRAME_H = Math.floor(sheet.height / ROWS);
  console.log(`Loaded ${fighterName}: ${sheet.width}x${sheet.height}  →  frame ${FRAME_W}x${FRAME_H}`);

  let frameIdx = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const pose = POSES[frameIdx++];
      const canvas = createCanvas(FRAME_W, FRAME_H);
      const ctx = canvas.getContext('2d');

      ctx.drawImage(sheet,
        col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H,
        0, 0, FRAME_W, FRAME_H
      );

      removeBackground(ctx, FRAME_W, FRAME_H);

      const cropped = autoCrop(ctx, FRAME_W, FRAME_H);
      const outFile = path.join(outDir, `${fighterName}_${pose}.png`);
      fs.writeFileSync(outFile, cropped.toBuffer('image/png'));
      console.log(`  Saved: ${fighterName}_${pose}.png  (${cropped.width}x${cropped.height})`);
    }
  }
}

async function extractNoRemoveBg(fighterName) {
  const src = path.join(__dirname, 'Public/Fighters', fighterName + '.png');
  const outDir = path.join(__dirname, 'Public/Fighters/sprites');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const sheet = await loadImage(src);
  FRAME_W = Math.floor(sheet.width / COLS);
  FRAME_H = Math.floor(sheet.height / ROWS);
  console.log(`Loaded ${fighterName}: ${sheet.width}x${sheet.height}  →  frame ${FRAME_W}x${FRAME_H}`);
  let frameIdx = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const pose = POSES[frameIdx++];
      const canvas = createCanvas(FRAME_W, FRAME_H);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(sheet, col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
      // No removeBackground — already transparent
      const cropped = autoCrop(ctx, FRAME_W, FRAME_H);
      const outFile = path.join(outDir, `${fighterName}_${pose}.png`);
      fs.writeFileSync(outFile, cropped.toBuffer('image/png'));
      console.log(`  Saved: ${fighterName}_${pose}.png  (${cropped.width}x${cropped.height})`);
    }
  }
}

// Run
const brownBgFighters = ['Yoel Romero', 'Jon Jones', 'Fedor Emelianenko', 'Georges St-Pierre'];
const transparentBgFighters = ['Mirko Cro Cop'];

(async () => {
  for (const name of brownBgFighters) await extract(name);
  for (const name of transparentBgFighters) await extractNoRemoveBg(name);
  console.log('\nAll done! Sprites in Public/Fighters/sprites/');
})().catch(console.error);
