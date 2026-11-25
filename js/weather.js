// Location, weather, clock and the sky that reacts to them.
const OFFICES = { Stuttgart: [48.78, 9.18], Berlin: [52.52, 13.41], Hamburg: [53.55, 9.99], Basel: [47.56, 7.59] };
const qs = new URLSearchParams(location.search);
const STAR = '20,0 8.3,3.4 14.1,14.1 3.4,8.3 0,20 -3.4,8.3 -14.1,14.1 -8.3,3.4 -20,0 -8.3,-3.4 -14.1,-14.1 -3.4,-8.3 0,-20 3.4,-8.3 14.1,-14.1 8.3,-3.4';
const CLOUD = '<rect x="10" y="46" width="180" height="40" rx="20"/><circle cx="62" cy="46" r="28"/><circle cx="112" cy="36" r="34"/><circle cx="152" cy="52" r="22"/>';

const ICONS = {
  sunny: `<svg viewBox="0 0 24 24"><polygon points="${STAR}" transform="translate(12 12) scale(.58)"/></svg>`,
  moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8.500 8.500 0 1 1 9.500 4a7 7 0 0 0 10.500 10.500z"/></svg>',
  cloudy: '<svg viewBox="0 0 24 24"><path d="M6.500 19a4.500 4.500 0 0 1-.5-8.970A6.500 6.500 0 0 1 18.600 11.100 4 4 0 0 1 18 19z"/></svg>',
  rainy: '<svg viewBox="0 0 24 24"><path d="M6.500 15a4.500 4.500 0 0 1-.5-8.970A6.500 6.500 0 0 1 18.600 7.100 4 4 0 0 1 18 15z"/><path d="M8 18l-1.500 4M12.500 18l-1.500 4M17 18l-1.500 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  snowy: '<svg viewBox="0 0 24 24"><path d="M12 3v18M4.200 7.500l15.600 9M19.800 7.500l-15.600 9" stroke="currentColor" stroke-width="2.400" stroke-linecap="round" fill="none"/></svg>',
};
// Optional snowflake drawing (an SVG with one path). Without it, snow falls as small stars.
let flake = null; const sprites = {};
export function setFlake(svgText) {
  const vb = svgText.match(/viewBox="([^"]+)"/), d = svgText.match(/ d="([^"]+)"/);
  if (vb && d) flake = { vb: vb[1].split(' ').map(Number), path: new Path2D(d[1]) };
}
function sprite(col) {
  if (!sprites[col]) {
    const c = document.createElement('canvas'), S = 72, x = c.getContext('2d'), [vx, vy, vw, vh] = flake.vb, m = Math.max(vw, vh), k = S / m;
    c.width = c.height = S; x.scale(k, k); x.translate(-vx + (m - vw) / 2, -vy + (m - vh) / 2); x.fillStyle = col; x.fill(flake.path);
    sprites[col] = c;
  }
  return sprites[col];
}

const opt = { soft: false };
export const tune = o => Object.assign(opt, o);

export const getLoc = () => JSON.parse(localStorage.sp_loc || 'null');
export const isOffice = city => city in OFFICES;
const setLoc = l => { localStorage.sp_loc = JSON.stringify(l); return l; };
const get = async url => { const r = await fetch(url); if (!r.ok) throw new Error(r.status); return r.json(); };

export function useOffice(city) { const [lat, lon] = OFFICES[city]; return setLoc({ lat, lon, city }); }

export async function searchCity(name, lang) {
  const j = await get(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=${lang}&name=${encodeURIComponent(name)}`);
  const r = j.results && j.results[0];
  if (!r) return null;
  return setLoc({ lat: +r.latitude.toFixed(2), lon: +r.longitude.toFixed(2), city: r.name });
}

export function geolocate(lang, fallbackName) {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(async p => {
      // Two decimals is about one kilometre: enough for weather, not an address.
      const lat = +p.coords.latitude.toFixed(2), lon = +p.coords.longitude.toFixed(2);
      let city = '';
      try {
        const j = await get(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${lang}`);
        city = j.city || j.locality || '';
      } catch (e) {}
      if (!city) city = Object.keys(OFFICES).find(k => Math.hypot(OFFICES[k][0] - lat, (OFFICES[k][1] - lon) * 0.65) < 0.3) || fallbackName;
      res(setLoc({ lat, lon, city, geo: true }));   // geo: the browser shared the location
    }, rej, { timeout: 10000, maximumAge: 600000 });
  });
}

// Open-Meteo codes: 0 clear, 1 mainly clear, 2 partly cloudy, 3 overcast, 45/48 fog, 51+ drizzle/rain, 71+ snow.
// Sun with a few clouds counts as sunny; overcast only when the sky is really covered.
// Models often call a sky with thin high cloud or haze "overcast" while the sun is out, so the measured
// direct sunlight decides too: real sunshine on the ground counts as sunny.
const kindOf = (c, cover = 100, sun = 0) => [71, 73, 75, 77, 85, 86].includes(c) ? 'snowy' : c >= 51 ? 'rainy' : (c <= 2 || cover < 60 || sun >= 90) ? 'sunny' : 'cloudy';

export async function refresh() {
  const l = getLoc();
  // Without a location (not allowed, or no city chosen) it simply snows.
  let kind = l ? 'cloudy' : 'snowy', night = new Date().getHours() >= 17 || new Date().getHours() < 8, wind = 10;
  if (l) try {
    const j = await get(`https://api.open-meteo.com/v1/forecast?latitude=${l.lat}&longitude=${l.lon}&current=weather_code,is_day,wind_speed_10m,cloud_cover,direct_radiation`);
    kind = kindOf(j.current.weather_code, j.current.cloud_cover, j.current.is_day ? j.current.direct_radiation : 0);
    if (qs.has('wxdebug')) console.log('weather', l.city, j.current, '→', kind); night = !j.current.is_day; wind = j.current.wind_speed_10m;
    try { localStorage.sp_wx = JSON.stringify({ kind, t: Date.now() }); } catch (e) {}
  } catch (e) {
    // weather service not reachable: the last known sky (up to 3 hours old) instead of guessing clouds
    try { const o = JSON.parse(localStorage.sp_wx || 'null'); if (o && Date.now() - o.t < 3 * 36e5) kind = o.kind; } catch (x) {}
  }
  if (qs.get('weather')) kind = qs.get('weather');
  if (qs.has('night')) night = qs.get('night') !== '0';
  document.body.dataset.weather = kind;
  const icon = document.getElementById('wicon');
  if (icon) icon.innerHTML = ICONS[night && kind === 'sunny' ? 'moon' : kind] || '';
  if (night) document.body.dataset.night = ''; else delete document.body.dataset.night;
  document.documentElement.style.setProperty('--wind', Math.max(25, 140 - wind * 3) + 's');
  document.querySelector('meta[name=theme-color]').content = getComputedStyle(document.body).getPropertyValue('--bg').trim();
}

export function initSky(getLang) {
  const sky = document.getElementById('sky');
  sky.innerHTML = `<div class="sun"><svg viewBox="-34 -34 68 68"><polygon points="${STAR}" fill="none" stroke="#000" stroke-width=".4" transform="scale(1.5)"/></svg></div>` +
    [[8, 30, 0], [22, 44, -40], [38, 24, -75], [14, 36, -20], [50, 28, -100]].map(([t, w, dl], i) =>
      `<svg class="cloud" viewBox="0 0 200 90" style="--t:${t}vh;--w:${w}vw;--d:calc(var(--wind,90s) * ${1 + i * 0.25});--dl:${dl}s"><g class="o">${CLOUD}</g><g class="f">${CLOUD}</g></svg>`).join('');

  const clock = document.getElementById('clock'), place = document.getElementById('place');
  const tick = () => {
    clock.textContent = new Date().toLocaleTimeString(getLang() === 'de' ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
    const l = getLoc(); place.textContent = l ? l.city : (getLang() === 'de' ? 'Nordpol' : 'North Pole');
  };
  tick(); setInterval(tick, 5000);
  setInterval(refresh, 15 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); refresh(); } });

  // Rain and snow.
  const cv = document.getElementById('fx'), g = cv.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion:reduce)').matches;
  let w, h, dpr, parts = [], lean = 0.25, kind = '';
  const size = () => { dpr = Math.min(2, devicePixelRatio || 1); w = innerWidth; h = innerHeight; cv.width = w * dpr; cv.height = h * dpr; };
  size(); addEventListener('resize', size);
  addEventListener('pointermove', e => { lean = (e.clientX / w - 0.5) * 0.9; });
  addEventListener('deviceorientation', e => { if (e.gamma != null) lean = Math.max(-0.6, Math.min(0.6, e.gamma / 50)); });
  const star = new Path2D('M' + STAR.split(' ').join('L') + 'Z');
  const seed = () => {
    kind = document.body.dataset.weather;
    const n = kind === 'rainy' ? Math.min(160, w * h / 9000) * (opt.soft ? 0.5 : 1) : kind === 'snowy' ? Math.min(90, w * h / 16000) : 0;
    parts = Array.from({ length: still ? n / 3 : n }, () => ({ x: Math.random() * w, y: Math.random() * h, v: 0.5 + Math.random(), s: 0.12 + Math.random() * 0.22, a: Math.random() * 6 }));
  };
  let last = performance.now();
  const loop = now => {
    const dt = Math.min(50, now - last) / 16.7; last = now;
    if (document.body.dataset.weather !== kind) seed();
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    if (parts.length) {
      const night = 'night' in document.body.dataset;
      const col = night ? '#fff' : kind === 'snowy' ? '#B78CFF' : '#000';
      const softRain = opt.soft && kind === 'rainy', len = softRain ? 15 : 22, fall = softRain ? 9 : 14;
      g.strokeStyle = g.fillStyle = col; g.lineWidth = softRain ? 1.2 : 2; g.lineCap = 'round'; g.globalAlpha = softRain ? 0.32 : 1;
      for (const p of parts) {
        if (kind === 'rainy') {
          if (!still) { p.y += fall * p.v * dt; p.x -= lean * fall * p.v * dt; }
          g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + lean * len, p.y - len); g.stroke();
        } else {
          if (!still) { p.y += 1.4 * p.v * dt; p.a += 0.02 * dt; p.x += (Math.sin(p.a) * 0.6 - lean * 1.5) * dt; }
          g.save(); g.translate(p.x, p.y); g.rotate(p.a);
          if (flake) { const z = 12 + p.s * 70; g.drawImage(sprite(col), -z / 2, -z / 2, z, z); } else { g.scale(p.s, p.s); g.fill(star); }
          g.restore();
        }
        if (p.y > h + 30) { p.y = -30; p.x = Math.random() * w; }
        if (p.x < -30) p.x = w + 30; else if (p.x > w + 30) p.x = -30;
      }
      g.globalAlpha = 1;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
