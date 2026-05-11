/* ==============================================================
   APEX FC — App router
   ============================================================== */

const SCREENS = {
  home:       { render: renderHome },
  career:     { render: renderCareer },
  roster:     { render: renderRoster },
  rankings:   { render: renderRankings },
  matchmaker: { render: renderMatchmaker },
  events:     { render: renderEvents },
  testlab:    { render: renderTestLab },
};

let currentScreen = 'home';

function navigateTo(name) {
  if (!SCREENS[name]) return;
  currentScreen = name;
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === name));
  const root = $('#app');
  root.innerHTML = '';
  SCREENS[name].render(root);
}

function renderHome(root) {
  const tpl = $('#tpl-home').content.cloneNode(true);
  root.appendChild(tpl);
  // Wire up the tile buttons
  $$('.tile', root).forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.screen));
  });
}


// Game selector
function initGameSelector() {
  const overlay = $('#game-selector');
  $('#pick-mma').addEventListener('click', () => {
    overlay.classList.add('hidden');
  });
  $('#pick-chess').addEventListener('click', () => {
    window.location.href = 'chess.html';
  });
}

// Wire up nav
document.addEventListener('DOMContentLoaded', () => {
  $$('.nav-btn').forEach(b => {
    b.addEventListener('click', () => navigateTo(b.dataset.screen));
  });
  $('#rosterCount').textContent = `${FIGHTERS.length} FIGHTERS LOADED`;
  navigateTo('home');
  initGameSelector();
});
