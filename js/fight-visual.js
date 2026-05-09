/* ==============================================================
   APEX FC — Fight Visual Arena
   Canvas arena with pixel-art sprite fighters, particles,
   screen shake, and impact effects.
   ============================================================== */

class FightArena {
  constructor(container, redFighter, blueFighter) {
    this.W = 0; this.H = 0;
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'width:100%;display:block;border-radius:0;';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.redFighter  = new FighterRenderer(redFighter,  'red',  this);
    this.blueFighter = new FighterRenderer(blueFighter, 'blue', this);

    this.particles = [];
    this.flashes   = [];
    this.shakeX = 0; this.shakeY = 0;
    this.lastTs = 0;

    this.resize();
    this._resizeCb = () => this.resize();
    window.addEventListener('resize', this._resizeCb);

    this.rafId = requestAnimationFrame(ts => this.loop(ts));
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.W = Math.max(rect.width, 400);
    this.H = Math.round(this.W * 0.42);
    this.canvas.width  = this.W;
    this.canvas.height = this.H;
    if (this.redFighter)  this.redFighter.reposition(this.W, this.H);
    if (this.blueFighter) this.blueFighter.reposition(this.W, this.H);
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this._resizeCb);
  }

  loop(ts) {
    const dt = Math.min(ts - this.lastTs, 50);
    this.lastTs = ts;
    this.update(dt, ts);
    this.draw(ts);
    this.rafId = requestAnimationFrame(nts => this.loop(nts));
  }

  update(dt, ts) {
    this.redFighter.update(dt, ts);
    this.blueFighter.update(dt, ts);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x  += p.vx * dt / 16;
      p.y  += p.vy * dt / 16;
      p.vy += 0.4 * dt / 16;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].alpha -= dt / 120;
      if (this.flashes[i].alpha <= 0) this.flashes.splice(i, 1);
    }

    this.shakeX *= Math.pow(0.85, dt / 16);
    this.shakeY *= Math.pow(0.85, dt / 16);
    if (Math.abs(this.shakeX) < 0.1) this.shakeX = 0;
    if (Math.abs(this.shakeY) < 0.1) this.shakeY = 0;
  }

  draw(ts) {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);
    this.drawBackground(ctx, W, H, ts);
    this.blueFighter.draw(ctx, ts);
    this.redFighter.draw(ctx, ts);
    this.drawParticles(ctx);
    this.drawFlashes(ctx, W, H);
    ctx.restore();
  }

  drawBackground(ctx, W, H, ts) {
    const floor = H * 0.78;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0,   '#0a0a0c');
    bg.addColorStop(0.6, '#0f0f14');
    bg.addColorStop(1,   '#080808');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += W / 18) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, floor * 0.7); ctx.stroke();
    }
    ctx.restore();

    const mat = ctx.createLinearGradient(0, floor - 10, 0, H);
    mat.addColorStop(0, '#1a1a20');
    mat.addColorStop(1, '#111116');
    ctx.fillStyle = mat;
    ctx.fillRect(0, floor - 10, W, H - floor + 10);

    ctx.save();
    ctx.strokeStyle = 'rgba(210,10,17,0.35)';
    ctx.lineWidth = 2;
    const cx = W / 2, cy = floor - 2;
    const rx = W * 0.38, ry = H * 0.06;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0);
    ctx.stroke();
    ctx.restore();

    const spR = ctx.createRadialGradient(W*0.28, H*0.1, 0, W*0.28, H*0.1, W*0.32);
    spR.addColorStop(0, 'rgba(255,200,160,0.07)');
    spR.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spR;
    ctx.fillRect(0, 0, W, H);

    const spB = ctx.createRadialGradient(W*0.72, H*0.1, 0, W*0.72, H*0.1, W*0.32);
    spB.addColorStop(0, 'rgba(160,180,255,0.07)');
    spB.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spB;
    ctx.fillRect(0, 0, W, H);

    this.drawCrowd(ctx, W, H, floor, ts);

    ctx.fillStyle = 'rgba(210,10,17,0.5)';
    ctx.fillRect(0, floor - 2, W, 2);
  }

  drawCrowd(ctx, W, H, floor, ts) {
    ctx.save();
    const crowdH = floor * 0.55;
    const seed_heads = [
      0.05,0.09,0.14,0.19,0.23,0.28,0.32,0.37,0.41,0.45,0.49,0.53,0.57,0.62,0.66,0.70,0.74,0.78,0.82,0.87,0.91,0.96,
      0.07,0.12,0.17,0.22,0.26,0.30,0.34,0.39,0.43,0.47,0.51,0.55,0.59,0.64,0.68,0.72,0.76,0.80,0.84,0.89,0.93,0.98,
    ];
    seed_heads.forEach((xf, i) => {
      const row = Math.floor(i / 22);
      const bob = Math.sin(ts * 0.001 + xf * 40) * 1.5;
      const baseY = crowdH * (0.75 + row * 0.12) + bob;
      const headR = 6 + (xf * 7) % 4;
      const bright = 20 + (xf * 60) % 30;
      ctx.fillStyle = `rgb(${bright},${bright},${bright+4})`;
      ctx.beginPath();
      ctx.arc(xf * W, baseY, headR, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.restore();
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawFlashes(ctx, W, H) {
    for (const f of this.flashes) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.alpha);
      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  // ---- Public event API ----
  triggerEvent(ev) {
    if (!ev.text) return;
    const actor = ev.actor;
    if (!actor) return;

    const attacker = actor === 'red' ? this.redFighter : this.blueFighter;
    const defender = actor === 'red' ? this.blueFighter : this.redFighter;

    const t = ev.text.toLowerCase();

    if (t.includes('нокаут') || t.includes('нокдаун') || t.includes('падает')) {
      attacker.playAnim('heavy_punch');
      defender.playAnim('knockdown');
      this.shake(18, 12);
      this.addImpact(defender.x, defender.groundY - defender.targetH * 0.65, 30, '#ff4422', '#ffaa22');
      this.addFlash('#ff220022', 0.35);
      return;
    }
    if (t.includes('тейкдаун') || t.includes('партер') || t.includes('проход')) {
      attacker.playAnim('takedown');
      defender.playAnim('taken_down');
      this.shake(8, 6);
      return;
    }
    if (t.includes('хай-кик') || t.includes('ногой в голову')) {
      attacker.playAnim('high_kick');
      defender.playAnim('hit_head');
      this.shake(6, 4);
      this.addImpact(defender.x, defender.groundY - defender.targetH * 0.72, 18, '#ffdd44', '#ffffff');
      return;
    }
    if (t.includes('кик') || t.includes('нога') || t.includes('лоу') || t.includes('миддл')) {
      attacker.playAnim('kick');
      if (ev.big) {
        defender.playAnim('hit_body');
        this.addImpact(defender.x, defender.groundY - defender.targetH * 0.45, 10, '#ffaa44', '#ffffff');
      }
      return;
    }
    if (t.includes('апперкот')) {
      attacker.playAnim('uppercut');
      if (ev.big) { defender.playAnim('hit_head'); this.shake(5,3); this.addImpact(defender.x, defender.groundY - defender.targetH*0.7, 14, '#ffcc44','#ffffff'); }
      return;
    }
    if (t.includes('хук')) {
      attacker.playAnim('hook');
      if (ev.big) { defender.playAnim('hit_head'); this.shake(4,2); this.addImpact(defender.x, defender.groundY - defender.targetH*0.68, 12, '#ffcc44','#ffffff'); }
      return;
    }
    if (t.includes('кросс') || t.includes('прямой') || t.includes('правой') || t.includes('левой')) {
      attacker.playAnim('cross');
      if (ev.big) { defender.playAnim('hit_head'); this.addImpact(defender.x, defender.groundY - defender.targetH*0.66, 10, '#ffffaa','#ffffff'); }
      return;
    }
    if (t.includes('джеб')) {
      attacker.playAnim('jab');
      return;
    }
    if (t.includes('коленом')) {
      attacker.playAnim('knee');
      if (ev.big) { defender.playAnim('hit_body'); this.addImpact(defender.x, defender.groundY - defender.targetH*0.45, 8, '#ffaa44','#ffffff'); }
      return;
    }
    if (ev.big) {
      attacker.playAnim('cross');
      defender.playAnim('hit_head');
      this.addImpact(defender.x, defender.groundY - defender.targetH*0.64, 8, '#ffcc88','#ffffff');
    }
  }

  shake(x, y) {
    const dir = Math.random() > 0.5 ? 1 : -1;
    this.shakeX += (Math.random() * x + x/2) * dir;
    this.shakeY += (Math.random() * y + y/2) * (Math.random() > 0.5 ? 1 : -1);
  }

  addImpact(x, y, count, col1, col2) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      const life  = 200 + Math.random() * 200;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        r: 2 + Math.random() * 3,
        color: Math.random() > 0.5 ? col1 : col2,
        life, maxLife: life,
      });
    }
  }

  addFlash(color, alpha) {
    this.flashes.push({ color, alpha });
  }

  // Call before destroy() to show final result poses
  freeze(winnerCorner) {
    const winner = winnerCorner === 'red' ? this.redFighter : this.blueFighter;
    const loser  = winnerCorner === 'red' ? this.blueFighter : this.redFighter;
    winner.currentPose = 'idle';
    winner.poseTimer   = 0;
    winner.poseDur     = 0;
    loser.currentPose  = 'ko';
    loser.poseTimer    = 0;
    loser.poseDur      = 999999; // stay down
  }
}

/* ==============================================================
   Fighter Renderer — draws a fighter using pixel-art sprites.
   Sprites live in Public/Fighters/sprites/[name]_[pose].png.
   Falls back to a styled silhouette when no sprites are found.
   ============================================================== */

class FighterRenderer {
  constructor(fighter, corner, arena) {
    this.fighter  = fighter;
    this.corner   = corner;
    this.arena    = arena;

    this.x        = 0;
    this.groundY  = 0;
    this.targetH  = 180;

    this.sprites     = {};   // pose → HTMLImageElement
    this.currentPose = 'idle';
    this.poseTimer   = 0;
    this.poseDur     = 0;

    this.idlePhase = Math.random() * Math.PI * 2;
    this.hasSprites = false;

    this._loadSprites();
  }

  _loadSprites() {
    const name  = this.fighter.name;
    const poses = ['idle', 'jab', 'kick', 'guard', 'takedown', 'ground_control', 'defeat', 'ko'];
    for (const pose of poses) {
      const img = new Image();
      img.onload = () => { this.sprites[pose] = img; this.hasSprites = true; };
      img.onerror = () => {
        const def = new Image();
        def.onload = () => { this.sprites[pose] = def; this.hasSprites = true; };
        def.src = `Public/Fighters/sprites/default_${pose}.png`;
      };
      img.src = `Public/Fighters/sprites/${name}_${pose}.png`;
    }
  }

  reposition(W, H) {
    this.groundY = H * 0.78;
    this.targetH = H * 0.65;
    this.x = this.corner === 'red' ? W * 0.28 : W * 0.72;
  }

  playAnim(animName) {
    const map = {
      jab:           ['jab',           600],
      cross:         ['jab',           600],
      hook:          ['jab',           580],
      uppercut:      ['jab',           580],
      heavy_punch:   ['jab',           750],
      kick:          ['kick',          700],
      high_kick:     ['kick',          800],
      knee:          ['kick',          620],
      takedown:      ['takedown',      900],
      taken_down:    ['defeat',        900],
      hit_head:      ['guard',         700],
      hit_body:      ['guard',         700],
      knockdown:     ['defeat',       1200],
      knockdown_ko:  ['ko',           2000],
      ground_top:    ['ground_control', 800],
    };
    const [pose, dur] = map[animName] || ['idle', 300];
    this.currentPose = pose;
    this.poseTimer   = 0;
    this.poseDur     = dur;
  }

  update(dt) {
    if (this.currentPose !== 'idle') {
      this.poseTimer += dt;
      if (this.poseTimer >= this.poseDur) {
        this.currentPose = 'idle';
        this.poseTimer   = 0;
      }
    }
  }

  draw(ctx, ts) {
    const isGround = this.currentPose === 'ground';
    const bob = Math.sin(ts * 0.002 + this.idlePhase) * (isGround ? 0 : 3);

    ctx.save();
    ctx.translate(this.x, this.groundY + bob);
    if (this.corner === 'blue') ctx.scale(-1, 1);

    if (this.hasSprites) {
      this._drawSprite(ctx);
    } else {
      this._drawFallback(ctx);
    }

    ctx.restore();
  }

  _drawSprite(ctx) {
    const sprite = this.sprites[this.currentPose] || this.sprites['idle'];
    if (!sprite) { this._drawFallback(ctx); return; }

    // Scale all poses consistently using idle height as reference
    const ref = this.sprites['idle'] || sprite;
    const scale = this.targetH / ref.height;
    const h = sprite.height * scale;
    const w = sprite.width * scale;

    // Ground shadow ellipse
    ctx.save();
    const sg = ctx.createRadialGradient(0, -6, 0, 0, -6, w * 0.48);
    sg.addColorStop(0, 'rgba(0,0,0,0.45)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(0, -6, w * 0.48, h * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Subtle spotlight glow (neutral warm light, not corner color)
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = 'rgba(255,230,160,0.5)';
    ctx.drawImage(sprite, -w / 2, -h, w, h);
    ctx.restore();

    // Clean sprite on top
    ctx.drawImage(sprite, -w / 2, -h, w, h);
  }

  _drawFallback(ctx) {
    // Styled silhouette + corner initial when no sprites available
    const h = this.targetH;
    const w = h * 0.32;
    const color = this.corner === 'red' ? '#d20a11' : '#2563eb';
    const glowColor = this.corner === 'red' ? 'rgba(210,10,17,0.8)' : 'rgba(59,130,246,0.8)';

    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = glowColor;

    // Body
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.rect(-w/2, -h * 0.78, w, h * 0.55);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(0, -h * 0.88, h * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Name initial
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.9;
    ctx.font = `bold ${Math.round(h * 0.12)}px JetBrains Mono, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials(this.fighter.name), 0, -h * 0.52);
    ctx.restore();

    // Ground shadow
    const sg = ctx.createRadialGradient(0, -4, 0, 0, -4, w * 0.7);
    sg.addColorStop(0, 'rgba(0,0,0,0.35)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(0, -4, w * 0.7, h * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- Math helpers ----
function lerp(a, b, t) { return a + (b - a) * t; }
function easeOutQuad(t)   { return 1 - (1-t)*(1-t); }
function easeInOutQuad(t) { return t < 0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }
