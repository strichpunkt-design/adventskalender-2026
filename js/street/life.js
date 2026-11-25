// Street life. Main cast: elf, gingerbread man, Santa, snowman, the sleigh, the tree.
// Deco only: sock, bauble, candy cane, snowflake. All of it is atmosphere; nothing here is needed to use the calendar.
import { sfx } from './sound.js';
import { backing } from './backing.js';
const DIR = new URL('../../assets/xmas/', import.meta.url);
// Parts that can move on their own: [class, [x, y, w, h] of the part in the file, [pivot x, pivot y]].
const RIG = {
  santa: [['arm', [1155.6, 219.1, 51.7, 80.7], [1158, 298]]],
  ginger: [['hat', [814.9, 207.3, 72.8, 40.2], [851, 247]]],
  snowman: [['arm', [1509.2, 238, 34.2, 42.8], [1511.4, 280]]],
};
// key, height, speed, facing of the drawing (1 = right), how often it is picked
const WALKERS = [['elf', 125, 120, 1, 3], ['ginger', 118, 44, 1, 2]];
const pick = a => a[Math.floor(Math.random() * a.length)];
const cache = {}, rigged = {};
// These drawings already carry their own backing shapes; only the deco set needs one worked out.
const OWN_BACKING = ['elf', 'ginger', 'santa', 'snowman', 'sleigh', 'tree'];

export const load = key => cache[key] || (cache[key] = fetch(new URL(key + '.svg', DIR)).then(r => r.text()));

// The drawing plus its backing: detail gaps are filled with the dark colour, real openings stay see-through.
const arts = {}, sheet = document.head.appendChild(document.createElement('style'));
export const art = key => arts[key] || (arts[key] = load(key).then(async svg => {
  const vb = svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  let bk = '';
  if (!OWN_BACKING.includes(key)) try {
    const b = await backing(svg, { skip: (RIG[key] || []).map(r => r[1]) });
    if (b.url) {
      sheet.textContent += `.bk-${key}{-webkit-mask-image:url(${b.url});mask-image:url(${b.url})}`;
      bk = `<i class="bk bk-${key}" style="left:${-b.insetX * 100}%;right:${-b.insetX * 100}%;top:${-b.insetY * 100}%;bottom:${-b.insetY * 100}%"></i>`;
    }
  } catch (e) {}
  return `<span class="art" style="aspect-ratio:${vb[2]}/${vb[3]}">${bk}${svg}</span>`;
}));
const STAR = '<svg viewBox="-20 -20 40 40"><polygon fill="currentColor" points="20,0 8.3,3.4 14.1,14.1 3.4,8.3 0,20 -3.4,8.3 -14.1,14.1 -8.3,3.4 -20,0 -8.3,-3.4 -14.1,-14.1 -3.4,-8.3 0,-20 3.4,-8.3 14.1,-14.1 8.3,-3.4"/></svg>';

// Finds the movable parts by their position and marks them. Returns width / height of the drawing.
function prepare(svg, key) {
  const shapes = [...svg.querySelectorAll('path,rect,circle,ellipse,polygon')].filter(s => !s.closest('mask'));
  if (!rigged[key]) {
    rigged[key] = [];
    for (const [cls, box, pivot] of RIG[key] || []) {
      const i = shapes.findIndex(s => { const b = s.getBBox(); return [b.x, b.y, b.width, b.height].every((v, n) => Math.abs(v - box[n]) < 3); });
      if (i >= 0) rigged[key].push([i, cls, pivot]);
    }
  }
  for (const [i, cls, pivot] of rigged[key]) {
    shapes[i].setAttribute('class', cls);
    shapes[i].style.transformOrigin = `${pivot[0]}px ${pivot[1]}px`;
  }
  const vb = svg.viewBox.baseVal;
  return vb.width / vb.height;
}

export function initLife({ world, houses, els, GROUND, W, state, view }) {
  const still = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const byX = Object.values(houses).sort((a, b) => a.x - b.x);
  const actors = [];
  let lastFly = 0, flying = false, roof = null;   // one Santa at a time: sleigh, walker or roof
  const weather = () => document.body.dataset.weather;
  const roofY = (o, x) => { const r = o.w / 2; return { flat: 0, step: x > o.w * 0.25 && x < o.w * 0.75 ? 0 : 60, gable: o.rd * Math.abs(x - r) / r, arch: r - Math.sqrt(Math.max(0, r * r - (x - r) * (x - r))), shed: o.rd * (1 - x / o.w) }[o.roof]; };

  async function make(key, h, cls) {
    const el = document.createElement('div');
    el.className = 'actor ' + cls;
    el.innerHTML = `<div class="flip"><div class="fig" style="height:${h}px">${await art(key)}</div></div>`;
    world.append(el);
    const w = h * prepare(el.querySelector('svg'), key);
    el.style.width = w + 'px';
    const a = { el, key, w, h, x: 0, y: GROUND + 16, dir: 1, face: 1 };
    el.querySelector('.fig').addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hover(a); });
    return a;
  }
  const place = a => {
    a.el.style.transform = `translate3d(${a.x - a.w / 2}px,${a.y - a.h}px,0)`;
    a.el.style.setProperty('--f', a.dir * a.face);
  };
  const STATES = ['walk', 'run', 'greet', 'hop', 'enter', 'exit', 'pop', 'indoor', 'outdoor'];
  const set = (a, ...on) => { a.el.classList.remove(...STATES); a.el.offsetWidth; a.el.classList.add(...on); };
  const drop = a => { a.el.remove(); const i = actors.indexOf(a); if (i >= 0) actors.splice(i, 1); };

  // ---------- things that stay put ----------
  // Snowmen stand only while it is really snowing.
  const statics = [];
  for (const i of [3, 11, 19]) make('snowman', 150, 'snow').then(a => { a.y = GROUND + 24; a.dir = i % 2 ? 1 : -1; statics.push({ a, base: byX[i].x - 26, k: null }); });
  // Deco lives on the buildings: bauble, sock or candy cane hang beside the window and swing as you walk.
  byX.filter(o => o.w >= 255 && o.n !== 24).forEach((o, i) => {
    const kind = ['ball', 'sock', 'cane'][i % 3], b = document.createElement('span'), cx = o.w - (o.w - 130) / 4;
    b.className = 'ball ' + kind; b.style.cssText = `left:${cx}px;top:${roofY(o, cx) + 4}px`;
    els[o.n].append(b);
    art(kind).then(html => { b.innerHTML = html; });
  });

  // ---------- house 24 has a chimney; Santa comes out of it on the 24th ----------
  {
    const o = houses[24], e = els[24], cx = o.w * 0.7, top = roofY(o, cx) - 84;
    const chim = document.createElement('span'); chim.className = 'chim'; chim.style.cssText = `left:${cx - 28}px;top:${top}px`;
    const santa = document.createElement('span'); santa.className = 'santa'; santa.style.cssText = `left:${cx - 90}px;top:${top - 176}px`;
    const smoke = document.createElement('span'); smoke.className = 'smoke'; smoke.style.cssText = `left:${cx - 11}px;top:${top - 26}px`;
    smoke.innerHTML = '<i></i><i></i><i></i>';
    e.prepend(chim, santa, smoke);
    art('santa').then(html => { santa.innerHTML = html; prepare(santa.querySelector('svg'), 'santa'); });
    roof = santa;
    const cycle = () => {
      const on = state.today === 24 && !document.hidden;
      const up = on && !santa.classList.contains('up') && !flying;   // never while the sleigh is in the sky
      santa.classList.toggle('up', up); e.classList.toggle('santa-on', up);
      if (up) sfx.play('santa');
      setTimeout(cycle, up ? 6500 : on ? 2600 : 5000);
    };
    if (still) santa.classList.toggle('up', state.today === 24); else setTimeout(cycle, 1500);
  }
  if (still) return { sync() {}, poke() {}, party() {} };

  // ---------- things that come and go ----------
  const inView = (x, pad = 0) => { const v = view(); return x > v.x0 + pad && x < v.x1 - pad; };
  const doorsInView = () => byX.map(o => ({ x: o.door + o.k * W, n: o.n })).filter(d => inView(d.x, 90));
  // The little door lights up while someone goes through it.
  const useDoor = d => { const e = els[d.n]; e.classList.add('door-open'); setTimeout(() => e.classList.remove('door-open'), 1500); };

  // They arrive as if from somewhere else: a flash of stars, and they are simply there.
  function sparkle(a) {
    const el = document.createElement('div');
    el.className = 'spark'; el.style.transform = `translate3d(${a.x}px,${a.y - a.h * 0.5}px,0)`;
    let html = `<b>${STAR}</b>`;
    for (let i = 0; i < 9; i++) {
      const ang = Math.random() * Math.PI * 2, d = 60 + Math.random() * 110;
      html += `<i style="--x:${Math.cos(ang) * d}px;--y:${Math.sin(ang) * d - 30}px;--s:${0.4 + Math.random() * 0.9};animation-delay:${Math.random() * 0.15}s">${STAR}</i>`;
    }
    el.innerHTML = html; world.append(el);
    setTimeout(() => el.remove(), 1100);
  }
  async function spawnWalker() {
    // Santa walks only from the 20th to the 23rd, and only when he is nowhere else to be seen.
    // On the 24th he belongs on the roof.
    const v = view(), santaFree = state.today >= 20 && state.today <= 23 && !santaSeen();
    const pool = santaFree ? [...WALKERS, ['santa', 165, 50, 1, 2]] : WALKERS;
    const [key, h, speed, face] = pick(pool.flatMap(w => Array(w[4]).fill(w)));
    const doors = doorsInView(), roll = Math.random();
    const a = await make(key, h, 'walk');
    Object.assign(a, { kind: 'walker', speed, face, greetIn: 2 + Math.random() * 5, dir: pick([-1, 1]) });
    if (roll < 0.3 && doors.length) {
      // Some step out of a house door: no magic. They come forward through the doorway, which acts as the frame.
      const d = pick(doors);
      a.x = d.x; a.from = d.x; a.wait = 0.9; doorway(a); set(a, 'outdoor'); useDoor(d);
    } else if (roll < 0.78) {
      // Others appear out of nowhere, anywhere on the pavement.
      a.x = v.x0 + (v.x1 - v.x0) * (0.12 + Math.random() * 0.76);
      a.wait = 0.7; set(a, 'exit'); sparkle(a);
    } else a.x = a.dir > 0 ? v.x0 - 140 : v.x1 + 140; // a few simply walk in from the side
    // Where they are heading: into a door, or to a spot where they vanish again. Some just keep walking.
    const to = Math.random(), ahead = doors.filter(d => (d.x - a.x) * a.dir > 160 && d.x !== a.from);
    if (to < 0.4 && ahead.length) { a.door = pick(ahead); a.goal = a.door.x; }
    else if (to < 0.78) a.goal = a.x + a.dir * (350 + Math.random() * 700);
    place(a); actors.push(a);
  }
  // Going through a door: the figure steps back to door size and is only visible inside the door's arch.
  // --ds is the size it shrinks to so it fits the door; --dm is the door's shape, measured from the figure's own box.
  function doorway(a) {
    a.el.style.setProperty('--ds', (78 / a.h).toFixed(3));
    a.el.style.setProperty('--dm', `inset(${a.h - 106}px ${a.w / 2 - 30}px 16px ${a.w / 2 - 30}px round 30px 30px 0 0)`);
  }
  function enterDoor(a) {
    a.gone = true;
    doorway(a); set(a, 'indoor'); useDoor(a.door);
    setTimeout(() => drop(a), 950);
  }
  // Santa and the reindeer cross the sky. There is only one Santa: no flight while he walks or waves from the roof.

  function santaSeen() { return flying || actors.some(a => a.key === 'santa') || !!(roof && roof.classList.contains('up')); }
  async function flyby() {
    if (santaSeen()) return;
    lastFly = performance.now(); flying = true;
    sfx.play('santa');
    const el = document.createElement('div');
    el.className = 'sleigh'; el.style.setProperty('--t', 8 + Math.random() * 18 + 'vh');
    el.innerHTML = await art('sleigh');
    document.getElementById('sky').append(el);
    el.addEventListener('animationend', e => { if (e.target === el) { el.remove(); flying = false; } });
  }

  function hover(a) {
    if (a.flee || a.gone) return;
    if (a.kind === 'walker') { if (!a.wait) { a.greet = 1.7; set(a, 'greet'); } return; }
    set(a, 'greet');
  }
  // Tapped: they run off, duck or jump.
  function poke(el) {
    const a = actors.find(x => x.el === el || x.el.contains(el));
    if (!a) { el.classList.remove('greet'); el.offsetWidth; el.classList.add('greet'); return; }
    if (a.gone) return;
    if (a.kind === 'walker') { a.flee = true; a.greet = 0; a.goal = null; a.door = null; a.wait = 0; set(a, 'walk', 'run'); }
    else leave(a);
  }
  function leave(a) {
    a.gone = true;
    set(a, 'enter'); sparkle(a);
    setTimeout(() => drop(a), 900);
  }

  let last = performance.now(), spawnIn = 2;
  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const hurry = weather() === 'rainy' ? 1.7 : 1, v = view();
    for (const st of statics) { const k = Math.round(((v.x0 + v.x1) / 2 - st.base) / W); if (k !== st.k) { st.k = k; st.a.x = st.base + k * W; place(st.a); } }
    for (const a of [...actors]) {
      if (a.gone) continue;
      if (a.kind === 'walker') {
        if (a.wait > 0) { a.wait -= dt; if (a.wait <= 0) set(a, 'walk'); continue; }
        if (a.greet > 0) { a.greet -= dt; if (a.greet <= 0) set(a, 'walk'); continue; }
        a.x += a.dir * a.speed * (a.flee ? 3.4 : hurry) * dt;
        if (a.goal != null && (a.goal - a.x) * a.dir <= 0) { a.x = a.goal; place(a); if (a.door) enterDoor(a); else leave(a); continue; }
        if (!a.flee && (a.greetIn -= dt) <= 0 && inView(a.x, 60)) { a.greet = 1.7; a.greetIn = 6 + Math.random() * 8; set(a, 'greet'); }
        if ((a.dir > 0 && a.x > v.x1 + 500) || (a.dir < 0 && a.x < v.x0 - 500) || a.x < v.x0 - 2600 || a.x > v.x1 + 2600) { drop(a); continue; }
        place(a);
      } else if ((a.life -= dt) <= 0 || !inView(a.x, -900)) leave(a);
    }
    // Rare on purpose, and a little busier as the 24th comes closer.
    if ((spawnIn -= dt) <= 0) {
      spawnIn = 1.5 + Math.random() * 2;
      const max = 1 + Math.floor(state.today / 8);
      // The sleigh is a rare sighting; on the 24th it keeps coming back.
      if (!document.hidden && now - lastFly > (state.today === 24 ? 25000 : 70000) && Math.random() < 0.12) flyby();
      if (!state.card && !document.hidden && actors.length < max && Math.random() < 0.4) {
        spawnWalker();
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  // ?cast in the address brings a few of them on at once, to look at them.
  if (new URLSearchParams(location.search).has('cast')) setTimeout(() => { spawnWalker(); spawnWalker(); flyby(); }, 800);
  // Everyone at once, for the finale.
  const party = () => { for (let i = 0; i < 6; i++) setTimeout(spawnWalker, i * 260); flyby(); };
  return { sync() {}, poke, party };
}
