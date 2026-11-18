// Small shared helpers for the cards: building elements and picking the right language.
import { T } from './content.js';

export const ui = { lang: 'de' };
export const L = o => (o && typeof o === 'object' && !Array.isArray(o) && 'de' in o) ? o[ui.lang] : o;
export const t = (k, ...a) => { const v = T[k][ui.lang]; return typeof v === 'function' ? v(...a) : v; };
export const pick = a => a[Math.floor(Math.random() * a.length)];

export function h(tag, props = {}, ...kids) {
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
export const btn = (label, onclick, cls = '') => h('button', { type: 'button', class: 'btn ' + cls, onclick }, label);

// Name is asked the first time someone posts, not on arrival: the first tap shows a name field beside the button.
export function needName(btnEl) {
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

// localStorage that never throws (private windows, blocked storage).
export const ls = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  del: k => { try { localStorage.removeItem(k); } catch (e) {} },
};
