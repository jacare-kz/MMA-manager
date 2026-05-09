// Quick targeted fixes — no full re-extraction
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const DIR = 'Public/Fighters/sprites';
const COLS = 4, ROWS = 2;
const POSES = ['idle','jab','kick','guard','takedown','ground_control','defeat','ko'];

const POSE_POS = {};
POSES.forEach((p, i) => { POSE_POS[p] = { col: i % COLS, row: Math.floor(i / COLS) }; });

async function cropPNG(fighter, pose, left, top, right, bottom) {
  const file = `${DIR}/${fighter}_${pose}.png`;
  if (!fs.existsSync(file)) return;
  const img = await loadImage(file);
  const w = img.width - left - right, h = img.height - top - bottom;
  if (w <= 0 || h <= 0) return;
  const canvas = createCanvas(w, h);
  canvas.getContext('2d').drawImage(img, -left, -top);
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
  console.log(`  crop ${pose}: ${img.width}×${img.height} → ${w}×${h}`);
}

function removeBackground(ctx, w, h, tolerance = 40) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  function getPixel(x, y) { const i=(y*w+x)*4; return [d[i],d[i+1],d[i+2],d[i+3]]; }
  function colorDist(a, b) { return Math.sqrt((a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2); }
  const corners = [
    getPixel(0,0),getPixel(w-1,0),getPixel(0,h-1),getPixel(w-1,h-1),
    getPixel(w>>1,0),getPixel(0,h>>1),getPixel(w-1,h>>1),getPixel(w>>1,h-1),
    getPixel(w>>2,0),getPixel(w*3>>2,0),getPixel(w>>2,h-1),getPixel(w*3>>2,h-1),
  ];
  const visited = new Uint8Array(w*h);
  const queue = [];
  for (let x=0;x<w;x++){queue.push(x,0);queue.push(x,h-1);}
  for (let y=0;y<h;y++){queue.push(0,y);queue.push(w-1,y);}
  let qi=0;
  while (qi<queue.length) {
    const x=queue[qi++],y=queue[qi++];
    if (x<0||x>=w||y<0||y>=h) continue;
    const idx=y*w+x;
    if (visited[idx]) continue;
    const px=getPixel(x,y);
    if (px[3]===0){visited[idx]=1;continue;}
    if (!corners.some(c=>colorDist(px,c)<tolerance)) continue;
    visited[idx]=1; d[idx*4+3]=0;
    queue.push(x+1,y,x-1,y,x,y+1,x,y-1);
  }
  ctx.putImageData(img,0,0);
}

function autoCrop(ctx, w, h) {
  const img = ctx.getImageData(0,0,w,h), d = img.data;
  let minX=w,maxX=0,minY=h,maxY=0;
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    if (d[(y*w+x)*4+3]>10){
      if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y;
    }
  }
  if (minX>maxX||minY>maxY) return createCanvas(4,4);
  const pad=8;
  minX=Math.max(0,minX-pad); minY=Math.max(0,minY-pad);
  maxX=Math.min(w-1,maxX+pad); maxY=Math.min(h-1,maxY+pad);
  const cw=maxX-minX+1, ch=maxY-minY+1;
  const out=createCanvas(cw,ch);
  out.getContext('2d').putImageData(ctx.getImageData(minX,minY,cw,ch),0,0);
  return out;
}

// Re-extract a pose from source with expanded frame boundaries
// dLeft/dRight/dTop/dBottom: positive = expand outward (negative = shrink)
async function reextract(fighter, pose, dLeft=0, dRight=0, dTop=0, dBottom=0, tolerance=40) {
  const src = path.join(__dirname, 'Public/Fighters', fighter + '.png');
  const sheet = await loadImage(src);
  const FW = Math.floor(sheet.width / COLS);
  const FH = Math.floor(sheet.height / ROWS);
  const { col, row } = POSE_POS[pose];

  const sx = Math.max(0, col * FW - dLeft);
  const sy = Math.max(0, row * FH - dTop);
  const ex = Math.min(sheet.width,  col * FW + FW + dRight);
  const ey = Math.min(sheet.height, row * FH + FH + dBottom);
  const fw = ex - sx, fh = ey - sy;

  const canvas = createCanvas(fw, fh);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(sheet, sx, sy, fw, fh, 0, 0, fw, fh);
  removeBackground(ctx, fw, fh, tolerance);
  const cropped = autoCrop(ctx, fw, fh);

  const outFile = `${DIR}/${fighter}_${pose}.png`;
  fs.writeFileSync(outFile, cropped.toBuffer('image/png'));
  console.log(`  reextract ${pose}: ${cropped.width}×${cropped.height}`);
}

// Zero out a rectangular region (make transparent)
async function clearRect(fighter, pose, rx, ry, rw, rh) {
  const file = `${DIR}/${fighter}_${pose}.png`;
  if (!fs.existsSync(file)) return;
  const img = await loadImage(file);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height);
  const d = data.data, w = img.width;
  const x2 = Math.min(rx + rw, img.width), y2 = Math.min(ry + rh, img.height);
  for (let y = ry; y < y2; y++) for (let x = rx; x < x2; x++) d[(y*w+x)*4+3] = 0;
  ctx.putImageData(data, 0, 0);
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
  console.log(`  clearRect ${pose}: (${rx},${ry} ${rw}×${rh})`);
}

// Remove white fringe — edge pixels blended with white background
// Uses min(R,G,B) so it catches mixed white even if one channel is lower
async function removeWhiteHalo(fighter, pose, minThreshold = 185, passes = 6) {
  const file = `${DIR}/${fighter}_${pose}.png`;
  if (!fs.existsSync(file)) return;
  const img = await loadImage(file);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const w = img.width, h = img.height;
  for (let pass = 0; pass < passes; pass++) {
    const data = ctx.getImageData(0, 0, w, h), d = data.data;
    const kill = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i+3] < 10) continue;
      if (Math.min(d[i], d[i+1], d[i+2]) < minThreshold) continue;
      const hasT = [
        x > 0   && d[((y*w+x-1)*4)+3] < 10,
        x < w-1 && d[((y*w+x+1)*4)+3] < 10,
        y > 0   && d[(((y-1)*w+x)*4)+3] < 10,
        y < h-1 && d[(((y+1)*w+x)*4)+3] < 10,
      ].some(Boolean);
      if (hasT) kill[y*w+x] = 1;
    }
    for (let i = 0; i < w*h; i++) if (kill[i]) d[i*4+3] = 0;
    ctx.putImageData(data, 0, 0);
  }
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
}

// Remove white blobs that are enclosed / touching transparent (aggressive)
async function removeWhiteArtifacts(fighter, pose, threshold = 200) {
  const file = `${DIR}/${fighter}_${pose}.png`;
  if (!fs.existsSync(file)) return;
  const img = await loadImage(file);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const w = img.width, h = img.height;
  for (let pass = 0; pass < 6; pass++) {
    const data = ctx.getImageData(0, 0, w, h), d = data.data;
    const kill = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i+3] < 10) continue;
      if (d[i] < threshold || d[i+1] < threshold || d[i+2] < threshold) continue;
      const hasT = [
        x > 0   && d[((y*w+x-1)*4)+3] < 10,
        x < w-1 && d[((y*w+x+1)*4)+3] < 10,
        y > 0   && d[(((y-1)*w+x)*4)+3] < 10,
        y < h-1 && d[(((y+1)*w+x)*4)+3] < 10,
      ].some(Boolean);
      if (hasT) kill[y*w+x] = 1;
    }
    for (let i = 0; i < w*h; i++) if (kill[i]) d[i*4+3] = 0;
    ctx.putImageData(data, 0, 0);
  }
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
  console.log(`  white-clean ${pose}: done`);
}

const ALL_WHITE_BG = [
  'Khabib Nurmagomedov','Ilia Topuria','Islam Makhachev','Charles Oliveira',
  'Alex Pereira','Conor McGregor','Dustin Poirier','Israel Adesanya',
];
const ALL_POSES = ['idle','jab','kick','guard','takedown','ground_control','defeat','ko'];

(async () => {
  console.log('\n── Removing white halo from all white-bg fighters ──');
  for (const name of ALL_WHITE_BG) {
    for (const pose of ALL_POSES) {
      await removeWhiteHalo(name, pose, 185, 6);
    }
    console.log(`  done: ${name}`);
  }

  // Poirier: white shorts — re-extract with tight tolerance
  console.log('\n── Dustin Poirier (white shorts fixes) ──');
  await reextract('Dustin Poirier', 'jab',      0, 0, 0, 0, 15);
  await cropPNG  ('Dustin Poirier', 'jab',      0, 0, 35, 0);
  await reextract('Dustin Poirier', 'kick',     0, 0, 0, 0, 15);
  await cropPNG  ('Dustin Poirier', 'kick',    45, 0,  0, 0);
  await reextract('Dustin Poirier', 'takedown', 0, 0, 0, 0, 15);
  await cropPNG  ('Dustin Poirier', 'defeat',   0, 0, 25, 0);

  // Adesanya: white shorts jab + takedown fragment
  console.log('\n── Israel Adesanya (white shorts fixes) ──');
  await reextract('Israel Adesanya', 'jab',      0, 0, 0, 0, 15);
  await cropPNG  ('Israel Adesanya', 'jab',      0, 0, 35, 0);
  await cropPNG  ('Israel Adesanya', 'takedown', 0, 0, 30, 0);

  // ── Dricus DuPlessis ──
  console.log('\n── Dricus DuPlessis ──');
  await cropPNG  ('Dricus DuPlessis', 'jab',           0, 0, 30, 0);
  await reextract('Dricus DuPlessis', 'kick',          0, 0, 0, 0, 20);
  await cropPNG  ('Dricus DuPlessis', 'kick',         45, 0,  0, 0);
  await cropPNG  ('Dricus DuPlessis', 'guard',       130, 0,  0, 0);
  await cropPNG  ('Dricus DuPlessis', 'ground_control', 35, 0, 0, 0);

  // ── Sean Strickland ──
  console.log('\n── Sean Strickland ──');
  await cropPNG  ('Sean Strickland', 'jab',           0, 0, 25, 0);
  await reextract('Sean Strickland', 'kick',          0, 0, 0, 0, 15);
  await cropPNG  ('Sean Strickland', 'kick',         45, 0,  0, 0);
  await cropPNG  ('Sean Strickland', 'guard',       130, 0,  0, 0);
  await cropPNG  ('Sean Strickland', 'ground_control', 35, 0, 0, 0);

  // White halo removal for both
  console.log('\n── White halo cleanup ──');
  for (const name of ['Dricus DuPlessis', 'Sean Strickland']) {
    for (const pose of ALL_POSES) await removeWhiteHalo(name, pose, 185, 6);
    console.log(`  done: ${name}`);
  }

  console.log('\nDone!');
})().catch(console.error);
