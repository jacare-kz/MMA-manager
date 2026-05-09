/* ==============================================================
   APEX FC — Test Lab
   Run any matchup N times to verify upset rates, finish distribution.
   ============================================================== */

let TL = { red: null, blue: null };

function renderTestLab(root) {
  const screen = el('section', { class:'screen testlab' });
  screen.appendChild(el('div', { class:'section-head' },
    el('h2', { class:'section-title' }, 'TEST LAB'),
    el('div', { class:'section-sub' }, 'BATCH SIMULATION // FIGHT BALANCE'),
  ));

  const wrap = el('div', { class:'matchmaker' },
    cornerBoxTL('red'),
    el('div', { class:'vs' }, 'VS'),
    cornerBoxTL('blue'),
  );
  screen.appendChild(wrap);

  const bookable = TL.red && TL.blue && TL.red.id !== TL.blue.id;
  const bar = el('div', { class:'book-bar' },
    el('div', { class:'info' },
      el('span', {}, el('span', { class:'k' }, 'RUNS')),
    ),
    el('button', { class:'btn ghost', onclick: () => runBatch(100) }, '100 RUNS'),
    el('button', { class:'btn ghost', onclick: () => runBatch(500) }, '500 RUNS'),
    el('button', { class:'btn', disabled: !bookable, onclick: () => bookable && runBatch(1000) }, '1000 RUNS'),
  );
  screen.appendChild(bar);

  const results = el('div', { id:'tlResults' });
  screen.appendChild(results);

  root.appendChild(screen);
}

function cornerBoxTL(corner) {
  const f = TL[corner];
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
      el('span', {}, 'OVR ' + ovr(f.stats)),
    ));
    box.appendChild(el('button', { class:'btn ghost', onclick: () => openPickerTL(corner) }, 'CHANGE'));
  } else {
    box.appendChild(el('div', { class:'corner-empty' }, 'PICK A FIGHTER'));
    box.appendChild(el('button', { class:'btn', onclick: () => openPickerTL(corner) }, 'PICK FIGHTER'));
  }
  return box;
}

function openPickerTL(corner) {
  const modalBg = el('div', { class:'modal-bg', onclick: (e) => { if (e.target === modalBg) modalBg.remove(); } });
  const search = el('input', { class:'search-input', placeholder:'Search…', oninput: () => renderList() });
  const list = el('div', { class:'fighter-grid' });
  function renderList() {
    list.innerHTML = '';
    const q = search.value.trim().toLowerCase();
    let arr = FIGHTERS.slice();
    if (q) arr = arr.filter(f => f.name.toLowerCase().includes(q));
    arr.sort(byDivisionRank);
    arr.forEach(f => {
      const card = fighterCardEl(f);
      card.onclick = () => {
        TL[corner] = f;
        modalBg.remove();
        navigateTo('testlab');
      };
      list.appendChild(card);
    });
  }
  const modal = el('div', { class:'modal' },
    el('div', { class:'modal-head' },
      el('h3', {}, 'PICK FOR ' + (corner === 'red' ? 'RED' : 'BLUE')),
      el('button', { class:'modal-close', onclick: () => modalBg.remove() }, '✕'),
    ),
    el('div', { class:'modal-body' },
      el('div', { style:'margin-bottom:12px;' }, search),
      list,
    ),
  );
  modalBg.appendChild(modal);
  document.body.appendChild(modalBg);
  renderList();
}

function runBatch(n) {
  if (!TL.red || !TL.blue) return;
  const start = performance.now();
  const out = simulateMany(TL.red, TL.blue, n);
  const dur = (performance.now() - start).toFixed(0);

  const total = out.redWins + out.blueWins + out.draws;
  const rPct = (out.redWins / total * 100).toFixed(1);
  const bPct = (out.blueWins / total * 100).toFixed(1);
  const dPct = (out.draws / total * 100).toFixed(1);

  const results = $('#tlResults');
  results.innerHTML = '';
  results.appendChild(el('div', { class:'results' },
    el('div', { class:'summary-row' },
      el('div', { class:'summary-cell red' },
        el('div', { class:'pct' }, rPct + '%'),
        el('div', { class:'pct-label' }, TL.red.name.toUpperCase() + ' WINS'),
        el('div', { style:'font-family:var(--mono); font-size:12px; color:var(--ink-dim); margin-top:8px;' }, out.redWins + ' / ' + total + ' fights'),
      ),
      el('div', { class:'summary-cell blue' },
        el('div', { class:'pct' }, bPct + '%'),
        el('div', { class:'pct-label' }, TL.blue.name.toUpperCase() + ' WINS'),
        el('div', { style:'font-family:var(--mono); font-size:12px; color:var(--ink-dim); margin-top:8px;' }, out.blueWins + ' / ' + total + ' fights'),
      ),
    ),
    el('div', { style:'font-family:var(--mono); font-size:11px; color:var(--ink-mute); letter-spacing:.16em; margin-bottom:8px;' },
      `// METHOD BREAKDOWN`),
    el('div', { class:'breakdown' },
      methodCell('R // KO',    out.methods.red.KO),
      methodCell('R // TKO',   out.methods.red.TKO),
      methodCell('R // SUB',   out.methods.red.SUB),
      methodCell('R // UD',    (out.methods.red.UD || 0) + (out.methods.red.SD || 0)),
      methodCell('B // KO',    out.methods.blue.KO),
      methodCell('B // TKO',   out.methods.blue.TKO),
      methodCell('B // SUB',   out.methods.blue.SUB),
      methodCell('B // UD',    (out.methods.blue.UD || 0) + (out.methods.blue.SD || 0)),
      methodCell('DRAWS',      out.draws),
      methodCell('FINISH %',   ((out.finishesEarly / total) * 100).toFixed(0) + '%'),
      methodCell('AVG ROUND',  out.avgRoundEnded.toFixed(2)),
      methodCell('SIM TIME',   dur + 'ms'),
    ),
  ));
}

function methodCell(label, val) {
  return el('div', { class:'bd-cell' },
    el('div', { class:'bd-label' }, label),
    el('div', { class:'bd-val' }, val),
  );
}
