// The door types of the 2026 calendar. Each gets the text column (el), the door data (d),
// options (o: lang, city, office, hush) and the picture column (head), and returns nothing.
import { h, btn, L, t, ls, needName } from './ui.js';
import { ANIMS, BURST } from './anims.js';
import * as store from './store.js';
import { media } from './cards.js';
import { ILLU } from './illu.js';

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
      wall(el, d, 'image', { board: false, moving: true });
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
            h('i', { class: 'str' }), h('i', { class: 'cap' }), h('span', { class: 'fr' }, media(m.image)),
            !sm && h('span', { class: 'tag' }, h('b', {}, m.name), '😂 ' + count(m.id))));
        });
        if (big) requestAnimationFrame(() => { st.scrollLeft = (st.scrollWidth - st.clientWidth) / 2; });
      };
      const open = m => {
        const key = 'sp_laugh_' + m.id, n = votes(laughs, 'laugh:' + m.id).length;
        const ov = h('div', { class: 'overlay', onclick: e => { if (e.target === ov) ov.remove(); } }, h('div', { class: 'ov-in' },
          h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', { class: 'lb' }, m.name), h('button', { type: 'button', class: 'x-s', 'aria-label': L({ de: 'Schließen', en: 'Close' }), onclick: () => ov.remove() }, '×')),
          media(m.image), m.body && h('p', {}, m.body),
          h('div', { class: 'row' }, btn((ls.get(key) ? '😂 ' + L({ de: 'Gelacht', en: 'Laughed' }) : '😂 ' + L({ de: 'Lustig', en: 'Funny' })) + ' · ' + n, async e => {
            if (ls.get(key)) return; ls.set(key, '1'); e.currentTarget.disabled = true;
            try { await store.add(d.n, { kind: 'vote', body: 'laugh:' + m.id }); } catch (x) { ls.del(key); }
            ov.remove();
          }, 'primary'), store.isMine(m.id) && btn(t('clear'), () => { store.remove(d.n, m.id).catch(() => {}); ov.remove(); }, 'line'))));
        (el.closest('#card') || document.body).append(ov); onCleanup(() => ov.remove());
      };
      const podium = h('div', { class: 'podium' });
      el.append(h('h3', { class: 'sub' }, L({ de: 'Gerade vorn', en: 'Leading right now' })), podium);
      const drawPodium = () => {
        const memes = posts.filter(p => p.kind === 'image' && p.image), count = id => votes(laughs, 'laugh:' + id).length;
        const top = memes.filter(m => count(m.id) > 0).sort((a, b) => count(b.id) - count(a.id)).slice(0, 3);
        podium.replaceChildren(...(top.length ? top.map((m, i) => h('figure', { class: i ? '' : 'first' }, h('span', { class: 'place' }, String(i + 1)), media(m.image), h('figcaption', {}, h('b', {}, m.name), ` · 😂 ${count(m.id)}`)))
          : [h('p', { class: 'empty' }, L({ de: 'Noch hat niemand gelacht. Tipp auf eine Kugel.', en: 'Nobody has laughed yet. Tap a bauble.' }))]));
      };
      live(d.n, p => { posts = p; laughs = p.filter(x => x.kind === 'vote'); layout(); drawPodium(); });
      const ro = new ResizeObserver(() => layout()); ro.observe(st); onCleanup(() => ro.disconnect());
    },

    // ---------- Meme of the year: the winners ----------
    memeaward(el, d) {
      const box = h('div', { class: 'podium' }); el.append(box);
      live(d.from, posts => {
        const memes = posts.filter(p => p.kind === 'image' && p.image), count = id => votes(posts, 'laugh:' + id).length;
        const top = memes.sort((a, b) => count(b.id) - count(a.id)).slice(0, 3);
        box.replaceChildren(...(top.length ? top.map((m, i) => h('figure', { class: i ? '' : 'first' }, h('span', { class: 'place' }, String(i + 1)), media(m.image), h('figcaption', {}, h('b', {}, m.name), ` · 😂 ${count(m.id)}`, m.body ? h('span', {}, m.body) : null)))
          : [h('p', { class: 'empty' }, L({ de: 'Am Baum hängt noch nichts. Tür 8 wartet.', en: 'Nothing on the tree yet. Door 8 is waiting.' }))]));
      });
    },

    // ---------- Colouring page: the Christmas street to print; on screen it colours itself in ----------
    colour(el, d, o, head) {
      const pic = h('div', { class: 'colouring' });
      stage(head, 'paper-bg', pic);
      fetch(ASSET('diy/ausmalbild.svg')).then(r => r.text()).then(svg => {
        // its own styles are dropped and its class names renamed, so the calendar's styles cannot touch it (scoped in doors.css)
        pic.innerHTML = svg.replace(/<style>[\s\S]*?<\/style>/, '').replace(/class="sh"/g, 'class="cp-s"').replace(/class="ln"/g, 'class="cp-l"');
        const shapes = [...pic.querySelectorAll('.cp-s')].filter(() => Math.random() < 0.35);
        const cols = ['#B78CFF', '#F3E6E0', '#CFCFCF', '#B78CFF', '#000'];
        let i = 0;
        const tick = () => { for (let k = 0; k < 6 && i < shapes.length; k++, i++) shapes[i].style.fill = cols[Math.floor(Math.random() * cols.length)]; if (i < shapes.length) t = setTimeout(tick, 60); };
        let t = setTimeout(tick, 600); onCleanup(() => clearTimeout(t));
      }).catch(() => {});
      el.append(h('div', { class: 'row', style: 'margin:6px 0 10px' },
          h('a', { class: 'btn primary', href: ASSET('diy/ausmalbild.pdf'), target: '_blank', rel: 'noopener' }, L({ de: 'Ausmalbild drucken (A4)', en: 'Print the colouring page (A4)' }))));
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
    dinner(el, d, o, head) {
      const dish = h('input', { maxlength: 80, placeholder: L({ de: 'Was gibt es bei euch?', en: 'What’s on your table?' }), 'aria-label': L({ de: 'Gericht', en: 'Dish' }) });
      const from = h('input', { maxlength: 40, placeholder: L({ de: 'Woher kommt die Tradition?', en: 'Where is the tradition from?' }), 'aria-label': L({ de: 'Herkunft', en: 'Origin' }) });
      const e1 = err(), table = h('div', { class: 'longtable' });
      stage(head, 'blush scroll', table);
      const send = btn(L({ de: 'Auf den Tisch', en: 'On the table' }), async () => {
        if (!dish.value.trim()) return e1.textContent = L({ de: 'Was kommt auf den Teller?', en: 'What goes on the plate?' });
        if (!needName(send)) return;
        send.disabled = true;
        try { await store.add(d.n, { kind: 'text', body: (dish.value.trim() + '\n' + from.value.trim()).slice(0, 280) }); dish.value = from.value = ''; e1.textContent = ''; } catch (e) { e1.textContent = t('failed'); }
        send.disabled = false;
      }, 'primary');
      const hint = h('p', { class: 'small', style: 'opacity:.7' });
      el.append(h('div', { class: 'wall-form' }, dish, from, h('div', { class: 'row' }, send), e1), hint);
      if (!store.isShared) el.append(h('p', { class: 'small', style: 'opacity:.5' }, t('local')));
      // One place setting: fork, plate, knife.
      const setting = (plate, cls = '') => h('div', { class: 'setting ' + cls }, h('span', { class: 'cut', html: FORK }), plate, h('span', { class: 'cut', html: KNIFE }));
      live(d.n, posts => {
        const plates = posts.filter(p => p.kind === 'text').reverse();
        const free = Math.max(plates.length < 8 ? 8 - plates.length : 0, plates.length % 2);
        table.replaceChildren(...plates.map(p => { const [a, b] = p.body.split('\n'); return setting(h('div', { class: 'plate' }, h('span', { class: 'dish' }, a), b && h('span', { class: 'from' }, b), h('span', { class: 'who' }, p.name), store.isMine(p.id) && h('button', { class: 'del', type: 'button', 'aria-label': t('clear'), onclick: () => store.remove(d.n, p.id).catch(() => {}) }, '×'))); }),
          ...Array.from({ length: free }, () => setting(h('div', { class: 'plate' }), 'free')));
        hint.textContent = plates.length ? '' : L({ de: 'Noch sitzt niemand am Tisch. Schreib dein Gericht hier rein, dann steht es links auf einem Teller.', en: 'Nobody at the table yet. Write your dish here and it appears on a plate on the left.' });
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
      stage(head, '', h('div', { class: 'chain', html: CHAIN() }));
      el.append(h('ol', { class: 'steps-s' }, L(d.steps).map(s => h('li', {}, s))),
        h('div', { class: 'row', style: 'margin:6px 0 10px' }, h('a', { class: 'btn primary', href: ASSET('diy/papierkette.pdf'), target: '_blank', rel: 'noopener' }, L({ de: 'Vorlage drucken (A4)', en: 'Print the template (A4)' }))),
        h('h3', { class: 'sub' }, L({ de: 'Zeig deine Kette', en: 'Show your chain' })));
      wall(el, d, 'image');
    },

    // ---------- Knecht Ruprecht left only coal: everyone draws a Christmas tree with it in 30 seconds ----------
    charcoal(el, d, o, head) {
      const W = 800, H = 600, cv = h('canvas', { class: 'paper', width: W, height: H, 'aria-label': L({ de: 'Zeichenblatt', en: 'Drawing paper' }) }), g = cv.getContext('2d');
      const clock = h('span', { class: 'clock' }, '30'), stick = h('div', { class: 'stick' }), e1 = err();
      let left = 30, timer = 0, drawing = false, done = false, used = false, intro = true, last = null, bristles = [], raf = 0;
      // Paper tooth: fine grain plus a softer, larger texture. Charcoal only sticks where the tooth lets it.
      const S = 9, cw = Math.ceil(W / S) + 2, tooth = new Float32Array(W * H), soft = Array.from({ length: cw * (Math.ceil(H / S) + 2) }, Math.random);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const gx = x / S, gy = y / S, ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy, at = (a, b) => soft[(iy + b) * cw + ix + a];
        const smooth = (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fy) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fy;
        tooth[y * W + x] = 0.7 * Math.random() + 0.3 * smooth;
      }
      const dot = (x, y, density) => { const i = (y | 0) * W + (x | 0); if (x < 0 || y < 0 || x >= W || y >= H || tooth[i] > density) return; g.fillRect(x - 0.9, y - 0.9, 1.8 + Math.random() * 0.8, 1.8 + Math.random() * 0.8); };
      const blank = () => { g.globalAlpha = 1; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.fillStyle = '#111'; g.globalAlpha = 0.7; };
      // Each stroke gets its own set of "bristles" across the stick: that gives the dry, streaky line.
      const newStroke = () => { bristles = Array.from({ length: 26 }, (_, k) => ({ o: (k / 25 - 0.5) * 2, a: 0.5 + Math.random() * 0.45, gap: Math.random() * 0.3 })); };
      const line = (a, b) => {
        const dx = b[0] - a[0], dy = b[1] - a[1], dist = Math.hypot(dx, dy) || 1, nx = -dy / dist, ny = dx / dist;
        const r = Math.max(6, 13 - dist * 0.12), press = Math.max(0.45, 1 - dist * 0.015);
        for (let s = 0; s <= dist; s += 0.9) {
          const x = a[0] + dx * s / dist, y = a[1] + dy * s / dist;
          for (const br of bristles) if (Math.random() > br.gap) dot(x + nx * br.o * r + (Math.random() - 0.5) * 1.6, y + ny * br.o * r + (Math.random() - 0.5) * 1.6, br.a * press);
        }
      };
      // The sheet starts with a message, written in charcoal from left to right.
      const writeIntro = async () => {
        try { await document.fonts.load('900 80px "Strichpunkt Sans"'); } catch (e) {}
        const off = document.createElement('canvas'); off.width = W; off.height = H; const o2 = off.getContext('2d');
        o2.translate(W / 2, H / 2); o2.rotate(-0.05); o2.textAlign = 'center'; o2.fillStyle = '#000';
        o2.font = '900 96px "Strichpunkt Sans", Archivo, sans-serif'; o2.fillText(L({ de: 'HEUTE: KOHLE.', en: 'TODAY: COAL.' }), 0, -40);
        o2.font = '400 38px "Strichpunkt Sans", Archivo, sans-serif'; o2.fillText(L({ de: 'Zeichne einen Weihnachtsbaum.', en: 'Draw a Christmas tree.' }), 0, 50);
        o2.font = '400 26px "Strichpunkt Sans", Archivo, sans-serif'; o2.fillText(L({ de: 'Leg los, das Blatt wird sauber.', en: 'Start drawing, the sheet clears.' }), 0, 110);
        const px = o2.getImageData(0, 0, W, H).data;
        let x0 = 0;
        const step = () => {
          if (!intro) return;
          const x1 = Math.min(W, x0 + 26);
          for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) if (px[(y * W + x) * 4 + 3] > 120) dot(x, y, 0.78);
          x0 = x1; if (x0 < W) raf = requestAnimationFrame(step);
        };
        step();
      };
      const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
      const stop = () => { clearInterval(timer); timer = 0; };
      const start = () => { if (timer || done) return; timer = setInterval(() => { left--; clock.textContent = left; if (left <= 0) { stop(); done = true; drawing = false; paper.classList.add('done'); } }, 1000); };
      cv.addEventListener('pointerdown', e => {
        if (done) return; e.preventDefault(); cv.setPointerCapture(e.pointerId);
        if (intro) { intro = false; cancelAnimationFrame(raf); blank(); paper.classList.remove('intro'); }
        drawing = used = true; last = pos(e); newStroke(); line(last, [last[0] + 0.5, last[1] + 0.5]); start();
      });
      cv.addEventListener('pointermove', e => { const p = pos(e); stick.style.left = (p[0] / W * 100) + '%'; stick.style.top = (p[1] / H * 100) + '%'; if (!drawing) return; line(last, p); last = p; });
      cv.addEventListener('pointerup', () => { drawing = false; });
      cv.addEventListener('pointerleave', () => { drawing = false; });
      onCleanup(() => { stop(); cancelAnimationFrame(raf); });
      const fresh = () => { stop(); blank(); intro = false; left = 30; clock.textContent = '30'; done = used = false; paper.classList.remove('done', 'intro'); e1.textContent = ''; send.disabled = false; };
      const send = btn(L({ de: 'In den Wald hängen', en: 'Hang it in the forest' }), async () => {
        if (!used) return e1.textContent = L({ de: 'Erst zeichnen, dann aufhängen.', en: 'Draw first, then hang it.' });
        if (!needName(send)) return;
        stop(); done = true; paper.classList.add('done'); send.disabled = true;
        try { await store.add(d.n, { kind: 'image', image: cv.toDataURL('image/jpeg', 0.8) }); e1.textContent = L({ de: 'Hängt im Kohle-Wald.', en: 'It’s in the charcoal forest.' }); }
        catch (x) { e1.textContent = t('failed'); send.disabled = false; }
      }, 'primary');
      const paper = h('div', { class: 'sheet intro' }, cv, stick, clock);
      stage(head, 'charcoal-bg tall', h('div', { class: 'easel' }, paper, h('div', { class: 'row' }, btn(L({ de: 'Neues Blatt', en: 'New sheet' }), fresh, 'line'), send), e1));
      blank(); writeIntro();
      // The gallery: a compact forest of small framed drawings; tap one to see it large.
      const forest = h('div', { class: 'forest' }), count = h('span', { class: 'lb' });
      el.append(h('div', { class: 'row', style: 'justify-content:space-between;align-items:baseline;margin-top:22px' }, h('h3', { class: 'sub', style: 'margin:0' }, L({ de: 'Der Kohle-Wald', en: 'The charcoal forest' })), count), forest);
      if (!store.isShared) el.append(h('p', { class: 'small', style: 'opacity:.5' }, t('local')));
      const open = p => {
        const ov = h('div', { class: 'overlay', onclick: e => { if (e.target === ov) ov.remove(); } }, h('div', { class: 'ov-in' },
          h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', { class: 'lb' }, p.name), h('button', { type: 'button', class: 'x-s', 'aria-label': L({ de: 'Schließen', en: 'Close' }), onclick: () => ov.remove() }, '×')),
          h('img', { src: p.image, alt: '' }), store.isMine(p.id) && h('div', { class: 'row' }, btn(t('clear'), () => { store.remove(d.n, p.id).catch(() => {}); ov.remove(); }, 'line'))));
        (el.closest('#card') || document.body).append(ov); onCleanup(() => ov.remove());
      };
      live(d.n, posts => {
        const pics = posts.filter(p => p.kind === 'image' && p.image);
        count.textContent = pics.length ? L({ de: `${pics.length} ${pics.length === 1 ? 'Baum' : 'Bäume'}`, en: `${pics.length} ${pics.length === 1 ? 'tree' : 'trees'}` }) : '';
        forest.replaceChildren(...(pics.length ? pics.map((p, i) => h('button', { type: 'button', class: 'frame', style: `--r:${(i * 37 % 7) - 3}deg`, onclick: () => open(p) }, h('img', { src: p.image, alt: '', loading: 'lazy' }), h('span', {}, p.name)))
          : [h('p', { class: 'empty' }, L({ de: 'Noch kein Baum. Pflanz den ersten.', en: 'No tree yet. Plant the first.' }))]));
      });
    },

    // ---------- Elf Yourself: Office Management ----------
    elfom(el, d, o, head) {
      // The dance video plays; a face photo sits on each elf's head, following a head track measured once per frame.
      const video = h('video', { src: ASSET('elf/dance.mp4'), playsinline: true, loop: true, preload: 'auto' });
      const cv = h('canvas', { class: 'faces' }), g = cv.getContext('2d');
      const play = h('button', { type: 'button', class: 'play' }, h('span', { html: burst() }), L({ de: 'Abspielen, mit Ton', en: 'Play, with sound' }));
      const box = h('div', { class: 'screen' }, video, cv, play);
      stage(head, 'dark tall', box);
      const people = d.people.map(p => ({ name: p.name, src: ASSET('elf/' + p.file + '.jpg') }));
      const img = src => { const im = new Image(); im.src = src; return im; };
      const faces = [img(people[0].src), img(people[1].src)], chosen = [0, 1];
      let track = null, raf = 0, own = [];
      fetch(ASSET('elf/dance.json')).then(r => r.json()).then(t => { track = t; draw(); }).catch(() => {});
      const fit = () => { const r = box.getBoundingClientRect(), k = devicePixelRatio || 1; cv.width = r.width * k; cv.height = r.height * k; };
      // Face: an oval cut-out of the photo, a bit larger than the elf's own face so it covers it.
      const draw = () => {
        if (!track) return;
        const f = Math.min(track.faces[0].length - 1, Math.floor(video.currentTime * track.fps));
        g.clearRect(0, 0, cv.width, cv.height);
        track.faces.forEach((tr, i) => {
          const b = tr[f], im = faces[i];
          if (!b || !im.complete || !im.naturalWidth) return;
          const w = b[2] * cv.width * 1.22, hh = w * 1.16, x = b[0] * cv.width, y = b[1] * cv.height + w * .04;
          g.save(); g.beginPath(); g.ellipse(x, y, w / 2, hh / 2, 0, 0, Math.PI * 2); g.clip();
          const s = Math.max(w / im.naturalWidth, hh / im.naturalHeight);
          g.drawImage(im, x - im.naturalWidth * s / 2, y - im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s);
          g.restore();
        });
      };
      const loop = () => { draw(); raf = requestAnimationFrame(loop); };
      video.addEventListener('loadeddata', () => { fit(); draw(); });
      const ro = new ResizeObserver(() => { fit(); draw(); }); ro.observe(box);
      play.addEventListener('click', () => {
        video.muted = false; video.play().then(() => { box.classList.add('on'); if (o.hush) o.hush(true); }).catch(() => {});
        cancelAnimationFrame(raf); loop();
      });
      box.addEventListener('click', e => { if (e.target === play || play.contains(e.target)) return; if (video.paused) play.click(); else { video.pause(); box.classList.remove('on'); if (o.hush) o.hush(false); } });
      onCleanup(() => { cancelAnimationFrame(raf); video.pause(); ro.disconnect(); own.forEach(u => u && URL.revokeObjectURL(u)); if (o.hush) o.hush(false); });
      // Who dances: per elf, one of Office Management or your own photo (stays in the browser).
      const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
      let target = 0;
      const rows = h('div', { class: 'cast-pick' });
      const pick = (i, k) => { chosen[i] = k; faces[i] = img(people[k].src); faces[i].onload = draw; drawRows(); };
      const drawRows = () => rows.replaceChildren(...[0, 1].map(i => h('div', { class: 'pickrow' }, h('span', { class: 'lb' }, i ? L({ de: 'Elf rechts', en: 'Right elf' }) : L({ de: 'Elf links', en: 'Left elf' })),
        h('div', { class: 'chips' }, people.map((p, k) => h('button', { type: 'button', class: chosen[i] === k ? 'on' : '', onclick: () => pick(i, k) }, p.name)),
          h('button', { type: 'button', class: chosen[i] === 'own' ? 'on' : '', onclick: () => { target = i; file.click(); } }, L({ de: 'Eigenes Foto', en: 'Your photo' }))))));
      file.addEventListener('change', () => {
        const f = file.files[0]; if (!f) return;
        if (own[target]) URL.revokeObjectURL(own[target]);
        own[target] = URL.createObjectURL(f); faces[target] = img(own[target]); faces[target].onload = draw; chosen[target] = 'own'; file.value = ''; drawRows();
      });
      drawRows();
      el.append(rows, file, h('p', { class: 'small', style: 'opacity:.6' }, L({ de: 'Am besten ein Foto von vorn, Gesicht in der Mitte. Es bleibt in deinem Browser, nichts wird hochgeladen.', en: 'Best with a photo from the front, face in the middle. It stays in your browser, nothing is uploaded.' })));
    },
  };
}

// ---------- drawings ----------
// Bites for the chocolate Nikolaus, in eating order: hat first, then down to the boots, until nothing is left.
const BITES = [[62, 4], [86, 12], [40, 8], [70, 24], [44, 26], [18, 22], [88, 34], [64, 42], [38, 44], [12, 42], [86, 54], [60, 60], [34, 62], [10, 62], [84, 74], [58, 78], [32, 80], [8, 82], [70, 94], [42, 96], [16, 96], [88, 92]];
// Things a picture needs to move after it is placed.
export const ART_RUN = {
  // Every bite lands a little after the last; once he is gone, he comes back whole.
  nikolaus(stage) {
    const T = 12000, bites = stage.querySelectorAll('.bite'), crumbs = stage.querySelectorAll('.crumb'), n = bites.length;
    // The last crumbs of chocolate vanish with the last bite.
    stage.querySelector('.niko img').animate([{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.72 }, { opacity: 0, offset: 0.76 }, { opacity: 0, offset: 0.9 }, { opacity: 1, offset: 0.95 }, { opacity: 1, offset: 1 }], { duration: T, iterations: Infinity });
    bites.forEach((b, i) => {
      const at = 0.04 + i * 0.68 / n;
      b.animate([{ scale: 0, offset: 0 }, { scale: 0, offset: at }, { scale: 1, offset: Math.min(at + 0.025, 0.86) }, { scale: 1, offset: 0.88 }, { scale: 0, offset: 0.95 }, { scale: 0, offset: 1 }], { duration: T, iterations: Infinity, easing: 'ease-out' });
      crumbs[i].animate([{ opacity: 0, transform: 'none', offset: 0 }, { opacity: 0, transform: 'none', offset: at }, { opacity: 1, transform: 'none', offset: at + 0.01 }, { opacity: 0, transform: `translate(${(i % 2 ? 1 : -1) * (10 + i % 5 * 6)}px,110px) rotate(160deg)`, offset: Math.min(at + 0.12, 0.99) }, { opacity: 0, offset: 1 }], { duration: T, iterations: Infinity });
    });
  },
};
// Pictures for the left column of simple doors (set with art: in content.js).
export const ART = {
  // A chocolate Nikolaus: someone takes bites out of his hat and hand, sweets float around.
  nikolaus: `<div class="niko"><img src="${ASSET('xmas/santa.svg')}" alt="">${BITES.map(([x, y]) => `<i class="bite" style="left:${x}%;top:${y}%"></i><i class="crumb" style="left:${x}%;top:${y + 4}%"></i>`).join('')}</div>
    ${[[8, 18, '#fff', -20, 0], [80, 12, '#000', 25, 1.2], [14, 70, '#F3E6E0', 10, 2.1], [84, 64, '#fff', -35, .6], [70, 86, '#000', 15, 1.7], [24, 88, '#fff', 40, 2.6]].map(([x, y, c, r, dl]) =>
      `<svg class="bonbon" style="left:${x}%;top:${y}%;--r:${r}deg;animation-delay:-${dl}s" viewBox="0 0 60 30" aria-hidden="true"><polygon points="0,4 14,15 0,26" fill="${c}"/><polygon points="60,4 46,15 60,26" fill="${c}"/><ellipse cx="30" cy="15" rx="17" ry="13" fill="${c}"/></svg>`).join('')}`,
  // Pretzel for breakfast (Noun Project, Taufik Ramadhan).
  pretzel: `<svg class="pretzel" viewBox="0 3 100 92" aria-hidden="true"><path d="m89.387 21.523c-5.5078-5.5078-12.816-8.5391-20.582-8.5391-5.7109 0-11.164 1.6523-15.879 4.7539 0.10547 0.10156 0.21484 0.19922 0.32031 0.30469l6.9961 6.9766c0.6875 0.69141 1.2852 1.4336 1.8203 2.207 6.1914-2.8164 13.434-1.543 18.297 3.3203 3.0898 3.0898 4.7891 7.1914 4.7891 11.555 0 4.3633-1.6992 8.4648-4.7891 11.555l-6.2578 6.2461 9.0312 9.0391 6.2578-6.2578c5.5-5.5 8.5312-12.812 8.5312-20.59 0-7.7734-3.0273-15.082-8.5273-20.574zm-21.941-1.5117c0 0.57422-0.46484 1.043-1.043 1.043-0.57422 0-1.043-0.46484-1.043-1.043v-1.9102c0-0.57422 0.46484-1.043 1.043-1.043 0.57422 0 1.043 0.46484 1.043 1.043zm13.598 1.9023-1.3438 1.3594c-0.20312 0.20703-0.47266 0.30859-0.74219 0.30859-0.26562 0-0.52734-0.10156-0.73047-0.30078-0.41016-0.40234-0.41406-1.0625-0.007812-1.4727l1.3438-1.3594c0.40625-0.41016 1.0625-0.41406 1.4727-0.007813 0.41016 0.40234 0.41406 1.0625 0.007813 1.4727zm6.4648 9.1875 1.3594-1.3594c0.40625-0.40625 1.0664-0.40625 1.4727 0s0.40625 1.0664 0 1.4727l-1.3594 1.3594c-0.20312 0.20312-0.46875 0.30469-0.73828 0.30469-0.26563 0-0.53516-0.10156-0.73828-0.30469-0.40625-0.40625-0.40625-1.0664 0-1.4727zm-1.4336 28.273c-0.20312 0.20312-0.46875 0.30469-0.73828 0.30469-0.26563 0-0.53516-0.10156-0.73828-0.30469-0.40625-0.40625-0.40625-1.0664 0-1.4727 5.1758-5.1758 8.1914-12.051 8.4922-19.363 0.023437-0.57422 0.49609-1.0312 1.082-0.99609 0.57422 0.023437 1.0234 0.50781 0.99609 1.082-0.32031 7.8359-3.5547 15.203-9.1016 20.75z"/><path d="m37.133 67.66c0.007813-0.007812 0.015626-0.007812 0.019532-0.011718l10.367-10.359-7.7656-7.7656c-0.43359-0.43359-0.82422-0.88672-1.1992-1.3555l-10.438 10.445c-0.007813 0.007813-0.007813 0.015625-0.015626 0.019531-0.007812 0.007813-0.015624 0.007813-0.019531 0.011719l-10.449 10.461c-0.011718 0.011719-0.015624 0.03125-0.027343 0.042969-0.011719 0.011718-0.023438 0.011718-0.035157 0.023437-1.1875 1.1992-1.8398 2.7852-1.8398 4.4766 0 1.707 0.66406 3.3125 1.8711 4.5117 1.207 1.2109 2.8086 1.8789 4.5156 1.8789 1.7109 0 3.3125-0.66406 4.5117-1.8711l0.003906-0.003907 10.488-10.48c0.007812-0.007813 0.007812-0.015625 0.011718-0.019532zm-8.1523 1.082-1.3594 1.3398c-0.20312 0.19922-0.46875 0.30078-0.73047 0.30078-0.26953 0-0.53906-0.10547-0.74219-0.30859-0.40234-0.41016-0.39844-1.0703 0.007812-1.4727l1.3594-1.3398c0.41016-0.40625 1.0664-0.39844 1.4727 0.007812 0.40234 0.41016 0.39844 1.0703-0.007812 1.4727zm7.168-7.5781c-0.26563 0-0.52734-0.10156-0.73047-0.30078l-1.3594-1.3398c-0.41016-0.40234-0.41406-1.0625-0.007813-1.4727 0.40625-0.41016 1.0625-0.41406 1.4727-0.007812l1.3594 1.3398c0.41016 0.40234 0.41406 1.0625 0.007813 1.4727-0.20312 0.20703-0.47266 0.30859-0.74219 0.30859z"/><path d="m25.891 57.891-6.2539-6.2539c-3.082-3.082-4.7812-7.1836-4.7812-11.547 0-4.3633 1.6992-8.4609 4.7812-11.547 3.0898-3.0898 7.1914-4.7891 11.555-4.7891 4.0547 0 7.875 1.4883 10.879 4.1758 0.023438 0.019531 0.054688 0.023437 0.074219 0.046874 0.19922 0.18359 0.39844 0.36719 0.60156 0.56641l16.73 16.734c4.6523-5.4258 4.418-13.641-0.71094-18.781l-6.9922-6.9766c-5.5039-5.5039-12.812-8.5312-20.59-8.5312s-15.082 3.0273-20.574 8.5312c-5.4961 5.4961-8.5234 12.805-8.5234 20.582 0 7.7773 3.0273 15.086 8.5234 20.582l6.25 6.25 9.0352-9.0391zm24.895-28.742 1.3438-1.3594c0.40625-0.41016 1.0625-0.41406 1.4727-0.007812 0.41016 0.40234 0.41406 1.0625 0.007813 1.4727l-1.3438 1.3594c-0.20312 0.20703-0.47266 0.30859-0.74219 0.30859-0.26563 0-0.52734-0.10156-0.73047-0.30078-0.41016-0.40234-0.41406-1.0625-0.007813-1.4727zm-8.0039-8.0078 1.3438-1.3594c0.40234-0.41016 1.0625-0.41406 1.4727-0.007812 0.41016 0.40234 0.41406 1.0625 0.007813 1.4727l-1.3438 1.3594c-0.20312 0.20703-0.47266 0.30859-0.74219 0.30859-0.26562 0-0.52734-0.10156-0.73047-0.30078-0.41016-0.40234-0.41406-1.0625-0.007812-1.4727zm-10.125-4.9961c0-0.57422 0.46484-1.043 1.043-1.043 0.57422 0 1.043 0.46484 1.043 1.043v1.9102c0 0.57422-0.46484 1.043-1.043 1.043-0.57422 0-1.043-0.46484-1.043-1.043zm-13.57 2.3359c0.41016-0.40625 1.0703-0.39844 1.4727 0.007812l1.3438 1.3594c0.40234 0.41016 0.39844 1.0703-0.007813 1.4727-0.20312 0.19922-0.46875 0.30078-0.73047 0.30078-0.26953 0-0.53906-0.10547-0.74219-0.30859l-1.3438-1.3594c-0.40234-0.41016-0.39844-1.0703 0.007813-1.4727zm-9.3008 9.3008c0.41016-0.40625 1.0703-0.39844 1.4727 0.007812l1.3438 1.3594c0.40234 0.41016 0.39844 1.0703-0.007812 1.4727-0.20312 0.19922-0.46875 0.30078-0.73047 0.30078-0.26953 0-0.53906-0.10547-0.74219-0.30859l-1.3438-1.3594c-0.40234-0.41016-0.39844-1.0703 0.007812-1.4727zm0.14844 15.113h-1.9102c-0.57422 0-1.043-0.46484-1.043-1.043 0-0.57422 0.46484-1.043 1.043-1.043h1.9102c0.57422 0 1.043 0.46484 1.043 1.043 0 0.57422-0.46484 1.043-1.043 1.043zm3.9102 10.133-1.3594 1.3594c-0.20312 0.20312-0.46875 0.30469-0.73828 0.30469-0.26562 0-0.53516-0.10156-0.73828-0.30469-0.40625-0.40625-0.40625-1.0664 0-1.4727l1.3594-1.3594c0.40625-0.40625 1.0664-0.40625 1.4727 0s0.40625 1.0664 0 1.4727z"/><path d="m41.254 30.02c-0.26172-0.25391-0.51562-0.48828-0.76562-0.70312-4.0195 4.7148-4.3438 11.539-1 16.598 0.019531 0.023438 0.050781 0.039063 0.066407 0.0625 0.50391 0.74609 1.0703 1.4375 1.6875 2.0586l8.4961 8.5117c0.011719 0.011719 0.019531 0.03125 0.03125 0.042969l23.594 23.594c1.2031 1.2109 2.8047 1.875 4.5117 1.875s3.3125-0.66406 4.5117-1.8711l0.003906-0.003906c1.2109-1.2109 1.8789-2.8242 1.875-4.5352-0.003906-1.6953-0.66797-3.2852-1.8711-4.4727zm7.6836 15.344-1.3438 1.3594c-0.20312 0.20703-0.47266 0.30859-0.74219 0.30859-0.26562 0-0.52734-0.10156-0.73047-0.30078-0.41016-0.40234-0.41406-1.0625-0.007813-1.4727l1.3438-1.3594c0.40234-0.41016 1.0625-0.41406 1.4727-0.007813 0.41016 0.40234 0.41406 1.0625 0.007812 1.4727zm8.0078 9.3477c-0.20312 0.20703-0.47266 0.30859-0.74219 0.30859-0.26562 0-0.52734-0.10156-0.73047-0.30078l-1.3594-1.3398c-0.41016-0.40234-0.41406-1.0625-0.007812-1.4727s1.0625-0.41406 1.4727-0.007812l1.3594 1.3398c0.41016 0.40234 0.41406 1.0625 0.007812 1.4727zm7.9961 6.6719-1.3594 1.3398c-0.20312 0.19922-0.46875 0.30078-0.73047 0.30078-0.26953 0-0.53906-0.10547-0.74219-0.30859-0.40234-0.41016-0.39844-1.0703 0.007813-1.4727l1.3594-1.3398c0.41016-0.40625 1.0664-0.39844 1.4727 0.007812 0.40234 0.41016 0.39844 1.0703-0.007813 1.4727zm7.9883 9.3516c-0.20313 0.19922-0.46875 0.30078-0.73047 0.30078-0.26953 0-0.53906-0.10547-0.74219-0.30859l-1.3438-1.3594c-0.40234-0.41016-0.39844-1.0703 0.007813-1.4727 0.41016-0.40625 1.0703-0.39844 1.4727 0.007813l1.3438 1.3594c0.40234 0.41016 0.39844 1.0703-0.007812 1.4727z"/><path d="m51.004 76.23c-4.1836 0-8.3672-1.5898-11.551-4.7773l-1.582-1.582-9.0312 9.0234 1.5859 1.5859c5.4922 5.5 12.801 8.5312 20.574 8.5312 7.5703 0 14.695-2.8789 20.141-8.1055l-9.0469-9.0469c-3.1133 2.9023-7.0977 4.3711-11.09 4.3711zm-13.406 1.1094-1.3438 1.3594c-0.20312 0.20703-0.47266 0.30859-0.74219 0.30859-0.26562 0-0.52734-0.10156-0.73047-0.30078-0.41016-0.40234-0.41406-1.0625-0.007812-1.4727l1.3438-1.3594c0.40625-0.41016 1.0625-0.41406 1.4727-0.007812 0.41016 0.40234 0.41406 1.0625 0.007812 1.4727zm13.441 5.7578c0 0.57422-0.46484 1.043-1.043 1.043-0.57422 0-1.043-0.46484-1.043-1.043v-1.9102c0-0.57422 0.46484-1.043 1.043-1.043 0.57422 0 1.043 0.46484 1.043 1.043zm12.836-6.543 1.3438 1.3594c0.40234 0.41016 0.39844 1.0703-0.007812 1.4727-0.20313 0.19922-0.46875 0.30078-0.73047 0.30078-0.26953 0-0.53906-0.10547-0.74219-0.30859l-1.3438-1.3594c-0.40234-0.41016-0.39844-1.0703 0.007813-1.4727 0.41016-0.40625 1.0703-0.39844 1.4727 0.007813z"/></svg>`,
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

// DIY: a paper chain of "Open". Every second figure pair is mirrored, as an accordion fold makes it;
// the outer hands meet at the folds. It hangs on a string and sways a little.
const CHAIN = () => {
  const o = ILLU.open, n = 7, gap = 0;
  const units = Array.from({ length: n }, (_, i) => {
    const x = i * (o.w + gap), mir = i % 2 ? ` translate(${o.w} 0) scale(-1 1)` : '';
    return `<g class="cu" style="animation-delay:-${(i * .37).toFixed(2)}s"><g transform="translate(${x} 0)${mir}">${o.b}</g></g>`;
  }).join('');
  const joints = Array.from({ length: n + 1 }, (_, i) => i * (o.w + gap));
  return `<svg viewBox="${o.w * .55} -120 ${o.w * 2.3} ${o.h + 240}" aria-hidden="true"><g class="sway">
    <g fill="#fff">${units.replace(/currentColor/g, '#fff')}</g>
    ${joints.map(x => `<polygon transform="translate(${x} 100) scale(2.2)" fill="#000" points="${BURST}"/>`).join('')}</g></svg>`;
};

// Fork and knife for the table (Noun Project, Styfico).
const FORK = '<svg viewBox="15 4 34 92" aria-hidden="true"><path d="m44.5 5c1.9336 0 3.5 1.5664 3.5 3.5v26c0 3.3164-1.6328 6.4961-4.5391 8.8398-1.5078 1.2148-3.293 2.1523-5.2344 2.7734l0.67188 42.387c0.054687 3.5742-2.8242 6.5-6.3984 6.5s-6.4531-2.9258-6.3984-6.5l0.66797-42.387c-1.9414-0.62109-3.7227-1.5586-5.2305-2.7734-2.9062-2.3438-4.5391-5.5234-4.5391-8.8398v-26c0-1.9336 1.5664-3.5 3.5-3.5s3.5 1.5664 3.5 3.5v21.5h5v-21.5c0-1.9336 1.5664-3.5 3.5-3.5s3.5 1.5664 3.5 3.5v21.5h5v-21.5c0-1.9336 1.5664-3.5 3.5-3.5z"/></svg>';
const KNIFE = '<svg viewBox="60 4 24 92" aria-hidden="true"><path d="m83 63h-0.054688l-0.0625 25.625c-0.007812 3.5234-2.8672 6.375-6.3906 6.375-3.5703 0-6.4453-2.9219-6.3906-6.4922l0.47656-30.574c-5.7852-5.2227-9.5781-13.992-9.5781-23.934 0-16.016 9.8516-29 22-29z"/></svg>';

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
