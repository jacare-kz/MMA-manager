/* ==============================================================
   APEX FC — Career Mode
   Create your fighter. Climb the rankings. Win the title.
   ============================================================== */

const CAREER_KEY = 'apexfc_career_v1';

const C_STYLES = [
  { id:'striker',   label:'STRIKER',
    desc:'Sharp boxing, forward pressure. Minimal wrestling.',
    tendencies:{ stand:0.85, td:0.10 },
    stats:{ striking:72, power:70, speed:74, kicking:58, boxing:74, clinch:58,
            tdo:44, tdd:56, grapple:50, sub_off:38, sub_def:54, chin:66, cardio:70, iq:66 } },
  { id:'kickboxer', label:'KICKBOXER',
    desc:'Powerful kicks and crisp combos. Dutch style.',
    tendencies:{ stand:0.80, td:0.12 },
    stats:{ striking:70, power:68, speed:72, kicking:76, boxing:68, clinch:60,
            tdo:42, tdd:54, grapple:48, sub_off:36, sub_def:52, chin:64, cardio:72, iq:65 } },
  { id:'wrestler',  label:'WRESTLER',
    desc:'Elite takedowns and suffocating top control.',
    tendencies:{ stand:0.40, td:0.80 },
    stats:{ striking:60, power:66, speed:64, kicking:44, boxing:58, clinch:74,
            tdo:82, tdd:80, grapple:72, sub_off:54, sub_def:70, chin:68, cardio:76, iq:66 } },
  { id:'grappler',  label:'GRAPPLER',
    desc:'BJJ black belt. Submission machine on the ground.',
    tendencies:{ stand:0.35, td:0.75 },
    stats:{ striking:54, power:62, speed:62, kicking:42, boxing:54, clinch:76,
            tdo:76, tdd:74, grapple:84, sub_off:80, sub_def:76, chin:64, cardio:72, iq:70 } },
  { id:'brawler',   label:'BRAWLER',
    desc:'Heavy hands. One-shot KO power. Always moving forward.',
    tendencies:{ stand:0.72, td:0.25 },
    stats:{ striking:70, power:84, speed:62, kicking:48, boxing:72, clinch:68,
            tdo:58, tdd:58, grapple:58, sub_off:48, sub_def:56, chin:74, cardio:64, iq:58 } },
  { id:'allround',  label:'ALL-ROUND',
    desc:'Complete MMA fighter. No obvious weaknesses.',
    tendencies:{ stand:0.60, td:0.45 },
    stats:{ striking:64, power:64, speed:66, kicking:60, boxing:64, clinch:64,
            tdo:62, tdd:62, grapple:64, sub_off:58, sub_def:62, chin:66, cardio:68, iq:68 } },
];

const C_TRAIN = [
  { id:'boxing',    label:'BOXING CAMP',    desc:'Sharpen your punching game',
    gains:['striking','boxing','speed'], cost:5000 },
  { id:'muaythai',  label:'MUAY THAI',      desc:'Develop kicks and clinch control',
    gains:['kicking','clinch','striking'], cost:5000 },
  { id:'wrestling', label:'WRESTLING CAMP', desc:'Improve takedowns and defense',
    gains:['tdo','tdd','clinch'], cost:5000 },
  { id:'bjj',       label:'BJJ CAMP',       desc:'Sharpen your submission game',
    gains:['grapple','sub_off','sub_def'], cost:5000 },
  { id:'strength',  label:'S&C TRAINING',   desc:'Build power, cardio, durability',
    gains:['power','chin','cardio'], cost:4000 },
  { id:'sparring',  label:'HARD SPARRING',  desc:'Fight IQ and mental toughness',
    gains:['iq','chin','striking'], cost:3000, risky:true },
];

const C_COUNTRIES = ['USA','BRA','RUS','KAZ','GBR','MEX','CAN','AUS','GEO',
                     'NLD','IRE','FRA','CHN','KOR','JPN','NGA','UKR','PHL','POL','CZE'];

// ══════════════════════════════════════════════════════════
//  PERSISTENCE
// ══════════════════════════════════════════════════════════
function loadCareer() {
  try { return JSON.parse(localStorage.getItem(CAREER_KEY)) || null; }
  catch { return null; }
}
function saveCareer(d) { localStorage.setItem(CAREER_KEY, JSON.stringify(d)); }
function wipeCareer()  { localStorage.removeItem(CAREER_KEY); }

function newCareer(name, nick, country, wclassId, styleId) {
  const st = C_STYLES.find(s => s.id === styleId);
  const wc = getWClass(wclassId);
  return {
    version: 1,
    fighter: {
      id:'player', name, nick, country,
      weight: wc.lbs, wclass: wclassId, age: 22,
      record: { w:0, l:0, d:0 },
      finishes: { ko:0, sub:0, dec_w:0, dec_l:0 },
      popularity:10, ranking:null, pfp:null, champion:false,
      style: styleId,
      tendencies: { ...st.tendencies },
      stats: { ...st.stats },
      visual: { build:'athletic', stance:'orthodox', skin:'#c07840',
                hair:'#0a0503', beard:false, shorts:'#c8102e' },
    },
    money: 50000,
    week: 1,
    history: [],
    streak: 0,
    titleDefenses: 0,
  };
}

// ══════════════════════════════════════════════════════════
//  RANKING / MATCHMAKING HELPERS
// ══════════════════════════════════════════════════════════
function divFighters(wclassId) {
  return fightersInDivision(wclassId).filter(f => f.id !== 'player');
}

function getOpponents(career) {
  const f   = career.fighter;
  const div = divFighters(f.wclass);
  const rank = f.ranking;

  let pool;
  if (f.champion) {
    pool = div.filter(d => d.ranking != null && d.ranking <= 5);
  } else if (rank == null) {
    pool = div.filter(d => d.ranking == null || d.ranking >= 10);
    if (pool.length < 3) pool = [...div].reverse().slice(0, 8);
  } else {
    const lo = Math.max(1, rank - 4), hi = Math.min(15, rank + 4);
    pool = div.filter(d => d.ranking != null && d.ranking >= lo && d.ranking <= hi);
    if (pool.length < 3) pool = div.filter(d => d.ranking != null).slice(0, 10);
  }

  return [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(3, pool.length));
}

function fightPay(career) {
  const rank = career.fighter.ranking;
  if (career.fighter.champion) return { win:200000, lose:100000, tier:'TITLE FIGHT' };
  if (rank == null)             return { win:15000,  lose:8000,   tier:'REGIONAL' };
  if (rank >= 10)               return { win:25000,  lose:12000,  tier:'PRELIMS' };
  if (rank >= 5)                return { win:50000,  lose:25000,  tier:'MAIN CARD' };
                                return { win:100000, lose:50000,  tier:'MAIN EVENT' };
}

// ══════════════════════════════════════════════════════════
//  PROCESS FIGHT RESULT
// ══════════════════════════════════════════════════════════
function processResult(career, result, opponent) {
  const won  = result.winner === 'red';
  const draw = result.winner === 'draw';
  const f    = career.fighter;

  // Record
  if (draw) {
    f.record.d++;
  } else if (won) {
    f.record.w++;
    if      (result.type === 'KO' || result.type === 'TKO') f.finishes.ko++;
    else if (result.type === 'SUB') f.finishes.sub++;
    else    f.finishes.dec_w++;
  } else {
    f.record.l++;
    if (result.type !== 'KO' && result.type !== 'TKO' && result.type !== 'SUB') f.finishes.dec_l++;
  }

  // Streak
  if (won)       career.streak = Math.max(0, career.streak) + 1;
  else if (!draw) career.streak = Math.min(0, career.streak) - 1;

  // Pay
  const pay = fightPay(career);
  let earned = won ? pay.win : (draw ? Math.round(pay.win * 0.5) : pay.lose);
  const bonuses = [];
  if (won && (result.type === 'KO' || result.type === 'TKO' || result.type === 'SUB')) {
    earned += 50000; bonuses.push({ label:'PERFORMANCE BONUS', amount:50000 });
  }
  if (Math.random() < 0.25) {
    earned += 50000; bonuses.push({ label:'FIGHT OF THE NIGHT', amount:50000 });
  }

  career.money += earned;
  career.week  += 8;
  f.age = Math.max(22, 22 + Math.floor((f.record.w + f.record.l + f.record.d) * 0.5));

  // Ranking changes
  const oldRank = f.ranking;
  let rankChange = 0;
  const notifications = [];

  if (won) {
    if (!f.champion && f.ranking === 1) {
      f.champion = true;
      f.ranking  = 0;
      notifications.push({ icon:'🏆', text:'CHAMPION — APEX FC TITLE WON!' });
    } else if (f.champion) {
      career.titleDefenses++;
      notifications.push({ icon:'🛡', text:`TITLE DEFENSE #${career.titleDefenses} — SUCCESSFUL` });
    } else if (f.ranking == null) {
      if (f.record.w >= 3) {
        f.ranking = 15;
        notifications.push({ icon:'📋', text:'SIGNED TO APEX FC — RANKED #15' });
      } else {
        const need = 3 - f.record.w;
        notifications.push({ icon:'📈', text:`REGIONAL WIN — ${need} MORE WIN${need > 1 ? 'S' : ''} TO REACH APEX FC` });
      }
    } else {
      const climb = (result.type === 'KO' || result.type === 'TKO' || result.type === 'SUB') ? 2 : 1;
      f.ranking = Math.max(1, f.ranking - climb);
      rankChange = (oldRank ?? 15) - f.ranking;
      if (f.ranking <= 5 && (oldRank ?? 15) > 5)
        notifications.push({ icon:'⭐', text:'TOP 5 CONTENDER — TITLE SHOT IN SIGHT' });
      if (f.ranking === 1 && (oldRank ?? 15) > 1)
        notifications.push({ icon:'🎯', text:'#1 CONTENDER — TITLE FIGHT NEXT' });
    }
  } else if (!draw) {
    if (f.champion) {
      f.champion = false;
      f.ranking  = 1;
      notifications.push({ icon:'❌', text:'TITLE LOST — BACK TO #1 CONTENDER' });
    } else if (f.ranking != null) {
      const drop = 3;
      f.ranking  = Math.min(15, f.ranking + drop);
      rankChange = -((f.ranking) - (oldRank ?? 15));
    }
    if (career.streak <= -3)
      notifications.push({ icon:'⚠', text:'3-FIGHT SKID — CONTRACT UNDER REVIEW' });
  }

  // Fight experience: +1 to 2 stats
  const expGains = {};
  const expPool = won
    ? ['striking','boxing','chin','cardio','iq']
    : ['chin','cardio','tdd','sub_def','iq'];
  [...expPool].sort(() => Math.random() - 0.5).slice(0, 2).forEach(s => {
    f.stats[s] = Math.min(97, (f.stats[s] || 50) + 1);
    expGains[s] = 1;
  });

  // History
  career.history.unshift({
    week:career.week, opponentName:opponent.name,
    won, draw, method:result.type, round:result.round,
    earned, bonuses, rankChange, rankAfter:f.ranking,
  });
  if (career.history.length > 20) career.history.length = 20;

  saveCareer(career);
  return { won, draw, earned, bonuses, rankChange, notifications, expGains,
           method:result.type, by:result.by, round:result.round, tier:pay.tier };
}

// ══════════════════════════════════════════════════════════
//  ENTRY POINT
// ══════════════════════════════════════════════════════════
function renderCareer(root) {
  const save = loadCareer();
  if (!save) renderCareerCreate(root);
  else        renderCareerHub(root, save);
}

// ══════════════════════════════════════════════════════════
//  CHARACTER CREATION
// ══════════════════════════════════════════════════════════
function renderCareerCreate(root) {
  let step = 1;
  let form = { name:'', nick:'', country:'USA', wclass:'lw', style:'striker' };

  function draw() {
    root.innerHTML = '';
    const wrap = el('div', { class:'cc-screen screen' });

    wrap.appendChild(el('div', { class:'cc-header' },
      el('div', { class:'cc-step-tag' }, `STEP ${step} / 3`),
      el('h1', { class:'cc-title' }, 'CREATE YOUR FIGHTER'),
    ));

    if (step === 1) {
      const body = el('div', { class:'cc-body' });
      body.appendChild(ccField('FIGHTER NAME',
        ccInput('text', form.name, 'Alex Johnson', v => form.name = v)));
      body.appendChild(ccField('NICKNAME  (optional)',
        ccInput('text', form.nick, 'The Nightmare', v => form.nick = v)));
      body.appendChild(ccField('COUNTRY', ccCountrySelect(form.country, v => form.country = v)));
      wrap.appendChild(body);
      wrap.appendChild(el('div', { class:'cc-btn-row' },
        el('button', { class:'btn', onclick: () => {
          if (!form.name.trim()) { alert('Enter a fighter name'); return; }
          step = 2; draw();
        }}, 'NEXT →'),
      ));

    } else if (step === 2) {
      const body = el('div', { class:'cc-body' });
      body.appendChild(el('div', { class:'cc-section-label' }, 'WEIGHT CLASS'));
      const grid = el('div', { class:'cc-wc-grid' });
      WCLASSES.forEach(wc => {
        grid.appendChild(el('button', {
          class: 'cc-wc-btn' + (form.wclass === wc.id ? ' active' : ''),
          onclick: () => { form.wclass = wc.id; draw(); },
        },
          el('div', { class:'cc-wc-name' }, wc.label),
          el('div', { class:'cc-wc-lbs' }, `${wc.lbs} lbs`),
        ));
      });
      body.appendChild(grid);
      wrap.appendChild(body);
      wrap.appendChild(el('div', { class:'cc-btn-row' },
        el('button', { class:'btn ghost', onclick: () => { step=1; draw(); } }, '← BACK'),
        el('button', { class:'btn', onclick: () => { step=3; draw(); } }, 'NEXT →'),
      ));

    } else {
      const body = el('div', { class:'cc-body' });
      body.appendChild(el('div', { class:'cc-section-label' }, 'FIGHTING STYLE'));
      const grid = el('div', { class:'cc-style-grid' });
      C_STYLES.forEach(s => {
        grid.appendChild(el('button', {
          class: 'cc-style-card' + (form.style === s.id ? ' active' : ''),
          onclick: () => { form.style = s.id; draw(); },
        },
          el('div', { class:'cc-style-name' }, s.label),
          el('div', { class:'cc-style-desc' }, s.desc),
          ccMiniStats(s.stats),
        ));
      });
      body.appendChild(grid);
      wrap.appendChild(body);
      wrap.appendChild(el('div', { class:'cc-btn-row' },
        el('button', { class:'btn ghost', onclick: () => { step=2; draw(); } }, '← BACK'),
        el('button', { class:'btn gold', onclick: () => {
          const career = newCareer(
            form.name.trim(), form.nick.trim(), form.country, form.wclass, form.style);
          saveCareer(career);
          renderCareerHub(root, career);
        }}, 'START CAREER'),
      ));
    }

    root.appendChild(wrap);
  }
  draw();
}

function ccField(label, input) {
  return el('div', { class:'cc-field' },
    el('label', { class:'cc-field-lbl' }, label),
    input,
  );
}
function ccInput(type, value, placeholder, onChange) {
  const inp = document.createElement('input');
  inp.type = type; inp.value = value; inp.placeholder = placeholder;
  inp.className = 'cc-input';
  inp.addEventListener('input', () => onChange(inp.value));
  return inp;
}
function ccCountrySelect(value, onChange) {
  const sel = document.createElement('select');
  sel.className = 'cc-select';
  C_COUNTRIES.forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    if (c === value) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}
function ccMiniStats(stats) {
  const keys = ['striking','power','speed','tdo','grapple','sub_off','chin'];
  const wrap = el('div', { class:'cc-mini-stats' });
  keys.forEach(k => {
    wrap.appendChild(el('div', { class:'cc-mini-row' },
      el('span', { class:'cc-mini-k' }, k.slice(0,3).toUpperCase()),
      el('div', { class:'cc-mini-track' },
        el('div', { class:'cc-mini-fill', style:`width:${stats[k]}%` }),
      ),
      el('span', { class:'cc-mini-v' }, stats[k]),
    ));
  });
  return wrap;
}

// ══════════════════════════════════════════════════════════
//  CAREER HUB
// ══════════════════════════════════════════════════════════
function renderCareerHub(root, career) {
  root.innerHTML = '';
  const f = career.fighter;
  const wrap = el('div', { class:'ch-screen screen' });

  // Top: identity + KPIs
  const top = el('div', { class:'ch-top' });

  const identity = el('div', { class:'ch-identity' },
    el('div', { class:'ch-avatar' }, initials(f.name)),
    el('div', { class:'ch-id-text' },
      el('div', { class:'ch-fighter-name' }, f.name.toUpperCase()),
      f.nick ? el('div', { class:'ch-fighter-nick' }, `"${f.nick}"`) : null,
      el('div', { class:'ch-id-tags' },
        el('span', { class:'ch-tag' }, f.country),
        el('span', { class:'ch-tag' }, getWClass(f.wclass)?.label ?? f.wclass.toUpperCase()),
        f.champion
          ? el('span', { class:'ch-tag gold' }, '👑 CHAMPION')
          : f.ranking != null
            ? el('span', { class:'ch-tag red' }, `#${f.ranking} RANKED`)
            : el('span', { class:'ch-tag muted' }, 'UNRANKED'),
      ),
    ),
  );
  top.appendChild(identity);

  const kpi = el('div', { class:'ch-kpi' },
    chKv('RECORD', recordStr(f.record)),
    chKv('OVR',    String(ovr(f.stats))),
    chKv('MONEY',  fmtMoney(career.money)),
    chKv('WEEK',   String(career.week)),
    chKv('STREAK', career.streak > 0 ? `${career.streak}W` : career.streak < 0 ? `${-career.streak}L` : '—'),
    f.champion ? chKv('DEFENSES', String(career.titleDefenses)) : null,
  );
  top.appendChild(kpi);
  wrap.appendChild(top);

  // Stats panel
  wrap.appendChild(chStatsPanel(f.stats));

  // Actions
  const actions = el('div', { class:'ch-actions' });
  actions.appendChild(chAction('⚔', 'FIGHT', 'Choose your next opponent', true,
    () => renderCareerOpponents(root, career)));
  actions.appendChild(chAction('💪', 'TRAIN', `Improve your skills · $3K–$5K`, false,
    () => renderCareerTrain(root, career)));
  actions.appendChild(chAction('🛌', 'REST', 'Skip 2 weeks · +1 Cardio, +1 Chin', false,
    () => {
      f.stats.cardio = Math.min(97, f.stats.cardio + 1);
      f.stats.chin   = Math.min(97, f.stats.chin   + 1);
      career.week   += 2;
      saveCareer(career);
      renderCareerHub(root, career);
    }));
  wrap.appendChild(actions);

  // History
  if (career.history.length > 0) wrap.appendChild(chHistory(career.history));

  wrap.appendChild(el('div', { class:'ch-bottom' },
    el('button', { class:'btn ghost small', onclick: () => {
      if (confirm('Wipe this career and start a new one?')) {
        wipeCareer(); renderCareerCreate(root);
      }
    }}, 'NEW CAREER'),
  ));

  root.appendChild(wrap);
}

function chKv(k, v) {
  if (v == null) return null;
  return el('div', { class:'ch-kv' },
    el('span', { class:'ch-kv-k' }, k),
    el('span', { class:'ch-kv-v' }, v),
  );
}

function chStatsPanel(stats) {
  const groups = [
    { label:'STRIKING',  keys:['striking','boxing','kicking','power','speed'] },
    { label:'GRAPPLING', keys:['clinch','tdo','tdd','grapple','sub_off','sub_def'] },
    { label:'PHYSICAL',  keys:['chin','cardio','iq'] },
  ];
  const panel = el('div', { class:'ch-stats-panel' });
  groups.forEach(g => {
    const grp = el('div', { class:'ch-stat-group' },
      el('div', { class:'ch-stat-group-lbl' }, g.label),
    );
    g.keys.forEach(k => {
      const v = stats[k] || 0;
      grp.appendChild(el('div', { class:'ch-stat-row' },
        el('span', { class:'ch-stat-k' }, k.replace('_',' ').toUpperCase()),
        el('div', { class:'ch-stat-track' },
          el('div', { class:'ch-stat-fill', style:`width:${v}%` }),
        ),
        el('span', { class:'ch-stat-v' }, v),
      ));
    });
    panel.appendChild(grp);
  });
  return panel;
}

function chAction(icon, label, desc, primary, onClick) {
  return el('button', {
    class: 'ch-action' + (primary ? ' primary' : ''),
    onclick: onClick,
  },
    el('span', { class:'cha-icon' }, icon),
    el('div', { class:'cha-text' },
      el('div', { class:'cha-label' }, label),
      el('div', { class:'cha-desc' }, desc),
    ),
  );
}

function chHistory(history) {
  const wrap = el('div', { class:'ch-history' },
    el('div', { class:'ch-history-hd' }, 'FIGHT HISTORY'),
  );
  history.slice(0,8).forEach(h => {
    wrap.appendChild(el('div', { class:'ch-hist-row ' + (h.won ? 'win' : h.draw ? 'draw' : 'loss') },
      el('span', { class:'ch-hist-badge' }, h.won ? 'W' : h.draw ? 'D' : 'L'),
      el('span', { class:'ch-hist-opp'   }, h.opponentName),
      el('span', { class:'ch-hist-method'}, `${h.method}${h.round ? ` R${h.round}` : ''}`),
      el('span', { class:'ch-hist-pay'   }, fmtMoney(h.earned)),
    ));
  });
  return wrap;
}

function fmtMoney(n) {
  if (n >= 1000000) return '$' + (n/1000000).toFixed(1) + 'M';
  if (n >= 1000)    return '$' + Math.round(n/1000) + 'K';
  return '$' + n;
}

// ══════════════════════════════════════════════════════════
//  TRAINING
// ══════════════════════════════════════════════════════════
function renderCareerTrain(root, career) {
  root.innerHTML = '';
  const wrap = el('div', { class:'ct-screen screen' });

  wrap.appendChild(el('div', { class:'section-head' },
    el('h2', { class:'section-title' }, 'TRAINING CAMP'),
    el('span', { class:'section-sub' }, `BUDGET: ${fmtMoney(career.money)}`),
  ));

  const grid = el('div', { class:'ct-grid' });
  C_TRAIN.forEach(mod => {
    const ok = career.money >= mod.cost;
    const card = el('div', { class:'ct-card' + (ok ? '' : ' locked') },
      el('div', { class:'ct-card-top' },
        el('div', { class:'ct-card-name' }, mod.label),
        el('div', { class:'ct-card-cost' }, `$${mod.cost.toLocaleString()}`),
      ),
      el('div', { class:'ct-card-desc' }, mod.desc),
      el('div', { class:'ct-gains' },
        ...mod.gains.map(g => el('span', { class:'ct-gain' }, '+' + g.replace('_',' ').toUpperCase())),
      ),
      mod.risky ? el('div', { class:'ct-risky' }, '⚠  INJURY RISK 5%') : el('span'),
    );
    if (ok) {
      card.appendChild(el('button', { class:'btn small', onclick: () => applyTraining(root, career, mod) }, 'TRAIN'));
    } else {
      const b = el('button', { class:'btn small ghost' }, 'NO FUNDS');
      b.disabled = true;
      card.appendChild(b);
    }
    grid.appendChild(card);
  });

  wrap.appendChild(grid);
  wrap.appendChild(el('div', { class:'ch-back-row' },
    el('button', { class:'btn ghost', onclick: () => renderCareerHub(root, career) }, '← BACK'),
  ));

  root.appendChild(wrap);
}

function applyTraining(root, career, mod) {
  if (mod.risky && Math.random() < 0.05) {
    career.week  += 4;
    career.money -= mod.cost;
    saveCareer(career);
    alert('Injury during sparring! Lost 4 weeks recovering.');
    renderCareerHub(root, career);
    return;
  }
  mod.gains.forEach(stat => {
    const gain = 1 + (Math.random() < 0.35 ? 1 : 0);
    career.fighter.stats[stat] = Math.min(97, (career.fighter.stats[stat] || 50) + gain);
  });
  career.money -= mod.cost;
  career.week  += 1;
  saveCareer(career);
  renderCareerHub(root, career);
}

// ══════════════════════════════════════════════════════════
//  OPPONENT SELECTION
// ══════════════════════════════════════════════════════════
function renderCareerOpponents(root, career) {
  root.innerHTML = '';
  const f = career.fighter;
  const isTitleFight = !f.champion && f.ranking === 1;
  const pay = fightPay(career);
  const opponents = getOpponents(career);
  const wrap = el('div', { class:'co-screen screen' });

  wrap.appendChild(el('div', { class:'section-head' },
    el('h2', { class:'section-title' }, isTitleFight ? '🏆 TITLE FIGHT' : 'BOOK A FIGHT'),
    el('span', { class:'section-sub' }, `${pay.tier} · WEEK ${career.week}`),
  ));

  if (isTitleFight) {
    wrap.appendChild(el('div', { class:'co-title-banner' },
      'CHAMPIONSHIP BOUT — WIN THE APEX FC TITLE',
    ));
  }

  const grid = el('div', { class:'co-grid' });
  opponents.forEach(opp => {
    const diff = ovr(opp.stats) - ovr(f.stats);
    const diffLabel = diff > 8 ? 'HEAVY UNDERDOG' : diff > 3 ? 'UNDERDOG'
                    : diff < -8 ? 'HEAVY FAVORITE' : diff < -3 ? 'FAVORITE' : 'EVEN FIGHT';
    const diffCls   = diff > 3 ? 'hard' : diff < -3 ? 'easy' : 'even';

    grid.appendChild(el('div', { class:'co-card' },
      el('div', { class:'co-card-head' },
        el('div', { class:'co-avatar' }, initials(opp.name)),
        el('div', { class:'co-info' },
          el('div', { class:'co-name' }, opp.name),
          opp.nick ? el('div', { class:'co-nick' }, `"${opp.nick}"`) : null,
          el('div', { class:'co-meta-row' },
            el('span', { class:'co-tag' }, opp.country),
            el('span', { class:'co-tag' }, opp.style.toUpperCase()),
            opp.ranking != null
              ? el('span', { class:'co-tag' }, `#${opp.ranking}`)
              : el('span', { class:'co-tag muted' }, 'NR'),
          ),
          el('div', { class:'co-record' }, `${recordStr(opp.record)} · OVR ${ovr(opp.stats)}`),
          el('div', { class:`co-diff ${diffCls}` }, diffLabel),
        ),
      ),
      coCompare(f.stats, opp.stats),
      el('button', { class:'btn co-fight-btn',
        onclick: () => launchCareerFight(root, career, opp, isTitleFight),
      }, isTitleFight ? 'FIGHT FOR THE TITLE' : 'ACCEPT FIGHT'),
    ));
  });

  wrap.appendChild(grid);
  wrap.appendChild(el('div', { class:'ch-back-row' },
    el('button', { class:'btn ghost', onclick: () => renderCareerHub(root, career) }, '← BACK'),
  ));
  root.appendChild(wrap);
}

function coCompare(pStats, oStats) {
  const keys = ['striking','power','speed','tdo','grapple','chin','cardio'];
  const wrap = el('div', { class:'co-compare' });
  keys.forEach(k => {
    const pv = pStats[k] || 0, ov = oStats[k] || 0;
    wrap.appendChild(el('div', { class:'co-cmp-row' },
      el('span', { class:'co-cmp-you ' + (pv >= ov ? 'up' : 'dn') }, pv),
      el('span', { class:'co-cmp-key' }, k.replace('_',' ').toUpperCase()),
      el('span', { class:'co-cmp-opp ' + (ov >= pv ? 'up' : 'dn') }, ov),
    ));
  });
  return wrap;
}

// ══════════════════════════════════════════════════════════
//  LAUNCH FIGHT
// ══════════════════════════════════════════════════════════
function launchCareerFight(root, career, opponent, isTitleFight) {
  const playerCopy = JSON.parse(JSON.stringify(career.fighter));
  const fs = new FightScreen(root, playerCopy, opponent, {
    titleFight:  isTitleFight,
    careerMode:  true,
    onFightEnd:  (result) => {
      const summary = processResult(career, result, opponent);
      renderCareerPostFight(root, career, summary, opponent);
    },
  });
  fs.mount();
}

// ══════════════════════════════════════════════════════════
//  POST-FIGHT SCREEN
// ══════════════════════════════════════════════════════════
function renderCareerPostFight(root, career, summary, opponent) {
  root.innerHTML = '';
  const wrap = el('div', { class:'cpf-screen screen' });

  const cls  = summary.won ? 'win' : summary.draw ? 'draw' : 'loss';
  const word = summary.won ? 'VICTORY' : summary.draw ? 'DRAW' : 'DEFEAT';
  const METHOD = {
    KO:'KNOCKOUT', TKO:'TECHNICAL KO', SUB:'SUBMISSION',
    UD:'UNANIMOUS DECISION', SD:'SPLIT DECISION', MD:'MAJORITY DECISION', DRAW:'DRAW',
  };
  const methodFull = METHOD[summary.method] || summary.method;

  wrap.appendChild(el('div', { class:`cpf-banner ${cls}` },
    el('div', { class:'cpf-result' }, word),
    el('div', { class:'cpf-method' },
      methodFull + (summary.by ? ` · ${summary.by}` : '') + (summary.round ? ` R${summary.round}` : '')),
    el('div', { class:'cpf-vs' }, `vs ${opponent.name}`),
  ));

  // Earnings
  const basePay = summary.earned - summary.bonuses.reduce((s,b) => s+b.amount, 0);
  const earn = el('div', { class:'cpf-earn' },
    el('div', { class:'cpf-earn-hd' }, `FIGHT PURSE · ${summary.tier}`),
    el('div', { class:'cpf-earn-row' },
      el('span', {}, 'BASE PAY'),
      el('span', { class:'cpf-earn-val' }, fmtMoney(basePay)),
    ),
  );
  summary.bonuses.forEach(b => {
    earn.appendChild(el('div', { class:'cpf-earn-row bonus' },
      el('span', {}, b.label),
      el('span', { class:'cpf-earn-val gold' }, `+${fmtMoney(b.amount)}`),
    ));
  });
  earn.appendChild(el('div', { class:'cpf-earn-row total' },
    el('span', {}, 'TOTAL'),
    el('span', { class:'cpf-earn-val' }, fmtMoney(summary.earned)),
  ));
  wrap.appendChild(earn);

  // Stat exp
  if (Object.keys(summary.expGains).length > 0) {
    const sg = el('div', { class:'cpf-exp' },
      el('div', { class:'cpf-exp-hd' }, 'EXPERIENCE GAINED'),
    );
    Object.entries(summary.expGains).forEach(([k, v]) => {
      sg.appendChild(el('div', { class:'cpf-exp-row' },
        el('span', {}, k.replace('_',' ').toUpperCase()),
        el('span', { class:'cpf-exp-val' }, `+${v}`),
      ));
    });
    wrap.appendChild(sg);
  }

  // Career notifications
  if (summary.notifications.length > 0) {
    const notifs = el('div', { class:'cpf-notifs' });
    summary.notifications.forEach(n => {
      notifs.appendChild(el('div', { class:'cpf-notif' },
        el('span', { class:'cpf-notif-icon' }, n.icon),
        el('span', {}, n.text),
      ));
    });
    wrap.appendChild(notifs);
  }

  wrap.appendChild(el('div', { class:'cpf-btn-row' },
    el('button', { class:'btn gold', onclick: () => renderCareerHub(root, career) }, 'BACK TO HUB'),
  ));

  root.appendChild(wrap);
}
