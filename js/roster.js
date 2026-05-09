/* ==============================================================
   APEX FC — Roster, rankings, matchmaker, fighter card detail
   ============================================================== */

// Sort: champion first, then ranked 1..15, then unranked by OVR.
// Within the same division — pure rank order. Across divisions — divisions
// in WCLASSES order, then rank within each.
function byDivisionRank(a, b) {
  const wcOrder = WCLASSES.findIndex(w => w.id === a.wclass) - WCLASSES.findIndex(w => w.id === b.wclass);
  if (wcOrder !== 0) return wcOrder;
  if (a.champion && !b.champion) return -1;
  if (!a.champion && b.champion) return 1;
  const ar = a.ranking ?? 999;
  const br = b.ranking ?? 999;
  if (ar !== br) return ar - br;
  return ovr(b.stats) - ovr(a.stats);
}

// ====== Roster ======
function renderRoster(root) {
  const screen = el('section', { class:'screen' });

  screen.appendChild(el('div', { class:'section-head' },
    el('h2', { class:'section-title' }, 'ROSTER'),
    el('div', { class:'section-sub' }, `${FIGHTERS.length} FIGHTERS // ${WCLASSES.length} DIVISIONS`),
  ));

  // Filters
  const filters = el('div', { class:'filters' });
  const allBtn = el('button', { class:'chip active', onclick: () => setFilter(null, allBtn) }, 'ALL');
  filters.appendChild(allBtn);
  const wcButtons = [];
  WCLASSES.forEach(wc => {
    if (FIGHTERS.some(f => f.wclass === wc.id)) {
      const b = el('button', { class:'chip', onclick: () => setFilter(wc.id, b) }, wc.label);
      filters.appendChild(b);
      wcButtons.push(b);
    }
  });
  const search = el('input', { class:'search-input', placeholder:'Search fighter…', oninput: () => render() });
  filters.appendChild(search);
  screen.appendChild(filters);

  let activeWc = null;
  function setFilter(wc, btn) {
    activeWc = wc;
    [allBtn, ...wcButtons].forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render();
  }

  const grid = el('div', { class:'fighter-grid' });
  screen.appendChild(grid);

  function render() {
    grid.innerHTML = '';
    const q = search.value.trim().toLowerCase();
    let list = FIGHTERS.slice();
    if (activeWc) list = list.filter(f => f.wclass === activeWc);
    if (q) list = list.filter(f => f.name.toLowerCase().includes(q) || f.nick.toLowerCase().includes(q));
    list.sort(byDivisionRank);
    if (list.length === 0) {
      grid.appendChild(el('div', { class:'empty' }, 'NO FIGHTERS MATCH'));
      return;
    }
    list.forEach(f => grid.appendChild(fighterCardEl(f)));
  }
  render();
  root.appendChild(screen);
}

function fighterCardEl(f) {
  const wc = getWClass(f.wclass);
  const rankBadge = f.champion
    ? el('span', { class:'rank-badge champ' }, 'CHAMP')
    : f.ranking != null
      ? el('span', { class:'rank-badge' }, '#' + f.ranking)
      : el('span', { class:'rank-badge unranked' }, 'NR');

  return el('button', { class:'fighter-card', onclick: () => openFighterModal(f) },
    rankBadge,
    el('div', { class:'fighter-card-head' },
      el('div', { class:'fighter-portrait' }, initials(f.name)),
      el('div', {},
        el('div', { class:'fighter-name' }, f.name),
        f.nick ? el('div', { class:'fighter-nick' }, '"' + f.nick + '"') : null,
      ),
    ),
    el('div', { class:'fighter-meta' },
      el('span', { class:'record' }, recordStr(f.record)),
      el('span', {}, wc.label.split(' ').slice(-1)[0]),
      el('span', {}, f.country),
      el('span', {}, 'OVR ' + ovr(f.stats)),
    ),
    el('div', { class:'stats-mini' },
      statBar('STR', f.stats.striking),
      statBar('GRP', f.stats.grapple),
      statBar('PWR', f.stats.power),
      statBar('CHN', f.stats.chin),
      statBar('CAR', f.stats.cardio),
      statBar('SPD', f.stats.speed),
    ),
  );
}

function statBar(label, val) {
  return el('div', { class:'stat-row' },
    el('span', {}, label),
    el('div', { class:'stat-bar' },
      el('span', { style: 'width:' + val + '%' }),
    ),
    el('span', { class:'stat-val' }, val),
  );
}

// ====== Fighter detail modal ======
function openFighterModal(f) {
  const modalBg = el('div', { class:'modal-bg', onclick: (e) => { if (e.target === modalBg) modalBg.remove(); } });
  const wc = getWClass(f.wclass);
  const stats = f.stats;
  const fullStats = [
    ['STRIKING','striking'], ['POWER','power'], ['SPEED','speed'],
    ['BOXING','boxing'], ['KICKING','kicking'], ['CLINCH','clinch'],
    ['TAKEDOWN OFF','tdo'], ['TAKEDOWN DEF','tdd'], ['GRAPPLING','grapple'],
    ['SUB OFFENSE','sub_off'], ['SUB DEFENSE','sub_def'],
    ['CHIN','chin'], ['CARDIO','cardio'], ['FIGHT IQ','iq'],
  ];
  const modal = el('div', { class:'modal' },
    el('div', { class:'modal-head' },
      el('h3', {}, f.name + (f.nick ? ' "' + f.nick + '"' : '')),
      el('button', { class:'modal-close', onclick: () => modalBg.remove() }, '✕'),
    ),
    el('div', { class:'modal-body' },
      el('div', { style:'display:grid; grid-template-columns: auto 1fr; gap: 24px; margin-bottom:18px;' },
        el('div', { class:'fighter-portrait', style:'width:96px; height:96px; font-size:38px;' }, initials(f.name)),
        el('div', {},
          el('div', { style:'font-family:var(--mono); font-size:11px; color:var(--ink-mute); letter-spacing:.16em; margin-bottom:6px;' },
            `${wc.label} • ${f.country} • AGE ${f.age}`),
          el('div', { style:'font-family:var(--mono); font-size:13px; color:var(--ink); margin-bottom:6px;' },
            `RECORD: ${recordStr(f.record)} (${f.finishes.ko} KO, ${f.finishes.sub} SUB)`),
          el('div', { style:'font-family:var(--mono); font-size:12px; color:var(--ink-dim); letter-spacing:.08em;' },
            `STYLE: ${f.style.toUpperCase()} • OVR ${ovr(f.stats)} • POPULARITY ${f.popularity}`),
        ),
      ),
      el('div', { style:'display:grid; grid-template-columns:1fr 1fr; gap:6px 18px;' },
        ...fullStats.map(([lbl, key]) =>
          el('div', { class:'stat-row' },
            el('span', { style:'min-width:120px;' }, lbl),
            el('div', { class:'stat-bar' }, el('span', { style:`width:${stats[key]}%`,
              ...(stats[key] >= 90 ? { class:'' } : {}) })),
            el('span', { class:'stat-val' }, stats[key]),
          )
        ),
      ),
      el('div', { style:'display:flex; gap:8px; margin-top:24px;' },
        el('button', { class:'btn', onclick: () => { modalBg.remove(); chooseAsRed(f); navigateTo('matchmaker'); } }, 'BOOK AS RED'),
        el('button', { class:'btn ghost', onclick: () => { modalBg.remove(); chooseAsBlue(f); navigateTo('matchmaker'); } }, 'BOOK AS BLUE'),
      ),
    ),
  );
  // Stat bar coloring for high stats
  modal.querySelectorAll('.stat-bar > span').forEach((sp, i) => {
    const v = parseInt(sp.style.width);
    if (v >= 90) sp.style.background = 'var(--gold)';
    else if (v >= 80) sp.style.background = '#e5e5e5';
    else if (v < 60) sp.style.background = '#7c0a0d';
  });
  modalBg.appendChild(modal);
  document.body.appendChild(modalBg);
}

// ====== Rankings ======
function renderRankings(root) {
  const screen = el('section', { class:'screen' });
  screen.appendChild(el('div', { class:'section-head' },
    el('h2', { class:'section-title' }, 'RANKINGS'),
    el('div', { class:'section-sub' }, `OFFICIAL DIVISIONAL TOP 15 // P4P`),
  ));

  const grid = el('div', { class:'rankings-grid' });

  // P4P first
  const p4p = p4pList();
  if (p4p.length) {
    grid.appendChild(rankingBlock('POUND-FOR-POUND', '#1 OVERALL', p4p, true));
  }

  // Per division
  WCLASSES.forEach(wc => {
    const list = fightersInDivision(wc.id);
    if (list.length === 0) return;
    grid.appendChild(rankingBlock(wc.label, wc.lbs + ' LBS', list.slice(0, 16), false));
  });

  screen.appendChild(grid);
  root.appendChild(screen);
}

function rankingBlock(title, sub, list, isP4P) {
  const block = el('div', { class:'ranking-block' });
  block.appendChild(el('div', { class:'ranking-block-head' },
    el('h3', {}, title),
    el('div', { class:'lbs' }, sub),
  ));
  list.forEach((f, i) => {
    const isChamp = !isP4P && f.champion;
    const pos = isChamp ? 'C' : (isP4P ? f.pfp : (f.ranking != null ? f.ranking : '—'));
    const row = el('div', { class:'ranking-row' + (isChamp ? ' champ' : ''), onclick: () => openFighterModal(f) },
      el('span', { class:'pos' }, String(pos)),
      el('div', {},
        el('div', { class:'name' }, f.name + (f.nick ? '  "' + f.nick + '"' : '')),
        el('div', { class:'rec' }, recordStr(f.record) + ' • ' + getWClass(f.wclass).label.split(' ').slice(-1)[0] + (isP4P ? '' : '')),
      ),
      el('span', { class:'ovr' }, 'OVR ' + ovr(f.stats)),
    );
    block.appendChild(row);
  });
  return block;
}

// ====== Matchmaker ======
let MM = { red: null, blue: null };
function chooseAsRed(f)  { MM.red  = f; if (MM.blue && MM.blue.id === f.id) MM.blue = null; }
function chooseAsBlue(f) { MM.blue = f; if (MM.red  && MM.red.id  === f.id) MM.red  = null; }

function renderMatchmaker(root) {
  const screen = el('section', { class:'screen' });
  screen.appendChild(el('div', { class:'section-head' },
    el('h2', { class:'section-title' }, 'MATCHMAKER'),
    el('div', { class:'section-sub' }, 'BOOK A FIGHT'),
  ));

  const wrap = el('div', { class:'matchmaker' },
    cornerBox('red'),
    el('div', { class:'vs' }, 'VS'),
    cornerBox('blue'),
  );
  screen.appendChild(wrap);

  // Bottom bar
  const hype = computeHype();
  const bookable = MM.red && MM.blue && MM.red.id !== MM.blue.id;
  const titleAvailable = bookable && MM.red.wclass === MM.blue.wclass;
  const bar = el('div', { class:'book-bar' },
    el('div', { class:'info' },
      el('span', {}, el('span', { class:'k' }, 'HYPE'), el('span', { class:'v' }, hype.score + '/100')),
      el('span', {}, el('span', { class:'k' }, 'BUYRATE'), el('span', { class:'v' }, hype.buyrate)),
      el('span', {}, el('span', { class:'k' }, 'GATE'), el('span', { class:'v' }, hype.gate)),
      titleAvailable ? el('span', {}, el('span', { class:'k' }, 'WEIGHT'), el('span', { class:'v' }, getWClass(MM.red.wclass).label)) : null,
    ),
    el('button', { class:'btn ghost', onclick: () => { MM = { red:null, blue:null }; navigateTo('matchmaker'); } }, 'CLEAR'),
    makeStartBtn(bookable),
  );
  screen.appendChild(bar);

  root.appendChild(screen);
}

function cornerBox(corner) {
  const f = MM[corner];
  const box = el('div', { class:`corner ${corner}` },
    el('div', { class:'corner-label' }, corner === 'red' ? 'RED CORNER' : 'BLUE CORNER'),
  );
  if (f) {
    box.appendChild(el('div', { class:'fighter-card-head' },
      el('div', { class:'fighter-portrait', style:'width:64px;height:64px;font-size:28px;' }, initials(f.name)),
      el('div', {},
        el('div', { class:'fighter-name' }, f.name),
        f.nick ? el('div', { class:'fighter-nick' }, '"' + f.nick + '"') : null,
      ),
    ));
    box.appendChild(el('div', { class:'fighter-meta' },
      el('span', { class:'record' }, recordStr(f.record)),
      el('span', {}, getWClass(f.wclass).label.split(' ').slice(-1)[0]),
      el('span', {}, f.country),
      el('span', {}, 'OVR ' + ovr(f.stats)),
    ));
    box.appendChild(el('div', { class:'stats-mini' },
      statBar('STR', f.stats.striking),
      statBar('GRP', f.stats.grapple),
      statBar('PWR', f.stats.power),
      statBar('CHN', f.stats.chin),
      statBar('CAR', f.stats.cardio),
      statBar('SPD', f.stats.speed),
    ));
    box.appendChild(el('button', { class:'btn ghost', style:'margin-top:auto;', onclick: () => openPicker(corner) }, 'CHANGE FIGHTER'));
  } else {
    box.appendChild(el('div', { class:'corner-empty' }, 'CLICK TO PICK A FIGHTER'));
    box.appendChild(el('button', { class:'btn', onclick: () => openPicker(corner) }, 'PICK FIGHTER'));
  }
  return box;
}

function openPicker(corner) {
  const modalBg = el('div', { class:'modal-bg', onclick: (e) => { if (e.target === modalBg) modalBg.remove(); } });
  const search = el('input', { class:'search-input', placeholder:'Search…',
    oninput: () => renderList() });
  const wcSelect = el('div', { class:'filters' });
  let activeWc = null;
  const allBtn = el('button', { class:'chip active', onclick: () => { activeWc = null; refreshChips(); renderList(); } }, 'ALL');
  wcSelect.appendChild(allBtn);
  WCLASSES.forEach(wc => {
    if (!FIGHTERS.some(f => f.wclass === wc.id)) return;
    const b = el('button', { class:'chip', onclick: () => { activeWc = wc.id; refreshChips(); renderList(); } }, wc.label.split(' ').slice(-1)[0]);
    wcSelect.appendChild(b);
  });
  function refreshChips() {
    Array.from(wcSelect.children).forEach((b, i) => b.classList.toggle('active',
      (i === 0 && activeWc === null) || (i > 0 && b.textContent === getWClass(activeWc)?.label.split(' ').slice(-1)[0])));
  }

  const list = el('div', { class:'fighter-grid' });
  function renderList() {
    list.innerHTML = '';
    const q = search.value.trim().toLowerCase();
    let arr = FIGHTERS.slice();
    if (activeWc) arr = arr.filter(f => f.wclass === activeWc);
    if (q) arr = arr.filter(f => f.name.toLowerCase().includes(q) || f.nick.toLowerCase().includes(q));
    arr.sort(byDivisionRank);
    arr.forEach(f => {
      const card = fighterCardEl(f);
      // Override click
      card.onclick = () => {
        if (corner === 'red') chooseAsRed(f); else chooseAsBlue(f);
        modalBg.remove();
        navigateTo('matchmaker');
      };
      list.appendChild(card);
    });
  }
  const modal = el('div', { class:'modal' },
    el('div', { class:'modal-head' },
      el('h3', {}, 'PICK ' + (corner === 'red' ? 'RED' : 'BLUE') + ' CORNER'),
      el('button', { class:'modal-close', onclick: () => modalBg.remove() }, '✕'),
    ),
    el('div', { class:'modal-body' },
      el('div', { style:'display:flex;gap:8px;margin-bottom:12px;' }, search),
      wcSelect,
      list,
    ),
  );
  modalBg.appendChild(modal);
  document.body.appendChild(modalBg);
  renderList();
}

function computeHype() {
  if (!MM.red || !MM.blue) return { score: 0, buyrate: '—', gate: '—' };
  const r = MM.red, b = MM.blue;
  const popAvg = (r.popularity + b.popularity) / 2;
  const rankBoost = ((r.ranking != null && r.ranking <= 5 ? 10 : 0) + (b.ranking != null && b.ranking <= 5 ? 10 : 0));
  const champBoost = (r.champion || b.champion) ? 12 : 0;
  const sameDiv = r.wclass === b.wclass ? 6 : 0;
  const score = Math.round(clamp(popAvg + rankBoost + champBoost + sameDiv, 0, 100));
  // Buyrate scales nonlinearly with hype
  const buys = Math.round(50 + Math.pow(score, 1.6) * 20);
  const gate = Math.round(2 + Math.pow(score / 100, 1.4) * 18);
  return {
    score,
    buyrate: buys + 'K',
    gate: '$' + gate + 'M',
  };
}

function makeStartBtn(bookable) {
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = '▶ START FIGHT';
  btn.disabled = !bookable;
  btn.addEventListener('click', () => launchFight());
  return btn;
}

function launchFight() {
  if (!MM.red || !MM.blue) return;
  const titleFight = MM.red.wclass === MM.blue.wclass && (MM.red.champion || MM.blue.champion);
  const fs = new FightScreen(document.getElementById('app'), MM.red, MM.blue, { titleFight });
  fs.mount();
}
