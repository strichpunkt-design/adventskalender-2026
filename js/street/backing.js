// Works out, for one illustration, which gaps are drawing detail (to be filled with the dark colour)
// and which are real openings (to stay see-through, like the space under a raised arm).
// It reads the drawing as pixels once, and returns a mask image of only the bits to fill.
const SIZE = 640;        // working resolution, longest side
const SEAL = 0.006;      // lines thinner than about twice this (share of the longest side) count as detail lines
const SMALL = 0.02;      // enclosed gaps below this share of the drawing's filled area are detail; bigger ones stay open

function label(open, w, h) {
  // Groups of connected see-through pixels. Returns [labels, info[]] with area and whether the group touches the edge.
  const lab = new Int32Array(w * h), info = [null], stack = [];
  for (let s = 0; s < w * h; s++) {
    if (!open[s] || lab[s]) continue;
    const id = info.length, it = { area: 0, edge: false };
    info.push(it); lab[s] = id; stack.push(s);
    while (stack.length) {
      const p = stack.pop(), x = p % w, y = (p - x) / w;
      it.area++;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) it.edge = true;
      if (x > 0 && open[p - 1] && !lab[p - 1]) { lab[p - 1] = id; stack.push(p - 1); }
      if (x < w - 1 && open[p + 1] && !lab[p + 1]) { lab[p + 1] = id; stack.push(p + 1); }
      if (y > 0 && open[p - w] && !lab[p - w]) { lab[p - w] = id; stack.push(p - w); }
      if (y < h - 1 && open[p + w] && !lab[p + w]) { lab[p + w] = id; stack.push(p + w); }
    }
  }
  return [lab, info];
}
// Distance (in thirds of a pixel) from every pixel to the nearest pixel where `set` is true.
function distance(set, w, h) {
  const d = new Float32Array(w * h).fill(1e9);
  for (let i = 0; i < w * h; i++) if (set[i]) d[i] = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + 3);
    if (y > 0) { v = Math.min(v, d[i - w] + 3); if (x > 0) v = Math.min(v, d[i - w - 1] + 4); if (x < w - 1) v = Math.min(v, d[i - w + 1] + 4); }
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; let v = d[i];
    if (x < w - 1) v = Math.min(v, d[i + 1] + 3);
    if (y < h - 1) { v = Math.min(v, d[i + w] + 3); if (x < w - 1) v = Math.min(v, d[i + w + 1] + 4); if (x > 0) v = Math.min(v, d[i + w - 1] + 4); }
    d[i] = v;
  }
  return d;
}

// svgText: the drawing. skip: boxes [x, y, w, h] in the drawing's own units where nothing is filled (parts that move).
// small: overrides the size below which an enclosed gap counts as detail (some drawings have large ornaments).
export async function backing(svgText, { skip = [], small = SMALL } = {}) {
  const vb = svgText.match(/viewBox="([^"]+)"/)[1].split(/[ ,]+/).map(Number), pad = 8;
  const k = SIZE / Math.max(vb[2], vb[3]), w = Math.round(vb[2] * k) + pad * 2, h = Math.round(vb[3] * k) + pad * 2;
  const img = new Image(), url = URL.createObjectURL(new Blob([svgText.replace('<svg ', `<svg width="${vb[2]}" height="${vb[3]}" `)], { type: 'image/svg+xml' }));
  await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, pad, pad, w - pad * 2, h - pad * 2); URL.revokeObjectURL(url);
  const px = g.getImageData(0, 0, w, h).data, n = w * h;
  const ink = new Uint8Array(n), open = new Uint8Array(n);
  let inkArea = 0;
  for (let i = 0; i < n; i++) { if (px[i * 4 + 3] > 60) { ink[i] = 1; inkArea++; } else open[i] = 1; }

  // 1. Seal thin lines that run in from the outside: close gaps narrower than twice the seal radius.
  const r = SEAL * SIZE * 3, [lab0, info0] = label(open, w, h);
  const near = distance(ink, w, h), grown = new Uint8Array(n);
  for (let i = 0; i < n; i++) grown[i] = near[i] <= r ? 1 : 0;
  const notGrown = new Uint8Array(n); for (let i = 0; i < n; i++) notGrown[i] = grown[i] ? 0 : 1;
  const back = distance(notGrown, w, h), sealed = new Uint8Array(n);
  for (let i = 0; i < n; i++) sealed[i] = (open[i] && info0[lab0[i]].edge && back[i] > r) ? 1 : 0;
  // Sealing also rounds off inner corners of the outline. Those specks are dropped; only real lines are kept.
  const [labS, infoS] = label(sealed, w, h), speck = (SEAL * SIZE) * (SEAL * SIZE) * 5;
  const solid = new Uint8Array(n);
  for (let i = 0; i < n; i++) solid[i] = (ink[i] || (sealed[i] && infoS[labS[i]].area >= speck)) ? 1 : 0;

  // 2. Whatever is now fully enclosed: small gaps are detail and get filled, large ones stay open.
  const rest = new Uint8Array(n); for (let i = 0; i < n; i++) rest[i] = solid[i] ? 0 : 1;
  const [labR, infoR] = label(rest, w, h), limit = small * inkArea;
  const fill = new Uint8Array(n), holes = [];
  for (const it of infoR) if (it && !it.edge) holes.push(+(it.area / inkArea * 100).toFixed(2));
  for (let i = 0; i < n; i++) {
    if (ink[i]) continue;
    if (solid[i]) fill[i] = 1;
    else { const it = infoR[labR[i]]; if (!it.edge && it.area < limit) fill[i] = 1; }
  }
  // 3. Parts that move keep their own gaps open, so nothing is left behind when they swing.
  for (const b of skip) {
    const x0 = Math.floor((b[0] - vb[0]) * k) + pad - 4, y0 = Math.floor((b[1] - vb[1]) * k) + pad - 4, x1 = Math.ceil((b[0] + b[2] - vb[0]) * k) + pad + 4, y1 = Math.ceil((b[1] + b[3] - vb[1]) * k) + pad + 4;
    for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) fill[y * w + x] = 0;
  }
  // 4. Let the fill run two pixels under the drawing so no hairline shows between them.
  const dFill = distance(fill, w, h), out = g.createImageData(w, h);
  let any = false;
  for (let i = 0; i < n; i++) if (fill[i] || (ink[i] && dFill[i] <= 7)) { out.data[i * 4 + 3] = 255; any = true; }
  g.putImageData(out, 0, 0);
  // The mask covers the drawing plus the working margin; `inset` says how far it overhangs, as a share of the drawing.
  return { url: any ? cv.toDataURL('image/png') : null, insetX: pad / (w - pad * 2), insetY: pad / (h - pad * 2), holes: holes.sort((a, b) => b - a) };
}
