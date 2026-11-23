// Plätzchen-Simulator: pick a cookie, drag toppings onto it, pick an angle, take a photo for the wall.
// 3D with three.js, physics with Rapier. Models come from Blender (tools/cookie_assets.py), in metres;
// here everything is in centimetres.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import RAPIER from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.14.0/rapier.es.js';
import * as store from '../js/store.js';

// Which door's wall the photos go to. To be decided; change the number here.
const DOOR = 11;
const MARK = 'plaetzchen';          // body text that marks a post as a cookie photo
const BASE = '../assets/plaetzchen/';
const S = 100;                      // metres → cm
const MAX_PIECES = 36;              // pieces per handful (sprinkles, pearls …)
const $ = s => document.querySelector(s);
const ls = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };

// ---------- words ----------
const EN = ls('sp_lang') === 'en';
const TXT = {
  back: ['← Kalender', '← Calendar'], new: ['Neues Plätzchen', 'New cookie'], new_s: ['Neu', 'New'], all_s: ['Alle', 'All'], undo: ['Rückgängig', 'Undo'], all: ['Alle Plätzchen', 'All cookies'],
  hint: ['Belag nach oben auf das Plätzchen ziehen', 'Drag a topping up onto the cookie'], loading: ['Ofen heizt vor …', 'Preheating the oven …'],
  v_top: ['Von oben', 'From above'], v_angle: ['Schräg', 'Angled'], v_flat: ['Flach', 'Low'], v_corner: ['Ecke', 'Corner'],
  done: ['Fertig', 'Done'], shoot: ['Foto', 'Photo'], more: ['Weiter verzieren', 'Keep decorating'], pick: ['Welches Plätzchen?', 'Which cookie?'],
  yours: ['Dein Plätzchen', 'Your cookie'], post: ['An die Pinnwand', 'Pin it to the wall'], name: ['Dein Vorname', 'Your first name'],
  posted: ['Hängt an der Pinnwand', 'It’s on the wall'], no: ['Plätzchen Nr.', 'Cookie no.'], count: [n => `${n} Plätzchen bisher`, n => `${n} cookies so far`],
  empty: ['Noch keine Plätzchen. Deins wäre das erste.', 'No cookies yet. Yours could be the first.'], err: ['Hat nicht geklappt. Nochmal?', 'That didn’t work. Try again?'],
  classic: ['Klassisch', 'Classic'], weird: ['Schräg', 'Weird'], sending: ['Wird aufgehängt …', 'Pinning …'],
};
const t = (k, ...a) => { const v = TXT[k][EN ? 1 : 0]; return typeof v === 'function' ? v(...a) : v; };
document.documentElement.lang = EN ? 'en' : 'de';
document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });

// ---------- renderer, light, table ----------
const canvas = $('#c'), stageEl = $('#stage'), frame = $('#frame');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.AgXToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1c1b1a);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;
const sun = new THREE.DirectionalLight(0xfff2e2, 2.6); sun.position.set(-28, 60, 24); sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 10, far: 140 });
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
scene.add(sun, new THREE.HemisphereLight(0xfff8f0, 0x3a3128, 0.35));

// Baking paper: off-white with fine fibres and soft creases, drawn once into a canvas.
function paperTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d');
  g.fillStyle = '#ECE4D4'; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '120,100,80'},${Math.random() * .05})`; g.fillRect(Math.random() * 1024, Math.random() * 1024, 1 + Math.random() * 3, 1); }
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * 1024, y = Math.random() * 1024, a = Math.random() * Math.PI, l = 200 + Math.random() * 500;
    const grd = g.createLinearGradient(0, -6, 0, 6); grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(.5, 'rgba(255,255,255,.18)'); grd.addColorStop(.52, 'rgba(90,70,50,.08)'); grd.addColorStop(1, 'rgba(90,70,50,0)');
    g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = grd; g.fillRect(-l / 2, -6, l, 12); g.restore();
  }
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; return tx;
}
const paper = new THREE.Mesh(new THREE.PlaneGeometry(90, 66), new THREE.MeshStandardMaterial({ map: paperTexture(), roughness: .78 }));
paper.rotation.x = -Math.PI / 2; paper.receiveShadow = true; scene.add(paper);
const tray = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0x262628, metalness: .7, roughness: .45 }));
tray.rotation.x = -Math.PI / 2; tray.position.y = -0.15; tray.receiveShadow = true; scene.add(tray);

// ---------- camera and the four angles ----------
const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 1500);
const controls = new OrbitControls(camera, canvas);
Object.assign(controls, { enableDamping: true, enablePan: false, minDistance: 10, maxDistance: 90, maxPolarAngle: 1.48 });
controls.target.set(0, 1, 0);
const VIEWS = { top: [0.001, 0, 27], angle: [0.8, 0, 27], flat: [1.33, 0.3, 24], corner: [0.98, 0.85, 26] };
let tween = null, stackTop = 1;
function goView(name, instant) {
  const [phi, theta, dist] = VIEWS[name];
  const h = Math.min(stackTop, 40), to = new THREE.Spherical(dist + h * 1.1, phi, theta), ty = Math.max(1, h * 0.45);
  const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target)), fy = controls.target.y;
  if (from.theta - to.theta > Math.PI) to.theta += 2 * Math.PI; else if (to.theta - from.theta > Math.PI) to.theta -= 2 * Math.PI;
  tween = { from, to, fy, ty, t0: performance.now(), dur: instant ? 0 : 700 };
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === name));
}
function runTween(now) {
  if (!tween) return;
  const k = tween.dur ? Math.min(1, (now - tween.t0) / tween.dur) : 1, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const s = new THREE.Spherical(THREE.MathUtils.lerp(tween.from.radius, tween.to.radius, e), THREE.MathUtils.lerp(tween.from.phi, tween.to.phi, e), THREE.MathUtils.lerp(tween.from.theta, tween.to.theta, e));
  controls.target.y = THREE.MathUtils.lerp(tween.fy, tween.ty, e);
  camera.position.setFromSpherical(s).add(controls.target);
  if (k >= 1) tween = null;
}
controls.addEventListener('start', () => { tween = null; document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', false)); });

function resize() {
  const w = stageEl.clientWidth, h = stageEl.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); placeFrame();
}
new ResizeObserver(resize).observe(stageEl);

// ---------- physics ----------
await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -981, z: 0 });
world.createCollider(RAPIER.ColliderDesc.cuboid(300, 1, 300).setTranslation(0, -1, 0).setFriction(0.9));
const live = [];                    // { body, obj }
let drops = [];                     // undo stack: { bodies, objs }
let cookie = null;                  // { obj, body }

// ---------- models ----------
const loader = new GLTFLoader(), cache = new Map();
const _v = new THREE.Vector3(), _m = new THREE.Matrix4();
function loadModel(id) {
  if (!cache.has(id)) cache.set(id, loader.loadAsync(`${BASE}models/${id}.glb`).then(prep));
  return cache.get(id);
}
// Each top-level node is one piece. Collect its points (for the collision hull) in centimetres.
function prep(gltf) {
  const root = gltf.scene; root.updateMatrixWorld(true);
  const pieces = root.children.map(node => {
    const inv = new THREE.Matrix4().copy(node.matrixWorld).invert(), pts = [], box = new THREE.Box3();
    node.traverse(m => {
      if (!m.isMesh) return;
      m.castShadow = m.receiveShadow = true;
      for (const mt of [].concat(m.material)) if (mt.transmission > 0) { mt.thickness = 0.6; mt.attenuationColor = mt.color.clone(); mt.attenuationDistance = 0.8; }
      _m.multiplyMatrices(inv, m.matrixWorld);
      const pos = m.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 220));
      for (let i = 0; i < pos.count; i += step) { _v.fromBufferAttribute(pos, i).applyMatrix4(_m).multiplyScalar(S); pts.push(_v.x, _v.y, _v.z); box.expandByPoint(_v); }
    });
    return { node, pts: new Float32Array(pts), box, at: node.position.clone().multiplyScalar(S), q: node.quaternion.clone() };
  });
  const c = new THREE.Vector3(); pieces.forEach(p => c.add(p.at)); c.divideScalar(pieces.length);
  c.y = Math.min(...pieces.map(p => p.at.y + p.box.min.y));
  return { pieces, center: c, gltf };
}
function makeObj(p) { const o = p.node.clone(); o.scale.setScalar(S); o.quaternion.copy(p.q); return o; }

// ---------- the cookie ----------
async function setCookie(id) {
  clearAll();
  const m = await loadModel(id), p = m.pieces[0], obj = makeObj(p);
  scene.add(obj); obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj); obj.position.set(-(b.min.x + b.max.x) / 2, -b.min.y + 0.02, -(b.min.z + b.max.z) / 2); obj.updateMatrixWorld(true);
  const verts = [], idx = [];
  obj.traverse(o => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position, base = verts.length / 3;
    for (let i = 0; i < pos.count; i++) { _v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); verts.push(_v.x, _v.y, _v.z); }
    const ix = o.geometry.index; for (let i = 0; i < ix.count; i++) idx.push(base + ix.getX(i));
  });
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(verts), new Uint32Array(idx)).setFriction(0.9), body);
  cookie = { obj, body }; stackTop = new THREE.Box3().setFromObject(obj).max.y;
  goView('angle');
}
function clearAll() {
  while (drops.length) undo(true);
  if (cookie) { scene.remove(cookie.obj); world.removeRigidBody(cookie.body); cookie = null; }
  stackTop = 1; $('#undo').disabled = true;
}

// ---------- dropping toppings ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const BOUNCE = { perlen: .25, linsen: .12, streusel: .08, hagel: .12, rosenkohl: .2, kirschen: .2, goldsterne: .05, kaffee: .1, popcorn: .08 };
function surfaceAt(x, y) {   // the first thing under the pointer: topping, cookie or paper
  const r = canvas.getBoundingClientRect(); ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects([...(cookie ? [cookie.obj] : []), ...live.map(l => l.obj), paper], true)[0];
  return hit ? hit.point : null;
}
function surfaceBelow(x, z) {
  ray.set(new THREE.Vector3(x, 200, z), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObjects([...(cookie ? [cookie.obj] : []), ...live.map(l => l.obj), paper], true)[0];
  return hit ? hit.point : new THREE.Vector3(x, 0, z);
}
function pickPieces(m) {
  if (m.pieces.length <= MAX_PIECES) return m.pieces;
  return [...m.pieces].sort(() => Math.random() - .5).slice(0, MAX_PIECES);
}
// Icing sugar is dust: it settles on whatever is below, no physics.
const dustGeo = new THREE.SphereGeometry(0.07, 6, 4).scale(1, .35, 1), dustMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
function dust(at) {
  const n = 520, inst = new THREE.InstancedMesh(dustGeo, dustMat, n), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < n; i++) {
    const r = Math.abs(gauss()) * 2.4, a = Math.random() * Math.PI * 2, p = surfaceBelow(at.x + Math.cos(a) * r, at.z + Math.sin(a) * r);
    s.setScalar(0.6 + Math.random() * 1.2); _m.compose(p.add(new THREE.Vector3(0, 0.02, 0)), q, s); inst.setMatrixAt(i, _m);
  }
  inst.receiveShadow = true; scene.add(inst); return inst;
}
const gauss = () => Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random());

async function drop(id, at, yaw = Math.random() * Math.PI * 2) {
  if (id === 'puder') { drops.push({ bodies: [], objs: [dust(at)] }); afterDrop(); return; }
  const m = await loadModel(id), R = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const bodies = [], objs = [], scatter = m.pieces.length > 1;
  for (const p of pickPieces(m)) {
    const rel = p.at.clone().sub(m.center); rel.applyQuaternion(R);
    if (scatter) rel.x *= .8, rel.z *= .8;
    const pos = at.clone().add(rel).add(new THREE.Vector3(0, 1.6 + (scatter ? Math.random() * 1.2 : 0), 0)), q = R.clone().multiply(p.q);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation(q)
      .setLinvel((Math.random() - .5) * (scatter ? 6 : 0), -25, (Math.random() - .5) * (scatter ? 6 : 0)).setAngularDamping(scatter ? .8 : 2).setLinearDamping(.3).setCcdEnabled(true));
    let cd = p.pts.length >= 12 ? RAPIER.ColliderDesc.convexHull(p.pts) : null;
    if (!cd) { const s = p.box.getSize(new THREE.Vector3()); cd = RAPIER.ColliderDesc.cuboid(Math.max(s.x / 2, .05), Math.max(s.y / 2, .05), Math.max(s.z / 2, .05)); }
    world.createCollider(cd.setFriction(1.1).setRestitution(BOUNCE[id] ?? .04).setDensity(1), body);
    const obj = makeObj(p); obj.position.copy(pos); obj.quaternion.copy(q); scene.add(obj);
    bodies.push(body); objs.push(obj); live.push({ body, obj });
  }
  drops.push({ bodies, objs }); afterDrop();
}
function afterDrop() { $('#undo').disabled = false; $('#hint').classList.add('off'); }
function undo(silent) {
  const d = drops.pop(); if (!d) return;
  d.bodies.forEach(b => world.removeRigidBody(b));
  d.objs.forEach(o => { scene.remove(o); const i = live.findIndex(l => l.obj === o); if (i >= 0) live.splice(i, 1); });
  if (!silent) $('#undo').disabled = !drops.length;
}
$('#undo').onclick = () => undo();

// ---------- the topping bar: scroll sideways, drag up to drop, tap to drop in the middle ----------
const strip = $('#strip');
let drag = null, ghost = null;
const marker = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .25, depthWrite: false }));
marker.rotation.x = -Math.PI / 2; marker.visible = false; scene.add(marker);

strip.addEventListener('pointerdown', e => {
  const el = e.target.closest('.item'); if (!el || cookieMissing()) return;
  drag = { id: el.dataset.id, el, x0: e.clientX, y0: e.clientY, mode: null, sl: strip.scrollLeft, type: e.pointerType };
  if (e.pointerType === 'mouse') e.preventDefault();
});
addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  if (!drag.mode) {
    if (dy < -8 && Math.abs(dy) > Math.abs(dx)) { drag.mode = 'drag'; drag.el.classList.add('held'); controls.enabled = false; startGhost(drag.id); }
    else if (Math.abs(dx) > 8) drag.mode = 'scroll';
  }
  if (drag.mode === 'scroll' && drag.type === 'mouse') strip.scrollLeft = drag.sl - dx;
  if (drag.mode === 'drag') moveGhost(e.clientX, e.clientY);
});
addEventListener('pointerup', e => {
  if (!drag) return;
  const d = drag; drag = null; d.el.classList.remove('held'); controls.enabled = true;
  if (d.mode === 'drag') { const at = ghost && ghost.visible && ghost.at; endGhost(); if (at) drop(d.id, at.clone(), ghost?.yaw); }
  else if (!d.mode) { const c = surfaceBelow((Math.random() - .5) * 2, (Math.random() - .5) * 2); drop(d.id, c); }
});
addEventListener('pointercancel', () => { if (drag) { drag.el.classList.remove('held'); drag = null; endGhost(); controls.enabled = true; } });
const cookieMissing = () => !cookie;

// While dragging, the topping hangs above the spot where it will land, with a small shadow on that spot.
async function startGhost(id) {
  const token = {}; ghost = { token, group: null, at: null, yaw: Math.random() * Math.PI * 2, visible: false };
  if (id === 'puder') return;
  const m = await loadModel(id); if (!ghost || ghost.token !== token) return;
  const g = new THREE.Group(), R = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ghost.yaw);
  for (const p of pickPieces(m).slice(0, 24)) { const o = makeObj(p); o.position.copy(p.at.clone().sub(m.center).applyQuaternion(R)); o.quaternion.premultiply(R); g.add(o); }
  g.visible = false; scene.add(g); ghost.group = g;
}
function moveGhost(x, y) {
  if (!ghost) return;
  const r = stageEl.getBoundingClientRect(), inside = y < r.bottom - 4 && y > r.top;
  const p = inside ? surfaceAt(x, y) : null;
  ghost.visible = !!p; marker.visible = !!p;
  if (!p) { if (ghost.group) ghost.group.visible = false; return; }
  ghost.at = p; marker.position.set(p.x, p.y + 0.03, p.z);
  if (ghost.group) { ghost.group.visible = true; ghost.group.position.set(p.x, p.y + 1.6, p.z); }
}
function endGhost() { if (ghost?.group) scene.remove(ghost.group); marker.visible = false; ghost = null; }

// ---------- views, photo, wall ----------
document.querySelectorAll('[data-view]').forEach(b => { b.onclick = () => goView(b.dataset.view); });
function placeFrame() {
  const w = stageEl.clientWidth, h = stageEl.clientHeight, s = Math.round(Math.min(w, h) * .88);
  Object.assign(frame.style, { width: s + 'px', height: s + 'px', left: (w - s) / 2 + 'px', top: (h - s) / 2 + 'px' });
}
function photoMode(on) {
  document.body.classList.toggle('shooting', on); frame.hidden = !on;
  $('#done').hidden = on; $('#shoot').hidden = !on; $('#back').hidden = !on; placeFrame();
}
$('#done').onclick = () => photoMode(true);
$('#back').onclick = () => photoMode(false);
let shotBlob = null;
$('#shoot').onclick = () => {
  renderer.render(scene, camera);
  const pr = renderer.getPixelRatio(), f = frame.getBoundingClientRect(), r = canvas.getBoundingClientRect();
  const out = document.createElement('canvas'); out.width = out.height = 1080;
  out.getContext('2d').drawImage(canvas, (f.left - r.left) * pr, (f.top - r.top) * pr, f.width * pr, f.height * pr, 0, 0, 1080, 1080);
  out.toBlob(b => {
    shotBlob = b; $('#shot').src = URL.createObjectURL(b);
    $('#resTitle').textContent = t('yours'); $('#resMeta').textContent = ''; $('#err').hidden = true;
    const nm = $('#name'); nm.hidden = !!ls('sp_name'); nm.placeholder = t('name');
    $('#post').hidden = false; $('#post').disabled = false; $('#post').textContent = t('post'); $('#retake').textContent = t('more');
    $('#result').hidden = false;
  }, 'image/jpeg', 0.9);
};
$('#retake').onclick = () => {
  $('#result').hidden = true; photoMode(false);
  if ($('#post').hidden) $('#shapes').hidden = false;
};
$('#post').onclick = async () => {
  const nm = $('#name');
  if (!ls('sp_name')) { const v = nm.value.trim(); if (!v) { nm.focus(); return; } try { localStorage.setItem('sp_name', v); } catch (e) {} nm.hidden = true; }
  const btn = $('#post'); btn.disabled = true; btn.textContent = t('sending');
  try {
    const id = await store.add(DOOR, { kind: 'image', body: MARK, image: shotBlob });
    const mine = (await cookies()).findIndex(p => p.id === id);
    $('#resTitle').textContent = `${t('no')} ${String(mine + 1).padStart(4, '0')}`;
    $('#resMeta').textContent = t('posted');
    btn.hidden = true; $('#retake').textContent = t('new');
  } catch (e) {
    console.error(e); $('#err').textContent = t('err'); $('#err').hidden = false; btn.disabled = false; btn.textContent = t('post');
  }
};
// All cookie photos, oldest first (so the numbers stay the same).
async function cookies() { return (await store.list(DOOR)).filter(p => p.kind === 'image' && p.body === MARK).reverse(); }
$('#all').onclick = async () => {
  const g = $('#allGrid'); g.textContent = ''; $('#gallery').hidden = false;
  const list = await cookies().catch(() => []);
  $('#allCount').textContent = list.length ? t('count', list.length) : t('empty');
  const fmt = new Intl.DateTimeFormat(EN ? 'en-GB' : 'de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  list.map((p, i) => [p, i]).reverse().forEach(([p, i]) => {
    const f = document.createElement('figure'), img = document.createElement('img'), cap = document.createElement('figcaption'), b = document.createElement('b');
    img.src = p.image; img.alt = ''; img.loading = 'lazy'; b.textContent = `${t('no')} ${String(i + 1).padStart(4, '0')}`;
    cap.append(b, document.createElement('br'), `${p.name} · ${fmt.format(new Date(p.created_at))}`); f.append(img, cap); g.append(f);
  });
};
$('#closeAll').onclick = () => { $('#gallery').hidden = true; };
$('#new').onclick = () => { photoMode(false); $('#shapes').hidden = false; };

// ---------- menus from the model list ----------
const items = await (await fetch(`${BASE}models/items.json`)).json();
const name = it => EN ? it.en : it.de;
const thumb = id => `${BASE}thumbs/${id}.webp`;
for (const it of items.filter(i => i.group === 'form')) {
  const b = document.createElement('button'); b.type = 'button';
  b.innerHTML = `<img src="${thumb(it.id)}" alt="">`; b.append(name(it));
  b.onclick = async () => { $('#shapes').hidden = true; await setCookie(it.id); };
  $('#shapeList').append(b);
}
for (const grp of ['klassisch', 'schraeg']) {
  const sep = document.createElement('span'); sep.className = 'sep'; sep.textContent = t(grp === 'klassisch' ? 'classic' : 'weird'); strip.append(sep);
  for (const it of items.filter(i => i.group === grp)) {
    const d = document.createElement('div'); d.className = 'item'; d.dataset.id = it.id;
    d.innerHTML = `<span class="disc"><img src="${thumb(it.id)}" alt="" draggable="false"></span>`; d.append(name(it));
    strip.append(d);
  }
}

// ---------- loop ----------
let last = performance.now(), acc = 0, frameNo = 0;
function loop(now) {
  acc += Math.min(0.1, (now - last) / 1000); last = now;
  let n = 0; while (acc >= 1 / 60 && n++ < 3) { world.step(); acc -= 1 / 60; }
  let top = cookie ? 1 : 0;
  for (const l of live) {
    const p = l.body.translation(), q = l.body.rotation();
    l.obj.position.set(p.x, p.y, p.z); l.obj.quaternion.set(q.x, q.y, q.z, q.w);
    if (p.y > top && p.y < 80) top = p.y;
  }
  stackTop = Math.max(cookie ? 1 : 0, top);
  // Lots of pieces: settled ones stop moving for good, so the phone keeps up.
  if (++frameNo % 90 === 0 && live.length > 300) for (const l of live) if (l.body.isSleeping() && l.body.isDynamic()) l.body.setBodyType(RAPIER.RigidBodyType.Fixed, false);
  runTween(now); controls.update(); renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
resize(); goView('angle', true);
requestAnimationFrame(loop);
$('#loading').classList.add('off');
$('#shapes').hidden = false;
