/* ============================================================
   APEX FC — Fighter Database
   Stats are 0–100 (UFC-game scale). Fighters are in their primes.
   Schema:
     id, name, nick, country, weight (lbs), wclass,
     record { w, l, d }, finishes { ko, sub, dec_l, dec_w },
     popularity (0–100), ranking (1–15 | null), pfp (1–15 | null),
     champion: bool, style, tendencies { stand: 0–1, td: 0–1 },
     stats: { striking, power, speed, kicking, boxing, clinch,
              tdo, tdd, grapple, sub_off, sub_def, chin, cardio, iq }
   ============================================================ */

const WCLASSES = [
  { id: 'fly',  label: 'FLYWEIGHT',       lbs: 125 },
  { id: 'bnt',  label: 'BANTAMWEIGHT',    lbs: 135 },
  { id: 'fea',  label: 'FEATHERWEIGHT',   lbs: 145 },
  { id: 'lw',   label: 'LIGHTWEIGHT',     lbs: 155 },
  { id: 'ww',   label: 'WELTERWEIGHT',    lbs: 170 },
  { id: 'mw',   label: 'MIDDLEWEIGHT',    lbs: 185 },
  { id: 'lhw',  label: 'LIGHT HEAVYWEIGHT', lbs: 205 },
  { id: 'hw',   label: 'HEAVYWEIGHT',     lbs: 265 },
  // women's
  { id: 'wstr', label: "WOMEN'S STRAWWEIGHT", lbs: 115 },
  { id: 'wfly', label: "WOMEN'S FLYWEIGHT",   lbs: 125 },
  { id: 'wbnt', label: "WOMEN'S BANTAMWEIGHT", lbs: 135 },
];

// Helper to build a fighter
function f(o) { return o; }

const FIGHTERS = [

  // ============ LIGHTWEIGHT ============
  f({ id:'khabib', name:'Khabib Nurmagomedov', nick:'The Eagle', country:'RUS',
      weight:155, wclass:'lw', age:30,
      record:{ w:29, l:0, d:0 }, finishes:{ ko:8, sub:11, dec_w:10, dec_l:0 },
      popularity:97, ranking:0, pfp:1, champion:true,
      style:'wrestler', tendencies:{ stand:0.15, td:0.95 },
      stats:{ striking:78, power:78, speed:82, kicking:70, boxing:80, clinch:92,
              tdo:99, tdd:96, grapple:99, sub_off:92, sub_def:96, chin:92, cardio:95, iq:96 },
      visual:{ build:'stocky', stance:'sambo', skin:'#c8906a', hair:'#1a1108', beard:true, beardColor:'#1a1108', shorts:'#c9a030', country_color:'#003580' }
  }),
  f({ id:'topuria', name:'Ilia Topuria', nick:'El Matador', country:'GEO/ESP',
      weight:155, wclass:'lw', age:28,
      record:{ w:16, l:0, d:0 }, finishes:{ ko:9, sub:5, dec_w:2, dec_l:0 },
      popularity:88, ranking:1, pfp:5, champion:false,
      style:'kickboxer', tendencies:{ stand:0.85, td:0.35 },
      stats:{ striking:93, power:95, speed:88, kicking:85, boxing:94, clinch:84,
              tdo:80, tdd:88, grapple:84, sub_off:82, sub_def:86, chin:90, cardio:88, iq:90 },
      visual:{ build:'athletic', stance:'orthodox', skin:'#d4a077', hair:'#1a1108', beard:false, beardColor:'#1a1108', shorts:'#cc2211', country_color:'#e8192c' }
  }),
  f({ id:'islam', name:'Islam Makhachev', nick:'', country:'RUS',
      weight:155, wclass:'lw', age:31,
      record:{ w:26, l:1, d:0 }, finishes:{ ko:5, sub:11, dec_w:10, dec_l:1 },
      popularity:84, ranking:2, pfp:2, champion:false,
      style:'wrestler', tendencies:{ stand:0.30, td:0.85 },
      stats:{ striking:84, power:82, speed:84, kicking:82, boxing:84, clinch:90,
              tdo:95, tdd:92, grapple:96, sub_off:94, sub_def:92, chin:88, cardio:92, iq:93 },
      visual:{ build:'athletic', stance:'sambo', skin:'#c8906a', hair:'#1a1108', beard:true, beardColor:'#1a1108', shorts:'#003580', country_color:'#003580' }
  }),
  f({ id:'oliveira', name:'Charles Oliveira', nick:'do Bronx', country:'BRA',
      weight:155, wclass:'lw', age:31,
      record:{ w:34, l:9, d:0 }, finishes:{ ko:10, sub:21, dec_w:3, dec_l:6 },
      popularity:86, ranking:3, pfp:9, champion:false,
      style:'grappler', tendencies:{ stand:0.45, td:0.65 },
      stats:{ striking:86, power:88, speed:86, kicking:80, boxing:86, clinch:84,
              tdo:84, tdd:78, grapple:96, sub_off:99, sub_def:84, chin:80, cardio:90, iq:88 },
      visual:{ build:'lean', stance:'orthodox', skin:'#a0632a', hair:'#0a0503', beard:false, beardColor:'#0a0503', shorts:'#009c3b', country_color:'#009c3b' }
  }),
  f({ id:'poirier', name:'Dustin Poirier', nick:'The Diamond', country:'USA',
      weight:155, wclass:'lw', age:30,
      record:{ w:29, l:7, d:1 }, finishes:{ ko:14, sub:7, dec_w:8, dec_l:5 },
      popularity:90, ranking:4, pfp:null, champion:false,
      style:'boxer', tendencies:{ stand:0.78, td:0.30 },
      stats:{ striking:90, power:90, speed:86, kicking:78, boxing:94, clinch:84,
              tdo:74, tdd:80, grapple:80, sub_off:84, sub_def:82, chin:88, cardio:88, iq:88 },
      visual:{ build:'athletic', stance:'orthodox', skin:'#e8c49a', hair:'#3a2010', beard:true, beardColor:'#3a2010', shorts:'#1a3a6a', country_color:'#3c3b6e' }
  }),
  f({ id:'mcgregor', name:'Conor McGregor', nick:'Notorious', country:'IRL',
      weight:155, wclass:'lw', age:28,
      record:{ w:22, l:6, d:0 }, finishes:{ ko:19, sub:1, dec_w:2, dec_l:4 },
      popularity:99, ranking:8, pfp:null, champion:false,
      style:'striker', tendencies:{ stand:0.92, td:0.18 },
      stats:{ striking:92, power:96, speed:92, kicking:80, boxing:92, clinch:78,
              tdo:64, tdd:74, grapple:70, sub_off:72, sub_def:74, chin:84, cardio:78, iq:90 },
      visual:{ build:'lean', stance:'southpaw', skin:'#e8c090', hair:'#1a1108', beard:true, beardColor:'#1a1108', shorts:'#1a6b1a', country_color:'#169b62' }
  }),
  f({ id:'lw_jm1', name:'Marco Vega', nick:'', country:'MEX',
      weight:155, wclass:'lw', age:29,
      record:{ w:14, l:7, d:0 }, finishes:{ ko:5, sub:2, dec_w:7, dec_l:4 },
      popularity:18, ranking:null, pfp:null, champion:false,
      style:'well-rounded', tendencies:{ stand:0.55, td:0.45 },
      stats:{ striking:72, power:74, speed:70, kicking:68, boxing:72, clinch:70,
              tdo:72, tdd:70, grapple:70, sub_off:68, sub_def:70, chin:80, cardio:78, iq:72 },
      visual:{ build:'athletic', stance:'orthodox', skin:'#c07840', hair:'#0a0503', beard:false, beardColor:'#0a0503', shorts:'#006847', country_color:'#006847' }
  }),

  // ============ WELTERWEIGHT ============
  f({ id:'gsp', name:'Georges St-Pierre', nick:'Rush', country:'CAN',
      weight:170, wclass:'ww', age:30,
      record:{ w:26, l:2, d:0 }, finishes:{ ko:8, sub:6, dec_w:12, dec_l:1 },
      popularity:96, ranking:0, pfp:3, champion:true,
      style:'well-rounded', tendencies:{ stand:0.50, td:0.70 },
      stats:{ striking:90, power:84, speed:92, kicking:88, boxing:90, clinch:94,
              tdo:96, tdd:94, grapple:94, sub_off:88, sub_def:94, chin:92, cardio:96, iq:99 },
      visual:{ build:'athletic', stance:'orthodox', skin:'#d4a070', hair:'#0a0503', beard:false, beardColor:'#0a0503', shorts:'#cc0000', country_color:'#ff0000' }
  }),
  f({ id:'usman', name:'Kamaru Usman', nick:'The Nigerian Nightmare', country:'NGA/USA',
      weight:170, wclass:'ww', age:32,
      record:{ w:20, l:1, d:0 }, finishes:{ ko:9, sub:1, dec_w:10, dec_l:1 },
      popularity:85, ranking:1, pfp:6, champion:false,
      style:'wrestler', tendencies:{ stand:0.45, td:0.75 },
      stats:{ striking:88, power:88, speed:86, kicking:80, boxing:90, clinch:94,
              tdo:96, tdd:92, grapple:94, sub_off:80, sub_def:90, chin:92, cardio:94, iq:92 },
      visual:{ build:'stocky', stance:'sambo', skin:'#5a3318', hair:'#0a0503', beard:false, beardColor:'#0a0503', shorts:'#008751', country_color:'#008751' }
  }),
  f({ id:'chimaev', name:'Khamzat Chimaev', nick:'Borz', country:'RUS/SWE',
      weight:170, wclass:'ww', age:27,
      record:{ w:13, l:0, d:0 }, finishes:{ ko:7, sub:5, dec_w:1, dec_l:0 },
      popularity:88, ranking:2, pfp:8, champion:false,
      style:'wrestler', tendencies:{ stand:0.40, td:0.85 },
      stats:{ striking:86, power:90, speed:88, kicking:78, boxing:86, clinch:94,
              tdo:96, tdd:88, grapple:96, sub_off:90, sub_def:88, chin:86, cardio:80, iq:84 },
      visual:{ build:'stocky', stance:'sambo', skin:'#c8906a', hair:'#1a1108', beard:true, beardColor:'#2a1a08', shorts:'#006aa7', country_color:'#006aa7' }
  }),
  f({ id:'edwards', name:'Leon Edwards', nick:'Rocky', country:'JAM/GBR',
      weight:170, wclass:'ww', age:30,
      record:{ w:22, l:3, d:0 }, finishes:{ ko:8, sub:3, dec_w:11, dec_l:3 },
      popularity:78, ranking:3, pfp:null, champion:false,
      style:'kickboxer', tendencies:{ stand:0.75, td:0.40 },
      stats:{ striking:90, power:84, speed:88, kicking:90, boxing:86, clinch:84,
              tdo:78, tdd:88, grapple:82, sub_off:80, sub_def:86, chin:88, cardio:90, iq:90 },
      visual:{ build:'lean', stance:'wide_kick', skin:'#5a3318', hair:'#0a0503', beard:false, beardColor:'#0a0503', shorts:'#012169', country_color:'#012169' }
  }),
  f({ id:'diaz_n', name:'Nate Diaz', nick:'', country:'USA',
      weight:170, wclass:'ww', age:30,
      record:{ w:21, l:13, d:0 }, finishes:{ ko:5, sub:11, dec_w:5, dec_l:9 },
      popularity:92, ranking:null, pfp:null, champion:false,
      style:'boxer', tendencies:{ stand:0.70, td:0.30 },
      stats:{ striking:84, power:74, speed:80, kicking:72, boxing:88, clinch:80,
              tdo:72, tdd:78, grapple:88, sub_off:92, sub_def:86, chin:96, cardio:96, iq:84 },
      visual:{ build:'lean', stance:'southpaw', skin:'#c8906a', hair:'#0a0503', beard:false, beardColor:'#0a0503', shorts:'#3c3b6e', country_color:'#3c3b6e' }
  }),

  // ============ MIDDLEWEIGHT ============
  f({ id:'silva', name:'Anderson Silva', nick:'The Spider', country:'BRA',
      weight:185, wclass:'mw', age:33,
      record:{ w:34, l:11, d:0 }, finishes:{ ko:23, sub:3, dec_w:8, dec_l:7 },
      popularity:95, ranking:0, pfp:4, champion:true,
      style:'striker', tendencies:{ stand:0.92, td:0.10 },
      stats:{ striking:99, power:90, speed:96, kicking:96, boxing:94, clinch:92,
              tdo:60, tdd:78, grapple:78, sub_off:84, sub_def:80, chin:88, cardio:88, iq:99 },
      visual:{ build:'tall_lean', stance:'upright_drop', skin:'#a0632a', hair:'#0a0503', beard:false, beardColor:'#0a0503', shorts:'#009c3b', country_color:'#009c3b' }
  }),
  f({ id:'adesanya', name:'Israel Adesanya', nick:'The Last Stylebender', country:'NGA/NZL',
      weight:185, wclass:'mw', age:30,
      record:{ w:24, l:3, d:0 }, finishes:{ ko:15, sub:0, dec_w:9, dec_l:3 },
      popularity:90, ranking:1, pfp:7, champion:false,
      style:'kickboxer', tendencies:{ stand:0.88, td:0.10 },
      stats:{ striking:96, power:90, speed:92, kicking:96, boxing:90, clinch:80,
              tdo:54, tdd:76, grapple:62, sub_off:60, sub_def:70, chin:84, cardio:88, iq:94 },
      visual:{ build:'tall_lean', stance:'wide_kick', skin:'#6a3d1a', hair:'#0a0503', beard:false, beardColor:'#0a0503', shorts:'#000000', country_color:'#000000' }
  }),
  f({ id:'pereira', name:'Alex Pereira', nick:'Poatan', country:'BRA',
      weight:185, wclass:'mw', age:33,
      record:{ w:11, l:2, d:0 }, finishes:{ ko:8, sub:0, dec_w:3, dec_l:1 },
      popularity:88, ranking:2, pfp:null, champion:false,
      style:'kickboxer', tendencies:{ stand:0.92, td:0.08 },
      stats:{ striking:94, power:99, speed:84, kicking:96, boxing:90, clinch:82,
              tdo:48, tdd:74, grapple:58, sub_off:50, sub_def:64, chin:90, cardio:80, iq:88 },
      visual:{ build:'heavy', stance:'wide_kick', skin:'#8a4a22', hair:'#0a0503', beard:false, beardColor:'#0a0503', shorts:'#ffcc00', country_color:'#009c3b' }
  }),
  f({ id:'ddp', name:'Dricus du Plessis', nick:'Stillknocks', country:'RSA',
      weight:185, wclass:'mw', age:30,
      record:{ w:21, l:2, d:0 }, finishes:{ ko:12, sub:6, dec_w:3, dec_l:1 },
      popularity:74, ranking:3, pfp:null, champion:false,
      style:'scrambler', tendencies:{ stand:0.55, td:0.55 },
      stats:{ striking:84, power:90, speed:78, kicking:78, boxing:84, clinch:88,
              tdo:84, tdd:84, grapple:88, sub_off:88, sub_def:84, chin:92, cardio:86, iq:82 },
      visual:{ build:'stocky', stance:'orthodox', skin:'#e0b890', hair:'#1a1108', beard:true, beardColor:'#4a3018', shorts:'#007a4d', country_color:'#007a4d' }
  }),
  f({ id:'strick', name:'Sean Strickland', nick:'Tarzan', country:'USA',
      weight:185, wclass:'mw', age:30,
      record:{ w:28, l:6, d:0 }, finishes:{ ko:10, sub:4, dec_w:14, dec_l:5 },
      popularity:78, ranking:4, pfp:null, champion:false,
      style:'boxer', tendencies:{ stand:0.85, td:0.20 },
      stats:{ striking:88, power:78, speed:80, kicking:74, boxing:90, clinch:80,
              tdo:64, tdd:84, grapple:74, sub_off:72, sub_def:84, chin:96, cardio:94, iq:84 },
      visual:{ build:'athletic', stance:'orthodox', skin:'#e8c090', hair:'#6a4020', beard:false, beardColor:'#6a4020', shorts:'#8b0000', country_color:'#3c3b6e' }
  }),
  f({ id:'mw_jm1', name:'Tomáš Hradecký', nick:'', country:'CZE',
      weight:185, wclass:'mw', age:31,
      record:{ w:11, l:5, d:0 }, finishes:{ ko:4, sub:2, dec_w:5, dec_l:3 },
      popularity:14, ranking:null, pfp:null, champion:false,
      style:'well-rounded', tendencies:{ stand:0.55, td:0.45 },
      stats:{ striking:70, power:72, speed:66, kicking:68, boxing:72, clinch:70,
              tdo:70, tdd:68, grapple:72, sub_off:68, sub_def:70, chin:78, cardio:76, iq:72 },
      visual:{ build:'athletic', stance:'orthodox', skin:'#e0c090', hair:'#5a3010', beard:false, beardColor:'#5a3010', shorts:'#d7141a', country_color:'#d7141a' }
  }),
];

// Helpers
function getFighter(id) { return FIGHTERS.find(f => f.id === id); }
function getWClass(id)  { return WCLASSES.find(w => w.id === id); }
function fightersInDivision(wclassId) {
  return FIGHTERS.filter(f => f.wclass === wclassId)
    .sort((a, b) => {
      if (a.champion && !b.champion) return -1;
      if (!a.champion && b.champion) return 1;
      const ar = a.ranking ?? 99, br = b.ranking ?? 99;
      return ar - br;
    });
}
function p4pList() {
  return FIGHTERS.filter(f => f.pfp != null).sort((a, b) => a.pfp - b.pfp);
}

// Compute "OVR" for display
function ovr(s) {
  return Math.round(
    (s.striking*1.5 + s.boxing*1.0 + s.kicking*0.7 + s.power*1.0 + s.speed*0.8 +
     s.clinch*0.7 + s.tdo*0.9 + s.tdd*0.9 + s.grapple*1.1 + s.sub_off*0.6 +
     s.sub_def*0.6 + s.chin*1.1 + s.cardio*1.1 + s.iq*1.0) / 13.0
  );
}
