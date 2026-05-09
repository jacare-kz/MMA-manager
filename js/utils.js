/* Misc helpers used throughout the app. */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') node.className = attrs[k];
    else if (k === 'dataset') Object.assign(node.dataset, attrs[k]);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
    else if (k === 'html') node.innerHTML = attrs[k];
    else if (attrs[k] === false || attrs[k] == null) { /* skip — boolean false = attribute absent */ }
    else if (attrs[k] === true) node.setAttribute(k, '');
    else node.setAttribute(k, attrs[k]);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    if (typeof c === 'string' || typeof c === 'number') node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  }
  return node;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
function randi(lo, hi) { return Math.floor(rand(lo, hi + 1)); }
function chance(p) { return Math.random() < p; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickWeighted(items) {
  // items: [{ v, w }]
  const total = items.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const it of items) { if ((r -= it.w) <= 0) return it.v; }
  return items[items.length - 1].v;
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function initials(name) {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function recordStr(r) { return `${r.w}-${r.l}${r.d ? '-' + r.d : ''}`; }
