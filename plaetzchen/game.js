// Plätzchen-Simulator: pick a cookie, drag toppings onto it, pick an angle, take a photo for the wall.
// 3D with three.js, physics with Rapier. Models come from Blender (tools/cookie_assets.py), in metres;
// here everything is in centimetres.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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
  hint: ['Belag nach oben aufs Plätzchen ziehen. Einzelne Stücke lassen sich verschieben.', 'Drag a topping up onto the cookie. You can move single pieces too.'], loading: ['Ofen heizt vor …', 'Preheating the oven …'],
  v_top: ['Von oben', 'From above'], v_angle: ['Schräg', 'Angled'], v_flat: ['Flach', 'Low'], v_corner: ['Ecke', 'Corner'],
  done: ['Fertig', 'Done'], shoot: ['Foto', 'Photo'], more: ['Weiter verzieren', 'Keep decorating'], pick: ['Welches Plätzchen?', 'Which cookie?'],
  yours: ['Dein Plätzchen', 'Your cookie'], post: ['An die Pinnwand', 'Pin it to the wall'], name: ['Dein Vorname', 'Your first name'],
  posted: ['Hängt an der Pinnwand', 'It’s on the wall'], no: ['Plätzchen Nr.', 'Cookie no.'], count: [n => `${n} Plätzchen bisher`, n => `${n} cookies so far`],
  empty: ['Noch keine Plätzchen. Deins wäre das erste.', 'No cookies yet. Yours could be the first.'], err: ['Hat nicht geklappt. Nochmal?', 'That didn’t work. Try again?'],
  classic: ['Klassisch', 'Classic'], draw: ['Guss mit dem Finger zeichnen. Nochmal antippen zum Beenden.', 'Draw icing with your finger. Tap it again to stop.'], glaze: ['Welche Glasur?', 'Which glaze?'], none: ['Ohne', 'None'], lila: ['Lila', 'Lilac'], weiss: ['Weiß', 'White'], rosa: ['Rosa', 'Pink'], schoko: ['Schoko', 'Chocolate'], schwarz: ['Schwarz', 'Black'], weird: ['Schräg', 'Weird'], sending: ['Wird aufgehängt …', 'Pinning …'],
};
const t = (k, ...a) => { const v = TXT[k][EN ? 1 : 0]; return typeof v === 'function' ? v(...a) : v; };
document.documentElement.lang = EN ? 'en' : 'de';

document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
// Inside the calendar card: the back arrow closes the bakery instead of leaving the page.
if (new URLSearchParams(location.search).has('embed') && parent !== window) {
  document.body.classList.add('embed');
  document.querySelector('.brand').addEventListener('click', e => { e.preventDefault(); parent.postMessage('pz-close', location.origin); });
  document.querySelector('.brand .l').textContent = EN ? '← Back' : '← Zurück';
}

// ---------- renderer, light, table ----------
const canvas = $('#c'), stageEl = $('#stage'), frame = $('#frame');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.AgXToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;
const sun = new THREE.DirectionalLight(0xfff2e2, 2.6); sun.position.set(-28, 60, 24); sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 10, far: 140 });
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
scene.add(sun, new THREE.HemisphereLight(0xfff8f0, 0x3a3128, 0.35));

// A wooden chopping board on a kitchen worktop, in front of a softly blurred kitchen wall.
const canvasTex = (w, h, draw, rep = [1, 1]) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(...rep); return tx;
};
const woodTex = canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#C79A62'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 2) {   // long grain with gentle waves
    const k = Math.sin(y * .021) * .5 + Math.sin(y * .0047 + 2) * .5;
    g.fillStyle = `rgba(${k > 0 ? '110,62,24' : '240,205,155'},${Math.abs(k) * .32})`; g.fillRect(0, y, w, 2);
  }
  for (let i = 0; i < 260; i++) { const y = Math.random() * h; g.strokeStyle = `rgba(90,50,18,${.12 + Math.random() * .2})`; g.lineWidth = .6 + Math.random() * 1.6;
    g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * .01 + i) * 4); g.stroke(); }
  for (let i = 0; i < 90; i++) { const x = Math.random() * w, y = Math.random() * h, a = Math.random() * Math.PI, l = 30 + Math.random() * 140;   // knife marks
    g.strokeStyle = `rgba(250,230,200,${.12 + Math.random() * .15})`; g.lineWidth = .8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
}, [1 / 38, 1 / 38]);
const shape = new THREE.Shape(), BW = 19, BH = 13, R = 2.2;   // half sizes in cm, with a handle on the right
shape.moveTo(-BW + R, -BH); shape.lineTo(BW - R, -BH); shape.quadraticCurveTo(BW, -BH, BW, -BH + R); shape.lineTo(BW, -3.2);
shape.lineTo(BW + 5, -2.6); shape.quadraticCurveTo(BW + 9, -2.6, BW + 9, 0); shape.quadraticCurveTo(BW + 9, 2.6, BW + 5, 2.6); shape.lineTo(BW, 3.2);
shape.lineTo(BW, BH - R); shape.quadraticCurveTo(BW, BH, BW - R, BH); shape.lineTo(-BW + R, BH); shape.quadraticCurveTo(-BW, BH, -BW, BH - R);
shape.lineTo(-BW, -BH + R); shape.quadraticCurveTo(-BW, -BH, -BW + R, -BH);
const hole = new THREE.Path(); hole.absarc(BW + 5.6, 0, 1.1, 0, Math.PI * 2, true); shape.holes.push(hole);
const boardGeo = new THREE.ExtrudeGeometry(shape, { depth: 1.8, bevelEnabled: true, bevelThickness: .25, bevelSize: .3, bevelSegments: 4, curveSegments: 24 });
boardGeo.rotateX(-Math.PI / 2); boardGeo.translate(-2, -2.05, 0);   // top face at y = 0
const paper = new THREE.Mesh(boardGeo, new THREE.MeshStandardMaterial({ map: woodTex, roughness: .62 }));   // the surface things land on
paper.castShadow = paper.receiveShadow = true; scene.add(paper);
const tray = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.ShadowMaterial({ opacity: .22 }));   // the worktop is in the panorama; this only catches shadows
tray.rotation.x = -Math.PI / 2; tray.position.y = -2.1; tray.receiveShadow = true; scene.add(tray);
const BGROT = +(new URLSearchParams(location.search).get('bgr') ?? Math.PI);
// The kitchen around: a 360° panorama rendered in Blender (tools/kitchen_pano.py), softly out of focus.
scene.background = new THREE.Color(0xD8CFC2);
new THREE.TextureLoader().load(`${BASE}kitchen.jpg`, tx => { tx.mapping = THREE.EquirectangularReflectionMapping; tx.colorSpace = THREE.SRGBColorSpace; scene.background = tx; scene.backgroundBlurriness = 0.04; scene.backgroundRotation.y = BGROT; });

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
world.lengthUnit = 100;              // we work in centimetres: keeps contact tolerances and sleeping right
world.numSolverIterations = 8;
world.timestep = 1 / 120;
world.createCollider(RAPIER.ColliderDesc.cuboid(300, 1, 300).setTranslation(0, -3.1, 0).setFriction(0.9));   // worktop
world.createCollider(RAPIER.ColliderDesc.cuboid(19.3, 1.05, 13.3).setTranslation(-2, -1.05, 0).setFriction(0.9));   // the board
const live = [];                    // { body, obj, calm }
let drops = [];                     // undo stack: { bodies, objs }
let cookie = null;                  // { obj }

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

// ---------- one height map for everything that does not move ----------
// Cookie, glaze and poured icing are drawn into a grid (1 mm cells). The physics uses it as one heightfield:
// pieces rest on it calmly, unlike on the raw triangle mesh, where small pieces jittered.
const N = 200, C = 0.1, X0 = -(N - 1) * C / 2;            // 20 × 20 cm around the middle
const gx = i => X0 + i * C, cellOf = v => Math.round((v - X0) / C);
const cookieH = new Float32Array(N * N), staticH = new Float32Array(N * N);
let field = null, frost = null, staticTop = 0, cookieR = 0;
const liquids = [];                                       // { mesh, ks, top, frozen, anim }
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
// Highest point of a mesh in every grid cell.
const GRID = { x0: X0, z0: X0, c: C, nx: N, nz: N };
function raster(obj, H, g = GRID) {
  obj.updateMatrixWorld(true);
  obj.traverse(m => {
    if (!m.isMesh || m.isInstancedMesh) return;
    const pos = m.geometry.attributes.position, ix = m.geometry.index, n = ix ? ix.count : pos.count;
    for (let t = 0; t + 2 < n; t += 3) {
      _a.fromBufferAttribute(pos, ix ? ix.getX(t) : t).applyMatrix4(m.matrixWorld);
      _b.fromBufferAttribute(pos, ix ? ix.getX(t + 1) : t + 1).applyMatrix4(m.matrixWorld);
      _c.fromBufferAttribute(pos, ix ? ix.getX(t + 2) : t + 2).applyMatrix4(m.matrixWorld);
      const d = (_b.z - _c.z) * (_a.x - _c.x) + (_c.x - _b.x) * (_a.z - _c.z); if (Math.abs(d) < 1e-9) continue;
      const i0 = Math.max(0, Math.ceil((Math.min(_a.x, _b.x, _c.x) - g.x0) / g.c)), i1 = Math.min(g.nx - 1, Math.floor((Math.max(_a.x, _b.x, _c.x) - g.x0) / g.c));
      const j0 = Math.max(0, Math.ceil((Math.min(_a.z, _b.z, _c.z) - g.z0) / g.c)), j1 = Math.min(g.nz - 1, Math.floor((Math.max(_a.z, _b.z, _c.z) - g.z0) / g.c));
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const x = g.x0 + i * g.c, z = g.z0 + j * g.c;
        const w1 = ((_b.z - _c.z) * (x - _c.x) + (_c.x - _b.x) * (z - _c.z)) / d, w2 = ((_c.z - _a.z) * (x - _c.x) + (_a.x - _c.x) * (z - _c.z)) / d, w3 = 1 - w1 - w2;
        if (w1 < -1e-4 || w2 < -1e-4 || w3 < -1e-4) continue;
        const y = w1 * _a.y + w2 * _b.y + w3 * _c.y, k = i * g.nz + j; if (y > H[k]) H[k] = y;
      }
    }
  });
}
function rebuildStatic() {
  staticH.set(cookieH);
  for (const l of [frost, ...liquids]) if (l && l.ks) for (let n = 0; n < l.ks.length; n++) { const k = l.ks[n]; if (l.top[n] > staticH[k]) staticH[k] = l.top[n]; }
  staticTop = 0; for (let k = 0; k < staticH.length; k++) if (staticH[k] > staticTop) staticTop = staticH[k];
  if (field) world.removeCollider(field, false);
  field = world.createCollider(RAPIER.ColliderDesc.heightfield(N - 1, N - 1, staticH, { x: (N - 1) * C, y: 1, z: (N - 1) * C }).setFriction(1));
  wakeAll();
}

// A thin sheet that lies on a height map: glaze on the cookie, or a poured puddle over everything.
// thick(i, j) > 0 inside; at the rim the sheet tucks under, so edges look rounded.
function sheet(i0, i1, j0, j1, base, mat) {
  const w = i1 - i0 + 1, h = j1 - j0 + 1, pos = new Float32Array(w * h * 3), idx = [];
  for (let a = 0; a < w - 1; a++) for (let b = 0; b < h - 1; b++) {
    const v = a * h + b; idx.push(v, v + 1, v + h, v + 1, v + h + 1, v + h);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
  const mesh = new THREE.Mesh(g, mat); mesh.castShadow = mesh.receiveShadow = true;
  const s = { mesh, i0, j0, w, h, base, full: idx };
  s.shape = thick => {
    const keep = new Uint8Array(w * h);
    for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) {
      const v = a * h + b, k = (i0 + a) * N + (j0 + b), t = thick(i0 + a, j0 + b);
      keep[v] = t > 0; pos[v * 3] = gx(i0 + a); pos[v * 3 + 2] = gx(j0 + b);
      if (t > 0) { pos[v * 3 + 1] = base[k] + t; continue; }
      // the rim folds in just under the neighbouring surface, never down to the paper
      let hi = base[k];
      for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) { const ii = i0 + a + da, jj = j0 + b + db; if (ii >= 0 && jj >= 0 && ii < N && jj < N && thick(ii, jj) > 0) hi = Math.max(hi, base[ii * N + jj]); }
      pos[v * 3 + 1] = hi - 0.04;
    }
    const out = [];
    for (let n = 0; n < s.full.length; n += 3) if (keep[s.full[n]] || keep[s.full[n + 1]] || keep[s.full[n + 2]]) out.push(s.full[n], s.full[n + 1], s.full[n + 2]);
    g.setIndex(out); g.attributes.position.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox();
  };
  return s;
}
const glossy = col => new THREE.MeshPhysicalMaterial({ color: col, roughness: .3, clearcoat: .6, clearcoatRoughness: .3 });

// ---------- the cookie and its glaze ----------
async function setCookie(id) {
  clearAll();
  const m = await loadModel(id), p = m.pieces[0], obj = makeObj(p);
  scene.add(obj); obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj); obj.position.set(-(b.min.x + b.max.x) / 2, -b.min.y + 0.02, -(b.min.z + b.max.z) / 2); obj.updateMatrixWorld(true);
  cookieH.fill(0); raster(obj, cookieH);
  cookie = { obj }; rebuildStatic(); stackTop = staticTop;
  const bb = new THREE.Box3().setFromObject(obj); cookieR = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2;
  goView('angle');
}
const GLAZES = [['none', null], ['lila', '#B78CFF'], ['weiss', '#F4F0E8'], ['rosa', '#F3B4C8'], ['schoko', '#3E2214'], ['schwarz', '#151515']];
// The glaze is built on its own fine grid (0.5 mm), so the rim is smooth and rounded like real icing,
// and its top is levelled instead of following every bump of the dough.
function setGlaze(col) {
  if (frost) { scene.remove(frost.mesh); frost.mesh.geometry.dispose(); frost = null; }
  if (col && cookie) {
    const bb = new THREE.Box3().setFromObject(cookie.obj), FC = 0.05;
    const g = { x0: bb.min.x - 0.3, z0: bb.min.z - 0.3, c: FC, nx: Math.ceil((bb.max.x - bb.min.x + 0.6) / FC) + 1, nz: Math.ceil((bb.max.z - bb.min.z + 0.6) / FC) + 1 };
    const nx = g.nx, nz = g.nz, n = nx * nz, H = new Float32Array(n); raster(cookie.obj, H, g);
    let top = 0; for (const v of H) if (v > top) top = v;
    const ins = new Uint8Array(n), dist = new Float32Array(n);
    for (let k = 0; k < n; k++) { ins[k] = H[k] > top - 0.3 && H[k] > 0.1; dist[k] = ins[k] ? 1e9 : 0; }
    for (let pass = 0; pass < 2; pass++) for (let a = 1; a < nx - 1; a++) for (let b = 1; b < nz - 1; b++) {   // distance to the rim, in cells
      const i = pass ? nx - 1 - a : a, j = pass ? nz - 1 - b : b, k = i * nz + j, s = pass ? 1 : -1;
      dist[k] = Math.min(dist[k], dist[(i + s) * nz + j] + 1, dist[i * nz + j + s] + 1, dist[(i + s) * nz + j + s] + 1.414, dist[(i + s) * nz + j - s] + 1.414);
    }
    // a levelled base: the dough smoothed over ~3 mm
    const blur = (src, r) => { let A = src;
      for (const dir of [0, 1]) { const B = new Float32Array(n);
        for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { let s = 0, c = 0;
          for (let d = -r; d <= r; d++) { const ii = dir ? i : i + d, jj = dir ? j + d : j; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue; const k = ii * nz + jj; if (!ins[k]) continue; s += A[k]; c++; }
          B[i * nz + j] = c ? s / c : A[i * nz + j]; }
        A = B; } return A; };
    const base = blur(blur(H, 6), 6);
    const T = 0.16, E = 0.28, th = new Float32Array(n);
    for (let k = 0; k < n; k++) { const d = dist[k] * FC - 0.03; th[k] = !ins[k] || d <= 0 ? 0 : T * Math.sqrt(1 - (1 - Math.min(1, d / E)) ** 2); }
    const pos = new Float32Array(n * 3), keep = new Uint8Array(n);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const k = i * nz + j; pos[k * 3] = g.x0 + i * FC; pos[k * 3 + 2] = g.z0 + j * FC;
      if (th[k] > 0) { keep[k] = 1; pos[k * 3 + 1] = Math.max(base[k], H[k]) + th[k]; continue; }
      let hi = H[k]; for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) { const ii = i + da, jj = j + db; if (ii >= 0 && jj >= 0 && ii < nx && jj < nz && th[ii * nz + jj] > 0) hi = Math.max(hi, base[ii * nz + jj], H[ii * nz + jj]); }
      pos[k * 3 + 1] = hi - 0.03;
    }
    const idx = [];
    for (let i = 0; i < nx - 1; i++) for (let j = 0; j < nz - 1; j++) {
      const v = i * nz + j, q = [v, v + 1, v + nz, v + nz + 1];
      if (q.some(x => keep[x])) idx.push(v, v + 1, v + nz, v + 1, v + nz + 1, v + nz);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, glossy(col)); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
    // the same surface on the coarse physics grid
    const ks = [], tp = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const fi = Math.round((gx(i) - g.x0) / FC), fj = Math.round((gx(j) - g.z0) / FC);
      if (fi < 0 || fj < 0 || fi >= nx || fj >= nz) continue; const k = fi * nz + fj;
      if (th[k] > 0) { ks.push(i * N + j); tp.push(pos[k * 3 + 1]); }
    }
    frost = { mesh, ks: Int32Array.from(ks), top: Float32Array.from(tp) };
  }
  rebuildStatic();
}
function clearAll() {
  while (drops.length) undo(true);
  if (frost) { scene.remove(frost.mesh); frost = null; }
  if (cookie) { scene.remove(cookie.obj); cookie = null; } cookieR = 0; setPen(null);
  cookieH.fill(0); rebuildStatic(); stackTop = 1; redos.length = 0; hist();
}

// ---------- icing is drawn: a piped line that follows the finger over everything ----------
const ICING = { 'guss-lila': ['#B78CFF', .19], 'guss-weiss': ['#F4F0E8', .19], schoko: ['#3B1F12', .16] };
let stroke = null, pen = null;
function strokeBegin(id) {
  const [col, r] = ICING[id];
  stroke = { id, r, pts: [], gap: false, mesh: new THREE.Mesh(new THREE.BufferGeometry(), glossy(col)) };
  stroke.mesh.castShadow = stroke.mesh.receiveShadow = true; scene.add(stroke.mesh);
}
function strokeAt(x, y) {
  if (!stroke) return;
  const p = surfaceAt(x, y, stroke.mesh); if (!p) return;
  // icing only sticks to the cookie and what is on it; across the paper the line breaks and starts again
  if (p.onPaper) { stroke.gap = true; return; }
  if (stroke.gap && stroke.pts.length) { const id = stroke.id; strokeEnd(); strokeBegin(id); }
  stroke.gap = false;
  p.y += stroke.r * .5;
  const last = stroke.pts[stroke.pts.length - 1];
  if (last && last.distanceTo(p) < stroke.r * .7) return;
  if (stroke.pts.length > 500) return;
  stroke.pts.push(p); shapeStroke();
}
function shapeStroke() {
  const cap = q => new THREE.SphereGeometry(stroke.r, 16, 10).translate(q.x, q.y, q.z);
  const pts = stroke.pts;
  const g = pts.length < 2 ? cap(pts[0]) : mergeGeometries([new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), Math.min(900, pts.length * 4), stroke.r, 12, false), cap(pts[0]), cap(pts[pts.length - 1])]);
  stroke.mesh.geometry.dispose(); stroke.mesh.geometry = g;
}
function strokeEnd() {
  const s = stroke; stroke = null; if (!s) return;
  if (!s.pts.length) { scene.remove(s.mesh); return; }
  // what lies under the icing stays stuck in it
  const frozen = [];
  for (const l of live) {
    if (!l.body.isDynamic()) continue; const b = l.obj.position;
    if (s.pts.some(q => Math.hypot(q.x - b.x, q.z - b.z) < 0.8 && q.y > b.y)) { l.body.setBodyType(RAPIER.RigidBodyType.Fixed, false); frozen.push(l.body); }
  }
  const tmp = staticH.slice(); raster(s.mesh, tmp);
  const ks = [], tp = []; for (let k = 0; k < tmp.length; k++) if (tmp[k] > staticH[k] + 1e-4) { ks.push(k); tp.push(tmp[k]); }
  const layer = { mesh: s.mesh, ks: Int32Array.from(ks), top: Float32Array.from(tp), frozen };
  const pts = s.pts.map(q => q.clone()), sid = s.id;
  liquids.push(layer); drops.push({ bodies: [], objs: [], liquid: layer, again: () => { strokeBegin(sid); stroke.pts = pts.map(q => q.clone()); shapeStroke(); strokeEnd(); } }); afterDrop(); rebuildStatic();
}
// Tapping an icing turns the finger into a piping bag until it is tapped again.
// A piping bag follows the finger while an icing is chosen; its tip is where the line comes out.
const bag = document.createElement('div'); bag.className = 'bag'; bag.hidden = true; stageEl.append(bag);
const BAG = id => `<img src="${BASE}bag-${id}.webp" alt="">`;   // rendered in Blender (tools/piping_bag.py)
function moveBag(x, y) { const r = stageEl.getBoundingClientRect(); bag.style.transform = `translate(${x - r.left - 30}px,${y - r.top - 120}px) rotate(-16deg)`; }
canvas.addEventListener('pointermove', e => { if (pen) { bag.hidden = false; moveBag(e.clientX, e.clientY); } });
canvas.addEventListener('pointerleave', () => { if (pen && !stroke) bag.hidden = true; });
function setPen(id) {
  pen = id; controls.enabled = !pen;
  bag.hidden = !pen; if (pen) { bag.innerHTML = BAG(pen); const r = stageEl.getBoundingClientRect(); moveBag(r.left + r.width / 2, r.top + r.height / 2); }
  canvas.style.cursor = pen ? 'none' : '';
  document.querySelectorAll('.item').forEach(el => el.classList.toggle('on', el.dataset.id === pen));
  const h = $('#hint'); h.textContent = pen ? t('draw') : t('hint'); h.classList.toggle('off', !pen && drops.length > 0);
}
canvas.addEventListener('pointerdown', e => { if (!pen) return; bag.hidden = false; moveBag(e.clientX, e.clientY); canvas.setPointerCapture(e.pointerId); strokeBegin(pen); strokeAt(e.clientX, e.clientY); });
canvas.addEventListener('pointermove', e => { if (pen && stroke) strokeAt(e.clientX, e.clientY); });
canvas.addEventListener('pointerup', () => { if (pen) strokeEnd(); });
canvas.addEventListener('pointercancel', () => { if (pen) strokeEnd(); });

// ---------- dropping toppings ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const BOUNCE = { perlen: .1, linsen: .04, kirschen: .06, kaffee: .03 };
const solids = () => [...(cookie ? [cookie.obj] : []), ...(frost ? [frost.mesh] : []), ...liquids.map(l => l.mesh), ...live.map(l => l.obj), paper];
function surfaceAt(x, y, skip) {   // the first thing under the pointer: topping, icing, cookie or paper
  const r = canvas.getBoundingClientRect(); ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(solids().filter(o => o !== skip), true)[0];
  if (hit) hit.point.onPaper = hit.object === paper;
  return hit ? hit.point : null;
}
function surfaceBelow(x, z) {
  ray.set(new THREE.Vector3(x, 200, z), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObjects(solids(), true)[0];
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
  if (id === 'puder') { drops.push({ bodies: [], objs: [dust(at)], again: () => drop(id, at, yaw) }); afterDrop(); return; }
  const m = await loadModel(id), R = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const bodies = [], objs = [], scatter = m.pieces.length > 1;
  for (const p of pickPieces(m)) {
    const rel = p.at.clone().sub(m.center); rel.applyQuaternion(R);
    if (scatter) rel.x *= .55, rel.z *= .55;
    const pos = at.clone().add(rel).add(new THREE.Vector3(0, 1.1 + (scatter ? Math.random() * .8 : 0), 0)), q = R.clone().multiply(p.q);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation(q)
      .setLinvel((Math.random() - .5) * (scatter ? 2 : 0), -20, (Math.random() - .5) * (scatter ? 2 : 0)).setAngularDamping(scatter ? 1.5 : 3).setLinearDamping(.6).setCcdEnabled(true));
    const sz = p.box.getSize(new THREE.Vector3()), mx = Math.max(sz.x, sz.y, sz.z), mn = Math.min(sz.x, sz.y, sz.z);
    let cd = mn > mx * .85 ? RAPIER.ColliderDesc.ball(mx / 2) : (p.pts.length >= 12 ? RAPIER.ColliderDesc.convexHull(p.pts) : null);
    if (!cd) cd = RAPIER.ColliderDesc.cuboid(Math.max(sz.x / 2, .05), Math.max(sz.y / 2, .05), Math.max(sz.z / 2, .05));
    world.createCollider(cd.setFriction(1.4).setRestitution(BOUNCE[id] ?? .02).setDensity(1), body);
    const obj = makeObj(p); obj.position.copy(pos); obj.quaternion.copy(q); scene.add(obj);
    bodies.push(body); objs.push(obj); live.push({ body, obj, calm: 0, h: sz.y / 2 });
  }
  drops.push({ bodies, objs, again: () => drop(id, at.clone(), yaw) }); afterDrop();
}
// Undo and redo: each step can be played again, so the arrows go both ways.
const redos = []; let replaying = false;
function hist() { $('#undo').disabled = !drops.length; $('#redo').disabled = !redos.length; }
function afterDrop() { if (!replaying) redos.length = 0; hist(); $('#hint').classList.add('off'); }
async function redo() { const d = redos.pop(); if (!d) return; replaying = true; try { await d.again(); } finally { replaying = false; hist(); } }
function wakeAll() { for (const l of live) if (l.body.isDynamic()) l.body.wakeUp(); }
function undo(silent) {
  const d = drops.pop(); if (!d) return;
  d.bodies.forEach(b => world.removeRigidBody(b));
  d.objs.forEach(o => { scene.remove(o); const i = live.findIndex(l => l.obj === o); if (i >= 0) live.splice(i, 1); });
  if (d.liquid) {
    scene.remove(d.liquid.mesh); liquids.splice(liquids.indexOf(d.liquid), 1);
    d.liquid.frozen.forEach(b => { if (live.some(l => l.body === b)) b.setBodyType(RAPIER.RigidBodyType.Dynamic, true); });
  }
  // nothing may hang in the air: everything that was resting gets checked again
  for (const b of parked) if (live.some(l => l.body === b)) b.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
  parked.clear();
  if (d.liquid) rebuildStatic(); else wakeAll();
  if (!silent) { redos.push(d); hist(); }
}
const parked = new Set();             // settled pieces fixed in place to save work on phones
$('#undo').onclick = () => undo(); $('#redo').onclick = () => redo();

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
    if (dy < -8 && Math.abs(dy) > Math.abs(dx) && ICING[drag.id]) { drag.mode = 'pipe'; drag.el.classList.add('held'); setPen(null); controls.enabled = false; }
    else if (dy < -8 && Math.abs(dy) > Math.abs(dx)) { drag.mode = 'drag'; drag.el.classList.add('held'); controls.enabled = false; startGhost(drag.id); }
    else if (Math.abs(dx) > 8) drag.mode = 'scroll';
  }
  if (drag.mode === 'scroll' && drag.type === 'mouse') strip.scrollLeft = drag.sl - dx;
  if (drag.mode === 'drag') moveGhost(e.clientX, e.clientY);
  if (drag.mode === 'pipe') {   // dragged up out of the bar: piping starts once the finger is over the stage
    const r = stageEl.getBoundingClientRect();
    if (e.clientY < r.bottom - 4) { if (!stroke) { strokeBegin(drag.id); bag.innerHTML = BAG(drag.id); } bag.hidden = false; moveBag(e.clientX, e.clientY); strokeAt(e.clientX, e.clientY); }
  }
});
addEventListener('pointerup', e => {
  if (!drag) return;
  const d = drag; drag = null; d.el.classList.remove('held'); controls.enabled = !pen;
  if (d.mode === 'pipe') { strokeEnd(); if (!pen) bag.hidden = true; return; }
  if (!d.mode && ICING[d.id]) { setPen(pen === d.id ? null : d.id); return; }
  if (!d.mode && pen) setPen(null);
  if (d.mode === 'drag') { const at = ghost && ghost.visible && ghost.at; endGhost(); if (at) drop(d.id, at.clone(), ghost?.yaw); }
  else if (!d.mode) { const c = surfaceBelow((Math.random() - .5) * 2, (Math.random() - .5) * 2); drop(d.id, c); }
});
addEventListener('pointercancel', () => { if (drag) { if (drag.mode === 'pipe') strokeEnd(); drag.el.classList.remove('held'); drag = null; endGhost(); controls.enabled = !pen; } });
const cookieMissing = () => !cookie;

// While dragging, the topping hangs above the spot where it will land, with a small shadow on that spot.
async function startGhost(id) {
  const token = {}; ghost = { token, group: null, at: null, yaw: Math.random() * Math.PI * 2, visible: false };
  if (id === 'puder') { marker.scale.setScalar(2.4); return; }
  marker.scale.setScalar(1);
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

// ---------- picking up a single piece and putting it somewhere else ----------
let carry = null;
const owner = o => live.find(l => { for (let x = o; x; x = x.parent) if (x === l.obj) return true; return false; });
stageEl.addEventListener('pointerdown', e => {
  if (pen || !cookie || e.target !== canvas || document.body.classList.contains('shooting')) return;
  const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(live.map(l => l.obj), true)[0], l = hit && owner(hit.object);
  if (!l || liquids.some(L => L.frozen.includes(l.body))) return;      // stuck in icing: stays put
  e.stopPropagation();                                                 // the camera does not turn
  canvas.setPointerCapture(e.pointerId); parked.delete(l.body);
  l.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
  carry = { l }; controls.enabled = false; canvas.style.cursor = 'grabbing'; $('#hint').classList.add('off');
}, { capture: true });
canvas.addEventListener('pointermove', e => {
  if (!carry) {   // on a computer, show that pieces can be picked up
    if (e.pointerType === 'mouse' && !pen && cookie) { const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); canvas.style.cursor = ray.intersectObjects(live.map(l => l.obj), true).length ? 'grab' : ''; }
    return;
  }
  const p = surfaceAt(e.clientX, e.clientY, carry.l.obj); if (!p) return;
  carry.l.body.setNextKinematicTranslation({ x: p.x, y: p.y + carry.l.h + 0.7, z: p.z });
});
const letGo = () => {
  if (!carry) return; const b = carry.l.body; carry = null;
  b.setBodyType(RAPIER.RigidBodyType.Dynamic, true); b.setLinvel({ x: 0, y: -10, z: 0 }, true); b.setAngvel({ x: 0, y: 0, z: 0 }, true);
  controls.enabled = !pen; canvas.style.cursor = ''; wakeAll();
};
canvas.addEventListener('pointerup', letGo); canvas.addEventListener('pointercancel', letGo);

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
    if (parent !== window) parent.postMessage('pz-posted', location.origin);
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
// The selection (the other models stay in the folder, unused).
const PICKED = ['semikolon', 'stern', 'baum', 'herz', 'mond', 'mann', 'stern-schoko', 'guss-lila', 'guss-weiss', 'streusel', 'perlen', 'linsen', 'mandeln', 'kirschen',
  'puder', 'hagel', 'schoko', 'goldsterne', 'gummibaer', 'popcorn', 'brezel', 'kaffee', 'riesenstreusel'];
const items = (await (await fetch(`${BASE}models/items.json`)).json()).filter(i => PICKED.includes(i.id));
const name = it => EN ? it.en : it.de;
const thumb = id => `${BASE}thumbs/${id}.webp`;
for (const it of items.filter(i => i.group === 'form')) {
  const b = document.createElement('button'); b.type = 'button';
  b.innerHTML = `<img src="${thumb(it.id)}" alt="">`; b.append(name(it));
  b.onclick = async () => { $('#shapes').hidden = true; await setCookie(it.id); $('#glazes').hidden = false; };
  $('#shapeList').append(b);
}
for (const [key, col] of GLAZES) {
  const b = document.createElement('button'); b.type = 'button';
  b.innerHTML = `<span class="sw" style="${col ? `background:${col}` : ''}"></span>`; b.append(t(key));
  b.onclick = () => { $('#glazes').hidden = true; setGlaze(col); };
  $('#glazeList').append(b);
}
// Icing first (the three you pipe), then the classics, then the odd ones; a thin line between the groups.
const ORDER = ['guss-lila', 'guss-weiss', 'schoko'];
for (const grp of ['klassisch', 'schraeg']) {
  if (grp !== 'klassisch') { const sep = document.createElement('span'); sep.className = 'sep line'; strip.append(sep); }
  const list = items.filter(i => i.group === grp).sort((a, b) => (ORDER.indexOf(a.id) + 1 || 99) - (ORDER.indexOf(b.id) + 1 || 99));
  for (const it of list) {
    const d = document.createElement('div'); d.className = 'item'; d.dataset.id = it.id;
    d.innerHTML = `<span class="disc"><img src="${thumb(it.id)}" alt="" draggable="false"></span>`; d.append(name(it));
    strip.append(d);
  }
}

// ---------- loop ----------
let last = performance.now(), acc = 0, frameNo = 0;
function loop(now) {
  acc += Math.min(0.1, (now - last) / 1000); last = now;
  let n = 0; while (acc >= 1 / 120 && n++ < 6) { world.step(); acc -= 1 / 120; }
  if (n > 6) acc = 0;
  let top = staticTop;
  for (const l of live) {
    const p = l.body.translation(), q = l.body.rotation();
    l.obj.position.set(p.x, p.y, p.z); l.obj.quaternion.set(q.x, q.y, q.z, q.w);
    if (p.y > top && p.y < 80) top = p.y;
    // A piece that barely moves for half a second is put to sleep, so nothing keeps trembling.
    if (l.body.isDynamic() && !l.body.isSleeping()) {
      const v = l.body.linvel(), w = l.body.angvel();
      // While something is still moving above the cookie, it is nudged towards the middle: piles grow up, not out.
      const d = Math.hypot(p.x, p.z);
      if (cookieR && p.y > 0.35 && d > 0.4 && d < cookieR + 1.5 && Math.hypot(v.x, v.y, v.z) > 0.6) {
        const J = l.body.mass() * 160 / 60 * Math.min(1.5, d / cookieR); l.body.applyImpulse({ x: -p.x / d * J, y: 0, z: -p.z / d * J }, true);
      }
      l.calm = (Math.hypot(v.x, v.y, v.z) < 2.5 && Math.hypot(w.x, w.y, w.z) < 1.2) ? l.calm + 1 : 0;
      if (l.calm > 24) { l.body.sleep(); l.calm = 0; }
    }
  }
  stackTop = Math.max(cookie ? 1 : 0, top);
  // Lots of pieces: settled ones stop moving for good, so the phone keeps up (undo frees them again).
  if (++frameNo % 90 === 0 && live.length > 300) for (const l of live) if (l.body.isSleeping() && l.body.isDynamic()) { l.body.setBodyType(RAPIER.RigidBodyType.Fixed, false); parked.add(l.body); }
  runTween(now); controls.update(); renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
resize(); goView('angle', true);
requestAnimationFrame(loop);
$('#loading').classList.add('off');
$('#shapes').hidden = false;
