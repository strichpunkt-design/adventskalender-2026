// The door types of the 2026 calendar. Each gets the text column (el), the door data (d),
// options (o: lang, city, office, hush) and the picture column (head), and returns nothing.
import { h, btn, L, t, ls, needName } from './ui.js';
import { ANIMS, BURST } from './anims.js';
import * as store from './store.js';

const ASSET = p => new URL('../assets/' + p, import.meta.url).href;
const svgCache = {};
const loadSvg = p => svgCache[p] || (svgCache[p] = fetch(ASSET(p)).then(r => r.text()).catch(() => ''));
const burst = (cls = '') => `<svg class="${cls}" viewBox="-20 -20 40 40" aria-hidden="true"><polygon fill="currentColor" points="${BURST}"/></svg>`;
const votes = (posts, prefix) => posts.filter(p => p.kind === 'vote' && p.body.startsWith(prefix));
const err = () => h('p', { class: 'err', role: 'alert' });

// Swap the brand illustration in the picture column for a stage of our own.
function stage(head, cls, ...kids) {
  head.classList.add('staged', ...cls.split(' ').filter(Boolean));
  const s = h('div', { class: 'stage' }, ...kids);
  head.append(s);
  return s;
}

export function doorTypes({ wall, onCleanup }) {
  // Keep a live list of a door's posts; calls draw(posts) now and on every change.
  const live = (n, draw) => {
    const run = async () => { let posts = []; try { posts = await store.list(n); } catch (e) {} draw(posts); };
    run(); onCleanup(store.subscribe(n, run));
    return run;
  };

  return {
    // ---------- Strichpunkt animations (1 Dec, weekends) ----------
    anim(el, d, o, head) {
      stage(head, 'dark', h('div', { class: 'anim', html: ANIMS[d.anim](L) }));
    },

    // ---------- Spotify playlist + song wall ----------
    playlist(el, d) {
      const a = d.spotify
        ? h('a', { class: 'btn primary', href: d.spotify, target: '_blank', rel: 'noopener noreferrer' }, L({ de: 'Playlist öffnen', en: 'Open the playlist' }))
        : h('span', { class: 'btn primary', 'aria-disabled': 'true', style: 'opacity:.5' }, L({ de: 'Playlist-Link folgt', en: 'Playlist link coming' }));
      el.append(h('div', { class: 'row', style: 'margin:6px 0 4px' }, a));
      wall(el, d, 'link');
    },

    // ---------- Quiz: one question per door ----------
    quiz(el, d, o) {
      const q = d.q, key = 'sp_quiz_' + d.n, box = h('div', { class: 'quiz' });
      el.append(h('div', { class: 'qnav' }, [1, 2, 3, 4, 5].map(i => h('i', { class: i < d.qi ? 'done' : i === d.qi ? 'on' : '' })), h('span', { class: 'lb' }, L({ de: `Frage ${d.qi} von 5`, en: `Question ${d.qi} of 5` }))), box);
      const fmt = v => Number(v).toLocaleString(L({ de: 'de-DE', en: 'en-GB' }));
      const right = v => q.slider ? Math.abs(+v - q.ok) <= q.tol : +v === q.ok;
      const answer = async v => { ls.set(key, String(v)); if (o.sfx) o.sfx(right(v) ? 'right' : 'wrong'); try { await store.add(d.n, { kind: 'vote', body: String(v) }); } catch (e) {} draw(last); };
      let last = [];
      const result = (mine, all) => {
        const ok = right(mine);
        return h('div', { class: 'res' }, h('h3', {}, ok ? L({ de: 'Richtig!', en: 'Correct!' }) : L({ de: 'Knapp daneben', en: 'Not quite' })),
          h('p', {}, L(q.why)), all.length ? h('p', { class: 'small' }, L({ de: `${Math.round(all.filter(right).length / all.length * 100)} % der Kolleg:innen lagen richtig.`, en: `${Math.round(all.filter(right).length / all.length * 100)} % of colleagues got it right.` })) : null);
      };
      const draw = posts => {
        last = posts;
        const mine = ls.get(key), all = posts.filter(p => p.kind === 'vote').map(p => p.body);
        if (q.slider) {
          const val = h('div', { class: 'big-n' }, fmt(mine ?? q.start), h('small', {}, L(q.unit)));
          const rng = h('input', { type: 'range', min: q.min, max: q.max, step: q.step, value: mine ?? q.start, disabled: mine != null, 'aria-label': L(q.unit) });
          rng.addEventListener('input', () => { val.firstChild.textContent = fmt(rng.value); });
          const pos = v => (v - q.min) / (q.max - q.min) * 100 + '%';
          const avg = all.length ? Math.round(all.reduce((a, b) => a + +b, 0) / all.length / 1000) * 1000 : null;
          const wrap = h('div', { class: 'range' + (mine != null ? ' shown' : '') },
            avg != null && h('div', { class: 'mk avg', style: `left:${pos(avg)}` }, L({ de: 'Ø Team ', en: 'Team avg ' }) + fmt(avg)),
            h('div', { class: 'mk ok', style: `left:${pos(q.ok)}` }, L({ de: 'Richtig ', en: 'Answer ' }) + fmt(q.ok)), rng);
          box.replaceChildren(val, wrap, h('div', { class: 'ticks' }, h('span', {}, fmt(q.min)), h('span', {}, fmt(q.max))),
            mine == null ? btn(L({ de: 'Schätzung abgeben', en: 'Lock in my guess' }), () => answer(rng.value), 'primary') : result(mine, all));
          return;
        }
        const n = all.length;
        box.replaceChildren(...[h('div', { class: 'ans' + (mine != null ? ' shown' : '') }, L(q.options).map((label, i) => {
          const c = all.filter(v => v === String(i)).length, pc = n ? Math.round(c / n * 100) : 0;
          return h('button', { type: 'button', disabled: mine != null, class: mine == null ? '' : i === q.ok ? 'ok' : String(i) === mine ? 'bad' : '', onclick: () => answer(i) },
            h('span', { class: 'fill', style: mine != null ? `width:${pc}%` : '' }), h('span', { class: 'l' }, 'ABC'[i]), h('span', { class: 't' }, label), mine != null && h('span', { class: 'pc' }, pc + ' %'));
        })), mine != null && result(mine, all)].filter(Boolean));
      };
      live(d.n, draw);
    },

    // ---------- Quiz result on the 23rd ----------
    quizscore(el, d, o, head, all) {
      const qs = all.filter(x => x.type === 'quiz');
      const right = (q, v) => v != null && (q.q.slider ? Math.abs(+v - q.q.ok) <= q.q.tol : +v === q.q.ok);
      const mine = qs.map(q => ls.get('sp_quiz_' + q.n)), score = qs.filter((q, i) => right(q, mine[i])).length;
      const label = score >= 4 ? L({ de: 'Weihnachtsprofi', en: 'Christmas pro' }) : score >= 2 ? L({ de: 'Solide Plätzchenklasse', en: 'Solid cookie class' }) : L({ de: 'Glühwein-Anfänger:in', en: 'Mulled wine beginner' });
      const team = h('p', { class: 'small' });
      el.append(h('div', { class: 'score' }, h('div', { class: 'big-n' }, `${score}/${qs.length}`), h('span', { class: 'tag-b' }, label)),
        h('ol', { class: 'qlist' }, qs.map((q, i) => h('li', { class: right(q, mine[i]) ? 'ok' : '' }, h('b', {}, right(q, mine[i]) ? '✓ ' : mine[i] == null ? '– ' : '✗ '), L(q.title), h('span', {}, ' · ' + (q.q.slider ? Number(q.q.ok).toLocaleString('de-DE') : L(q.q.options)[q.q.ok]))))), team);
      Promise.all(qs.map(q => store.list(q.n).catch(() => []))).then(lists => {
        const by = {};
        lists.forEach((posts, i) => posts.filter(p => p.kind === 'vote').forEach(p => { (by[p.name] = by[p.name] || {})[i] = p.body; }));
        const names = Object.keys(by), full = names.filter(nm => qs.every((q, i) => right(q, by[nm][i])));
        if (!names.length) return;
        team.textContent = (names.length === 1 ? L({ de: 'Eine Person hat mitgerätselt.', en: 'One person played.' }) : L({ de: `${names.length} Kolleg:innen haben mitgerätselt.`, en: `${names.length} colleagues played.` })) + (full.length ? ' ' + L({ de: 'Alle fünf richtig: ', en: 'All five right: ' }) + full.join(', ') + '.' : '');
      });
    },

    // ---------- Meme tree ----------
    meme(el, d, o, head) {
      const tb = h('div', { class: 'treebox' }, h('div', { class: 'tree', html: `<svg viewBox="0 0 400 500" aria-hidden="true"><polygon points="200,70 290,190 110,190"/><polygon points="200,130 320,290 80,290"/><polygon points="200,210 360,410 40,410"/><rect x="176" y="410" width="48" height="56"/><rect x="120" y="466" width="160" height="14"/></svg>` }), h('div', { class: 'top', html: burst() }));
      const st = stage(head, 'blush tall', tb);
      let big = false, posts = [], laughs = [];
      const zoom = btn(L({ de: 'Baum vergrößern', en: 'Enlarge the tree' }), () => { big = !big; zoom.textContent = big ? L({ de: 'Ganzer Baum', en: 'Whole tree' }) : L({ de: 'Baum vergrößern', en: 'Enlarge the tree' }); layout(); }, 'line');
      el.append(h('div', { class: 'row' }, zoom));
      wall(el, d, 'image', { board: false });
      // Pack n ornaments into the tree triangle (viewBox 400x500) on a hex grid, as large as they can be.
      const grid = dd => { const pts = []; for (let k = 0, y = 112; y <= 400; k++, y += dd * 0.866) { const hw = 160 * (y - 70) / 340 - dd * 0.3, off = k % 2 ? dd / 2 : 0; for (let j = -20; j <= 20; j++) { const x = 200 + j * dd + off; if (Math.abs(x - 200) <= hw) pts.push([x, y]); } } return pts; };
      const pack = n => { let lo = 6, hi = 120; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; grid(m).length >= n ? lo = m : hi = m; } const p = grid(lo); return { dd: lo, pts: Array.from({ length: n }, (_, i) => p[Math.floor(i * p.length / n)]) }; };
      const layout = () => {
        tb.querySelectorAll('.orn').forEach(x => x.remove());
        const memes = posts.filter(p => p.kind === 'image' && p.image);
        const W = st.clientWidth - 24, H = st.clientHeight - 24;
        const fit = Math.max(160, Math.min(W, H * 0.8));
        const { dd, pts } = pack(Math.max(1, memes.length)), size = Math.min(dd * 0.86, 62);
        const w = big ? Math.max(fit, 84 * 400 / size) : fit;
        tb.style.width = w + 'px'; st.classList.toggle('big', big);
        const px = size / 400 * w, sm = px < 80, count = id => votes(laughs, 'laugh:' + id).length;
        const best = memes.reduce((b, m) => count(m.id) > (b ? count(b.id) : 0) ? m : b, null);
        memes.forEach((m, i) => {
          const [x, y] = pts[i];
          tb.append(h('button', { type: 'button', class: 'orn' + (i % 3 === 1 ? '' : ' round') + (m === best ? ' win' : '') + (sm ? ' sm' : ''), style: `left:${x / 4}%;top:${y / 5}%;width:${size / 4}%`, 'aria-label': m.name, onclick: () => open(m) },
            h('i', { class: 'str' }), h('i', { class: 'cap' }), h('span', { class: 'fr' }, h('img', { src: m.image, alt: '', loading: 'lazy' })),
            !sm && h('span', { class: 'tag' }, h('b', {}, m.name), '😂 ' + count(m.id))));
        });
        if (big) requestAnimationFrame(() => { st.scrollLeft = (st.scrollWidth - st.clientWidth) / 2; });
      };
      const open = m => {
        const key = 'sp_laugh_' + m.id, n = votes(laughs, 'laugh:' + m.id).length;
        const ov = h('div', { class: 'overlay', onclick: e => { if (e.target === ov) ov.remove(); } }, h('div', { class: 'ov-in' },
          h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', { class: 'lb' }, m.name), h('button', { type: 'button', class: 'x-s', 'aria-label': L({ de: 'Schließen', en: 'Close' }), onclick: () => ov.remove() }, '×')),
          h('img', { src: m.image, alt: '' }), m.body && h('p', {}, m.body),
          h('div', { class: 'row' }, btn((ls.get(key) ? '😂 ' + L({ de: 'Gelacht', en: 'Laughed' }) : '😂 ' + L({ de: 'Lustig', en: 'Funny' })) + ' · ' + n, async e => {
            if (ls.get(key)) return; ls.set(key, '1'); e.currentTarget.disabled = true;
            try { await store.add(d.n, { kind: 'vote', body: 'laugh:' + m.id }); } catch (x) { ls.del(key); }
            ov.remove();
          }, 'primary'), store.isMine(m.id) && btn(t('clear'), () => { store.remove(d.n, m.id).catch(() => {}); ov.remove(); }, 'line'))));
        (el.closest('#card') || document.body).append(ov); onCleanup(() => ov.remove());
      };
      live(d.n, p => { posts = p; laughs = p.filter(x => x.kind === 'vote'); layout(); });
      const ro = new ResizeObserver(() => layout()); ro.observe(st); onCleanup(() => ro.disconnect());
    },

    // ---------- Meme of the year: the winners ----------
    memeaward(el, d) {
      const box = h('div', { class: 'podium' }); el.append(box);
      live(d.from, posts => {
        const memes = posts.filter(p => p.kind === 'image' && p.image), count = id => votes(posts, 'laugh:' + id).length;
        const top = memes.sort((a, b) => count(b.id) - count(a.id)).slice(0, 3);
        box.replaceChildren(...(top.length ? top.map((m, i) => h('figure', { class: i ? '' : 'first' }, h('span', { class: 'place' }, String(i + 1)), h('img', { src: m.image, alt: '' }), h('figcaption', {}, h('b', {}, m.name), ` · 😂 ${count(m.id)}`, m.body ? h('span', {}, m.body) : null)))
          : [h('p', { class: 'empty' }, L({ de: 'Am Baum hängt noch nichts. Tür 8 wartet.', en: 'Nothing on the tree yet. Door 8 is waiting.' }))]));
      });
    },

    // ---------- Recipe shelf in the kitchen ----------
    recipes(el, d, o, head) {
      const books = h('div', { class: 'books' }), ginger = h('div', { class: 'ginger' }, h('div', { class: 'walk' }, h('div', { class: 'bob' })));
      const kitchen = h('div', { class: 'kitchen', html: KITCHEN }); kitchen.append(books, ginger);
      const st = stage(head, 'kitchen-bg tall', kitchen);
      loadSvg('xmas/ginger.svg').then(s => { ginger.querySelector('.bob').innerHTML = s; });
      const seed = { id: 'seed', name: 'Strichpunkt', ...d.seed };
      let list = [seed], baked = [], cur = 0, fresh = null;
      const stack = h('div', { class: 'stack' });
      if (matchMedia('(min-width:900px)').matches) kitchen.append(stack); else el.append(stack);
      const parse = p => { try { const r = JSON.parse(p.body); return { id: p.id, name: p.name, t: r.t, z: r.z || [], s: r.s || [] }; } catch (e) { return null; } };
      const rnd = i => { const x = Math.sin(i * 91.7 + 3.1) * 43758.5; return x - Math.floor(x); };
      const drawBooks = () => {
        const sc = Math.max(kitchen.clientWidth / 1000, kitchen.clientHeight / 700), ct = kitchen.clientHeight - 200 * sc;
        ginger.style.top = (ct - 96) + 'px';
        const room = ct - 104 * sc - books.offsetTop - 30, n = list.length + 1;
        let f = 1, per = 8;
        for (; f > 0.3; f -= 0.05) { per = Math.max(6, Math.floor((books.clientWidth - 16) / (15 * f))); const rows = Math.ceil(n / per); if (rows * 96 * f + (rows - 1) * 18 * f + rows * 10 <= room) break; }
        books.style.setProperty('--f', f.toFixed(2));
        const spines = list.map((r, i) => h('button', { type: 'button', class: 'spine s' + Math.floor(rnd(i) * 5) + (i === cur ? ' on' : ''), title: L(r.t), 'aria-label': L(r.t),
          style: `width:${(8 + Math.round(rnd(i + 50) * 6)) * f}px;height:${(58 + Math.round(rnd(i + 99) * 30)) * f}px`, onclick: () => { cur = i; drawCard(); drawBooks(); } }));
        spines.push(h('button', { type: 'button', class: 'spine add', title: L({ de: 'Rezept einlegen', en: 'Add a recipe' }), onclick: () => form.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, '+'));
        const planks = []; for (let i = 0; i < spines.length; i += per) planks.push(h('div', { class: 'plank' }, spines.slice(i, i + per)));
        books.replaceChildren(h('div', { class: 'lbl' }, L(list[cur].t)), ...planks);
      };
      // The recipe someone just added opens straight away.
      const show = () => { const i = fresh ? list.findIndex(r => r.id === fresh) : -1; if (i >= 0) { cur = i; fresh = null; } cur = Math.min(cur, list.length - 1); drawCard(); drawBooks(); };
      const drawCard = () => {
        const r = list[cur], nx = list[(cur + 1) % list.length], key = 'sp_baked_' + r.id, nb = votes(baked, 'baked:' + r.id).length;
        const front = h('article', { class: 'rcard' }, h('h3', {}, L(r.t)), h('p', { class: 'lb' }, L({ de: 'Eingelegt von ', en: 'Added by ' }) + r.name),
          h('div', { class: 'cols' }, h('div', {}, h('h4', { class: 'lb' }, L({ de: 'Zutaten', en: 'Ingredients' })), h('ul', {}, L(r.z).map(x => h('li', {}, x)))),
            h('div', {}, h('h4', { class: 'lb' }, L({ de: 'So geht’s', en: 'How to' })), h('ol', {}, L(r.s).map(x => h('li', {}, x))))),
          h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn ' + (ls.get(key) ? 'primary' : 'ghost'), disabled: !!ls.get(key), onclick: async () => {
            ls.set(key, '1'); try { await store.add(d.n, { kind: 'vote', body: 'baked:' + r.id }); } catch (e) { ls.del(key); drawCard(); } } },
            (ls.get(key) ? '✓ ' : '') + L({ de: 'Hab ich gebacken', en: 'I baked it' }) + ' · ' + nb),
            list.length > 1 && btn(L({ de: 'Nächstes →', en: 'Next →' }), () => { front.classList.add('out'); setTimeout(() => { cur = (cur + 1) % list.length; drawCard(); drawBooks(); }, 320); }),
            store.isMine(r.id) && btn(t('clear'), () => { store.remove(d.n, r.id).catch(() => {}); cur = 0; }, 'line')));
        stack.replaceChildren(list.length > 2 ? h('div', { class: 'rcard back b2' }) : '', list.length > 1 ? h('div', { class: 'rcard back b1' }, h('span', { class: 'lb' }, L({ de: 'Als Nächstes: ', en: 'Up next: ' }) + L(nx.t))) : '', front);
      };
      // Add a recipe: one ingredient and one step per line.
      const ti = h('input', { maxlength: 60, placeholder: L({ de: 'Name des Rezepts', en: 'Recipe name' }) });
      const zi = h('textarea', { rows: 5, placeholder: L({ de: 'Zutaten, eine pro Zeile', en: 'Ingredients, one per line' }) });
      const si = h('textarea', { rows: 5, placeholder: L({ de: 'Schritte, einer pro Zeile', en: 'Steps, one per line' }) });
      const e1 = err();
      const send = btn(L({ de: 'Ins Regal stellen', en: 'Put it on the shelf' }), async () => {
        const lines = v => v.split('\n').map(x => x.trim()).filter(Boolean);
        const r = { t: ti.value.trim(), z: lines(zi.value), s: lines(si.value) }, body = JSON.stringify(r);
        if (!r.t || !r.z.length || !r.s.length) return e1.textContent = L({ de: 'Name, Zutaten und Schritte bitte.', en: 'Name, ingredients and steps, please.' });
        if (body.length > 2000) return e1.textContent = L({ de: 'Etwas kürzer, bitte.', en: 'A little shorter, please.' });
        if (!needName(send)) return;
        send.disabled = true;
        try { fresh = await store.add(d.n, { kind: 'recipe', body }); ti.value = zi.value = si.value = ''; e1.textContent = ''; show(); } catch (e) { e1.textContent = t('failed'); }
        send.disabled = false;
      }, 'primary');
      const form = h('div', { class: 'wall-form' }, h('h3', { class: 'sub' }, L({ de: 'Dein Rezept', en: 'Your recipe' })), ti, zi, si, h('div', { class: 'row' }, send), e1);
      el.append(form);
      if (!store.isShared) el.append(h('p', { class: 'small', style: 'opacity:.5' }, t('local')));
      live(d.n, posts => {
        baked = posts.filter(p => p.kind === 'vote');
        list = [seed, ...posts.filter(p => p.kind === 'recipe').map(parse).filter(Boolean).reverse()];
        show();
      });
      const ro = new ResizeObserver(() => drawBooks()); ro.observe(st); onCleanup(() => ro.disconnect());
    },

    // ---------- Christmas dinner: a long table ----------
    dinner(el, d) {
      const dish = h('input', { maxlength: 80, placeholder: L({ de: 'Was gibt es bei euch?', en: 'What’s on your table?' }), 'aria-label': L({ de: 'Gericht', en: 'Dish' }) });
      const from = h('input', { maxlength: 40, placeholder: L({ de: 'Woher kommt die Tradition?', en: 'Where is the tradition from?' }), 'aria-label': L({ de: 'Herkunft', en: 'Origin' }) });
      const e1 = err(), table = h('div', { class: 'table' });
      const send = btn(L({ de: 'Auf den Tisch', en: 'On the table' }), async () => {
        if (!dish.value.trim()) return e1.textContent = L({ de: 'Was kommt auf den Teller?', en: 'What goes on the plate?' });
        if (!needName(send)) return;
        send.disabled = true;
        try { await store.add(d.n, { kind: 'text', body: (dish.value.trim() + '\n' + from.value.trim()).slice(0, 280) }); dish.value = from.value = ''; e1.textContent = ''; } catch (e) { e1.textContent = t('failed'); }
        send.disabled = false;
      }, 'primary');
      const hint = h('p', { class: 'small', style: 'opacity:.7' });
      el.append(h('div', { class: 'wall-form' }, dish, from, h('div', { class: 'row' }, send), e1), hint, table);
      if (!store.isShared) el.append(h('p', { class: 'small', style: 'opacity:.5' }, t('local')));
      live(d.n, posts => {
        const plates = posts.filter(p => p.kind === 'text').reverse();
        table.style.setProperty('--n', Math.max(4, plates.length));
        const seats = Array.from({ length: Math.max(0, (plates.length < 6 ? 6 : plates.length % 2 ? 1 : 2) - (plates.length < 6 ? plates.length : 0)) }, () => h('div', { class: 'plate empty-seat', 'aria-hidden': 'true' }));
        table.replaceChildren(h('div', { class: 'cloth' }), ...(plates.length ? plates.map(p => { const [a, b] = p.body.split('\n'); return h('div', { class: 'plate' }, h('span', { class: 'dish' }, a), b && h('span', { class: 'from' }, b), h('span', { class: 'who' }, p.name), store.isMine(p.id) && h('button', { class: 'del', type: 'button', 'aria-label': t('clear'), onclick: () => store.remove(d.n, p.id).catch(() => {}) }, '×')); })
          : []), ...seats);
        hint.textContent = plates.length ? '' : L({ de: 'Noch sitzt niemand am Tisch. Schreib dein Gericht oben rein, dann steht es hier auf einem Teller.', en: 'Nobody at the table yet. Write your dish above and it appears here on a plate.' });
      });
    },

    // ---------- Breakfast in every studio: who comes? ----------
    rsvp(el, d) {
      const key = 'sp_rsvp_' + d.n, list = h('div', { class: 'studios' }); el.append(list);
      const draw = posts => {
        const mine = JSON.parse(ls.get(key) || 'null');
        list.replaceChildren(...d.studios.map(s => {
          const people = posts.filter(p => p.kind === 'vote' && p.body === 'rsvp:' + s.city), on = mine && mine.city === s.city;
          return h('div', { class: 'studio' + (on ? ' on' : '') }, h('div', {}, h('h3', {}, s.city), h('p', { class: 'small' }, L(s.when))),
            h('div', { class: 'count' }, h('b', {}, String(people.length)), h('span', { class: 'lb' }, L({ de: 'kommen', en: 'coming' }))),
            people.length ? h('p', { class: 'small names' }, people.map(p => p.name).join(', ')) : null,
            h('button', { type: 'button', class: 'btn ' + (on ? 'primary' : 'ghost'), onclick: async e => {
              if (!needName(e.currentTarget)) return;
              if (mine) { ls.del(key); try { await store.remove(d.n, mine.id); } catch (x) {} }
              if (!on) { try { const id = await store.add(d.n, { kind: 'vote', body: 'rsvp:' + s.city }); ls.set(key, JSON.stringify({ id, city: s.city })); } catch (x) {} }
              run();
            } }, on ? '✓ ' + L({ de: 'Ich komme', en: 'I’m coming' }) : L({ de: 'Ich komme', en: 'I’m coming' })));
        }));
      };
      const run = live(d.n, draw);
    },

    // ---------- TV: one episode in a drawn tube telly ----------
    tv(el, d, o) {
      const scr = h('div', { class: 'scr' });
      const on = h('button', { type: 'button', class: 'tv-on', onclick: () => {
        scr.replaceChildren(h('iframe', { src: `https://www.youtube-nocookie.com/embed/${d.video}?autoplay=1&rel=0`, title: L(d.title), allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true }));
        if (o.hush) { o.hush(true); onCleanup(() => o.hush(false)); }
      } }, h('span', { html: burst() }), L({ de: 'Einschalten', en: 'Switch on' }));
      scr.append(on);
      el.append(h('div', { class: 'tvbox' }, h('div', { html: TV }), scr), h('p', { class: 'small', style: 'opacity:.6' }, L({ de: 'Video: TOGGO auf YouTube. Die Musik des Kalenders macht so lange Pause.', en: 'Video: TOGGO on YouTube. The calendar music pauses meanwhile.' })));
    },

    // ---------- DIY: a Strichpunkt ornament for the tree ----------
    diy(el, d, o, head) {
      stage(head, '', h('div', { class: 'ornament', html: ORNAMENT }));
      el.append(h('ol', { class: 'steps-s' }, L(d.steps).map(s => h('li', {}, s))),
        h('div', { class: 'row', style: 'margin:6px 0 10px' }, h('a', { class: 'btn primary', href: ASSET('diy/vorlage.svg'), target: '_blank', rel: 'noopener' }, L({ de: 'Vorlage drucken (A4)', en: 'Print the template (A4)' }))),
        h('h3', { class: 'sub' }, L({ de: 'Zeig deinen Anhänger', en: 'Show your ornament' })));
      wall(el, d, 'image');
    },

    // ---------- Knecht Ruprecht: today a lump of coal. Unless you knock. ----------
    niete(el, d, o, head) {
      let n = 0;
      const coal = h('button', { type: 'button', class: 'coal', 'aria-label': L({ de: 'Kohle', en: 'Coal' }) });
      const cookie = h('div', { class: 'cookie' });
      const s = stage(head, 'coal-bg', coal, cookie, h('div', { class: 'puff', html: burst() }));
      loadSvg('xmas/ginger.svg').then(x => { cookie.innerHTML = x; });
      coal.addEventListener('click', () => {
        n++; coal.classList.remove('knock'); void coal.offsetWidth; coal.classList.add('knock');
        if (n === 5) { s.classList.add('won'); note.textContent = L({ de: 'Na gut. Einen Lebkuchen gibt’s doch.', en: 'Fine. One gingerbread after all.' }); }
      });
      const note = h('p', { class: 'small', style: 'opacity:.6' }, L({ de: 'Man sagt, er sei bestechlich. Klopf mal an die Kohle.', en: 'They say he can be bribed. Knock on the coal.' }));
      el.append(note);
    },

    // ---------- Elf Yourself: Office Management ----------
    elfom(el, d, o, head) {
      const troupe = h('div', { class: 'troupe bw' }), file = h('input', { type: 'file', accept: 'image/*', hidden: true });
      const crew = d.people.map(p => ({ name: p.name, img: ASSET('elf/' + p.file + '.jpg') }));
      let target = -1, own;
      const draw = svg => troupe.replaceChildren(...crew.map((c, i) => h('div', { class: 'elfm' }, h('div', { class: 'body', html: svg }),
        h('button', { type: 'button', class: 'face', 'aria-label': c.name, onclick: () => { target = i; file.click(); } }, h('img', { src: c.img, alt: c.name })), h('span', { class: 'lb nm' }, c.name))));
      file.addEventListener('change', () => { const f = file.files[0]; if (!f || target < 0) return; if (own) URL.revokeObjectURL(own); own = URL.createObjectURL(f); crew[target] = { name: L({ de: 'Du', en: 'You' }), img: own }; file.value = ''; loadSvg('xmas/elf.svg').then(draw); });
      onCleanup(() => own && URL.revokeObjectURL(own));
      loadSvg('xmas/elf.svg').then(draw);
      const col = btn(L({ de: 'Foto: Original', en: 'Photo: original' }), () => { const bw = troupe.classList.toggle('bw'); col.textContent = bw ? L({ de: 'Foto: Original', en: 'Photo: original' }) : L({ de: 'Foto: Schwarzweiß', en: 'Photo: black and white' }); }, 'line');
      const st = stage(head, 'blush tall', troupe, file);
      el.append(h('div', { class: 'row' }, col), h('p', { class: 'small', style: 'opacity:.6' }, L({ de: 'Tipp auf ein Gesicht und wähl ein eigenes Foto. Es bleibt in deinem Browser.', en: 'Tap a face and pick your own photo. It stays in your browser.' })));
      for (let i = 0; i < 16; i++) st.append(h('span', { class: 'fall', html: burst(), style: `left:${Math.random() * 100}%;animation-delay:${-Math.random() * 5}s;animation-duration:${3 + Math.random() * 4}s;width:${14 + Math.random() * 22}px` }));
    },
  };
}

// ---------- drawings ----------
// Pictures for the left column of simple doors (set with art: in content.js).
export const ART = {
  // A chocolate Nikolaus: someone takes bites out of his hat and hand, sweets float around.
  nikolaus: `<div class="niko"><img src="${ASSET('xmas/santa.svg')}" alt=""><i class="bite b1"></i><i class="bite b2"></i><i class="bite b3"></i>
    <i class="crumb c1"></i><i class="crumb c2"></i><i class="crumb c3"></i><i class="crumb c4"></i></div>
    ${[[8, 18, '#fff', -20, 0], [80, 12, '#000', 25, 1.2], [14, 70, '#F3E6E0', 10, 2.1], [84, 64, '#fff', -35, .6], [70, 86, '#000', 15, 1.7], [24, 88, '#fff', 40, 2.6]].map(([x, y, c, r, dl]) =>
      `<svg class="bonbon" style="left:${x}%;top:${y}%;--r:${r}deg;animation-delay:-${dl}s" viewBox="0 0 60 30" aria-hidden="true"><polygon points="0,4 14,15 0,26" fill="${c}"/><polygon points="60,4 46,15 60,26" fill="${c}"/><ellipse cx="30" cy="15" rx="17" ry="13" fill="${c}"/></svg>`).join('')}`,
  // A pretzel and a coffee for breakfast.
  pretzel: `<svg class="pretzel" viewBox="0 0 240 200" aria-hidden="true"><g fill="none" stroke="#000" stroke-linecap="round">
    <path d="M44 108 C44 172 196 172 196 108" stroke-width="30"/>
    <path d="M44 110 C38 56 90 30 114 80 C124 102 138 128 164 152" stroke-width="19"/>
    <path d="M196 110 C202 56 150 30 126 80 C116 102 102 128 76 152" stroke-width="19"/></g>
    <g fill="#fff"><circle cx="70" cy="150" r="3"/><circle cx="96" cy="160" r="2.5"/><circle cx="120" cy="158" r="3"/><circle cx="146" cy="162" r="2.5"/><circle cx="174" cy="148" r="3"/><circle cx="58" cy="128" r="2.5"/><circle cx="184" cy="126" r="2.5"/><circle cx="56" cy="80" r="2.5"/><circle cx="184" cy="78" r="2.5"/></g></svg>`,
};

const KITCHEN = `<svg class="bg" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs><pattern id="tiles" width="50" height="50" patternUnits="userSpaceOnUse"><rect width="50" height="50" fill="#F3E6E0"/><path d="M50 0V50H0" fill="none" stroke="#fff" stroke-width="3"/></pattern></defs>
  <rect width="1000" height="700" fill="url(#tiles)"/>
  <rect y="500" width="1000" height="200" fill="#000"/><rect y="500" width="1000" height="14" fill="#fff"/>
  <rect x="640" y="534" width="250" height="150" fill="none" stroke="#fff" stroke-width="5"/><rect x="664" y="572" width="202" height="88" fill="#B78CFF"/><rect x="664" y="548" width="202" height="8" fill="#fff"/>
  <g fill="#F3E6E0"><circle cx="712" cy="640" r="12"/><circle cx="752" cy="640" r="12"/><circle cx="792" cy="640" r="12"/><circle cx="832" cy="640" r="12"/></g><rect x="664" y="652" width="202" height="6" fill="#000"/>
  <g fill="#fff"><circle cx="160" cy="560" r="9"/><circle cx="190" cy="560" r="9"/></g><rect x="120" y="580" width="360" height="5" fill="#fff"/>
  <rect x="118" y="474" width="190" height="26" rx="13" fill="#fff"/><rect x="88" y="482" width="32" height="10" fill="#000"/><rect x="306" y="482" width="32" height="10" fill="#000"/>
  <polygon transform="translate(372 484) scale(.8)" fill="#000" points="${BURST}"/><polygon transform="translate(410 490) scale(.5)" fill="#B78CFF" points="${BURST}"/>
  <g font-family="Strichpunkt Sans,Archivo,sans-serif" font-weight="900" font-stretch="150%" text-anchor="middle">
    <rect x="452" y="418" width="64" height="82" fill="#fff"/><rect x="448" y="408" width="72" height="14" fill="#000"/><text x="484" y="466" font-size="12">MEHL</text>
    <rect x="528" y="436" width="62" height="64" fill="#fff"/><rect x="524" y="426" width="70" height="13" fill="#B78CFF"/><text x="559" y="474" font-size="10">ZUCKER</text>
    <rect x="602" y="456" width="40" height="44" fill="#B78CFF"/><rect x="598" y="448" width="48" height="11" fill="#000"/><text x="622" y="483" font-size="9">ZIMT</text>
  </g>
  <rect x="664" y="430" width="104" height="70" fill="#B78CFF"/><rect x="650" y="446" width="16" height="10" fill="#000"/><rect x="766" y="446" width="16" height="10" fill="#000"/>
  <rect x="656" y="418" width="120" height="14" fill="#000"/><rect x="706" y="406" width="20" height="14" fill="#000"/>
  <rect x="796" y="458" width="76" height="42" fill="#fff"/><rect x="870" y="464" width="58" height="10" fill="#000"/>
  <g class="steam" fill="none" stroke="#000" stroke-width="4" stroke-linecap="round">
    <path d="M694 396 q-10 -14 0 -28 q10 -14 0 -28"/><path d="M716 392 q-10 -14 0 -28 q10 -14 0 -28" style="animation-delay:-.7s"/><path d="M738 396 q-10 -14 0 -28 q10 -14 0 -28" style="animation-delay:-1.4s"/>
    <path d="M824 444 q-8 -11 0 -22 q8 -11 0 -22" style="animation-delay:-.4s"/><path d="M844 444 q-8 -11 0 -22 q8 -11 0 -22" style="animation-delay:-1.1s"/>
  </g></svg>`;

// DIY: the finished Strichpunkt ornament hanging from a fir branch.
const ORNAMENT = `<svg viewBox="0 0 400 460" aria-hidden="true">
  <g stroke="#000" stroke-width="7" stroke-linecap="round"><path d="M-40 60 C80 40 240 30 440 70"/>${[20, 60, 100, 140, 180, 220, 260, 300, 340, 380].map((x, i) => `<path d="M${x} ${52 - i * .2 + (i > 5 ? (i - 5) * 3 : 0)} l${i % 2 ? 22 : -22} ${i % 2 ? 26 : 30}"/>`).join('')}</g>
  <g class="swing"><rect x="198.5" y="56" width="3" height="66" fill="#000"/>
    <circle cx="200" cy="160" r="40" fill="#fff"/><rect x="198.5" y="198" width="3" height="24" fill="#000"/>
    <path transform="translate(0 -30)" d="M200 250C222 250 240 268 240 290C240 342 220 378 178 400C175 395 171 391 168 386C194 368 204 350 204 330C182 330 160 312 160 290C160 268 178 250 200 250Z" fill="#fff"/>
    <g class="glint"><polygon transform="translate(256 148) scale(.55)" fill="#fff" points="${BURST}"/></g></g>
</svg>`;

const TV = `<svg viewBox="0 0 600 440" aria-hidden="true">
  <path d="M260 26 L196 -44 M340 26 L410 -50" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
  <polygon transform="translate(410 -50) scale(.7)" fill="#B78CFF" points="${BURST}"/>
  <rect x="236" y="12" width="128" height="16" fill="currentColor"/>
  <rect x="20" y="26" width="560" height="356" rx="22" fill="currentColor"/>
  <rect x="420" y="52" width="134" height="300" fill="var(--cb,#000)"/>
  <circle cx="487" cy="114" r="34" fill="currentColor"/><rect x="483" y="84" width="8" height="34" fill="var(--cb,#000)"/>
  <circle cx="487" cy="200" r="26" fill="currentColor"/><rect x="470" y="196" width="34" height="8" fill="#B78CFF"/>
  ${[252, 268, 284, 300, 316, 332].map(y => `<rect x="440" y="${y}" width="94" height="6" fill="currentColor"/>`).join('')}
  <rect x="80" y="382" width="70" height="40" fill="currentColor"/><rect x="450" y="382" width="70" height="40" fill="currentColor"/>
</svg>`;

// One small drawing per DIY step: template, cut, punch, thread, hang.
const SEMI = `<circle cx="50" cy="28" r="14"/><path d="M50 50C58 50 64 56 64 64C64 82 57 95 43 102L39 97C48 91 52 85 52 78C44 78 36 72 36 64C36 56 42 50 50 50Z"/>`;
const DIY_PICS = [
  `<svg viewBox="0 0 100 110"><rect x="18" y="6" width="64" height="98" fill="#fff"/><g fill="none" stroke="#000" stroke-width="2" stroke-dasharray="4 3" transform="translate(5 2) scale(.9)">${SEMI}</g></svg>`,
  `<svg viewBox="0 0 100 110"><g fill="#fff">${SEMI}</g><path d="M78 20 L92 6 M78 6 L92 20" stroke="#B78CFF" stroke-width="5" stroke-linecap="round"/></svg>`,
  `<svg viewBox="0 0 100 110"><g fill="#fff">${SEMI}</g><circle cx="50" cy="20" r="3.5" fill="#000"/><circle cx="50" cy="56" r="3.5" fill="#000"/></svg>`,
  `<svg viewBox="0 0 100 110"><rect x="49" y="0" width="2" height="60" fill="#CFCFCF"/><g fill="#fff">${SEMI}</g></svg>`,
  `<svg viewBox="0 0 100 110"><polygon points="50,4 86,104 14,104" fill="#fff" opacity=".25"/><rect x="49" y="10" width="2" height="30" fill="#CFCFCF"/><g fill="#B78CFF" transform="translate(25 30) scale(.5)">${SEMI}</g></svg>`,
];
