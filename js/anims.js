// Weekend and opening animations. Every one starts as a Strichpunkt (dot over comma)
// and turns into something Christmassy. Shapes morph with SMIL (works on iPhones too),
// the rest moves with CSS from doors.css. Drawn on black, in white with lilac accents.
export const C0 = 'M200 250C222 250 240 268 240 290C240 342 220 378 178 400C175 395 171 391 168 386C194 368 204 350 204 330C182 330 160 312 160 290C160 268 178 250 200 250Z';
export const BURST = '20,0 8.3,3.4 14.1,14.1 3.4,8.3 0,20 -3.4,8.3 -14.1,14.1 -8.3,3.4 -20,0 -8.3,-3.4 -14.1,-14.1 -3.4,-8.3 0,-20 3.4,-8.3 14.1,-14.1 8.3,-3.4';
const BELL = 'M118 398C146 380 146 330 146 296C146 246 172 220 200 220C228 220 254 246 254 296C254 330 254 380 282 398C230 412 170 412 118 398Z';
const sm = (attr, vals, kt, dur) => `<animate attributeName="${attr}" dur="${dur}s" repeatCount="indefinite" values="${vals.join(';')}" keyTimes="${kt.join(';')}" calcMode="spline" keySplines="${Array(kt.length - 1).fill('.6 0 .3 1').join(';')}"/>`;
const svg = (label, body) => `<svg class="an" viewBox="0 0 400 460" role="img" aria-label="${label}">${body}</svg>`;

// A parcel: lilac box, black ribbon and bow.
const PARCEL = (x, y, w, hh) => `<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="#B78CFF"/><rect x="${x + w / 2 - 3}" y="${y}" width="6" height="${hh}" fill="#000"/><rect x="${x}" y="${y + hh / 2 - 3}" width="${w}" height="6" fill="#000"/><path d="M${x + w / 2} ${y} l-11 -9 l0 9z M${x + w / 2} ${y} l11 -9 l0 9z" fill="#000"/>`;
// Parcels fall in one after the other while the snowman stands (x, y, width, height, start %).
const PARCELS = [[284, 316, 56, 44, 38], [290, 272, 44, 40, 44], [48, 326, 50, 34, 50], [340, 330, 34, 30, 56], [96, 334, 30, 26, 61], [298, 236, 32, 32, 66]];

// Snowman: the comma loses its tail and becomes the body, the dot the head; a hat drops in. Then parcels arrive.
const snowman = L => svg(L({ de: 'Ein Strichpunkt wird zum Schneemann', en: 'A semicolon turns into a snowman' }), `
  <g id="a-snow" class="A" fill="#fff">
    <circle cx="60" cy="40" r="5"/><circle cx="120" cy="10" r="4"/><circle cx="330" cy="30" r="6"/><circle cx="290" cy="90" r="4"/>
    <circle cx="40" cy="150" r="4"/><circle cx="360" cy="170" r="5"/><circle cx="90" cy="230" r="6"/><circle cx="320" cy="250" r="4"/>
    <circle cx="30" cy="300" r="5"/><circle cx="370" cy="320" r="4"/><circle cx="150" cy="60" r="3"/><circle cx="250" cy="0" r="4"/>
  </g>
  <g id="a-wob" class="A">
    <g id="a-arms" class="A" stroke="#fff" stroke-width="7" stroke-linecap="round" fill="none">
      <path d="M140 270 L70 230 M95 244 L80 214"/><path d="M260 270 L330 230 M305 244 L322 214"/>
    </g>
    <g id="a-body" class="A">
      <circle cx="200" cy="290" r="40" fill="#fff"/>
      <path id="a-tail" class="A" d="M240 290 C240 342 220 378 178 400 L168 386 C194 368 204 350 204 329.8 A40 40 0 0 0 240 290 Z" fill="#fff"/>
    </g>
    <g id="a-btns" class="A" fill="#000"><circle cx="200" cy="262" r="7"/><circle cx="200" cy="292" r="7"/><circle cx="200" cy="322" r="7"/></g>
    <g id="a-head" class="A"><circle cx="200" cy="150" r="40" fill="#fff"/></g>
    <g id="a-face" class="A"><circle cx="186" cy="176" r="5" fill="#000"/><circle cx="214" cy="176" r="5" fill="#000"/><polygon points="200,186 238,194 200,198" fill="#B78CFF"/></g>
    <g id="a-hat" class="A"><rect x="160" y="124" width="80" height="12" fill="#B78CFF"/><rect x="172" y="76" width="56" height="50" fill="#B78CFF"/><rect x="172" y="112" width="56" height="8" fill="#000"/></g>
  </g>
  ${PARCELS.map(([x, y, w, hh, at], i) => `<style>@keyframes pk${i}{0%,${at}%{transform:translateY(-520px);opacity:1}${at + 4}%{transform:translateY(6px)}${at + 6}%,80%{transform:none;opacity:1}86%,100%{transform:translateY(40px);opacity:0}}</style><g style="animation:pk${i} 9s infinite cubic-bezier(.5,0,.7,1)">${PARCEL(x, y, w, hh)}</g>`).join('')}`);

// Bauble: the semicolon turns over, the comma becomes the hook, the dot the bauble.
// The string hangs from the tip of the comma's tail, which ends up at (210, 140).
const ball = L => svg(L({ de: 'Ein Strichpunkt wird zur Christbaumkugel', en: 'A semicolon turns into a bauble' }), `
  <defs><clipPath id="b-clip"><circle cx="200" cy="300" r="100"/></clipPath></defs>
  <g id="b-swing">
    <rect id="b-str" x="208.5" y="-30" width="3" height="172" fill="#CFCFCF"/>
    <g id="b-dot"><circle cx="200" cy="150" r="40" fill="#fff"/></g>
    <g clip-path="url(#b-clip)"><g id="b-band"><rect x="90" y="270" width="220" height="38" fill="#B78CFF"/><rect x="90" y="318" width="220" height="8" fill="#B78CFF"/></g></g>
    <g id="b-comma"><path d="${C0}" fill="#fff"/></g>
  </g>
  ${[[40, -14, 0], [334, 12, .25], [86, 20, .5], [300, -18, .75], [26, 8, 1], [356, -8, 1.2], [130, 16, 1.4]].map(([x, r, dl], i) =>
    `<g class="letter" style="--r:${r}deg;animation-delay:${dl}s"><g transform="translate(${x} 0) rotate(${r})"><rect x="-22" y="-15" width="44" height="30" fill="#fff"/><path d="M-22 -15 L0 3 L22 -15" fill="none" stroke="#000" stroke-width="3"/>${i === 3 ? '<rect x="8" y="-11" width="9" height="11" fill="#B78CFF"/>' : ''}</g></g>`).join('')}`);

// Advent candles: the dot stretches into the candle, the comma upside down is the flame.
// Small dots fall as snow the whole time.
const candles = n => L => svg(L({ de: `${n}. Advent: Strichpunkte werden Kerzen`, en: `Advent Sunday ${n}: semicolons turn into candles` }), `
  ${[[30, 3, 0, 7], [70, 4, 3.1, 9], [118, 2.5, 1.4, 6], [150, 3.5, 5.2, 8], [188, 2, 2.2, 6.5], [226, 4, 6.3, 9.5], [262, 3, .7, 7.5], [300, 2.5, 4.4, 6], [338, 4, 2.9, 8.5], [372, 3, 5.8, 7], [92, 2, 7.1, 5.5], [246, 2, 3.7, 6.8], [352, 2.5, 1.1, 6.2], [12, 2.5, 4.9, 7.8]]
    .map(([x, r, d, t]) => `<circle class="snow" cx="${x}" cy="0" r="${r}" fill="#fff" style="animation-delay:-${d}s;animation-duration:${t}s"/>`).join('')}
  <text x="200" y="74" text-anchor="middle" font-family="Strichpunkt Sans,Archivo,sans-serif" font-weight="900" font-stretch="150%" font-size="34" fill="#fff" class="cd-w">${n}. ADVENT</text>
  <rect class="cd-w" x="36" y="410" width="328" height="12" fill="#B78CFF"/>
  ${[80, 160, 240, 320].map((cx, i) => {
    const lit = i < n, kt = [0, .12, .3, .8, .94, 1], a = 32 + i * 7;
    return `<style>@keyframes cd-f${n}${i}{0%,${a}%{fill:#fff}${a + 3}%,78%{fill:${lit ? '#B78CFF' : '#fff'}}84%,100%{fill:#fff}}</style>
    <rect fill="#fff">${sm('x', [cx - 22, cx - 22, cx - 24, cx - 24, cx - 22, cx - 22], kt, 9)}${sm('y', [201, 201, 250, 250, 201, 201], kt, 9)}${sm('width', [44, 44, 48, 48, 44, 44], kt, 9)}${sm('height', [44, 44, 160, 160, 44, 44], kt, 9)}${sm('rx', [22, 22, 4, 4, 22, 22], kt, 9)}</rect>
    <g transform="translate(${cx - 110} 140.5) scale(.55)"><g class="cd-c${lit ? '' : ' off'}"><g class="${lit ? 'cd-fl' : ''}" style="animation-delay:-${i * .17}s"><path d="${C0}" style="animation:cd-f${n}${i} 9s infinite"/></g></g></g>`;
  }).join('')}`);

// Snowflake: the dot moves to the middle, the comma copies itself six times around it, small flakes fall.
const flake = L => svg(L({ de: 'Ein Strichpunkt wird zur Schneeflocke', en: 'A semicolon turns into a snowflake' }), `
  <g id="sf-spin">
    ${[0, 60, 120, 180, 240, 300].map(a => `<g class="sf" style="--a:${a}deg"><path d="${C0}" fill="#fff"/></g>`).join('')}
    <g id="sf-dot"><circle cx="200" cy="150" r="40" fill="#fff"/></g>
  </g>
  <defs><g id="sf-mini">${[0, 60, 120, 180, 240, 300].map(a => `<path d="${C0}" transform="translate(200 230) rotate(${a}) translate(0 50) rotate(-15) scale(.6) translate(0 -60) translate(-200 -230)"/>`).join('')}<circle cx="200" cy="230" r="24"/></g></defs>
  <g class="sf-fall" fill="#fff">${[[40, .14, 0, 7], [110, .1, 2.5, 6], [330, .16, 1.2, 8], [270, .09, 4, 5.5], [70, .11, 5.5, 7.5], [360, .1, 3.4, 6.5], [160, .08, 6.2, 5], [300, .13, .6, 9]].map(([x, sc, d, t]) =>
    `<g class="sf-f" style="animation-delay:-${d}s;animation-duration:${t}s"><use href="#sf-mini" transform="translate(${x} 0) scale(${sc}) translate(-200 -230)"/></g>`).join('')}</g>
  <g class="bells">${[[78, 96, -20, 0], [318, 352, 24, 1.3], [334, 110, 12, 2.4]].map(([x, y, r, dl]) =>
    `<g class="bell" style="--r:${r}deg;animation-delay:-${dl}s"><g transform="translate(${x} ${y}) scale(.26) translate(-200 -310)"><path d="${BELL}" fill="#fff"/><circle cx="200" cy="414" r="18" fill="#B78CFF"/><circle cx="200" cy="204" r="13" fill="none" stroke="#fff" stroke-width="8"/></g></g>`).join('')}</g>`);

// Reindeer: the dot grows into the head, the comma turns over into an antler and gets a twin, a red nose lights up.
const deer = L => svg(L({ de: 'Ein Strichpunkt wird zum Rentier', en: 'A semicolon turns into a reindeer' }), `
  <g id="r-al"><path d="${C0}" fill="#fff"/></g>
  <g id="r-ar"><path d="${C0}" fill="#fff"/></g>
  <g id="r-head"><circle cx="200" cy="150" r="40" fill="#fff"/></g>
  <circle class="r-f" cx="176" cy="288" r="8" fill="#000"/><circle class="r-f" cx="224" cy="288" r="8" fill="#000"/>
  <circle id="r-nose" cx="200" cy="330" r="17" fill="#E2231A"/>`);

export const ANIMS = { snowman, ball, flake, deer, adv2: candles(2), adv3: candles(3), adv4: candles(4) };
