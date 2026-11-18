// The street, the camera that walks along it, and the frame around them.
import { DOORS, T } from '../../js/content.js';
import { render, cleanup } from '../../js/cards.js';
import * as wx from '../../js/weather.js';
import * as store from '../../js/store.js';
import { initLife, load, art } from './life.js';
import { sfx } from './sound.js';

const H = 1000, GROUND = 880;
const qs = new URLSearchParams(location.search);
const $ = s => document.querySelector(s);
const stage = $('#stage'), world = $('#world'), far = $('#far'), fg = $('#fg'), card = $('#card'), cardBody = $('#card-body'), wheel = $('#wheel'), hint = $('#hint'), toastEl = $('#toast');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ?demo shows a mixed street: day 12, some windows opened, some still shut, the rest locked. Nothing is saved.
const demo = new URLSearchParams(location.search).has('demo');
const state = {
  lang: localStorage.sp_lang || 'de',
  opened: new Set(demo ? [1, 2, 3, 5, 6, 8, 10] : JSON.parse(localStorage.sp_opened || '[]')),
  today: today(), focus: 0, card: 0, busy: false,
};
// ?preview=14 pretends it is December 14; ?preview=all unlocks everything.
function today() {
  const p = qs.get('preview') || (qs.has('demo') ? '12' : null);
  if (p === 'all') return 24;
  if (p) return clamp(+p || 0, 0, 24);
  const d = new Date();
  if (d.getFullYear() > 2026) return 24;
  if (d.getFullYear() < 2026 || d.getMonth() < 11) return 0;
  return Math.min(24, d.getDate());
}
const t = (k, ...a) => { const v = T[k][state.lang]; return typeof v === 'function' ? v(...a) : v; };

// ---------- build the street: one house per day, shuffled so you have to look ----------
let seed = 2026;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const ROOFS = ['gable', 'flat', 'arch', 'step', 'shed', 'arch', 'gable', 'flat'];
const STAR = '<svg viewBox="-20 -20 40 40"><polygon fill="currentColor" points="20,0 8.3,3.4 14.1,14.1 3.4,8.3 0,20 -3.4,8.3 -14.1,14.1 -8.3,3.4 -20,0 -8.3,-3.4 -14.1,-14.1 -3.4,-8.3 0,-20 3.4,-8.3 14.1,-14.1 8.3,-3.4"/></svg>';
// The Strichpunkt eye: the almond, with a pupil that moves separately.
const EYE = 'M36 43.8C51.700 43.8 65.300 34.900 72 21.900 65.300 8.900 51.700 0 36 0 20.300 0 6.700 8.900 0 21.900 6.700 34.900 20.300 43.8 36 43.8Z';
// On a closed day the eye is shut; on its day it opens.
const LOCK = `<svg class="lock" viewBox="0 0 72 44" aria-hidden="true"><g class="o"><path d="${EYE}"/><circle class="pupil" cx="36" cy="21.9" r="13.3"/></g><path class="c" d="M3 16Q36 44 69 16M17 32l-5 9M36 38v10M55 32l5 9"/></svg>`;
const houses = {};
let cursor = 40;
const order = Array.from({ length: 24 }, (_, i) => i + 1);
for (let i = 23; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
const slot = {};
order.forEach((n, i) => {
  slot[n] = i;
  const tall = i % 3 === 1 || rnd() > 0.65;
  const w = Math.round(230 + rnd() * 110), h = Math.min(n === 24 ? 500 : 999, Math.round(tall ? 600 + rnd() * 190 : 380 + rnd() * 150)); // 24 stays low: Santa needs sky above its chimney
  const roof = ROOFS[Math.floor(rnd() * ROOFS.length)];
  const rd = { gable: w * 0.38, arch: w / 2, step: 60, shed: w * 0.28, flat: 0 }[roof];
  const wy = Math.round({ gable: rd * 0.78 + 30, arch: rd * 0.55 + 46, step: 100, shed: rd + 40, flat: 50 }[roof]);
  houses[n] = { n, x: cursor, w, h, roof, rd, wy, line: i % 4 === 3, k: 0, px: cursor + w / 2, py: GROUND - h + wy + 80 };
  cursor += w + Math.round(24 + rnd() * 80);
});
const W = cursor; // the street is a loop of this length
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
      ? `<g transform="translate(${x - 9} ${y + 10}) scale(.89)"><path class="eye" d="${EYE}"/><circle class="pupil" cx="36" cy="21.9" r="13.3"/></g>`
      : `<rect class="dw" style="--i:${i}" x="${x}" y="${y}" width="46" height="60"/>`;
  }
  const dx = Math.round(w * (0.3 + rnd() * 0.4));
  o.door = o.x + dx;
  s += `<path class="dw door" style="--i:${i}" d="M${dx - 30} ${h}V${h - 60}a30 30 0 0 1 60 0V${h}Z"/>`;
  return `<svg viewBox="0 0 ${w} ${h}">${s}</svg>`;
}

const els = {};
let html = '';
for (const o of Object.values(houses)) {
  const d = String(o.n).padStart(2, '0');
  html += `<button type="button" class="house ${o.line ? 'line' : 'solid'}" data-n="${o.n}" style="left:${o.x}px;top:${GROUND - o.h}px;width:${o.w}px;height:${o.h}px">${houseSvg(o)}` +
    `<span class="win" style="left:${(o.w - 130) / 2}px;top:${o.wy}px"><span class="room">${STAR}<i>${o.n}</i></span><span class="sh l"><b>${d[0]}</b></span><span class="sh r"><b>${d[1]}</b></span>${LOCK}<span class="badge" hidden></span><span class="dots"></span></span></button>`;
}
world.innerHTML = html;
world.querySelectorAll('.house').forEach(e => {
  els[e.dataset.n] = e;
  e.addEventListener('click', ev => { if (!ev.detail) tapHouse(+e.dataset.n); }); // keyboard only; pointers go through the stage
});
// Distant skyline, in outline. It repeats, so it is drawn once and tiled.
const FAR_P = W * 0.45;
{
  let s = '', x = 0;
  for (;;) {
    const w = 110 + rnd() * 170, h = 240 + rnd() * 460, y = GROUND - h;
    if (x + w > FAR_P - 10) break;
    s += rnd() > 0.5 ? `<path d="M${x} ${GROUND}V${y + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V${GROUND}"/>` : `<path d="M${x} ${GROUND}V${y}h${w}V${GROUND}"/>`;
    x += w + rnd() * 60;
  }
  far.style.width = FAR_P * 3 + 'px';
  far.innerHTML = [0, 1, 2].map(i => `<svg width="${FAR_P}" height="${H}" style="left:${i * FAR_P}px">${s}</svg>`).join('');
}
// Decorated trees in front, moving a little faster than the houses.
const FG_P = W * 1.2, trees = [];
{
  let x = 150;
  while (x < FG_P - 400) { trees.push({ x: Math.round(x), k: null }); x += 900 + rnd() * 900; }
  art('tree').then(html => {
    fg.innerHTML = trees.map(() => `<span class="ftree">${html}</span>`).join('');
    trees.forEach((tr, i) => { tr.el = fg.children[i]; });
    apply();
  }).catch(() => {});
}
// Shortest way round the loop from house b to house a, in houses (negative = to the left).
const ring = (a, b) => { let d = (slot[a] - slot[b]) % 24; if (d > 12) d -= 24; if (d < -12) d += 24; return d; };
let nearest = 0, life = null;
function paint() {
  for (const d of DOORS) {
    const e = els[d.n], locked = d.n > state.today, opened = state.opened.has(d.n) && !locked;
    e.classList.toggle('locked', locked); e.classList.toggle('opened', opened);
    e.classList.toggle('today', d.n === state.today && !opened);
    e.setAttribute('aria-label', `${t('date', d.n)}${locked ? ' 🔒' : ''}`);
  }
  compass();
  if (life) life.sync();
}
// The sticker only points the way: which direction, and how many houses.
function compass() {
  const n = state.today;
  hint.hidden = false;
  if (!n) return hint.textContent = t('soon', Math.max(1, Math.ceil((new Date(2026, 11, 1) - new Date()) / 864e5)));
  const d = ring(n, nearest || n);
  $('#navL').classList.toggle('to', d < 0); $('#navR').classList.toggle('to', d > 0);
  hint.textContent = d ? t('compass', n, Math.abs(d), Math.sign(d)) : t(state.opened.has(n) ? 'reopen' : 'here', n);
}
// Tapping it walks a few houses that way, never the whole distance.
hint.addEventListener('click', () => {
  const n = state.today;
  if (!n || state.card || state.busy) return;
  const d = ring(n, nearest);
  if (!d) return tapHouse(n);
  walkTo(order[(slot[nearest] + Math.sign(d) * Math.min(3, Math.abs(d)) + 24) % 24]);
});
// On phones two round arrows walk the street; the one that leads to today's door is filled.
const step = dir => { if (!state.card && !state.busy) walkTo(order[(slot[nearest] + dir * 2 + 24) % 24]); };
$('#navL').addEventListener('click', () => step(-1));
$('#navR').addEventListener('click', () => step(1));
// Small counters show where colleagues have left something.
async function badges() {
  try {
    const c = await store.counts();
    for (const n of Object.keys(els)) { const b = els[n].querySelector('.badge'); b.hidden = !c[n]; b.textContent = c[n] || ''; }
    // One dot under a window for each colleague who opened it today.
    const who = await store.presence();
    for (const n of Object.keys(els)) {
      const names = who[n] || [], box = els[n].querySelector('.dots');
      box.replaceChildren(...names.slice(0, 8).map(name => { const i = document.createElement('i'); i.title = name; return i; }));
      if (names.length > 8) { const m = document.createElement('em'); m.textContent = '+' + (names.length - 8); box.append(m); }
    }
  } catch (e) {}
}
function seen(n) {
  if (demo) return;
  const key = `sp_seen_${n}_${new Date().toDateString()}`;
  if (localStorage[key]) return;
  localStorage[key] = '1';
  store.add(n, { kind: 'open' }).then(badges).catch(() => { delete localStorage[key]; });
}

// ---------- camera: walks left and right, zooms in only for a card ----------
const cam = { x: 0, y: 0, z: 1 };
let vw, vh, raf = 0, vel = 0, lastOff = null, lookT = 0;
const baseZ = () => Math.max(vh / H, 0.5);
function fit() { vw = innerWidth; vh = innerHeight; apply(); }
function apply(free) {
  if (!free && !state.card) {
    cam.z = baseZ(); cam.y = H - vh / 2 / cam.z;
  }
  const off = cam.x * cam.z - vw / 2, ty = vh / 2 - cam.y * cam.z, sc = ` scale(${cam.z})`;
  // Eyes on the houses look the way you are walking; baubles swing with it.
  if (lastOff != null && Math.abs(off - lastOff) > 0.4) {
    world.style.setProperty('--ex', clamp((off - lastOff) / 12, -1, 1).toFixed(2));
    clearTimeout(lookT); lookT = setTimeout(() => world.style.setProperty('--ex', 0), 450);
  }
  lastOff = off;
  world.style.transform = `translate3d(${-off}px,${ty}px,0)` + sc;
  // Everything repeats: houses and trees are moved to the copy of themselves nearest to you, the skyline is tiled.
  for (const n in houses) {
    const o = houses[n], k = Math.round((cam.x - o.px) / W);
    if (k !== o.k) { o.k = k; els[n].style.left = o.x + k * W + 'px'; }
  }
  const cf = (off * 1.2 + vw / 2) / cam.z;
  for (const tr of trees) if (tr.el) {
    const k = Math.round((cf - tr.x) / FG_P);
    if (k !== tr.k) { tr.k = k; tr.el.style.left = tr.x - 75 + k * FG_P + 'px'; }
  }
  const fp = FAR_P * cam.z, fo = ((off * 0.45) % fp + fp) % fp;
  $('#ground').style.top = ty + GROUND * cam.z + 'px';
  far.style.transform = `translate3d(${-fo}px,${ty}px,0)` + sc;
  fg.style.transform = `translate3d(${-off * 1.2}px,${ty}px,0)` + sc;
  let best = 1;
  for (let n = 2; n <= 24; n++) if (Math.abs(houses[n].px + houses[n].k * W - cam.x) < Math.abs(houses[best].px + houses[best].k * W - cam.x)) best = n;
  if (best !== nearest && !state.card) {
    nearest = best; compass();
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
const walkX = n => { const o = houses[n]; return o.px + Math.round((cam.x - o.px) / W) * W; };
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
  g = { id: e.pointerId, a: e.target.closest && e.target.closest('.actor'), n: hs ? +hs.dataset.n : 0, x: e.clientX, y: e.clientY, cx: cam.x, t: performance.now(), moved: 0, lx: e.clientX, lt: performance.now() };
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
    if (o.a && life) life.poke(o.a); else if (o.n) tapHouse(o.n); else if (state.card) closeCard();
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
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = order[(slot[nearest] + (e.key === 'ArrowRight' ? 1 : -1) + 24) % 24]; walkTo(n); els[n].focus({ preventScroll: true }); }
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
    sfx.play('locked');
    return toast(state.today ? t('sleeps', n - state.today) : t('soon', Math.max(1, Math.ceil((new Date(2026, 11, n) - new Date()) / 864e5))));
  }
  state.busy = true;
  try {
    if (Math.abs(walkX(n) - cam.x) * cam.z > vw * 0.3 || cam.z !== baseZ()) await walkTo(n);
    if (!state.opened.has(n)) {
      // Shutters swing, the house hops, its windows light up one by one.
      state.opened.add(n); if (!demo) localStorage.sp_opened = JSON.stringify([...state.opened]);
      if (navigator.vibrate) navigator.vibrate([12, 60, 20]);
      sfx.play('open');
      paint(); replay(e, 'pop');
      if (n === 24) await finale(); else await wait(600);
    } else replay(e, 'pop');
  } finally { state.busy = false; }
  openCard(n);
}

// ---------- card: only one open at a time ----------
const cardOpts = () => { const c = (wx.getLoc() || {}).city || ''; return { lang: state.lang, city: c, office: wx.isOffice(c), hush: v => sfx.hush(v), sfx: name => sfx.play(name) }; };
const still = matchMedia('(prefers-reduced-motion:reduce)').matches;
// The window itself grows into the full layer, and shrinks back into it.
function grow(n, open) {
  card.getAnimations().forEach(a => a.cancel()); cardBody.getAnimations().forEach(a => a.cancel());
  const room = els[n].querySelector('.room'), r = room.getBoundingClientRect(), c = card.getBoundingClientRect(), cs = getComputedStyle(card);
  const small = { transform: `translate(${r.left - c.left}px,${r.top - c.top}px) scale(${r.width / c.width},${r.height / c.height})`, borderRadius: '0px', backgroundColor: getComputedStyle(room).backgroundColor };
  const full = { transform: 'none', borderRadius: cs.borderRadius, backgroundColor: cs.backgroundColor };
  const ms = still ? 1 : open ? 720 : 400;
  cardBody.animate(open ? [{ opacity: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0, offset: 0.3 }, { opacity: 0 }], { duration: ms, fill: 'both' });
  return card.animate(open ? [small, full] : [full, small], { duration: ms, easing: 'cubic-bezier(.2,.85,.2,1)', fill: 'both' });
}
// The last window: every house lights up in a wave, stars fly, everyone comes out.
async function finale() {
  for (const m of order) els[m].style.setProperty('--d', Math.abs(slot[m] - slot[24]) * 110 + 'ms');
  document.body.classList.add('finale');
  sfx.play('finale');
  for (const m of order) if (m !== 24) setTimeout(() => replay(els[m], 'pop'), 150 + Math.abs(slot[m] - slot[24]) * 110);
  const r = els[24].querySelector('.room').getBoundingClientRect(), box = document.createElement('div');
  box.className = 'burst'; box.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px`;
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2, d = 160 + Math.random() * 440, star = document.createElement('i');
    star.style.cssText = `--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d - 140}px;--s:${0.5 + Math.random() * 1.3};animation-delay:${Math.random() * 0.25}s`;
    star.innerHTML = STAR; box.append(star);
  }
  document.body.append(box); setTimeout(() => box.remove(), 2800);
  if (life) life.party();
  await wait(still ? 300 : 3000);
}
function openCard(n) {
  state.card = n;
  seen(n);
  cardBody.replaceChildren(render(DOORS[n - 1], cardOpts()));
  card.querySelectorAll('.c-main').forEach(m => { m.scrollTop = 0; }); cardBody.scrollTop = 0;
  card.hidden = false;
  document.body.classList.add('card-open');
  grow(n, true);
  $('#card-close').focus({ preventScroll: true });
}
function closeCard(quiet) {
  if (!state.card) return;
  const n = state.card; state.card = 0;
  cleanup();
  document.body.classList.remove('card-open');
  if (quiet === true) { card.hidden = true; return; }
  grow(n, false).finished.then(() => { if (!state.card) card.hidden = true; }).catch(() => {});
  els[n].focus({ preventScroll: true });
  badges();
}
$('#card-close').addEventListener('click', () => closeCard());

// ---------- language ----------
function setLang(l) {
  state.lang = l; localStorage.sp_lang = l;
  document.documentElement.lang = l;
  $('#lang').classList.toggle('en', l === 'en');
  document.querySelectorAll('[data-t]').forEach(e => { e.textContent = t(e.dataset.t); });
  $('#ob-name').placeholder = l === 'de' ? 'Jana' : 'Jane';
  $('#snd').setAttribute('aria-label', t('sound'));
  $('#card-close').setAttribute('aria-label', l === 'de' ? 'Schließen' : 'Close');
  paint();
  if (state.card) cardBody.replaceChildren(render(DOORS[state.card - 1], cardOpts()));
}
const paintSound = () => { $('#snd').setAttribute('aria-pressed', sfx.on); $('#snd').classList.toggle('off', !sfx.on); };
$('#snd').addEventListener('click', () => { sfx.toggle(); paintSound(); });
paintSound();
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
$('#onboard-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('#ob-name').value.trim();
  if (obCity.value === 'other') {
    if (!obOther.value.trim()) return obStatus.textContent = t('ob_need');
    obStatus.textContent = '…';
    try { pending = await wx.searchCity(obOther.value.trim(), state.lang); } catch (x) { pending = null; }
    if (!pending) return obStatus.textContent = t('ob_nocity');
  }
  if (name) localStorage.sp_name = name;
  ob.close(); wx.refresh();
  if (!localStorage.sp_walked) { localStorage.sp_walked = '1'; toast(t('walk')); }
});

// ---------- start ----------
addEventListener('resize', fit);
wx.initSky(() => state.lang);
vw = innerWidth; vh = innerHeight;
cam.x = +localStorage.sp_x || 0; // you come back to where you last stood
setLang(state.lang);
fit();
wx.refresh();
load('flake').then(wx.setFlake).catch(() => {});
wx.tune({ soft: true });
life = initLife({ world, houses, els, GROUND, W, state, view: () => ({ x0: cam.x - vw / 2 / cam.z, x1: cam.x + vw / 2 / cam.z }) });
// Ask the browser for the location straight away; the city picker is the fallback. The name is asked on the first post.
if (!wx.getLoc() && !demo) wx.geolocate(state.lang, t('somewhere')).then(() => wx.refresh()).catch(() => wx.refresh());
addEventListener('pagehide', () => { localStorage.sp_x = Math.round(cam.x); });
badges(); setInterval(badges, 60000);
if (state.today === 24 && state.opened.has(24)) document.body.classList.add('finale');
if (!localStorage.sp_walked) setTimeout(() => { localStorage.sp_walked = '1'; toast(t('walk')); }, 1200);
