// The street, the camera that walks along it, and the frame around them.
import { DOORS, T } from './content.js';
import { render, cleanup } from './cards.js';
import * as wx from './weather.js';

const H = 1000, GROUND = 880;
const qs = new URLSearchParams(location.search);
const $ = s => document.querySelector(s);
const stage = $('#stage'), world = $('#world'), far = $('#far'), fg = $('#fg'), card = $('#card'), cardBody = $('#card-body'), wheel = $('#wheel'), hint = $('#hint'), toastEl = $('#toast');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const state = {
  lang: localStorage.sp_lang || 'de',
  opened: new Set(JSON.parse(localStorage.sp_opened || '[]')),
  today: today(), focus: 0, card: 0, busy: false,
};
// ?preview=14 pretends it is December 14; ?preview=all unlocks everything.
function today() {
  const p = qs.get('preview');
  if (p === 'all') return 24;
  if (p) return clamp(+p || 0, 0, 24);
  const d = new Date();
  if (d.getFullYear() > 2026) return 24;
  if (d.getFullYear() < 2026 || d.getMonth() < 11) return 0;
  return Math.min(24, d.getDate());
}
const t = (k, ...a) => { const v = T[k][state.lang]; return typeof v === 'function' ? v(...a) : v; };

// ---------- build the street: one house per day, in order ----------
let seed = 2026;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const ROOFS = ['gable', 'flat', 'arch', 'step', 'shed', 'arch', 'gable', 'flat'];
const STAR = '<svg viewBox="-20 -20 40 40"><polygon fill="currentColor" points="20,0 8.3,3.4 14.1,14.1 3.4,8.3 0,20 -3.4,8.3 -14.1,14.1 -8.3,3.4 -20,0 -8.3,-3.4 -14.1,-14.1 -3.4,-8.3 0,-20 3.4,-8.3 14.1,-14.1 8.3,-3.4"/></svg>';
const houses = {};
let cursor = 320;
for (let n = 1; n <= 24; n++) {
  const tall = n % 3 === 1 || rnd() > 0.65;
  const w = Math.round(230 + rnd() * 110), h = Math.round(tall ? 600 + rnd() * 190 : 380 + rnd() * 150);
  const roof = ROOFS[Math.floor(rnd() * ROOFS.length)];
  const rd = { gable: w * 0.38, arch: w / 2, step: 60, shed: w * 0.28, flat: 0 }[roof];
  const wy = Math.round({ gable: rd * 0.78 + 30, arch: rd * 0.55 + 46, step: 100, shed: rd + 40, flat: 50 }[roof]);
  houses[n] = { n, x: cursor, w, h, roof, rd, wy, line: n % 4 === 3, px: cursor + w / 2, py: GROUND - h + wy + 80 };
  cursor += w + Math.round(24 + rnd() * 80);
}
const W = cursor + 320;
[world, far, fg].forEach(l => { l.style.width = W + 'px'; });

function houseSvg(o) {
  const { w, h, rd, roof, wy } = o;
  const body = {
    flat: `M0 0H${w}V${h}H0Z`,
    gable: `M0 ${h}V${rd}L${w / 2} 0L${w} ${rd}V${h}Z`,
    arch: `M0 ${h}V${w / 2}A${w / 2} ${w / 2} 0 0 1 ${w} ${w / 2}V${h}Z`,
    step: `M0 ${h}V60H${w * 0.25}V0H${w * 0.75}V60H${w}V${h}Z`,
    shed: `M0 ${h}V${rd}L${w} 0V${h}Z`,
  }[roof];
  let s = `<path class="body" d="${body}"/>`, i = 0;
  const cols = w > 290 ? 3 : 2, gap = (w - cols * 46) / (cols + 1), eyeAt = Math.floor(rnd() * 6);
  for (let y = wy + 210; y + 60 < h - 130; y += 96) for (let c = 0; c < cols; c++, i++) {
    const x = gap + c * (46 + gap);
    s += i === eyeAt
      ? `<ellipse class="eye" cx="${x + 23}" cy="${y + 30}" rx="30" ry="19"/><circle class="pupil" cx="${x + 23}" cy="${y + 30}" r="9"/>`
      : `<rect class="dw" style="--i:${i}" x="${x}" y="${y}" width="46" height="60"/>`;
  }
  const dx = Math.round(w * (0.3 + rnd() * 0.4));
  s += `<path class="dw" style="--i:${i}" d="M${dx - 30} ${h}V${h - 60}a30 30 0 0 1 60 0V${h}Z"/>`;
  return `<svg viewBox="0 0 ${w} ${h}">${s}</svg>`;
}

const els = {};
let html = '<div class="ground"></div>';
for (const o of Object.values(houses)) {
  const d = String(o.n).padStart(2, '0');
  html += `<button type="button" class="house ${o.line ? 'line' : 'solid'}" data-n="${o.n}" style="left:${o.x}px;top:${GROUND - o.h}px;width:${o.w}px;height:${o.h}px">${houseSvg(o)}` +
    `<span class="win" style="left:${(o.w - 130) / 2}px;top:${o.wy}px"><span class="room">${STAR}<i>${o.n}</i></span><span class="sh l"><b>${d[0]}</b></span><span class="sh r"><b>${d[1]}</b></span></span></button>`;
}
world.innerHTML = html;
world.querySelectorAll('.house').forEach(e => {
  els[e.dataset.n] = e;
  e.addEventListener('click', ev => { if (!ev.detail) tapHouse(+e.dataset.n); }); // keyboard only; pointers go through the stage
});
// Distant skyline, in outline.
{
  let s = '', x = 0;
  while (x < W * 0.5 + 2600) {
    const w = 110 + rnd() * 170, h = 240 + rnd() * 460, y = GROUND - h;
    s += rnd() > 0.5 ? `<path d="M${x} ${GROUND}V${y + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V${GROUND}"/>` : `<path d="M${x} ${GROUND}V${y}h${w}V${GROUND}"/>`;
    x += w + rnd() * 60;
  }
  far.innerHTML = `<svg width="${x}" height="${H}">${s}</svg>`;
}
// Trees and lamps in front, moving a little faster than the houses.
{
  let s = '', x = 150, k = 0;
  while (x < W * 1.2 + 1200) {
    s += k++ % 2
      ? `<g class="lamp"><path d="M${x} 905V640"/><circle cx="${x}" cy="630" r="15"/></g>`
      : `<path class="tree" d="M${x} 705l44 70h-22l42 66h-24l44 64H${x - 84}l44-64h-24l42-66h-22z"/>`;
    x += 620 + rnd() * 620;
  }
  fg.innerHTML = `<svg width="${x}" height="${H}">${s}</svg>`;
}

for (const d of DOORS) {
  const w = document.createElement('button');
  w.type = 'button'; w.textContent = d.n; w.dataset.n = d.n;
  w.addEventListener('click', () => tapHouse(d.n));
  wheel.append(w);
}
let nearest = 0;
function paint() {
  for (const d of DOORS) {
    const e = els[d.n], w = wheel.children[d.n - 1], locked = d.n > state.today, opened = state.opened.has(d.n) && !locked;
    e.classList.toggle('locked', locked); e.classList.toggle('opened', opened);
    e.classList.toggle('today', d.n === state.today && !opened);
    e.setAttribute('aria-label', `${t('date', d.n)}${locked ? ' 🔒' : ''}`);
    w.classList.toggle('locked', locked); w.classList.toggle('done', opened); w.classList.toggle('on', d.n === nearest);
  }
  const n = state.today;
  hint.hidden = false;
  if (!n) hint.textContent = t('soon', Math.max(1, Math.ceil((new Date(2026, 11, 1) - new Date()) / 864e5)));
  else hint.textContent = state.opened.has(n) ? t('reopen', n) : t('find', n);
}
hint.addEventListener('click', () => state.today && tapHouse(state.today));

// ---------- camera: walks left and right, zooms in only for a card ----------
const cam = { x: 0, y: 0, z: 1 };
let vw, vh, raf = 0, vel = 0;
const baseZ = () => Math.max(vh / H, 0.5);
function fit() { vw = innerWidth; vh = innerHeight; apply(); }
function apply(free) {
  if (!free && !state.card) {
    cam.z = baseZ(); cam.y = H - vh / 2 / cam.z;
    cam.x = clamp(cam.x, vw / 2 / cam.z, W - vw / 2 / cam.z);
  }
  const off = cam.x * cam.z - vw / 2, ty = vh / 2 - cam.y * cam.z, sc = ` scale(${cam.z})`;
  world.style.transform = `translate3d(${-off}px,${ty}px,0)` + sc;
  far.style.transform = `translate3d(${-off * 0.45}px,${ty}px,0)` + sc;
  fg.style.transform = `translate3d(${-off * 1.2}px,${ty}px,0)` + sc;
  let best = 1;
  for (let n = 2; n <= 24; n++) if (Math.abs(houses[n].px - cam.x) < Math.abs(houses[best].px - cam.x)) best = n;
  if (best !== nearest && !state.card) {
    if (nearest) wheel.children[nearest - 1].classList.remove('on');
    nearest = best; wheel.children[best - 1].classList.add('on');
    wheel.scrollTo({ left: wheel.children[best - 1].offsetLeft - wheel.clientWidth / 2 + 19, behavior: 'smooth' });
  }
}
function fly(x, y, z, ms = 900) {
  cancelAnimationFrame(raf); vel = 0;
  const a = { ...cam }, t0 = performance.now();
  return new Promise(done => {
    const step = now => {
      const k = Math.min(1, (now - t0) / ms), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      cam.x = a.x + (x - a.x) * e; cam.y = a.y + (y - a.y) * e; cam.z = a.z + (z - a.z) * e;
      apply(true);
      if (k < 1) raf = requestAnimationFrame(step); else { apply(); done(); }
    };
    raf = requestAnimationFrame(step);
  });
}
const wide = () => vw >= 900;
const walkX = n => clamp(houses[n].px, vw / 2 / baseZ(), W - vw / 2 / baseZ());
function walkTo(n) {
  const x = walkX(n), z = baseZ();
  return fly(x, H - vh / 2 / z, z, clamp(Math.abs(x - cam.x) * 0.45, 350, 1900));
}
function zoomTo(n) {
  const o = houses[n], z = Math.min(baseZ() * 1.4, 240 / 160);
  // Keep the window visible beside (desktop) or above (phone) the card.
  const ax = wide() ? (vw - card.offsetWidth - 32) / 2 : vw / 2, ay = wide() ? vh * 0.42 : vh * 0.15;
  return fly(o.px - (ax - vw / 2) / z, o.py - (ay - vh / 2) / z, z, 650);
}

// ---------- pointer: walk, tap ----------
let g = null;
stage.addEventListener('pointerdown', e => {
  if (e.button || g) return;
  stage.setPointerCapture(e.pointerId);
  cancelAnimationFrame(raf); vel = 0;
  const hs = e.target.closest && e.target.closest('.house');
  g = { id: e.pointerId, n: hs ? +hs.dataset.n : 0, x: e.clientX, y: e.clientY, cx: cam.x, t: performance.now(), moved: 0, lx: e.clientX, lt: performance.now() };
});
stage.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') { world.style.setProperty('--ex', (e.clientX / vw * 2 - 1).toFixed(2)); world.style.setProperty('--ey', (e.clientY / vh * 2 - 1).toFixed(2)); }
  if (!g || g.id !== e.pointerId) return;
  const dx = e.clientX - g.x;
  g.moved = Math.max(g.moved, Math.hypot(dx, e.clientY - g.y));
  if (g.moved > 6) stage.classList.add('drag');
  if (state.card || state.busy) return;
  cam.x = g.cx - dx / cam.z; apply();
  const now = performance.now();
  if (now - g.lt > 16) { vel = (e.clientX - g.lx) / (now - g.lt); g.lx = e.clientX; g.lt = now; }
});
function end(e) {
  if (!g || g.id !== e.pointerId) return;
  const o = g; g = null;
  stage.classList.remove('drag');
  if (o.moved < 8 && performance.now() - o.t < 500) {
    if (o.n) tapHouse(o.n); else if (state.card) closeCard();
    return;
  }
  if (vel && !state.card && performance.now() - o.lt < 80) glide();
}
stage.addEventListener('pointerup', end);
stage.addEventListener('pointercancel', end);
function glide() {
  let last = performance.now();
  const step = now => {
    const dt = now - last; last = now;
    cam.x -= vel * dt / cam.z; vel *= 0.94; apply();
    world.style.setProperty('--ex', clamp(-vel, -1, 1).toFixed(2));
    if (Math.abs(vel) > 0.02) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}
stage.addEventListener('wheel', e => {
  e.preventDefault();
  if (state.card || state.busy) return;
  cancelAnimationFrame(raf);
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  cam.x += d * (e.deltaMode ? 30 : 1) / cam.z; apply();
}, { passive: false });
addEventListener('keydown', e => {
  if (e.key === 'Escape') return closeCard();
  if (state.card || $('#onboard').open || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = clamp(nearest + (e.key === 'ArrowRight' ? 1 : -1), 1, 24); walkTo(n); els[n].focus({ preventScroll: true }); }
});

// ---------- houses ----------
function toast(msg) {
  toastEl.textContent = msg; toastEl.hidden = false;
  toastEl.style.animation = 'none'; toastEl.offsetWidth; toastEl.style.animation = '';
  clearTimeout(toast.t); toast.t = setTimeout(() => { toastEl.hidden = true; }, 2400);
}
const replay = (e, cls) => { e.classList.remove(cls); e.offsetWidth; e.classList.add(cls); };
const wait = ms => new Promise(r => setTimeout(r, ms));
async function tapHouse(n) {
  if (state.busy) return;
  const e = els[n];
  if (state.card === n) return;
  if (state.card) closeCard(true);
  if (n > state.today) {
    walkTo(n); replay(e, 'wobble');
    if (navigator.vibrate) navigator.vibrate(30);
    return toast(state.today ? t('sleeps', n - state.today) : t('soon', Math.max(1, Math.ceil((new Date(2026, 11, n) - new Date()) / 864e5))));
  }
  state.busy = true;
  try {
    if (Math.abs(walkX(n) - cam.x) * cam.z > vw * 0.3 || cam.z !== baseZ()) await walkTo(n);
    if (!state.opened.has(n)) {
      // Shutters swing, the house hops, its windows light up one by one.
      state.opened.add(n); localStorage.sp_opened = JSON.stringify([...state.opened]);
      if (navigator.vibrate) navigator.vibrate([12, 60, 20]);
      paint(); replay(e, 'pop');
      await wait(850);
    } else replay(e, 'pop');
  } finally { state.busy = false; }
  openCard(n);
}

// ---------- card: only one open at a time ----------
const cardOpts = () => { const c = (wx.getLoc() || {}).city || ''; return { lang: state.lang, city: c, office: wx.isOffice(c) }; };
function openCard(n) {
  state.card = n;
  cardBody.replaceChildren(render(DOORS[n - 1], cardOpts()));
  cardBody.scrollTop = 0;
  card.classList.remove('out'); card.hidden = false;
  card.style.animation = 'none'; card.offsetWidth; card.style.animation = '';
  document.body.classList.add('card-open');
  zoomTo(n);
  $('#card-close').focus({ preventScroll: true });
}
function closeCard(quiet) {
  if (!state.card) return;
  const n = state.card; state.card = 0;
  cleanup();
  document.body.classList.remove('card-open');
  if (quiet === true) { card.hidden = true; return; }
  card.classList.add('out');
  setTimeout(() => { if (!state.card) card.hidden = true; }, 300);
  const z = baseZ();
  fly(walkX(n), H - vh / 2 / z, z, 600);
  els[n].focus({ preventScroll: true });
}
$('#card-close').addEventListener('click', () => closeCard());

// ---------- language ----------
function setLang(l) {
  state.lang = l; localStorage.sp_lang = l;
  document.documentElement.lang = l;
  $('#lang').classList.toggle('en', l === 'en');
  document.querySelectorAll('[data-t]').forEach(e => { e.textContent = t(e.dataset.t); });
  $('#ob-name').placeholder = l === 'de' ? 'Jana' : 'Jane';
  paint();
  if (state.card) cardBody.replaceChildren(render(DOORS[state.card - 1], cardOpts()));
}
$('#lang').addEventListener('click', () => setLang(state.lang === 'de' ? 'en' : 'de'));

// ---------- name and location ----------
const ob = $('#onboard'), obStatus = $('#ob-status'), obCity = $('#ob-city'), obOther = $('#ob-other');
let pending = null;
function openOnboard() {
  $('#ob-name').value = localStorage.sp_name || '';
  obStatus.textContent = ''; pending = wx.getLoc();
  if (!ob.open) ob.showModal();
}
$('#pill').addEventListener('click', openOnboard);
$('#ob-geo').addEventListener('click', async () => {
  obStatus.textContent = '…';
  try { pending = await wx.geolocate(state.lang, t('somewhere')); obCity.value = ''; obOther.hidden = true; obStatus.textContent = t('ob_ok', pending.city); }
  catch (e) { obStatus.textContent = t('ob_fail'); }
});
obCity.addEventListener('change', () => {
  obOther.hidden = obCity.value !== 'other'; obStatus.textContent = '';
  if (obCity.value && obCity.value !== 'other') pending = wx.useOffice(obCity.value);
  if (obCity.value === 'other') obOther.focus();
});
ob.addEventListener('cancel', e => { if (!localStorage.sp_name || !wx.getLoc()) e.preventDefault(); });
$('#onboard-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('#ob-name').value.trim();
  if (!name) return;
  if (obCity.value === 'other') {
    if (!obOther.value.trim()) return obStatus.textContent = t('ob_need');
    obStatus.textContent = '…';
    try { pending = await wx.searchCity(obOther.value.trim(), state.lang); } catch (x) { pending = null; }
    if (!pending) return obStatus.textContent = t('ob_nocity');
  }
  if (!pending) return obStatus.textContent = t('ob_need');
  localStorage.sp_name = name;
  ob.close(); wx.refresh();
  if (!localStorage.sp_walked) { localStorage.sp_walked = '1'; toast(t('walk')); }
});

// ---------- start: arrive a few houses early and walk up to today ----------
addEventListener('resize', fit);
wx.initSky(() => state.lang);
vw = innerWidth; vh = innerHeight;
const start = state.today || 1;
cam.x = houses[start].px - (state.today ? 900 : 0);
setLang(state.lang);
fit();
wx.refresh();
if (!localStorage.sp_name || !wx.getLoc()) openOnboard();
if (state.today) setTimeout(() => { if (!state.card && !state.busy && !g) walkTo(start); }, 500);
