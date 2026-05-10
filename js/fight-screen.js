/* ==============================================================
   APEX FC — Fight Visualization (broadcast)
   Plays back the timed event stream from simulateFight().
   ============================================================== */

class FightScreen {
  constructor(root, redFighter, blueFighter, opts = {}) {
    this.root = root;
    this.red = redFighter;
    this.blue = blueFighter;
    this.opts = opts;
    this.speed = 1; // 1, 2, 4, or 0 = instant
    this.paused = false;
    this.events = null;
    this.idx = 0;
    this.finished = false;
    this.timer = null;
  }

  mount() {
    this.root.innerHTML = '';
    this.root.appendChild(this.buildShell());
    const sim = simulateFight(this.red, this.blue, this.opts);
    this.events = sim.events;
    this.simResult = sim;
    // Init visual arena after shell is in DOM
    const arenaWrap = $('#arenaWrap', this.shell);
    this.arena = new FightArena(arenaWrap, this.red, this.blue);
    this.play();
  }

  buildShell() {
    const wrap = el('section', { class:'fight-screen' });

    // Compact top bar: fighter names + round + timer
    const topBar = el('div', { class:'fight-topbar' },
      el('div', { class:'fight-name red' },
        el('span', { class:'fight-corner-tag' }, 'RED'),
        el('span', { class:'fight-name-text' }, this.red.name),
        el('span', { class:'fight-record-sm' }, recordStr(this.red.record)),
      ),
      el('div', { class:'fight-center' },
        el('div', { class:'round' }, 'РАУНД'),
        el('div', { class:'round-num', id:'roundNum' }, '1'),
        el('div', { class:'timer', id:'roundTimer' }, '5:00'),
      ),
      el('div', { class:'fight-name blue' },
        el('span', { class:'fight-record-sm' }, recordStr(this.blue.record)),
        el('span', { class:'fight-name-text' }, this.blue.name),
        el('span', { class:'fight-corner-tag' }, 'BLUE'),
      ),
    );
    wrap.appendChild(topBar);

    // HP / stamina bars
    const bars = el('div', { class:'bars' },
      el('div', { class:'bars-col red' },
        this.barRow('HP', 'redHP'),
        this.barRow('STAMINA', 'redStam', true),
      ),
      el('div', { class:'bars-col blue' },
        this.barRow('HP', 'blueHP'),
        this.barRow('STAMINA', 'blueStam', true),
      ),
    );
    wrap.appendChild(bars);

    // Visual arena canvas
    const arenaWrap = el('div', { id:'arenaWrap', class:'arena-wrap' });
    wrap.appendChild(arenaWrap);

    // Feed + stats
    const feedWrap = el('div', { class:'feed-wrap' },
      el('div', { class:'feed', id:'feed' }),
      this.statsPanel(),
    );
    wrap.appendChild(feedWrap);

    // Controls
    const ctrls = el('div', { class:'fight-controls' },
      el('button', { class:'ctrl-btn', id:'btnPause', onclick: () => this.togglePause() }, 'ПАУЗА'),
      el('button', { class:'ctrl-btn active', id:'btnSpeed1', onclick: () => this.setSpeed(1) }, '1×'),
      el('button', { class:'ctrl-btn', id:'btnSpeed2', onclick: () => this.setSpeed(2) }, '2×'),
      el('button', { class:'ctrl-btn', id:'btnSpeed4', onclick: () => this.setSpeed(4) }, '4×'),
      el('button', { class:'ctrl-btn', id:'btnInstant', onclick: () => this.setSpeed(0) }, 'МГНОВЕННО'),
    );
    wrap.appendChild(ctrls);

    this.shell = wrap;
    return wrap;
  }

  fighterCard(corner, f) {
    return el('div', { class:`fight-fighter ${corner}` },
      el('div', { class:'portrait-lg' }, initials(f.name)),
      el('div', { class:'name-block' },
        el('div', { class:'corner-tag' }, `${corner === 'red' ? 'RED CORNER' : 'BLUE CORNER'} // ${f.country}`),
        el('h2', {}, f.name),
        el('div', { class:'rec-line' }, `${recordStr(f.record)} • OVR ${ovr(f.stats)} • ${f.style.toUpperCase()}`),
      ),
    );
  }

  barRow(label, id, isStam = false) {
    return el('div', { class:'bar-row' },
      el('div', { class:'bar-label' },
        el('span', {}, label),
        el('span', { id: id + 'val' }, '100'),
      ),
      el('div', { class:'bar-track' },
        el('div', { class: 'bar-fill ' + (isStam ? 'stamina' : 'hp'), id: id + 'fill', style:'width:100%' }),
      ),
    );
  }

  statsPanel() {
    const panel = el('div', { class:'stats-panel' },
      el('h4', {}, 'STATISTICS'),
      this.statTwoSide('STRIKES',     'redStrikes', 'blueStrikes'),
      this.statTwoSide('SIG. STRIKES','redSig',     'blueSig'),
      this.statTwoSide('TAKEDOWNS',   'redTd',      'blueTd'),
      this.statTwoSide('SUB ATTEMPTS','redSub',     'blueSub'),
      this.statTwoSide('CONTROL (s)', 'redCtrl',    'blueCtrl'),
      this.statTwoSide('DAMAGE',      'redDmg',     'blueDmg'),
      this.statTwoSide('KNOCKDOWNS',  'redKD',      'blueKD'),
    );
    return panel;
  }

  statTwoSide(label, redId, blueId) {
    return el('div', {},
      el('div', { class:'twoside-row stat-line' },
        el('span', { class:'red-val', id:redId }, '0'),
        el('span', { class:'lbl' }, label),
        el('span', { class:'blue-val', id:blueId }, '0'),
      ),
      el('div', { class:'stat-bar-twoside' },
        el('div', { class:'red-side',  id:redId  + 'Bar', style:'width:0%' }),
        el('div', { class:'blue-side', id:blueId + 'Bar', style:'width:0%' }),
      ),
    );
  }

  // ====== Playback ======
  play() {
    if (this.finished) return;
    if (this.paused) return;
    this.scheduleNext();
  }

  scheduleNext() {
    if (this.idx >= this.events.length || this.finished) {
      this.finalize();
      return;
    }
    const ev = this.events[this.idx];
    let delay;
    if (this.speed === 0) {
      delay = 0;
    } else {
      // Choose pacing based on event importance, scaled by speed
      const baseDelay = ev.big ? 1100 : 700;
      delay = baseDelay / this.speed;
    }
    this.timer = setTimeout(() => this.consumeEvent(), delay);
  }

  consumeEvent() {
    if (this.paused) return;
    const ev = this.events[this.idx++];
    this.applyEvent(ev);
    this.scheduleNext();
  }

  applyEvent(ev) {
    // Fire visual arena
    if (this.arena) this.arena.triggerEvent(ev);

    // Round number / timer
    if (ev.type === 'ROUND_START' && ev.round) {
      $('#roundNum', this.shell).textContent = String(ev.round);
    }
    if (ev.t != null && ev.round != null) {
      const roundStart = (ev.round - 1) * 300;
      const roundElapsed = ev.t - roundStart;
      const remaining = clamp(300 - roundElapsed, 0, 300);
      $('#roundTimer', this.shell).textContent = fmtTime(remaining);
    }

    // Snapshot bars/stats
    if (ev.snap) {
      this.updateBars(ev.snap);
      this.updateStats(ev.snap);
    }

    // Commentary line
    if (ev.text) this.addLine(ev);

    // Flash
    if (ev.flash) {
      this.shell.classList.remove('flash-red', 'flash-blue');
      void this.shell.offsetWidth;
      this.shell.classList.add(ev.flash === 'red' ? 'flash-red' : 'flash-blue');
    }

    // Fight end
    if (ev.type === 'FIGHT_END') {
      this.finished = true;
      setTimeout(() => this.showFinish(ev.result), 600);
    }
  }

  addLine(ev) {
    const feed = $('#feed', this.shell);
    const tsTxt = ev.round ? `R${ev.round} ${fmtTime(300 - ((ev.t - (ev.round-1)*300)))}` : '—';
    const cls = 'text' + (ev.kind === 'huge' ? ' huge' : ev.kind === 'big' || ev.big ? ' big' : '');
    const line = el('div', { class:'line' },
      el('span', { class:'ts' }, tsTxt),
      el('span', { class: cls, html: ev.text }),
    );
    feed.appendChild(line);
    feed.scrollTop = feed.scrollHeight;
    // Cap feed entries
    while (feed.childElementCount > 80) feed.removeChild(feed.firstChild);
  }

  updateBars(snap) {
    setBar(this.shell, 'redHP', snap.redHP);
    setBar(this.shell, 'blueHP', snap.blueHP);
    setBar(this.shell, 'redStam', snap.redStam);
    setBar(this.shell, 'blueStam', snap.blueStam);
  }

  updateStats(snap) {
    const r = snap.redStats, b = snap.blueStats;
    setText(this.shell, 'redStrikes',  `${r.strikes_landed}/${r.strikes_attempted}`);
    setText(this.shell, 'blueStrikes', `${b.strikes_landed}/${b.strikes_attempted}`);
    setText(this.shell, 'redSig',      r.sig_strikes);
    setText(this.shell, 'blueSig',     b.sig_strikes);
    setText(this.shell, 'redTd',       `${r.takedowns_landed}/${r.takedowns_attempted}`);
    setText(this.shell, 'blueTd',      `${b.takedowns_landed}/${b.takedowns_attempted}`);
    setText(this.shell, 'redSub',      r.sub_attempts);
    setText(this.shell, 'blueSub',     b.sub_attempts);
    setText(this.shell, 'redCtrl',     r.control_seconds);
    setText(this.shell, 'blueCtrl',    b.control_seconds);
    setText(this.shell, 'redDmg',      r.damage_dealt);
    setText(this.shell, 'blueDmg',     b.damage_dealt);
    setText(this.shell, 'redKD',       r.knockdowns);
    setText(this.shell, 'blueKD',      b.knockdowns);

    // Two-side bars: relative
    setTwoSide(this.shell, 'redStrikes', 'blueStrikes', r.strikes_landed, b.strikes_landed);
    setTwoSide(this.shell, 'redSig', 'blueSig', r.sig_strikes, b.sig_strikes);
    setTwoSide(this.shell, 'redTd', 'blueTd', r.takedowns_landed, b.takedowns_landed);
    setTwoSide(this.shell, 'redSub', 'blueSub', r.sub_attempts, b.sub_attempts);
    setTwoSide(this.shell, 'redCtrl', 'blueCtrl', r.control_seconds, b.control_seconds);
    setTwoSide(this.shell, 'redDmg', 'blueDmg', r.damage_dealt, b.damage_dealt);
    setTwoSide(this.shell, 'redKD', 'blueKD', r.knockdowns, b.knockdowns);
  }

  setSpeed(s) {
    this.speed = s;
    $$('.ctrl-btn', this.shell).forEach(b => b.classList.remove('active'));
    const id = s === 0 ? 'btnInstant' : `btnSpeed${s}`;
    if (s === 1) $('#btnSpeed1', this.shell).classList.add('active');
    else if (s === 2) $('#btnSpeed2', this.shell).classList.add('active');
    else if (s === 4) $('#btnSpeed4', this.shell).classList.add('active');
    else if (s === 0) $('#btnInstant', this.shell).classList.add('active');
    if (this.timer) { clearTimeout(this.timer); this.timer = null; this.scheduleNext(); }
  }

  togglePause() {
    this.paused = !this.paused;
    $('#btnPause', this.shell).textContent = this.paused ? 'ПРОДОЛЖИТЬ' : 'ПАУЗА';
    $('#btnPause', this.shell).classList.toggle('active', this.paused);
    if (!this.paused) this.scheduleNext();
    else if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  finalize() {
    // ensure overlay shown if it wasn't (defensive)
    if (!this.finished) this.finished = true;
  }

  showFinish(result) {
    if (this.arena) {
      if (result.winner && result.winner !== 'draw') {
        this.arena.freeze(result.winner);
      }
      const arenaRef = this.arena;
      setTimeout(() => arenaRef.destroy(), 4000);
      this.arena = null;
    }
    const wname = result.winner === 'red' ? this.red.name : result.winner === 'blue' ? this.blue.name : 'НИЧЬЯ';
    const methodLine = result.type === 'KO' ? 'НОКАУТ' :
                       result.type === 'TKO' ? 'ТЕХНИЧЕСКИЙ НОКАУТ' :
                       result.type === 'SUB' ? 'САБМИШН' :
                       result.type === 'UD' ? 'ЕДИНОГЛАСНОЕ РЕШЕНИЕ' :
                       result.type === 'SD' ? 'РАЗДЕЛЬНОЕ РЕШЕНИЕ' :
                       result.type === 'DRAW' ? 'НИЧЬЯ' : 'РЕШЕНИЕ';
    const detail = result.by ? `${result.by}` : '';
    const tline = result.cards ? `СУДЕЙСКИЕ КАРТЫ: ${result.cards}` :
                  result.round ? `Р${result.round} • ${fmtTime((result.t || 0) - (result.round-1)*300)}` : '';
    const overlay = el('div', { class:'finish-overlay' },
      el('div', { class:'finish-card' },
        el('div', { class:'label' }, 'ОФИЦИАЛЬНЫЙ РЕЗУЛЬТАТ'),
        el('div', { class:'winner' }, wname.toUpperCase()),
        el('div', { class:'method' }, methodLine + (detail && result.type !== 'DRAW' && result.type !== 'UD' && result.type !== 'SD' ? ` // ${detail}` : '')),
        el('div', { class:'timeline' }, tline),
        el('div', { class:'actions' },
          el('button', { class:'btn ghost', onclick: () => { overlay.remove(); } }, 'СМОТРЕТЬ ПОВТОР'),
          this.opts.onFightEnd
            ? el('button', { class:'btn gold', onclick: () => { overlay.remove(); this.opts.onFightEnd(result); } }, 'BACK TO CAREER')
            : el('button', { class:'btn', onclick: () => { overlay.remove(); navigateTo('matchmaker'); } }, 'НОВЫЙ БОЙ'),
        ),
      ),
    );
    document.body.appendChild(overlay);
  }
}

// ====== Bar/stat helpers ======
function setBar(root, id, val) {
  const fill = $('#' + id + 'fill', root);
  const txt  = $('#' + id + 'val', root);
  if (!fill || !txt) return;
  fill.style.width = clamp(val, 0, 100) + '%';
  txt.textContent = Math.round(val);
  if (id.endsWith('HP')) {
    fill.classList.remove('warn', 'crit');
    if (val < 30) fill.classList.add('crit');
    else if (val < 60) fill.classList.add('warn');
  }
}
function setText(root, id, val) {
  const el = $('#' + id, root);
  if (el) el.textContent = String(val);
}
function setTwoSide(root, redId, blueId, rVal, bVal) {
  const max = Math.max(rVal, bVal, 1);
  const rb = $('#' + redId + 'Bar', root);
  const bb = $('#' + blueId + 'Bar', root);
  if (rb) rb.style.width = (rVal / max) * 50 + '%';
  if (bb) bb.style.width = (bVal / max) * 50 + '%';
}
