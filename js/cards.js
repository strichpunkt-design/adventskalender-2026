// What is behind each door.
import { illu } from './illu.js';
import { DOORS } from './content.js';
import { ui, L, t, h, btn } from './ui.js';
import { doorTypes } from './doors.js';
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
  (TYPES[d.type] || (() => {}))(main, d, o, head, DOORS);
  if (d.todo) main.append(todo(d));
  return h('div', {}, head, main);
}

function todo(d) {
  const key = 'sp_todo_' + d.n;
  const cb = h('input', { type: 'checkbox', id: 'todo', checked: localStorage[key] === '1' });
  cb.addEventListener('change', () => { localStorage[key] = cb.checked ? '1' : '0'; });
  return h('label', { class: 'todo', for: 'todo' }, cb, h('span', {}, L(d.todo)));
}

// ---------- shared wall: a form and the posts as notes on a dotted board ----------
function wall(el, d, mode = d.mode, { board: showBoard = true } = {}) {
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
  onCleanup(store.subscribe(d.n, draw));
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
