/* ==============================================================
   APEX FC — Fight Simulation Engine
   Pure logic. Returns a list of timed events for the visualizer.

   Design summary:
   - Round-based, each round = configurable seconds.
   - Position state machine: STANDING / CLINCH / GROUND_R_TOP / GROUND_B_TOP.
   - Per "exchange" (~15s of in-fight time): one action resolves, events emit.
   - HP and stamina drive finishes; stamina also weakens effective stats.
   - Stylistic matchups adjust action-selection weights (striker prefers stand,
     wrestler shoots, grappler hunts subs from top).
   - Underdogs win via: variance in accuracy, lucky power shots, scrambles
     finding takedowns/subs, stamina collapse of a heavier favorite.
   ============================================================== */

const POS = { STAND: 'stand', CLINCH: 'clinch', GROUND_R: 'ground_r_top', GROUND_B: 'ground_b_top' };

function simulateFight(redIn, blueIn, opts = {}) {
  const titleFight = opts.titleFight ?? false;
  const numRounds = titleFight ? 5 : 3;
  const roundLen = 300; // seconds

  // Mutable copies of fighter state for the fight
  const red  = makeState(redIn,  'red');
  const blue = makeState(blueIn, 'blue');

  const ev = [];
  let t = 0;
  let pos = POS.STAND;
  let finish = null;

  // Round-by-round scoring
  const roundScores = [];

  ev.push({ t, type: 'INTRO',
    text: `${redIn.name.toUpperCase()} vs ${blueIn.name.toUpperCase()} — ${getWClass(redIn.wclass).label}`,
    big: true });

  for (let r = 1; r <= numRounds; r++) {
    ev.push({ t, type:'ROUND_START', round:r,
      text:`РАУНД ${r} НАЧАЛСЯ`, big:true, flash:'red' });

    const roundStartT = t;
    const roundEndT = roundStartT + roundLen;
    // per-round stat deltas
    const rs = newRoundStats();

    while (t < roundEndT && !finish) {
      const dt = randi(8, 18);
      t += dt;
      if (t > roundEndT) t = roundEndT;

      // Run one exchange
      const { events, newPos, fin } = runExchange({ red, blue, pos, t, round:r, roundStats:rs });
      pos = newPos;
      events.forEach(e => ev.push(e));

      if (fin) {
        finish = fin;
        break;
      }
    }

    if (finish) break;

    ev.push({ t, type:'ROUND_END', round:r, text:`РАУНД ${r} ОКОНЧЕН`, big:true });

    // Score the round
    const score = scoreRound(red, blue, rs);
    roundScores.push(score);
    ev.push({ t, type:'ROUND_SCORE', round:r,
      text:`СУДЬИ: ${score.red}-${score.blue} (${score.who === 'red' ? redIn.name : score.who === 'blue' ? blueIn.name : 'РАВНО'})` });

    // Reset position to standing between rounds, partial recovery
    pos = POS.STAND;
    red.stamina  = clamp(red.stamina  + 14, 0, 100);
    blue.stamina = clamp(blue.stamina + 14, 0, 100);
    // Small HP recovery (damage settles)
    red.hp  = clamp(red.hp  + 4, 0, 100);
    blue.hp = clamp(blue.hp + 4, 0, 100);
  }

  // Determine final result
  let result;
  if (finish) {
    result = finish;
  } else {
    // Decision
    result = decideByCards(roundScores, red, blue, redIn, blueIn);
  }

  ev.push({ t, type:'FIGHT_END', result, big:true, flash: result.winner === 'red' ? 'red' : 'blue',
    text: announceResult(result, redIn, blueIn) });

  return {
    events: ev,
    result,
    finalStats: { red: red.stats, blue: blue.stats },
    roundScores,
    fighters: { red: redIn, blue: blueIn },
  };
}

// ============== State construction ==============
function makeState(f, corner) {
  return {
    id: f.id,
    name: f.name,
    corner,
    s: { ...f.stats }, // base stats
    hp: 100,
    stamina: 100,
    // Cumulative tracked stats across the whole fight
    stats: {
      strikes_landed: 0,
      strikes_attempted: 0,
      sig_strikes: 0,
      power_strikes: 0,
      knockdowns: 0,
      takedowns_landed: 0,
      takedowns_attempted: 0,
      control_seconds: 0,
      sub_attempts: 0,
      damage_dealt: 0,
    },
    style: f.style,
    tendencies: f.tendencies,
    // ring rust / mental state
    wobbles: 0, // accumulating wobble counter; high → KO risk
  };
}

// Get effective stat (lowered by stamina)
function eff(stateOrStats, key) {
  const stats = stateOrStats.s ?? stateOrStats;
  const stam = stateOrStats.stamina ?? 100;
  // At 100 stam: full. At 0 stam: 60% effectiveness.
  const mult = 0.60 + 0.40 * (stam / 100);
  return stats[key] * mult;
}

// ============== Round stats ==============
function newRoundStats() {
  return {
    red:  { strikes:0, sig:0, td:0, control:0, damage:0, knockdowns:0 },
    blue: { strikes:0, sig:0, td:0, control:0, damage:0, knockdowns:0 },
  };
}

// ============== Core exchange resolution ==============
function runExchange({ red, blue, pos, t, round, roundStats }) {
  const events = [];
  let newPos = pos;
  let fin = null;

  // Stamina drains every exchange (just being active)
  drainStamina(red, 0.6);
  drainStamina(blue, 0.6);

  // Determine initiator: who pushes the action
  const initiator = pickInitiator(red, blue, pos);
  const defender  = initiator === red ? blue : red;

  // Pick action category
  const action = pickAction(initiator, defender, pos);

  // Resolve action
  switch (action) {
    case 'STRIKE': {
      const o = resolveStriking(initiator, defender, pos, t, round, roundStats);
      events.push(...o.events);
      if (o.fin) fin = o.fin;
      break;
    }
    case 'TAKEDOWN': {
      const o = resolveTakedown(initiator, defender, pos, t, round, roundStats);
      events.push(...o.events);
      newPos = o.newPos;
      break;
    }
    case 'CLINCH_WORK': {
      const o = resolveClinch(initiator, defender, pos, t, round, roundStats);
      events.push(...o.events);
      newPos = o.newPos;
      if (o.fin) fin = o.fin;
      break;
    }
    case 'GROUND_WORK': {
      const o = resolveGroundWork(initiator, defender, pos, t, round, roundStats);
      events.push(...o.events);
      newPos = o.newPos;
      if (o.fin) fin = o.fin;
      break;
    }
    case 'STAND_UP': {
      newPos = POS.STAND;
      drainStamina(initiator, 1.5);
      events.push(makeEv(t, round, initiator,
        `${initiator.name} поднимается в стойку.`));
      break;
    }
  }

  // Attach state snapshots to last event for visualizer
  attachSnapshot(events, red, blue);

  return { events, newPos, fin };
}

// Who pushes the action this exchange
function pickInitiator(red, blue, pos) {
  // Position bias: top control = much higher chance to dictate
  let redW = 1, blueW = 1;
  if (pos === POS.GROUND_R) { redW *= 4; blueW *= 0.6; }
  if (pos === POS.GROUND_B) { redW *= 0.6; blueW *= 4; }
  // Aggression by IQ + striking (cardio if low → less push)
  redW  *= (red.s.iq  + red.s.striking) / 200 * (0.7 + 0.3 * red.stamina/100);
  blueW *= (blue.s.iq + blue.s.striking) / 200 * (0.7 + 0.3 * blue.stamina/100);
  return chance(redW / (redW + blueW)) ? red : blue;
}

// Pick action by initiator's intent + position
function pickAction(initiator, defender, pos) {
  const t = initiator.tendencies;
  if (pos === POS.STAND) {
    const wStrike = 0.25 + 1.5 * t.stand;
    const wTd     = 0.10 + 1.6 * t.td;
    const wClinch = 0.20 + 0.6 * (initiator.s.clinch / 100);
    return pickWeighted([
      { v:'STRIKE',      w: wStrike },
      { v:'TAKEDOWN',    w: wTd },
      { v:'CLINCH_WORK', w: wClinch },
    ]);
  }
  if (pos === POS.CLINCH) {
    return pickWeighted([
      { v:'CLINCH_WORK', w: 1 + (initiator.s.clinch / 60) },
      { v:'TAKEDOWN',    w: 0.8 + 1.0 * t.td },
      { v:'STRIKE',      w: 0.4 },
      { v:'STAND_UP',    w: 0.2 + (defender.s.clinch / 200) },
    ]);
  }
  // GROUND
  const onTop = (pos === POS.GROUND_R && initiator.corner === 'red') ||
                (pos === POS.GROUND_B && initiator.corner === 'blue');
  if (onTop) {
    return pickWeighted([
      { v:'GROUND_WORK', w: 2 },
      { v:'STAND_UP',    w: 0.2 },
    ]);
  } else {
    // From bottom: scramble or sub from guard (rare unless grappler)
    return pickWeighted([
      { v:'GROUND_WORK', w: 0.6 + 0.5 * (initiator.s.grapple / 100) },
      { v:'STAND_UP',    w: 1 + (initiator.s.tdd / 100) },
    ]);
  }
}

// ============== STRIKING ==============
function resolveStriking(att, def, pos, t, round, rs) {
  const events = [];
  let fin = null;

  // Pick strike type
  const type = pickStrikeType(att);
  const meta = STRIKE_META[type];

  drainStamina(att, meta.stamCost);

  // Land probability
  const attSkill = eff(att, 'striking') * 0.5 + eff(att, meta.skillKey) * 0.3 + eff(att, 'speed') * 0.2;
  const defSkill = eff(def, 'iq') * 0.4 + eff(def, 'striking') * 0.3 + eff(def, 'speed') * 0.3;
  const landProb = clamp(0.50 + (attSkill - defSkill) / 140 + meta.accuracyMod, 0.10, 0.92);

  rs[att.corner].strikes += 1;
  att.stats.strikes_attempted += 1;

  if (chance(landProb)) {
    // Landed
    const baseDmg = randi(meta.dmgLo, meta.dmgHi);
    const powerMult = 0.7 + (eff(att, 'power') / 100) * 0.7; // 0.7 .. 1.4
    const chinResist = 0.75 + (eff(def, 'chin') / 100) * 0.4; // 0.75 .. 1.15 divisor
    const stamMult  = 0.7 + 0.3 * (att.stamina / 100);
    let dmg = baseDmg * powerMult * stamMult / chinResist;
    // Wobble bonus — already-hurt fighters take more
    if (def.hp < 50) dmg *= 1 + (50 - def.hp) / 120;
    dmg = Math.round(clamp(dmg, 1, 35));

    def.hp = clamp(def.hp - dmg, 0, 100);
    att.stats.strikes_landed += 1;
    if (meta.sig) att.stats.sig_strikes += 1;
    if (meta.power) att.stats.power_strikes += 1;
    att.stats.damage_dealt += dmg;
    rs[att.corner].sig += meta.sig ? 1 : 0;
    rs[att.corner].damage += dmg;

    // Knockdown chance — every clean power shot has a real KD chance
    let knockdown = false;
    if (meta.power) {
      const kdProb = clamp(
        Math.max(0, dmg - 4) * 0.045 +
        (1 - def.s.chin / 100) * 0.45 +
        (1 - def.stamina / 100) * 0.30 +
        (def.wobbles > 0 ? 0.10 * def.wobbles : 0),
        0.0, 0.75);
      if (chance(kdProb)) {
        knockdown = true;
        att.stats.knockdowns += 1;
        rs[att.corner].knockdowns += 1;
        def.wobbles += 1;
      }
    } else if (dmg >= 6 && def.hp < 30 && chance(0.20)) {
      // Even a non-power shot can wobble a hurt fighter
      knockdown = true;
      att.stats.knockdowns += 1;
      rs[att.corner].knockdowns += 1;
      def.wobbles += 1;
    }

    const verb = meta.verb[Math.floor(Math.random() * meta.verb.length)];
    let text = `<span class="${att.corner}">${att.name}</span> ${verb}`;
    if (dmg >= 10) text = `<span class="${att.corner}">${att.name}</span> попадает мощно — ${verb}!`;

    events.push(makeEv(t, round, att, text, dmg >= 10));

    if (knockdown) {
      events.push(makeEv(t, round, att,
        `НОКДАУН! <span class="${def.corner}">${def.name}</span> на полу!`,
        true, 'huge', att.corner));

      // Follow-up: defender HP very low → potential TKO
      if (def.hp < 25 || (def.hp < 40 && chance(0.4))) {
        // Ref watches GnP for a beat — chance of TKO
        if (chance(0.55)) {
          fin = { type:'KO', winner:att.corner, round, t, by:meta.label };
          events.push(makeEv(t+2, round, att,
            `И ВСЁ! РЕФЕРИ ОСТАНАВЛИВАЕТ БОЙ!`, true, 'huge', att.corner));
        } else {
          events.push(makeEv(t+2, round, att,
            `${att.name} в добивании, но ${def.name} переживает шквал.`));
          drainStamina(att, 4);
        }
      } else {
        // Add some dmg from follow-up
        const followDmg = randi(4, 10);
        def.hp = clamp(def.hp - followDmg, 0, 100);
        events.push(makeEv(t+2, round, att,
          `${att.name} добивает в партере, но ${def.name} держится.`));
        if (def.hp <= 0) {
          fin = { type:'TKO', winner:att.corner, round, t, by:meta.label };
          events.push(makeEv(t+3, round, att,
            `БОЙ ОСТАНОВЛЕН! ТЕХНИЧЕСКИЙ НОКАУТ!`, true, 'huge', att.corner));
        }
      }
    } else if (def.hp <= 0) {
      // Direct KO
      fin = { type:'KO', winner:att.corner, round, t, by:meta.label };
      events.push(makeEv(t+1, round, att,
        `НОКАУТ! ${def.name.toUpperCase()} ПАДАЕТ!`, true, 'huge', att.corner));
    }
  } else {
    // Missed — possible counter
    const counterProb = 0.18 + (eff(def, 'iq') - eff(att, 'iq')) / 300;
    if (chance(clamp(counterProb, 0.05, 0.4))) {
      // Counter strike, smaller exchange
      const cType = pickStrikeType(def);
      const cMeta = STRIKE_META[cType];
      const cDmg = Math.round(randi(cMeta.dmgLo, cMeta.dmgHi) * (0.7 + eff(def,'power')/120) / (0.85 + eff(att,'chin')/200));
      if (cDmg > 0 && chance(0.7)) {
        att.hp = clamp(att.hp - cDmg, 0, 100);
        def.stats.strikes_landed += 1;
        def.stats.damage_dealt += cDmg;
        if (cMeta.sig) def.stats.sig_strikes += 1;
        rs[def.corner].sig += cMeta.sig ? 1 : 0;
        rs[def.corner].damage += cDmg;
        events.push(makeEv(t, round, def,
          `${att.name} промахивается, <span class="${def.corner}">${def.name}</span> ловит на контратаке — ${cMeta.label.toLowerCase()}!`));
        if (att.hp <= 0) {
          fin = { type:'KO', winner:def.corner, round, t, by:'COUNTER ' + cMeta.label };
          events.push(makeEv(t+1, round, def,
            `НОКАУТ КОНТРАТАКОЙ!`, true, 'huge', def.corner));
        }
      } else {
        events.push(makeEv(t, round, att, `${att.name} промахивается, ${def.name} уходит чисто.`));
      }
    } else {
      const text = pick([
        `${att.name} выбрасывает ${meta.label.toLowerCase()} — мимо.`,
        `${att.name} промахивается ${meta.label.toLowerCase()}.`,
        `${def.name} уклоняется от ${meta.label.toLowerCase()}.`,
      ]);
      events.push(makeEv(t, round, att, text));
    }
  }

  return { events, fin };
}

// Strike types
const STRIKE_META = {
  jab:        { label:'ДЖЕБ',         skillKey:'boxing',   dmgLo:2, dmgHi:5,  accuracyMod:0.10, sig:false, power:false, stamCost:0.5,
                verb:['проводит джеб','выбрасывает джеб в голову','точно джебом отмеряет дистанцию'] },
  cross:      { label:'КРОСС',        skillKey:'boxing',   dmgLo:5, dmgHi:9,  accuracyMod:0.0, sig:true, power:true, stamCost:1.0,
                verb:['пробивает прямой правой','бросает кросс','хлёстко бьёт прямым'] },
  hook:       { label:'ХУК',          skillKey:'boxing',   dmgLo:5, dmgHi:11, accuracyMod:-0.05, sig:true, power:true, stamCost:1.2,
                verb:['заряжает левый хук','выстреливает хуком','цепляет хуком в челюсть'] },
  uppercut:   { label:'АПЕРКОТ',      skillKey:'boxing',   dmgLo:6, dmgHi:12, accuracyMod:-0.08, sig:true, power:true, stamCost:1.3,
                verb:['пробивает апперкот','находит апперкот снизу','подсаживает апперкотом'] },
  leg:        { label:'ЛОУ-КИК',      skillKey:'kicking',  dmgLo:3, dmgHi:6,  accuracyMod:0.05, sig:true, power:false, stamCost:0.8,
                verb:['рубит лоу-кик','хлещет по бедру','забивает ногу лоу-киком'] },
  body:       { label:'УДАР В КОРПУС',skillKey:'kicking',  dmgLo:4, dmgHi:8,  accuracyMod:-0.05, sig:true, power:false, stamCost:1.5,
                verb:['рубит миддл-кик в корпус','хлещет по печени','садит в корпус'] },
  head_kick:  { label:'ХАЙ-КИК',      skillKey:'kicking',  dmgLo:8, dmgHi:14, accuracyMod:-0.18, sig:true, power:true, stamCost:1.8,
                verb:['пытается хай-кик','летит ногой в голову','рубит хай-киком'] },
};

function pickStrikeType(att) {
  // Style influences strike preference
  const isStriker  = ['striker','kickboxer','boxer'].includes(att.style);
  const isKicker   = att.style === 'kickboxer';
  const isBoxer    = att.style === 'boxer';
  return pickWeighted([
    { v:'jab',       w: 1.6 + (isBoxer ? 0.6 : 0) },
    { v:'cross',     w: 1.4 + (isBoxer ? 0.5 : 0) },
    { v:'hook',      w: 1.2 + (isBoxer ? 0.4 : 0) + (isStriker ? 0.2 : 0) },
    { v:'uppercut',  w: 0.7 + (isBoxer ? 0.3 : 0) },
    { v:'leg',       w: 1.0 + (isKicker ? 1.0 : 0) },
    { v:'body',      w: 0.7 + (isKicker ? 0.7 : 0) },
    { v:'head_kick', w: 0.3 + (isKicker ? 0.7 : 0) },
  ]);
}

// ============== TAKEDOWN ==============
function resolveTakedown(att, def, pos, t, round, rs) {
  const events = [];
  drainStamina(att, 4);

  att.stats.takedowns_attempted += 1;
  const succ = clamp(0.40 + (eff(att,'tdo') - eff(def,'tdd')) / 100 + (eff(att,'speed') - eff(def,'speed')) / 200, 0.05, 0.92);
  if (chance(succ)) {
    const newPos = att.corner === 'red' ? POS.GROUND_R : POS.GROUND_B;
    att.stats.takedowns_landed += 1;
    rs[att.corner].td += 1;
    // Slamming damage
    const dmg = randi(2, 6);
    def.hp = clamp(def.hp - dmg, 0, 100);
    rs[att.corner].damage += dmg;
    events.push(makeEv(t, round, att,
      `<span class="${att.corner}">${att.name}</span> ныряет в проход и переводит в партер!`, true));
    return { events, newPos };
  } else {
    drainStamina(def, 1.5);
    events.push(makeEv(t, round, att,
      `${att.name} тянется за тейкдауном — ${def.name} отбивает проход.`));
    return { events, newPos: pos };
  }
}

// ============== CLINCH ==============
function resolveClinch(att, def, pos, t, round, rs) {
  const events = [];
  let fin = null;
  drainStamina(att, 1.0);
  drainStamina(def, 0.6);

  // If not in clinch yet, get into it
  if (pos !== POS.CLINCH) {
    const succ = clamp(0.55 + (eff(att,'clinch') - eff(def,'clinch'))/120, 0.2, 0.92);
    if (chance(succ)) {
      events.push(makeEv(t, round, att,
        `${att.name} клинчует у сетки.`));
      return { events, newPos: POS.CLINCH };
    } else {
      events.push(makeEv(t, round, att,
        `${att.name} тянется в клинч — ${def.name} срывает захват.`));
      return { events, newPos: pos };
    }
  }

  // Already clinching — knees / dirty boxing
  rs[att.corner].control += 6;
  att.stats.control_seconds += 6;
  const knee = chance(0.45 + att.s.clinch/300);
  if (knee) {
    const land = chance(clamp(0.50 + (eff(att,'clinch') - eff(def,'clinch'))/100, 0.15, 0.85));
    if (land) {
      const dmg = Math.round(randi(4,9) * (0.8 + eff(att,'power')/200) / (0.85 + eff(def,'chin')/200));
      def.hp = clamp(def.hp - dmg, 0, 100);
      att.stats.strikes_landed += 1;
      att.stats.sig_strikes += 1;
      att.stats.damage_dealt += dmg;
      rs[att.corner].sig += 1;
      rs[att.corner].damage += dmg;
      events.push(makeEv(t, round, att,
        `<span class="${att.corner}">${att.name}</span> прилетает коленом в корпус из клинча.`));
      if (def.hp <= 0) {
        fin = { type:'TKO', winner:att.corner, round, t, by:'KNEE' };
        events.push(makeEv(t+1, round, att,
          `${def.name} складывается! Бой остановлен!`, true, 'huge', att.corner));
      }
    } else {
      events.push(makeEv(t, round, att, `${att.name} ищет колено в клинче, но мимо.`));
    }
  } else {
    events.push(makeEv(t, round, att, `${att.name} прижимает к сетке, контролирует клинч.`));
  }
  return { events, newPos: pos, fin };
}

// ============== GROUND ==============
function resolveGroundWork(att, def, pos, t, round, rs) {
  const events = [];
  let newPos = pos;
  let fin = null;

  const onTop = (pos === POS.GROUND_R && att.corner === 'red') ||
                (pos === POS.GROUND_B && att.corner === 'blue');

  if (onTop) {
    drainStamina(att, 1.0);
    drainStamina(def, 1.5);
    rs[att.corner].control += 12;
    att.stats.control_seconds += 12;

    // Decide: GnP, advance, sub. Strikers/wrestlers prefer GnP, grapplers hunt subs.
    const subBias = att.style === 'grappler' ? 0.9 : 0.25;
    const action = pickWeighted([
      { v:'GNP',     w: 1.8 },
      { v:'ADVANCE', w: 0.8 + att.s.grapple / 200 },
      { v:'SUB',     w: subBias + att.s.sub_off / 200 },
    ]);

    if (action === 'GNP') {
      const land = chance(clamp(0.55 + (eff(att,'grapple') - eff(def,'grapple'))/200, 0.25, 0.92));
      if (land) {
        // Solid GnP — does meaningful damage
        const baseDmg = randi(3, 11);
        const powerM = 0.8 + eff(att,'power')/200;
        const chinResist = 0.85 + eff(def,'chin')/200;
        let dmg = Math.round(baseDmg * powerM / chinResist);
        if (def.hp < 50) dmg = Math.round(dmg * (1 + (50 - def.hp) / 100));
        dmg = clamp(dmg, 1, 25);
        def.hp = clamp(def.hp - dmg, 0, 100);
        att.stats.strikes_landed += 1;
        att.stats.sig_strikes += 1;
        att.stats.damage_dealt += dmg;
        rs[att.corner].sig += 1;
        rs[att.corner].damage += dmg;
        events.push(makeEv(t, round, att,
          `<span class="${att.corner}">${att.name}</span> работает в граунд-н-паунде сверху.`));
        if (def.hp <= 0) {
          fin = { type:'TKO', winner:att.corner, round, t, by:'GROUND-AND-POUND' };
          events.push(makeEv(t+1, round, att,
            `Рефери прыгает! Бой остановлен в партере!`, true, 'huge', att.corner));
        }
      } else {
        events.push(makeEv(t, round, att,
          `${att.name} пытается удары сверху, ${def.name} закрывает гард.`));
      }
    } else if (action === 'ADVANCE') {
      const succ = chance(clamp(0.40 + (eff(att,'grapple') - eff(def,'grapple'))/120, 0.1, 0.85));
      if (succ) {
        events.push(makeEv(t, round, att,
          `<span class="${att.corner}">${att.name}</span> проходит гард, переводит в маунт.`, true));
      } else {
        events.push(makeEv(t, round, att,
          `${att.name} ищет проход, но ${def.name} держит гард.`));
      }
    } else { // SUB
      att.stats.sub_attempts += 1;
      const subProb = clamp(0.18 + (eff(att,'sub_off') - eff(def,'sub_def'))/110 + (1 - def.stamina/100)*0.15, 0.03, 0.65);
      if (chance(subProb)) {
        // Deep sub — defender tries to escape
        const subType = pick(['РЕАР НЕЙКЕД ЧОУК','ТРЕУГОЛЬНИК','ГИЛЬОТИНА','РЫЧАГ ЛОКТЯ','КИМУРА','АНАКОНДА']);
        events.push(makeEv(t, round, att,
          `<span class="${att.corner}">${att.name}</span> ловит на ${subType.toLowerCase()}!`, true, 'big'));
        // Escape chance
        const escProb = clamp(0.45 + (eff(def,'sub_def') - eff(att,'sub_off'))/120 - (1 - def.hp/100)*0.2, 0.08, 0.85);
        if (chance(escProb)) {
          events.push(makeEv(t+2, round, def,
            `${def.name} защищается и выскальзывает!`));
          // Maybe scrambles to top
          if (chance(0.25)) {
            newPos = def.corner === 'red' ? POS.GROUND_R : POS.GROUND_B;
            events.push(makeEv(t+3, round, def,
              `${def.name} перекатывается наверх в скрэмбле!`, true));
          }
        } else {
          fin = { type:'SUB', winner:att.corner, round, t, by:subType };
          events.push(makeEv(t+2, round, att,
            `${def.name} ХЛОПАЕТ! САБМИШН ГОТОВ!`, true, 'huge', att.corner));
        }
      } else {
        events.push(makeEv(t, round, att,
          `${att.name} ищет шею, но ${def.name} прячет подбородок.`));
      }
    }
  } else {
    // From bottom — sub from guard or attempt to stand
    drainStamina(att, 1.2);
    rs[def.corner].control += 6;
    def.stats.control_seconds += 6;

    // Guard sub
    if (att.style === 'grappler' && chance(0.25 + att.s.sub_off/300)) {
      att.stats.sub_attempts += 1;
      const subProb = clamp(0.10 + (eff(att,'sub_off') - eff(def,'sub_def'))/140, 0.02, 0.45);
      if (chance(subProb)) {
        const subType = pick(['ТРЕУГОЛЬНИК','АРМБАР С ГАРДА','ОМОПЛАТА','ГИЛЬОТИНА']);
        events.push(makeEv(t, round, att,
          `${att.name} закидывает ${subType.toLowerCase()} с гарда!`, true, 'big'));
        const escProb = clamp(0.50 + (eff(def,'sub_def') - eff(att,'sub_off'))/120, 0.12, 0.85);
        if (chance(escProb)) {
          events.push(makeEv(t+2, round, def, `${def.name} вырывает руку, выскакивает.`));
        } else {
          fin = { type:'SUB', winner:att.corner, round, t, by:subType };
          events.push(makeEv(t+2, round, att,
            `${def.name} ВЫНУЖДЕН ХЛОПАТЬ!`, true, 'huge', att.corner));
        }
      } else {
        events.push(makeEv(t, round, att,
          `${att.name} активно работает с гарда.`));
      }
    } else {
      events.push(makeEv(t, round, def,
        `${def.name} удерживает позицию сверху, дожимает.`));
    }
  }

  return { events, newPos, fin };
}

function drainStamina(s, amount) {
  // Cardio mitigates drain. 90+ cuts ~30%, 70-90 ~15%, <70 full.
  const cardio = s.s.cardio;
  let mult = 1;
  if (cardio >= 90)      mult = 0.65;
  else if (cardio >= 80) mult = 0.78;
  else if (cardio >= 70) mult = 0.90;
  else if (cardio < 60)  mult = 1.15;
  s.stamina = clamp(s.stamina - amount * mult, 0, 100);
}

// ============== Scoring ==============
function scoreRound(red, blue, rs) {
  const r = rs.red, b = rs.blue;
  // Combine: damage(2x), sig strikes, td, control time, knockdowns(huge)
  const rScore = r.damage*2 + r.sig*1.5 + r.td*4 + r.control*0.05 + r.knockdowns*15;
  const bScore = b.damage*2 + b.sig*1.5 + b.td*4 + b.control*0.05 + b.knockdowns*15;
  // Add small judge variance
  const noise = (Math.random() - 0.5) * 4;
  const diff = (rScore - bScore) + noise;

  let red10 = 10, blue10 = 10;
  if (Math.abs(diff) < 1) {
    // very close round, often 10-9 still — flip a coin slightly biased
    if (diff > 0) blue10 = 9; else red10 = 9;
  } else if (diff > 0) {
    blue10 = (diff > 18 || r.knockdowns >= 1) ? 8 : 9;
    if (diff > 35) blue10 = 7;
  } else {
    red10 = (-diff > 18 || b.knockdowns >= 1) ? 8 : 9;
    if (-diff > 35) red10 = 7;
  }

  const who = red10 > blue10 ? 'red' : red10 < blue10 ? 'blue' : 'tie';
  return { red: red10, blue: blue10, who };
}

function decideByCards(scores, red, blue, redIn, blueIn) {
  // Three judges, slightly different evaluations
  function judge() {
    let r = 0, b = 0;
    for (const s of scores) { r += s.red; b += s.blue; }
    // tiny per-judge swing
    r += randi(-1, 1) * 0.5; b += randi(-1, 1) * 0.5;
    return { r, b };
  }
  const j1 = judge(), j2 = judge(), j3 = judge();
  let rWins = 0, bWins = 0, draws = 0;
  for (const j of [j1, j2, j3]) {
    if (j.r > j.b) rWins++;
    else if (j.b > j.r) bWins++;
    else draws++;
  }

  let winner;
  let kind = 'DEC';
  if (rWins >= 2) winner = 'red';
  else if (bWins >= 2) winner = 'blue';
  else { winner = null; kind = 'DRAW'; }

  // Detect unanimous vs split
  if (winner) {
    const unan = (winner === 'red' && rWins === 3) || (winner === 'blue' && bWins === 3);
    kind = unan ? 'UD' : 'SD';
  }

  const cards = [j1, j2, j3].map(j => `${Math.round(j.r)}-${Math.round(j.b)}`).join(', ');
  return { type: kind, winner, by: 'DECISION', cards };
}

// ============== Helpers ==============
function makeEv(t, round, actor, text, big = false, kind = '', flash = '') {
  return {
    t, round,
    type: 'PLAY',
    actor: actor ? actor.corner : null,
    text, big,
    kind: kind || (big ? 'big' : ''),
    flash: flash || (big && actor ? actor.corner : ''),
  };
}

function attachSnapshot(events, red, blue) {
  if (events.length === 0) return;
  const last = events[events.length - 1];
  last.snap = {
    redHP: red.hp, blueHP: blue.hp,
    redStam: red.stamina, blueStam: blue.stamina,
    redStats: { ...red.stats },
    blueStats: { ...blue.stats },
  };
}

function announceResult(res, redIn, blueIn) {
  if (res.type === 'DRAW') return `НИЧЬЯ ПО РЕШЕНИЮ СУДЕЙ (${res.cards})`;
  const wname = res.winner === 'red' ? redIn.name : blueIn.name;
  if (res.type === 'KO')  return `${wname.toUpperCase()} ВЫИГРЫВАЕТ НОКАУТОМ (${res.by}, Р${res.round})`;
  if (res.type === 'TKO') return `${wname.toUpperCase()} ВЫИГРЫВАЕТ ТЕХНИЧЕСКИМ НОКАУТОМ (${res.by}, Р${res.round})`;
  if (res.type === 'SUB') return `${wname.toUpperCase()} ВЫИГРЫВАЕТ САБМИШНОМ — ${res.by} (Р${res.round})`;
  if (res.type === 'UD')  return `${wname.toUpperCase()} ВЫИГРЫВАЕТ ЕДИНОГЛАСНЫМ РЕШЕНИЕМ (${res.cards})`;
  if (res.type === 'SD')  return `${wname.toUpperCase()} ВЫИГРЫВАЕТ РАЗДЕЛЬНЫМ РЕШЕНИЕМ (${res.cards})`;
  return `${wname.toUpperCase()} ВЫИГРЫВАЕТ`;
}

// ============== Quick batch sim (for test lab) ==============
function simulateMany(redIn, blueIn, n, opts = {}) {
  const out = {
    redWins: 0, blueWins: 0, draws: 0,
    methods: { red: { KO:0, TKO:0, SUB:0, UD:0, SD:0 },
               blue: { KO:0, TKO:0, SUB:0, UD:0, SD:0 } },
    avgRoundEnded: 0,
    finishesEarly: 0,
  };
  let roundSum = 0;
  for (let i = 0; i < n; i++) {
    const r = simulateFight(redIn, blueIn, opts);
    if (r.result.type === 'DRAW') out.draws++;
    else if (r.result.winner === 'red') {
      out.redWins++;
      out.methods.red[r.result.type] = (out.methods.red[r.result.type] || 0) + 1;
    } else {
      out.blueWins++;
      out.methods.blue[r.result.type] = (out.methods.blue[r.result.type] || 0) + 1;
    }
    if (['KO','TKO','SUB'].includes(r.result.type)) {
      out.finishesEarly++;
      roundSum += r.result.round;
    } else {
      roundSum += (opts.titleFight ? 5 : 3);
    }
  }
  out.avgRoundEnded = roundSum / n;
  return out;
}
