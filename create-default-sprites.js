// Берёт спрайты Khabib Nurmagomedov, делает их чёрным силуэтом, сохраняет как default_*.png
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const POSES = ['idle', 'jab', 'kick', 'guard', 'takedown', 'ground_control', 'defeat', 'ko'];
const SRC = 'Public/Fighters/sprites/Khabib Nurmagomedov';
const OUT = 'Public/Fighters/sprites';

(async () => {
  for (const pose of POSES) {
    const src = `${SRC}_${pose}.png`;
    if (!fs.existsSync(src)) { console.log('SKIP', src); continue; }
    const img = await loadImage(src);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < d.data.length; i += 4) {
      if (d.data[i + 3] > 10) { // visible pixel → make dark
        d.data[i] = 20; d.data[i+1] = 20; d.data[i+2] = 25;
      }
    }
    ctx.putImageData(d, 0, 0);
    const out = path.join(OUT, `default_${pose}.png`);
    fs.writeFileSync(out, canvas.toBuffer('image/png'));
    console.log('OK', out);
  }
})();
