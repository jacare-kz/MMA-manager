/* ==============================================================
   APEX FC — Events & Card Builder
   ============================================================== */

const ARENAS = [
  { id:'apex',      name:'UFC Apex',             location:'Las Vegas, NV',    capacity:1_800  },
  { id:'tmobile',   name:'T-Mobile Arena',        location:'Las Vegas, NV',    capacity:20_000 },
  { id:'msg',       name:'Madison Square Garden', location:'New York, NY',     capacity:20_789 },
  { id:'o2',        name:'O2 Arena',              location:'London, England',  capacity:20_000 },
  { id:'bell',      name:'Bell Centre',           location:'Montreal, Canada', capacity:21_288 },
  { id:'etihad',    name:'Etihad Arena',          location:'Abu Dhabi, UAE',   capacity:18_000 },
  { id:'saitama',   name:'Saitama Super Arena',   location:'Saitama, Japan',   capacity:36_500 },
  { id:'singapore', name:'Singapore Indoor Std.', location:'Singapore',        capacity:12_000 },
];

// Persistent event storage (in-memory for session)
const EVENTS = [];
let _eventCounter = 1;

// ── Builder state ────────────────────────────────────────────
let _builder = null;   // null = not building
let _pickerCb = null;  // callback for fighter picker
let _pickerUsed = [];  // IDs already used in current event

// ── Entry point ──────────────────────────────────────────────
function renderEvents(root) {
  if (_builder) {
    _renderBuilder(root);
  } else {
    _renderEventList(root);
  }
}

// ── Event list ───────────────────────────────────────────────
function _renderEventList(root) {
  const screen = el('section', { class:'screen' });

  screen.appendChild(el('div', { class:'section-head' },
    el('h2', { class:'section-title' }, 'EVENTS'),
    el('button', { class:'btn', onclick: _startBuilder }, '+ NEW EVENT'),
  ));

  if (EVENTS.length === 0) {
    screen.appendChild(el('div', { class:'empty' }, 'NO EVENTS SCHEDULED — CREATE YOUR FIRST CARD'));
  } else {
    const list = el('div', { class:'event-list' });
    EVENTS.slice().reverse().forEach(ev => {
      list.appendChild(_eventRow(ev));
    });
    screen.appendChild(list);
  }

  root.appendChild(screen);
}

function _eventRow(ev) {
  const arena = ARENAS.find(a => a.id === ev.arenaId) || { name: ev.arenaId, location: '' };
  const mainBout = ev.bouts[0];
  const status = ev.status === 'done' ? 'COMPLETED' : 'SCHEDULED';

  const row = el('div', { class:'event-row' },
    el('div', { class:'event-row-left' },
      el('div', { class:'event-row-name' }, ev.name),
      el('div', { class:'event-row-meta' },
        el('span', {}, arena.name),
        el('span', { class:'event-row-sep' }, '//'),
        el('span', {}, arena.location),
        el('span', { class:'event-row-sep' }, '//'),
        el('span', {}, `${ev.bouts.length} BOUTS`),
      ),
      mainBout && mainBout.red && mainBout.blue
        ? el('div', { class:'event-main-matchup' },
            el('span', { class:'event-fighter-name' }, mainBout.red.name),
            el('span', { class:'event-vs-sm' }, ' VS '),
            el('span', { class:'event-fighter-name' }, mainBout.blue.name),
          )
        : null,
    ),
    el('div', { class:'event-row-right' },
      el('div', { class:`event-status ${ev.status === 'done' ? 'done' : 'sched'}` }, status),
      ev.status !== 'done'
        ? el('button', { class:'btn', onclick: () => _broadcastEvent(ev) }, 'BROADCAST')
        : el('button', { class:'btn ghost', onclick: () => _viewResults(ev) }, 'RESULTS'),
    ),
  );
  return row;
}

// ── Builder ──────────────────────────────────────────────────
function _startBuilder() {
  _builder = {
    name: `APEX FC ${_eventCounter}`,
    arenaId: 'tmobile',
    mainCardCount: 3,   // excluding main event & co-main
    prelimCount: 3,
    bouts: [],
  };
  _rebuildBouts();
  navigateTo('events');
}

function _rebuildBouts() {
  const old = _builder.bouts;
  const getBout = (slot, idx) => {
    const existing = old.find(b => b.slot === slot && b.slotIdx === idx);
    return existing || { slot, slotIdx: idx, red: null, blue: null, title: false, rounds: slot === 'main_event' ? 5 : 3 };
  };

  const bouts = [];
  bouts.push(getBout('main_event', 0));
  bouts.push(getBout('co_main', 0));
  for (let i = 0; i < _builder.mainCardCount; i++) bouts.push(getBout('main_card', i));
  for (let i = 0; i < _builder.prelimCount; i++) bouts.push(getBout('prelim', i));
  _builder.bouts = bouts;
}

function _renderBuilder(root) {
  _pickerUsed = _builder.bouts.flatMap(b => [b.red?.id, b.blue?.id]).filter(Boolean);

  const screen = el('section', { class:'screen' });

  // Header
  screen.appendChild(el('div', { class:'section-head' },
    el('h2', { class:'section-title' }, 'CREATE EVENT'),
    el('div', { class:'builder-head-actions' },
      el('button', { class:'btn ghost', onclick: _cancelBuilder }, 'CANCEL'),
      el('button', { class:'btn gold', onclick: _saveEvent }, 'SAVE EVENT'),
    ),
  ));

  // Event name + arena
  const infoRow = el('div', { class:'builder-info-row' });

  // Name input
  const nameWrap = el('div', { class:'builder-field' },
    el('div', { class:'field-label' }, 'EVENT NAME'),
  );
  const nameInput = el('input', { class:'builder-input', value: _builder.name });
  nameInput.addEventListener('input', () => { _builder.name = nameInput.value; });
  nameWrap.appendChild(nameInput);
  infoRow.appendChild(nameWrap);

  // Card structure
  const structWrap = el('div', { class:'builder-field' },
    el('div', { class:'field-label' }, 'CARD STRUCTURE'),
  );
  const structRow = el('div', { class:'struct-row' });

  structRow.appendChild(_counterControl('MAIN CARD', _builder.mainCardCount, 1, 6, v => {
    _builder.mainCardCount = v;
    _rebuildBouts();
    navigateTo('events');
  }));
  structRow.appendChild(_counterControl('PRELIMS', _builder.prelimCount, 0, 8, v => {
    _builder.prelimCount = v;
    _rebuildBouts();
    navigateTo('events');
  }));
  structWrap.appendChild(structRow);
  infoRow.appendChild(structWrap);

  screen.appendChild(infoRow);

  // Arena picker
  screen.appendChild(el('div', { class:'field-label', style:'margin-bottom:8px' }, 'ARENA'));
  const arenaGrid = el('div', { class:'arena-grid' });
  ARENAS.forEach(a => {
    const selected = _builder.arenaId === a.id;
    const card = el('button', {
      class: `arena-card ${selected ? 'selected' : ''}`,
      onclick: () => { _builder.arenaId = a.id; navigateTo('events'); },
    },
      el('div', { class:'arena-name' }, a.name),
      el('div', { class:'arena-loc' }, a.location),
      el('div', { class:'arena-cap' }, `${a.capacity.toLocaleString()} SEATS`),
    );
    arenaGrid.appendChild(card);
  });
  screen.appendChild(arenaGrid);

  // Fight card
  screen.appendChild(el('div', { class:'field-label', style:'margin: 18px 0 8px' }, 'FIGHT CARD'));

  const card = el('div', { class:'fight-card-builder' });

  const groups = [
    { label: 'MAIN EVENT',   bouts: _builder.bouts.filter(b => b.slot === 'main_event') },
    { label: 'CO-MAIN EVENT', bouts: _builder.bouts.filter(b => b.slot === 'co_main') },
    { label: 'MAIN CARD',    bouts: _builder.bouts.filter(b => b.slot === 'main_card') },
    { label: 'PRELIMS',      bouts: _builder.bouts.filter(b => b.slot === 'prelim') },
  ].filter(g => g.bouts.length > 0);

  groups.forEach(g => {
    card.appendChild(el('div', { class:'bout-group-label' }, g.label));
    g.bouts.forEach((bout, i) => {
      card.appendChild(_boutRow(bout, i));
    });
  });

  screen.appendChild(card);
  root.appendChild(screen);
}

function _counterControl(label, value, min, max, onChange) {
  const wrap = el('div', { class:'counter-ctrl' });
  wrap.appendChild(el('div', { class:'counter-label' }, label));
  const row = el('div', { class:'counter-row' });
  const dec = el('button', { class:'counter-btn', onclick: () => { if (value > min) onChange(value - 1); } }, '−');
  const num = el('div', { class:'counter-val' }, String(value));
  const inc = el('button', { class:'counter-btn', onclick: () => { if (value < max) onChange(value + 1); } }, '+');
  row.append(dec, num, inc);
  wrap.appendChild(row);
  return wrap;
}

function _boutRow(bout, i) {
  const row = el('div', { class:'bout-row' });

  // Red corner
  row.appendChild(_cornerSlot(bout, 'red'));

  // VS / rounds badge
  row.appendChild(el('div', { class:'bout-vs' },
    el('div', { class:'vs-text' }, 'VS'),
    el('div', { class:'bout-rounds' }, `${bout.rounds}R`),
    bout.slot === 'main_event'
      ? _titleToggle(bout)
      : null,
  ));

  // Blue corner
  row.appendChild(_cornerSlot(bout, 'blue'));

  return row;
}

function _cornerSlot(bout, corner) {
  const fighter = bout[corner];
  const colorClass = corner === 'red' ? 'red' : 'blue';

  if (fighter) {
    const wrap = el('div', { class:`bout-corner filled ${colorClass}` },
      el('div', { class:'bout-fighter-name' }, fighter.name),
      el('div', { class:'bout-fighter-rec' },
        recordStr(fighter.record),
        ' // ',
        getWClass(fighter.wclass)?.label || fighter.wclass.toUpperCase(),
      ),
      el('button', { class:'bout-clear', onclick: () => { bout[corner] = null; navigateTo('events'); } }, '✕'),
    );
    return wrap;
  }

  return el('button', {
    class: `bout-corner empty ${colorClass}`,
    onclick: () => _openPicker(f => { bout[corner] = f; navigateTo('events'); }),
  },
    el('span', { class:'assign-label' }, `+ ASSIGN ${corner.toUpperCase()}`),
  );
}

function _titleToggle(bout) {
  const btn = el('button', {
    class: `title-toggle ${bout.title ? 'active' : ''}`,
    onclick: () => { bout.title = !bout.title; navigateTo('events'); },
  }, bout.title ? 'TITLE FIGHT' : 'NON-TITLE');
  return btn;
}

// ── Fighter picker modal ──────────────────────────────────────
function _openPicker(cb) {
  _pickerCb = cb;

  const bg = el('div', { class:'modal-bg', id:'pickerBg' });
  const modal = el('div', { class:'modal' });

  const head = el('div', { class:'modal-head' },
    el('h3', {}, 'SELECT FIGHTER'),
    el('button', { class:'modal-close', onclick: _closePicker }, '✕'),
  );
  modal.appendChild(head);

  // Search
  const searchWrap = el('div', { style:'padding:12px 20px; border-bottom:1px solid var(--line)' });
  const searchInput = el('input', { class:'search-input', placeholder:'Search fighter…', style:'width:100%' });
  searchWrap.appendChild(searchInput);
  modal.appendChild(searchWrap);

  const body = el('div', { class:'modal-body', style:'padding:0' });
  modal.appendChild(body);

  const render = () => {
    const q = searchInput.value.toLowerCase();
    body.innerHTML = '';
    const list = el('div', { class:'picker-list' });
    const fighters = FIGHTERS
      .filter(f => !_pickerUsed.includes(f.id))
      .filter(f => !q || f.name.toLowerCase().includes(q) || f.wclass.includes(q));

    if (fighters.length === 0) {
      list.appendChild(el('div', { class:'empty', style:'padding:32px' }, 'NO FIGHTERS MATCH'));
    }

    fighters.forEach(f => {
      const row = el('button', {
        class: 'picker-row',
        onclick: () => {
          _pickerCb(f);
          _closePicker();
        },
      },
        el('div', { class:'picker-row-name' }, f.name),
        el('div', { class:'picker-row-meta' },
          el('span', { class:'picker-row-wc' }, getWClass(f.wclass)?.label || f.wclass),
          el('span', {}, recordStr(f.record)),
        ),
      );
      list.appendChild(row);
    });
    body.appendChild(list);
  };

  searchInput.addEventListener('input', render);
  render();

  bg.addEventListener('click', e => { if (e.target === bg) _closePicker(); });
  bg.appendChild(modal);
  document.body.appendChild(bg);
  searchInput.focus();
}

function _closePicker() {
  const bg = document.getElementById('pickerBg');
  if (bg) bg.remove();
  _pickerCb = null;
}

// ── Save / cancel ─────────────────────────────────────────────
function _saveEvent() {
  const ev = {
    id: `event_${Date.now()}`,
    name: _builder.name || `APEX FC ${_eventCounter}`,
    arenaId: _builder.arenaId,
    bouts: _builder.bouts.filter(b => b.red && b.blue),
    status: 'scheduled',
    results: [],
  };

  if (ev.bouts.length === 0) {
    alert('Add at least one complete bout before saving.');
    return;
  }

  EVENTS.push(ev);
  _eventCounter++;
  _builder = null;
  navigateTo('events');
}

function _cancelBuilder() {
  _builder = null;
  navigateTo('events');
}

// ── Broadcast event ───────────────────────────────────────────
function _broadcastEvent(ev) {
  const order = ['prelim', 'main_card', 'co_main', 'main_event'];
  const sorted = [...ev.bouts].sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot));
  ev.status = 'broadcasting';
  ev.results = [];
  _playNextBout(ev, sorted, 0);
}

function _playNextBout(ev, bouts, idx) {
  if (idx >= bouts.length) {
    ev.status = 'done';
    navigateTo('events');
    return;
  }

  const bout = bouts[idx];
  const root = document.getElementById('app');

  // Show broadcast screen for this bout
  const screen = new FightScreen(root, bout.red, bout.blue, { titleFight: bout.rounds === 5 || bout.title });

  // Override showFinish to replace default buttons with event-specific navigation
  screen.showFinish = (result) => {
    // Stop the arena rendering
    if (screen.arena) {
      if (result.winner && result.winner !== 'draw') screen.arena.freeze(result.winner);
      const arenaRef = screen.arena;
      setTimeout(() => arenaRef.destroy(), 4000);
      screen.arena = null;
    }

    const bout = bouts[idx];
    ev.results.push({ bout, result });

    const wname = result.winner === 'red' ? bout.red.name
                : result.winner === 'blue' ? bout.blue.name : 'DRAW';
    const methodLine = result.type === 'KO' ? 'НОКАУТ'
                     : result.type === 'TKO' ? 'ТЕХНИЧЕСКИЙ НОКАУТ'
                     : result.type === 'SUB' ? 'САБМИШН'
                     : result.type === 'UD'  ? 'ЕДИНОГЛАСНОЕ РЕШЕНИЕ'
                     : result.type === 'SD'  ? 'РАЗДЕЛЬНОЕ РЕШЕНИЕ'
                     : result.type === 'DRAW' ? 'НИЧЬЯ' : 'РЕШЕНИЕ';
    const detail = result.by ? ` // ${result.by}` : '';
    const tline  = result.cards ? `СУДЕЙСКИЕ КАРТЫ: ${result.cards}`
                 : result.round ? `Р${result.round} • ${fmtTime((result.t || 0) - (result.round-1)*300)}` : '';

    const isLast = idx >= bouts.length - 1;
    const nextAction = isLast
      ? el('button', { class:'btn gold', onclick: () => {
          ev.status = 'done';
          overlay.remove();
          navigateTo('events');
        }}, 'CARD COMPLETE')
      : el('button', { class:'btn gold', onclick: () => {
          overlay.remove();
          _playNextBout(ev, bouts, idx + 1);
        }}, 'NEXT FIGHT');

    const boutLabel = bout.slot === 'main_event' ? 'MAIN EVENT'
                    : bout.slot === 'co_main' ? 'CO-MAIN EVENT'
                    : bout.slot === 'main_card' ? 'MAIN CARD'
                    : 'PRELIM';

    const overlay = el('div', { class:'finish-overlay' },
      el('div', { class:'finish-card' },
        el('div', { class:'label' }, boutLabel + ' // ОФИЦИАЛЬНЫЙ РЕЗУЛЬТАТ'),
        el('div', { class:'winner' }, wname.toUpperCase()),
        el('div', { class:'method' }, methodLine + detail),
        el('div', { class:'timeline' }, tline),
        el('div', { class:'actions' },
          el('button', { class:'btn ghost', onclick: () => overlay.remove() }, 'СМОТРЕТЬ ПОВТОР'),
          nextAction,
        ),
      ),
    );
    document.body.appendChild(overlay);
  };

  screen.mount();
}


function _viewResults(ev) {
  const root = document.getElementById('app');
  root.innerHTML = '';
  const screen = el('section', { class:'screen' });

  screen.appendChild(el('div', { class:'section-head' },
    el('h2', { class:'section-title' }, ev.name),
    el('button', { class:'btn ghost', onclick: () => navigateTo('events') }, '← BACK'),
  ));

  const arena = ARENAS.find(a => a.id === ev.arenaId);
  screen.appendChild(el('div', { class:'event-meta-bar' },
    el('span', {}, arena?.name || ev.arenaId),
    el('span', { class:'event-row-sep' }, '//'),
    el('span', {}, arena?.location || ''),
    el('span', { class:'event-row-sep' }, '//'),
    el('span', { class:'event-status done' }, 'COMPLETED'),
  ));

  if (ev.results.length > 0) {
    ev.results.forEach(({ bout, result }) => {
      const winner = result.winner === 'red' ? bout.red : bout.blue;
      const loser  = result.winner === 'red' ? bout.blue : bout.red;
      screen.appendChild(el('div', { class:'result-row' },
        el('div', { class:'result-winner' }, winner?.name || '—'),
        el('div', { class:'result-method' }, result.method + ' R' + result.round + ' ' + result.time),
        el('div', { class:'result-loser' }, 'def. ' + (loser?.name || '—')),
      ));
    });
  } else {
    ev.bouts.forEach(bout => {
      screen.appendChild(el('div', { class:'result-row' },
        el('div', { class:'result-winner' }, bout.red?.name || 'TBD'),
        el('div', { class:'result-method' }, 'VS'),
        el('div', { class:'result-loser' }, bout.blue?.name || 'TBD'),
      ));
    });
  }

  root.appendChild(screen);
}
