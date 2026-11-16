// What is behind each door.
import { illu } from './illu.js';
import { T } from './content.js';
import * as store from './store.js';

let lang = 'de', cleanups = [];
const L = o => (o && typeof o === 'object' && !Array.isArray(o) && 'de' in o) ? o[lang] : o;
const t = (k, ...a) => { const v = T[k][lang]; return typeof v === 'function' ? v(...a) : v; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const STAR = '<svg viewBox="-20 -20 40 40"><polygon fill="currentColor" points="20,0 8.3,3.4 14.1,14.1 3.4,8.3 0,20 -3.4,8.3 -14.1,14.1 -8.3,3.4 -20,0 -8.3,-3.4 -14.1,-14.1 -3.4,-8.3 0,-20 3.4,-8.3 14.1,-14.1 8.3,-3.4"/></svg>';

function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c);
  return e;
}
const btn = (label, onclick, cls = '') => h('button', { type: 'button', class: 'btn ' + cls, onclick }, label);

// Name is asked the first time someone posts, not on arrival: the first tap shows a name field beside the button.
function needName(btnEl) {
  if (localStorage.sp_name) return true;
  let f = btnEl.parentNode.querySelector('.name-ask');
  if (!f) {
    f = h('input', { class: 'name-ask', maxlength: 24, placeholder: t('ob_name'), 'aria-label': t('ob_name'), autocomplete: 'given-name' });
    btnEl.before(f); f.focus(); return false;
  }
  const v = f.value.trim();
  if (!v) { f.focus(); return false; }
  localStorage.sp_name = v; f.remove(); return true;
}

export function cleanup() { cleanups.forEach(f => f()); cleanups = []; }

export function render(d, o) {
  lang = o.lang; cleanup();
  const head = h('div', { class: 'c-head' },
    h('span', { class: 'count lb' }, `${String(d.n).padStart(3, '0')} / 024`),
    h('span', { html: illu(d.illu) }),
    h('span', { class: 'tag lb' }, t('date', d.n)));
  const main = h('div', { class: 'c-main' }, h('p', { class: 'kicker' }, L(d.kicker)));
  if (d.type === 'quote') main.append(h('blockquote', { id: 'card-title' }, '„' + L(d.title).replace(/\.$/, '') + '.“'), h('p', { class: 'kicker' }, d.by));
  else main.append(h('h2', { id: 'card-title' }, L(d.title)));
  for (const p of L(d.body) || []) main.append(h('p', {}, p));
  (TYPES[d.type] || (() => {}))(main, d, o, head);
  if (d.todo) main.append(todo(d));
  return h('div', {}, head, main);
}

function todo(d) {
  const key = 'sp_todo_' + d.n;
  const cb = h('input', { type: 'checkbox', id: 'todo', checked: localStorage[key] === '1' });
  cb.addEventListener('change', () => { localStorage[key] = cb.checked ? '1' : '0'; });
  return h('label', { class: 'todo', for: 'todo' }, cb, h('span', {}, L(d.todo)));
}

// ---------- shared wall ----------
function wall(el, d, mode = d.mode) {
  const err = h('p', { class: 'err', role: 'alert' });
  let img = null;
  if (mode !== 'none') {
    const who = !localStorage.sp_name && h('input', { maxlength: 24, placeholder: t('ob_name'), 'aria-label': t('ob_name'), autocomplete: 'given-name' });
    const ta = h('textarea', { maxlength: 280, placeholder: L(d.ph) || '', 'aria-label': L(d.ph) || L(d.title) });
    const url = mode === 'link' && h('input', { type: 'url', placeholder: 'https://open.spotify.com/…', maxlength: 300, 'aria-label': 'Link' });
    const file = mode === 'image' && h('input', { type: 'file', accept: 'image/*', hidden: true });
    const fileBtn = file && btn(t('image'), () => file.click(), 'line');
    if (file) file.addEventListener('change', async () => {
      err.textContent = '';
      try { img = await store.shrink(file.files[0]); fileBtn.textContent = '✓ ' + file.files[0].name.slice(0, 18); }
      catch (e) { img = null; err.textContent = t('failed'); }
    });
    const send = btn(t('post'), async () => {
      const body = ta.value.trim(), link = url ? url.value.trim() : '';
      if (mode === 'text' && !body) return err.textContent = t('need_text');
      if (mode === 'link' && !/^https:\/\/\S+\.\S+/.test(link)) return err.textContent = t('need_link');
      if (mode === 'image' && !img) return err.textContent = t('need_img');
      if (who && !localStorage.sp_name) { if (!who.value.trim()) return err.textContent = t('need_name'); localStorage.sp_name = who.value.trim(); }
      send.disabled = true;
      try {
        await store.add(d.n, { kind: mode, body, url: link, image: img });
        if (who) who.remove();
        ta.value = ''; if (url) url.value = ''; img = null; if (fileBtn) fileBtn.textContent = t('image');
      } catch (e) { err.textContent = t('failed'); }
      send.disabled = false;
    }, 'primary');
    [ta, url].forEach(i => i && i.addEventListener('input', () => { err.textContent = ''; }));
    el.append(h('div', { class: 'wall-form' }, who, url, ta, file, h('div', { class: 'row' }, fileBtn, send), err));
  }
  const board = h('div', { class: 'board' });
  el.append(board);
  if (!store.isShared) el.append(h('p', { class: 'small', style: 'opacity:.5' }, t('local')));
  const draw = async () => {
    let posts = [];
    try { posts = (await store.list(d.n)).filter(p => p.kind !== 'vote' && p.kind !== 'open'); } catch (e) {}
    board.replaceChildren(...(posts.length ? posts.map(postEl) : [h('p', { class: 'empty' }, t('empty'))]));
  };
  const postEl = p => {
    const hash = [...p.id].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7);
    const e = h('div', { class: 'post', style: `--rot:${(hash % 9) - 4}deg;--dy:${(hash >> 4) % 13 - 6}px` });
    if (p.image && /^(https:\/\/|data:image\/)/.test(p.image)) e.append(h('img', { src: p.image, alt: '', loading: 'lazy' }));
    if (p.url && /^https:\/\//.test(p.url)) {
      let host = p.url; try { host = new URL(p.url).hostname.replace(/^www\./, ''); } catch (x) {}
      e.append(h('a', { href: p.url, target: '_blank', rel: 'noopener noreferrer' }, '♪ ' + host), h('br'));
    }
    if (p.body) e.append(h('span', {}, p.body));
    e.append(h('span', { class: 'who' }, p.name));
    if (store.isMine(p.id)) e.append(h('button', { class: 'del', type: 'button', 'aria-label': t('clear'), onclick: () => store.remove(d.n, p.id).catch(() => {}) }, '×'));
    return e;
  };
  draw();
  cleanups.push(store.subscribe(d.n, draw));
}

const shareScore = (d, text) => {
  const b = btn(t('share_score'), async () => { if (!needName(b)) return; b.disabled = true; try { await store.add(d.n, { kind: 'score', body: text }); } catch (e) { b.disabled = false; } }, 'primary');
  return b;
};

// ---------- door types ----------
const TYPES = {
  wall: (el, d) => wall(el, d),
  poll(el, d) {
    const key = 'sp_vote_' + d.n, bars = h('div', { class: 'bars' });
    el.append(bars);
    const draw = async () => {
      let votes = [];
      try { votes = (await store.list(d.n)).filter(p => p.kind === 'vote'); } catch (e) {}
      const mineV = localStorage[key];
      bars.replaceChildren(...L(d.options).map((label, i) => {
        const n = votes.filter(v => v.body === String(i)).length, pct = votes.length ? Math.round(n / votes.length * 100) : 0;
        return h('button', { type: 'button', class: 'bar' + (mineV === String(i) ? ' me' : ''), style: mineV != null ? `--p:${pct}%` : '', disabled: mineV != null,
          onclick: async () => { localStorage[key] = String(i); try { await store.add(d.n, { kind: 'vote', body: String(i) }); } catch (e) { delete localStorage[key]; draw(); } } },
          h('i'), h('span', {}, label), mineV != null && h('span', {}, pct + ' %'));
      }));
    };
    draw(); cleanups.push(store.subscribe(d.n, draw));
  },
  pickup(el, d, o) {
    el.append(h('p', {}, o.office ? L(d.office)(o.city) : L(d.remote)));
  },
  color(el, d) {
    const rounds = [[{ de: 'Glühwein', en: 'Mulled wine' }, [345, 60, 28]], [{ de: 'Lebkuchen', en: 'Gingerbread' }, [27, 52, 34]], [{ de: 'Tannengrün', en: 'Fir green' }, [150, 42, 21]]];
    const box = h('div', { class: 'game' }); el.append(box);
    let r = 0, total = 0;
    const play = () => {
      const [name, target] = rounds[r], v = [180, 50, 50];
      const mineSw = h('div', {}, t('you')), goal = h('div', { style: 'background:#000' }, '?');
      const paint = () => { mineSw.style.background = `hsl(${v[0]} ${v[1]}% ${v[2]}%)`; };
      const sl = (i, max) => { const s = h('input', { type: 'range', min: 0, max, value: v[i], step: 1, 'aria-label': 'HSL'[i] }); s.addEventListener('input', () => { v[i] = +s.value; paint(); }); return s; };
      const out = h('p', { class: 'big' });
      const go = btn(t('check'), () => {
        const dh = Math.min(Math.abs(v[0] - target[0]), 360 - Math.abs(v[0] - target[0]));
        const sc = Math.max(0, Math.round(100 - (dh / 180 * 100 * 1.2 + Math.abs(v[1] - target[1]) * 0.5 + Math.abs(v[2] - target[2]) * 1.2)));
        total += sc; r++;
        goal.style.background = `hsl(${target[0]} ${target[1]}% ${target[2]}%)`; goal.textContent = t('target');
        out.textContent = sc + ' %';
        go.replaceWith(r < rounds.length ? btn(t('next'), play) : h('div', { class: 'row' }, h('span', { class: 'big' }, `Ø ${Math.round(total / rounds.length)} %`), shareScore(d, `${Math.round(total / rounds.length)} %`)));
      });
      box.replaceChildren(h('p', { class: 'lb' }, `${r + 1} / ${rounds.length}`), h('p', { class: 'big' }, L(name)), h('div', { class: 'sw' }, mineSw, goal), sl(0, 360), sl(1, 100), sl(2, 100), out, go);
      paint();
    };
    play(); wall(el, d, 'none');
  },
  kern(el, d) {
    const box = h('div', { class: 'game' }), row = h('div', { class: 'kern' }), out = h('p', { class: 'big' });
    const offs = [];
    [...d.word].forEach((ch, i) => {
      if (ch === ' ') return row.append(h('span', { style: 'width:.35em;cursor:default' }));
      const k = offs.length; offs.push(k ? Math.round((Math.random() * 2 - 1) * 16) || 8 : 0);
      const s = h('span', { style: `transform:translateX(${offs[k]}px)` }, ch);
      if (k) s.addEventListener('pointerdown', e => {
        s.setPointerCapture(e.pointerId); s.classList.add('sel');
        const x0 = e.clientX, o0 = offs[k];
        const mv = m => { offs[k] = Math.max(-30, Math.min(30, o0 + m.clientX - x0)); s.style.transform = `translateX(${offs[k]}px)`; };
        const up = () => { s.classList.remove('sel'); s.removeEventListener('pointermove', mv); };
        s.addEventListener('pointermove', mv); s.addEventListener('pointerup', up, { once: true }); s.addEventListener('pointercancel', up, { once: true });
      });
      row.append(s);
    });
    const go = btn(t('check'), () => {
      const sc = Math.max(0, Math.round(100 - offs.reduce((a, b) => a + Math.abs(b), 0) / (offs.length - 1) * 7));
      out.textContent = sc + ' %';
      [...row.children].forEach(s => { s.style.transition = 'transform .6s cubic-bezier(.3,1.6,.5,1)'; s.style.transform = ''; s.style.pointerEvents = 'none'; });
      go.replaceWith(shareScore(d, sc + ' %'));
    });
    box.append(row, out, go); el.append(box); wall(el, d, 'none');
  },
  star(el, d) {
    const box = h('div', { class: 'game' }), arena = h('div', { class: 'arena' }), out = h('p', { class: 'big' }, '0');
    const s = h('button', { type: 'button', html: STAR, 'aria-label': 'Stern', style: 'left:calc(50% - 28px);top:82px' });
    let n = 0, on = false, timer;
    const jump = () => { s.style.left = Math.random() * (arena.clientWidth - 56) + 'px'; s.style.top = Math.random() * (arena.clientHeight - 56) + 'px'; };
    const foot = h('div', { class: 'row' }, h('span', { class: 'lb' }, '15 s'));
    s.addEventListener('pointerdown', () => {
      if (!on) {
        if (n) return;
        on = true; let left = 15;
        timer = setInterval(() => { left--; foot.firstChild.textContent = left + ' s'; if (left <= 0) { clearInterval(timer); on = false; s.disabled = true; s.style.opacity = .3; foot.append(shareScore(d, n + ' ★')); } }, 1000);
      }
      n++; out.textContent = n; jump();
    });
    cleanups.push(() => clearInterval(timer));
    arena.append(s); box.append(out, arena, foot); el.append(box); wall(el, d, 'none');
  },
  sketch(el, d) {
    const box = h('div', { class: 'game' }), cv = h('canvas', { class: 'pad', width: 640, height: 480 }), g = cv.getContext('2d');
    const clock = h('span', { class: 'big' }, '30');
    let left = 30, timer, drawing = false, done = false, used = false;
    const reset = () => { g.fillStyle = '#fff'; g.fillRect(0, 0, 640, 480); g.lineWidth = 7; g.lineCap = g.lineJoin = 'round'; g.strokeStyle = '#000'; };
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 640, (e.clientY - r.top) / r.height * 480]; };
    reset();
    cv.addEventListener('pointerdown', e => {
      if (done) return;
      cv.setPointerCapture(e.pointerId); drawing = used = true; g.beginPath(); g.moveTo(...pos(e));
      if (!timer) timer = setInterval(() => { clock.textContent = --left; if (left <= 0) { clearInterval(timer); done = true; drawing = false; } }, 1000);
    });
    cv.addEventListener('pointermove', e => { if (drawing) { g.lineTo(...pos(e)); g.stroke(); } });
    cv.addEventListener('pointerup', () => { drawing = false; });
    cleanups.push(() => clearInterval(timer));
    const err = h('p', { class: 'err', style: 'color:#c00' });
    const send = btn(t('to_wall'), async () => {
      if (!used) return err.textContent = t('need_draw');
      if (!needName(send)) return;
      send.disabled = true;
      try { await store.add(d.n, { kind: 'image', image: cv.toDataURL('image/jpeg', 0.7) }); done = true; } catch (e) { err.textContent = t('failed'); send.disabled = false; }
    });
    box.append(h('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:8px' }, clock, send), cv, err);
    el.append(box); wall(el, d, 'none');
  },
  roulette(el, d) {
    const slots = h('div', { class: 'slots' }), groups = L(d.slots);
    let spin;
    const roll = () => {
      let i = 0; clearInterval(spin);
      spin = setInterval(() => {
        slots.replaceChildren(...groups.map(([label, list]) => h('div', {}, h('small', {}, label), pick(list))));
        if (++i > 12) clearInterval(spin);
      }, 70);
    };
    cleanups.push(() => clearInterval(spin));
    roll(); el.append(slots, btn(t('again'), roll, 'line')); wall(el, d, 'text');
  },
  santa(el, d) {
    const logo = h('div', { class: 'logo' }), looks = [['#000', '#fff'], ['#B78CFF', '#000'], ['#F3E6E0', '#000'], ['#fff', '#000']];
    let cur = '';
    const roll = () => {
      const [bg, ink] = pick(looks), name = `${pick(d.names)} ${pick(d.tails)}`, claim = pick(L(d.claims));
      cur = `${name} — ${claim}`;
      logo.style.cssText = `background:${bg};color:${ink}`;
      logo.replaceChildren(h('div', {}, h('b', { style: `font-stretch:${pick([100, 125, 150])}%;font-weight:${pick([400, 700, 900])};letter-spacing:${pick(['-.03em', '0', '.12em'])}` }, name), h('span', {}, claim)));
    };
    roll();
    const post = btn(t('to_wall'), async () => { if (!needName(post)) return; post.disabled = true; try { await store.add(d.n, { kind: 'text', body: cur }); } catch (e) {} post.disabled = false; }, 'primary');
    el.append(logo, h('div', { class: 'row' }, btn(t('again'), roll, 'line'), post)); wall(el, d, 'none');
  },
  elf(el, d) {
    const face = h('div', { class: 'face' });
    const stage = h('div', { class: 'elf' }, h('div', { class: 'body' }, h('div', { class: 'hat' }), h('div', { class: 'torso' }), h('div', { class: 'arm l' }), h('div', { class: 'arm r' }), face));
    const chips = h('div', { class: 'chips' });
    const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
    let ownUrl;
    const show = (b, url, letter) => {
      [...chips.children].forEach(c => c.classList.toggle('on', c === b));
      face.textContent = letter; face.style.backgroundImage = 'none';
      if (url) { const im = new Image(); im.onload = () => { face.textContent = ''; face.style.backgroundImage = `url("${url}")`; }; im.src = url; }
    };
    d.people.forEach((p, i) => {
      const b = h('button', { type: 'button', onclick: () => show(b, new URL(`../assets/elf/${p.toLowerCase()}.jpg`, import.meta.url).href, p[0]) }, p);
      chips.append(b); if (!i) setTimeout(() => b.click());
    });
    const own = h('button', { type: 'button', onclick: () => file.click() }, L(d.own));
    file.addEventListener('change', () => { if (!file.files[0]) return; if (ownUrl) URL.revokeObjectURL(ownUrl); ownUrl = URL.createObjectURL(file.files[0]); show(own, ownUrl, '?'); });
    cleanups.push(() => ownUrl && URL.revokeObjectURL(ownUrl));
    chips.append(own); el.append(stage, chips, file);
  },
  finale(el, d, o, head) {
    for (let i = 0; i < 16; i++) head.append(h('span', { class: 'fall', html: STAR, style: `left:${Math.random() * 100}%;animation-delay:${-Math.random() * 5}s;animation-duration:${3 + Math.random() * 4}s;width:${14 + Math.random() * 22}px` }));
  },
};
