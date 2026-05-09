/* ==============================================================
   APEX FC — App router
   ============================================================== */

const SCREENS = {
  home:       { render: renderHome },
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

function renderEvents(root) {
  const screen = el('section', { class:'screen' });
  screen.appendChild(el('div', { class:'section-head' },
    el('h2', { class:'section-title' }, 'EVENTS'),
    el('div', { class:'section-sub' }, 'COMING SOON // CARD BUILDER'),
  ));
  screen.appendChild(el('div', { class:'empty' }, 'EVENT SYSTEM IN DEVELOPMENT — USE MATCHMAKER FOR NOW'));
  root.appendChild(screen);
}

// Wire up nav
document.addEventListener('DOMContentLoaded', () => {
  $$('.nav-btn').forEach(b => {
    b.addEventListener('click', () => navigateTo(b.dataset.screen));
  });
  $('#rosterCount').textContent = `${FIGHTERS.length} FIGHTERS LOADED`;
  navigateTo('home');
});
