// What is behind each door.
import { illu } from './illu.js';
import { DOORS } from './content.js';
import { ui, L, t, h, btn } from './ui.js';
import { doorTypes, ART, ART_RUN } from './doors.js';
import * as store from './store.js';

let cleanups = [];
const onCleanup = f => cleanups.push(f);

export function cleanup() { cleanups.forEach(f => { try { f(); } catch (e) {} }); cleanups = []; }

export function render(d, o) {
  ui.lang = o.lang; cleanup();
  const head = h('div', { class: 'c-head' },
    h('span', { class: 'count lb' }, `${String(d.n).padStart(3, '0')} / 024`),
    h('span', { class: 'c-art', html: illu(d.illu) }),
    h('span', { class: 'tag lb' }, t('date', d.n)));
  const main = h('div', { class: 'c-main' }, h('p', { class: 'kicker' }, L(d.kicker)));
  main.append(h('h2', { id: 'card-title' }, L(d.title)));
  for (const p of L(d.body) || []) main.append(h('p', {}, p));
  if (d.art && ART[d.art]) { head.classList.add('staged'); const st = h('div', { class: 'stage art-' + d.art, html: ART[d.art] }); head.append(st); if (ART_RUN[d.art]) ART_RUN[d.art](st); }
  (TYPES[d.type] || (() => {}))(main, d, o, head, DOORS);
  if (d.todo) main.append(todo(d));
  const lay = LAYOUT[d.type] || '';
  const wrap = h('div', { class: `t-${d.type} ${lay}` }, head, main);
  fitText(main);
  return wrap;
}

// Visual doors give the picture two thirds; the TV fills the whole card.
const LAYOUT = { anim: 'lay-wide', meme: 'lay-wide', recipes: 'lay-wide', charcoal: 'lay-wide', elfom: 'lay-wide', diy: 'lay-wide', dinner: 'lay-wide', colour: 'lay-wide', plaetzchen: 'lay-wide', rsvp: 'lay-half', tv: 'lay-full' };

// On a laptop, everything to read should fit without scrolling: shrink the type step by step if needed.
// Doors with long lists (walls, forms) may still scroll once the type is as small as it may get.
function fitText(main) {
  if (!matchMedia('(min-width:900px)').matches) return;
  let raf = 0;
  const fit = () => {
    raf = 0;
    let f = 1; main.style.setProperty('--fit', 1);
    while (main.scrollHeight > main.clientHeight + 2 && f > 0.62) { f -= 0.04; main.style.setProperty('--fit', f.toFixed(2)); }
  };
  const later = () => { if (!raf) raf = requestAnimationFrame(fit); };
  later();
  const mo = new MutationObserver(later); mo.observe(main, { childList: true, subtree: true });
  addEventListener('resize', later); onCleanup(() => { mo.disconnect(); removeEventListener('resize', later); cancelAnimationFrame(raf); });
}

function todo(d) {
  const key = 'sp_todo_' + d.n;
  const cb = h('input', { type: 'checkbox', id: 'todo', checked: localStorage[key] === '1' });
  cb.addEventListener('change', () => { localStorage[key] = cb.checked ? '1' : '0'; });
  return h('label', { class: 'todo', for: 'todo' }, cb, h('span', {}, L(d.todo)));
}

// ---------- shared wall: a form and the posts as notes on a dotted board ----------
function wall(el, d, mode = d.mode, { board: showBoard = true, moving = false } = {}) {
  const err = h('p', { class: 'err', role: 'alert' });
  let img = null;
  if (mode !== 'none') {
    const who = !localStorage.sp_name && h('input', { maxlength: 24, placeholder: t('ob_name'), 'aria-label': t('ob_name'), autocomplete: 'given-name' });
    const ta = h('textarea', { maxlength: 280, placeholder: L(d.ph) || '', 'aria-label': L(d.ph) || L(d.title) });
    const url = mode === 'link' && h('input', { type: 'url', placeholder: 'https://open.spotify.com/…', maxlength: 300, 'aria-label': 'Link' });
    const file = mode === 'image' && h('input', { type: 'file', accept: moving ? 'image/*,video/mp4,video/webm,video/quicktime' : 'image/*', hidden: true });
    // Pictures go straight up: choosing one posts it (with the caption, if any). One button, no second step.
    const fileBtn = file && btn(t('image'), () => {
      if (who && !localStorage.sp_name && !who.value.trim()) { err.textContent = t('need_name'); who.focus(); return; }
      file.click();
    }, 'primary');
    if (file) file.addEventListener('change', async () => {
      err.textContent = '';
      try { img = moving ? await store.prepare(file.files[0]) : await store.shrink(file.files[0]); }
      catch (e) { img = null; err.textContent = e.code === 'big' ? t('too_big') : t('failed'); }
      file.value = '';
      if (img) send.click();
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
        ta.value = ''; if (url) url.value = ''; img = null;
      } catch (e) { err.textContent = t('failed'); }
      send.disabled = false;
    }, 'primary');
    [ta, url].forEach(i => i && i.addEventListener('input', () => { err.textContent = ''; }));
    el.append(h('div', { class: 'wall-form' }, who, url, ta, file, h('div', { class: 'row' }, fileBtn, file ? null : send),
      file && h('p', { class: 'small', style: 'opacity:.6' }, moving ? L({ de: 'JPG, PNG, GIF oder kurzes Video (MP4, MOV), bis 8 MB.', en: 'JPG, PNG, GIF or a short video (MP4, MOV), up to 8 MB.' }) : L({ de: 'JPG oder PNG.', en: 'JPG or PNG.' })), err));
  }
  if (!store.isShared) el.append(h('p', { class: 'small', style: 'opacity:.5' }, t('local')));
  if (!showBoard) return;
  const board = h('div', { class: 'board' });
  el.append(board);
  const draw = async () => {
    let posts = [];
    try { posts = (await store.list(d.n)).filter(p => p.kind !== 'vote' && p.kind !== 'open'); } catch (e) {}
    board.replaceChildren(...(posts.length ? posts.map(postEl) : [h('p', { class: 'empty' }, t('empty'))]));
  };
  const postEl = p => {
    const hash = [...p.id].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7);
    const e = h('div', { class: 'post', style: `--rot:${(hash % 9) - 4}deg;--dy:${(hash >> 4) % 13 - 6}px` });
    if (p.image && /^(https:\/\/|data:(image|video)\/)/.test(p.image)) e.append(media(p.image));
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
  onCleanup(store.subscribe(d.n, draw));
}

// A picture, GIF or video: videos play silently on a loop, like a GIF.
export function media(src, cls = '') {
  if (!store.isVideo(src)) return h('img', { src, alt: '', loading: 'lazy', class: cls });
  const v = h('video', { src, loop: true, autoplay: true, playsinline: true, preload: 'metadata', class: cls });
  v.muted = true; v.play().catch(() => {});
  return v;
}

// ---------- door types ----------
const TYPES = {
  text() {},
  wall: (el, d) => wall(el, d),
  pickup(el, d, o) {
    el.append(h('p', {}, o.office ? L(d.office)(o.city) : L(d.remote)));
  },
  ...doorTypes({ wall, onCleanup }),
};
