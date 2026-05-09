// Quick balance check for the fight engine (Node).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = [
  'data/fighters.js',
  'js/utils.js',
  'js/fight-engine.js',
].map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');

const harness = `
function pct(a, b) { return ((a / b) * 100).toFixed(1) + '%'; }

function show(label, redId, blueId, n) {
  if (n == null) n = 500;
  const r = getFighter(redId), b = getFighter(blueId);
  if (!r || !b) { console.log('MISSING: ' + redId + ' or ' + blueId); return; }
  const t0 = Date.now();
  const out = simulateMany(r, b, n);
  const total = out.redWins + out.blueWins + out.draws;
  console.log('\\n=== ' + label + ' (' + n + ' sims, ' + (Date.now()-t0) + 'ms) ===');
  console.log('RED  (' + r.name + ')  : ' + pct(out.redWins, total) + '  (' + out.redWins + ')');
  console.log('BLUE (' + b.name + ')  : ' + pct(out.blueWins, total) + '  (' + out.blueWins + ')');
  console.log('DRAW             : ' + pct(out.draws, total));
  const finishR = (out.methods.red.KO||0) + (out.methods.red.TKO||0) + (out.methods.red.SUB||0);
  const finishB = (out.methods.blue.KO||0) + (out.methods.blue.TKO||0) + (out.methods.blue.SUB||0);
  console.log('Finish rate: ' + pct(finishR + finishB, total) + ', avg round end ' + out.avgRoundEnded.toFixed(2));
  console.log('  R: KO ' + (out.methods.red.KO||0) + '  TKO ' + (out.methods.red.TKO||0) + '  SUB ' + (out.methods.red.SUB||0) + '  UD ' + (out.methods.red.UD||0) + '  SD ' + (out.methods.red.SD||0));
  console.log('  B: KO ' + (out.methods.blue.KO||0) + '  TKO ' + (out.methods.blue.TKO||0) + '  SUB ' + (out.methods.blue.SUB||0) + '  UD ' + (out.methods.blue.UD||0) + '  SD ' + (out.methods.blue.SD||0));
}

console.log('Loaded fighters: ' + FIGHTERS.length);
show('CHAMP vs JOURNEYMAN (Khabib vs Vega)', 'khabib', 'lw_jm1');
show('TOP vs TOP (Khabib vs Topuria)',       'khabib', 'topuria');
show('GRAPPLER vs STRIKER (Khabib vs McGregor)', 'khabib', 'mcgregor');
show('STRIKER vs STRIKER (Adesanya vs Pereira)', 'adesanya', 'pereira');
show('CHAMP vs JOURNEYMAN MW (Silva vs Hradecky)', 'silva', 'mw_jm1');
show('CHAMP vs ELITE (GSP vs Usman)',        'gsp', 'usman');
show('GRAPPLER vs GRAPPLER (Khabib vs Islam)', 'khabib', 'islam');
show('STRIKER vs WRESTLER (Topuria vs Islam)',  'topuria', 'islam');
show('STRIKER vs GRAPPLER (Topuria vs Khabib)',  'topuria', 'khabib');
show('PEREIRA vs ADESANYA (kicker vs kicker)',  'pereira', 'adesanya');
show('NATE DIAZ vs USMAN (mismatch)',  'diaz_n', 'usman');
`;

const ctx = vm.createContext({
  console, Math, Date, Array, Object, JSON, Number,
  performance: { now: () => Date.now() },
});
vm.runInContext(code + harness, ctx);
