// Sounds and background music. Off until someone switches them on.
// Everything is generated in the browser. To use real recordings instead, put the files in
// assets/sound/ and name them in assets/sound/sounds.json (open, santa, locked, close, finale, music).
// An entry is a file name, or { file, from, for } to play only a part of it (seconds).
const DIR = new URL('../../assets/sound/', import.meta.url);
let hushed = false, ctx, out, music = null, loopCfg = null, loopBuf = null, loopSrc = null, manifest = {}, gen = 0, timer = 0, playing = false, lastSanta = 0;
const st = { on: localStorage.sp_sound !== '0' }; // on unless someone switched it off

function ac() {
  if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); out = ctx.createGain(); out.connect(ctx.destination); }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
// A small bell: a note with two quiet overtones and a long tail.
function bell(f, at, dur, vol, to) {
  const c = ac(), g = c.createGain(), s = c.currentTime + at;
  g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(vol, s + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
  g.connect(to || out);
  [[1, 1], [2, 0.3], [3, 0.1]].forEach(([m, v]) => {
    const o = c.createOscillator(), og = c.createGain();
    o.frequency.value = f * m; og.gain.value = v; o.connect(og).connect(g); o.start(s); o.stop(s + dur + 0.05);
  });
}
function tone(f0, f1, at, dur, vol) {
  const c = ac(), o = c.createOscillator(), g = c.createGain(), s = c.currentTime + at;
  o.frequency.setValueAtTime(f0, s); o.frequency.exponentialRampToValueAtTime(f1, s + dur);
  g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(vol, s + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
  o.connect(g).connect(out); o.start(s); o.stop(s + dur + 0.05);
}
// A short woody knock, for shutters.
function knock(at, vol = 0.16) {
  const c = ac(), len = Math.floor(c.sampleRate * 0.08), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 1.2; g.gain.value = vol;
  n.buffer = b; n.connect(f).connect(g).connect(out); n.start(c.currentTime + at);
}
const SOUNDS = {
  // Shutters, then a bright run of bells upward and a sparkle on top.
  open() { knock(0); knock(0.1); [784, 988, 1175, 1568, 1976].forEach((f, i) => bell(f, 0.16 + i * 0.075, 1.1, 0.09)); bell(3136, 0.6, 0.9, 0.035); bell(2637, 0.7, 0.9, 0.03); },
  locked() { tone(150, 110, 0, 0.16, 0.16); knock(0, 0.1); },
  close() { bell(988, 0, 0.35, 0.05); bell(784, 0.07, 0.4, 0.05); },
  santa() {},
  finale() {
    [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => bell(f, i * 0.11, 1.8, 0.09));
    [[1047, 1319, 1568], [1175, 1397, 1760], [1319, 1568, 2093]].forEach((ch, i) => ch.forEach(f => bell(f, 0.9 + i * 0.45, 2.2, 0.06)));
  },
};

// ---------- background music: "Stille Nacht" as a music box (the melody is in the public domain) ----------
const HZ = { C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46 };
const TUNE = ('G4 3,A4 1,G4 2,E4 6,G4 3,A4 1,G4 2,E4 6,D5 4,D5 2,B4 6,C5 4,C5 2,G4 6,A4 4,A4 2,C5 3,B4 1,A4 2,G4 3,A4 1,G4 2,E4 6,' +
  'A4 4,A4 2,C5 3,B4 1,A4 2,G4 3,A4 1,G4 2,E4 6,D5 4,D5 2,F5 3,D5 1,B4 2,C5 6,E5 6,C5 2,G4 2,E4 2,G4 3,F4 1,D4 2,C4 12').split(',').map(x => x.split(' '));
const BASS = [130.81, 130.81, 130.81, 130.81, 98, 98, 130.81, 130.81, 87.31, 87.31, 130.81, 130.81, 87.31, 87.31, 130.81, 130.81, 98, 98, 130.81, 130.81, 130.81, 98, 130.81, 130.81];
const BEAT = 0.36;
function round(my, bus) {
  let at = 0.15;
  for (const [n, d] of TUNE) { bell(HZ[n] * 2, at, Math.max(1.2, d * BEAT * 1.5), 0.05, bus); at += d * BEAT; }
  BASS.forEach((f, i) => bell(f, 0.15 + i * 6 * BEAT, 6 * BEAT * 1.1, 0.045, bus));
  timer = setTimeout(() => { if (my === gen && st.on) round(my, bus); }, (at + 1.5) * 1000);
}
function startMusic() {
  if (playing) return;
  playing = true;
  const my = ++gen;
  // Wait for the sound list first; only without a named recording does the generated music box play.
  ready.then(() => { if (my === gen && playing) startTrack(my); });
}
function startTrack(my) {
  if (loopCfg) { startLoop(my); return; }
  if (music) { music.currentTime = 0; music.play().catch(() => { playing = false; }); return; }
  const c = ac(), bus = c.createGain();
  bus.connect(out); startMusic.bus = bus;
  round(my, bus);
}
// A recorded track loops on a bar line: the part between loopFrom and loopTo repeats, and the last
// moment before the seam is blended into the lead-in so the join is not heard as a cut.
async function startLoop(my) {
  try {
    const c = ac();
    if (!loopBuf) loopBuf = await loopReady;
    if (!loopBuf || my !== gen || !playing) return;
    const bus = c.createGain(); bus.gain.value = 0.0001; bus.gain.exponentialRampToValueAtTime(0.32, c.currentTime + 0.6); bus.connect(out);
    loopSrc = c.createBufferSource(); loopSrc.buffer = loopBuf; loopSrc.loop = true; loopSrc.connect(bus); loopSrc.start();
    loopSrc.bus = bus;
  } catch (e) { playing = false; }
}
// Cut the loop out of the decoded track: the part between loopFrom and loopTo, with the seam blended.
function buildLoop(src) {
  const c = ac(), sr = src.sampleRate, a = Math.round(loopCfg.loopFrom * sr), len = Math.round((loopCfg.loopTo - loopCfg.loopFrom) * sr), f = Math.min(Math.round((loopCfg.fade || 0.1) * sr), a);
  const buf = c.createBuffer(src.numberOfChannels, len, sr);
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const sd = src.getChannelData(ch), d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = sd[a + i];
    for (let i = 0; i < f; i++) { const t = (i + 1) / f, jj = len - f + i; d[jj] = sd[a + jj] * Math.cos(t * Math.PI / 2) + sd[a - f + i] * Math.sin(t * Math.PI / 2); }
  }
  return buf;
}
function stopMusic() {
  playing = false; gen++; clearTimeout(timer);
  if (loopSrc) { const s = loopSrc; loopSrc = null; s.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.12); setTimeout(() => { try { s.stop(); } catch (e) {} }, 600); }
  if (music) music.pause();
  if (startMusic.bus) { startMusic.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.08); startMusic.bus = null; }
}
// Real recordings named in sounds.json replace the generated ones.
const entry = e => !e ? null : typeof e === 'string' ? { file: e } : e;
// Everything is fetched and decoded as soon as the page opens, so the first tap plays the real recordings
// at once (decoding works before a tap; only playing needs one).
const decode = file => fetch(new URL(file, DIR)).then(r => r.arrayBuffer()).then(b => ac().decodeAudioData(b));
const NAMES = ['open', 'santa', 'locked', 'close', 'finale', 'right', 'wrong'];
const clips = {};
let loopReady = Promise.resolve(null);
const ready = fetch(new URL('sounds.json', DIR)).then(r => r.json()).then(m => {
  manifest = m;
  const mu = entry(m.music);
  if (mu && mu.loopTo) { loopCfg = mu; loopReady = decode(mu.file).then(buildLoop).catch(() => null); }
  else if (mu) { music = new Audio(new URL(mu.file, DIR)); music.loop = true; music.volume = 0.3; music.preload = 'auto'; }
  for (const k of NAMES) {
    const e = entry(m[k]);
    if (e) clips[k] = decode(e.file).then(buf => ({ buf, from: e.from || 0, len: e.for })).catch(() => null);
  }
}).catch(() => {});

export const sfx = {
  get on() { return st.on; },
  toggle() {
    st.on = !st.on; localStorage.sp_sound = st.on ? '1' : '0';
    if (st.on) { this.play('open'); startMusic(); } else stopMusic();
    return st.on;
  },
  // A video is playing: the music waits until it is closed.
  hush(v) { hushed = v; if (v) stopMusic(); else if (st.on && !playing) startMusic(); },
  play(name) {
    if (!st.on) return;
    try {
      // Santa's laugh is kept rare, however often he shows up.
      if (name === 'santa') { if (performance.now() - lastSanta < 30000) return; lastSanta = performance.now(); }
      const asked = performance.now();
      ready.then(() => {
        // A named recording always wins; if it is still loading it plays as soon as it is ready (but not late).
        if (clips[name]) return clips[name].then(f => {
          if (!f || performance.now() - asked > 1500) return;
          const c = ac(), n = c.createBufferSource(); n.buffer = f.buf; n.connect(out); n.start(0, f.from, f.len || f.buf.duration - f.from);
        });
        if (SOUNDS[name]) SOUNDS[name]();
      }).catch(() => {});
    } catch (e) {}
  },
};
// If sound was left on last time, the music starts with the first tap (browsers require one).
// Some browsers (Safari, iPhone) only accept the end of a tap or a click as permission to play, not its start,
// so every kind of first touch counts: also a tap inside a door card opened straight from a link.
const wake = () => { if (ctx && ctx.state === 'suspended') ctx.resume(); if (st.on && !playing && !hushed) startMusic(); };
for (const ev of ['pointerdown', 'pointerup', 'click', 'keydown', 'touchend']) addEventListener(ev, wake, { passive: true, capture: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) stopMusic(); });
