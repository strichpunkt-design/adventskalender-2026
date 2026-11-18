#!/usr/bin/env python3
# Usage: python3 tools/gen_diy.py <repo folder>   (then render PDFs from the SVGs if needed)
# Builds two print sheets from the calendar's own drawings, everything as outlines with one stroke weight:
#   assets/diy/ausmalbild.svg  - A4 landscape colouring page: the Christmas street, brand illustrations and the cast
#   mockups/diy-ideen.svg      - A4 landscape sketch sheet of the six DIY ideas
import json, re, random, math, sys
ROOT = sys.argv[1]
R = random.Random(2026)
SW = 4.2  # stroke weight in sheet units (10 units = 1 mm), the same for every line

# ---------- sources ----------
s = open(f'{ROOT}/js/illu.js').read()
ILLU = json.loads(s[s.index('export const ILLU=') + 18:s.index(';\nexport const illu')])
TAG = re.compile(r'<(path|rect|circle|ellipse|polygon|polyline|line)\b([^>]*?)(/?)>')

def outline(markup):
    """Every shape white with a black outline; former lines stay lines."""
    def fix(m):
        tag, attrs, close = m.groups()
        line = 'stroke=' in attrs and 'stroke="none"' not in attrs
        attrs = re.sub(r'\s(fill|stroke|stroke-width|stroke-linecap|stroke-linejoin|style|id)="[^"]*"', '', attrs)
        return f'<{tag}{attrs} class="{"ln" if line else "sh"}"{close}>'
    markup = re.sub(r'<g\b[^>]*>', '<g>', markup)
    return TAG.sub(fix, markup)

ART = {}
for k, v in ILLU.items():
    ART[k] = (0, 0, v['w'], v['h'], outline(v['b']))
for k in ['ball', 'cane', 'elf', 'flake', 'ginger', 'santa', 'sleigh', 'snowman', 'sock', 'tree']:
    t = open(f'{ROOT}/assets/xmas/{k}.svg').read()
    vb = [float(x) for x in re.search(r'viewBox="([^"]+)"', t).group(1).split()]
    inner = t[t.index('>', t.index('<svg')) + 1:t.rindex('</svg>')]
    ART[k] = (*vb, outline(inner))

def place(k, x, y, h=None, w=None, flip=False, rot=0):
    """Put drawing k with its top-left at (x, y), scaled to height h or width w; the outline keeps the same weight."""
    vx, vy, vw, vh, inner = ART[k]
    sc = h / vh if h else w / vw
    fx = f' translate({vw * sc} 0) scale(-1 1)' if flip else ''
    rt = f' rotate({rot} {vw * sc / 2} {vh * sc / 2})' if rot else ''
    return f'<g transform="translate({x:.1f} {y:.1f}){rt}{fx} scale({sc:.5f}) translate({-vx} {-vy})" style="stroke-width:{SW / sc:.3f}">{inner}</g>', vw * sc, vh * sc

BURST = '20,0 8.3,3.4 14.1,14.1 3.4,8.3 0,20 -3.4,8.3 -14.1,14.1 -8.3,3.4 -20,0 -8.3,-3.4 -14.1,-14.1 -3.4,-8.3 0,-20 3.4,-8.3 14.1,-14.1 8.3,-3.4'
EYE = 'M36 43.8C51.7 43.8 65.3 34.9 72 21.9C65.3 8.9 51.7 0 36 0C20.3 0 6.7 8.9 0 21.9C6.7 34.9 20.3 43.8 36 43.8Z'
CLOUD = '<rect x="10" y="46" width="180" height="40" rx="20"/><circle cx="62" cy="46" r="28"/><circle cx="112" cy="36" r="34"/><circle cx="152" cy="52" r="22"/>'
def star(x, y, r, a=0): return f'<polygon class="sh" transform="translate({x:.1f} {y:.1f}) rotate({a}) scale({r / 20:.3f})" style="stroke-width:{SW / (r / 20):.3f}" points="{BURST}"/>'
def eye(x, y, w): sc = w / 72; return f'<g transform="translate({x:.1f} {y:.1f}) scale({sc:.4f})" style="stroke-width:{SW / sc:.3f}"><path class="sh" d="{EYE}"/><circle class="sh" cx="36" cy="21.9" r="13.3"/><circle class="sh" cx="41" cy="17" r="3.5"/></g>'
def cloud(x, y, w): sc = w / 200; return f'<g transform="translate({x:.1f} {y:.1f}) scale({sc:.4f})" style="stroke-width:{SW / sc:.3f}"><path class="sh" d="M30 86 H170 A20 20 0 0 0 172 47 A22 22 0 0 0 142 34 A34 34 0 0 0 82 22 A28 28 0 0 0 36 50 A20 20 0 0 0 30 86Z"/></g>'
def parcel(x, y, w, h, bow=True):
    s = f'<rect class="sh" x="{x}" y="{y}" width="{w}" height="{h}"/><rect class="sh" x="{x + w / 2 - 7}" y="{y}" width="14" height="{h}"/><rect class="sh" x="{x}" y="{y + h / 2 - 7}" width="{w}" height="14"/>'
    if bow: s += f'<path class="sh" d="M{x + w / 2} {y} c-10 -22 -34 -22 -30 -4 c2 8 18 6 30 4z M{x + w / 2} {y} c10 -22 34 -22 30 -4 c-2 8 -18 6 -30 4z"/>'
    return s
def bauble(x, y, r):
    return f'<line class="ln" x1="{x}" y1="{y - r - 40}" x2="{x}" y2="{y - r - 8}"/><rect class="sh" x="{x - 7}" y="{y - r - 10}" width="14" height="12"/><circle class="sh" cx="{x}" cy="{y}" r="{r}"/><path class="ln" d="M{x - r * .92} {y - r * .3} Q{x} {y - r * .6} {x + r * .92} {y - r * .3} M{x - r * .92} {y + r * .3} Q{x} {y} {x + r * .92} {y + r * .3}"/>'

def svg(body, title):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 2970 2100">
<title>{title}</title>
<style>.sh{{fill:#fff;stroke:#000}}.ln{{fill:none;stroke:#000}}g,path,rect,circle,ellipse,polygon,line,text{{stroke-linejoin:round;stroke-linecap:round}}
text{{font-family:'Strichpunkt Sans',Archivo,Arial,sans-serif;font-weight:900;font-stretch:150%;fill:#fff;stroke:#000}}</style>
<rect width="2970" height="2100" fill="#fff"/>
<g stroke-width="{SW}">{body}</g>
</svg>
'''

# ======================================================================
# 1) COLOURING PAGE: the street
# ======================================================================
G = 1700  # ground line
out = []
add = out.append
# frame
add(f'<rect class="ln" x="40" y="40" width="2890" height="2020"/>')
# sky: moon, clouds, stars, snowflakes, the sleigh
add('<circle class="sh" cx="300" cy="250" r="120"/><circle class="sh" cx="262" cy="214" r="22"/><circle class="sh" cx="340" cy="290" r="16"/><circle class="sh" cx="330" cy="200" r="10"/><circle class="sh" cx="270" cy="300" r="12"/>')
for x, y, w in [(560, 120, 300), (1280, 90, 240), (2050, 230, 280), (900, 330, 200), (2550, 120, 220)]: add(cloud(x, y, w))
for _ in range(34):
    x, y = R.uniform(80, 2890), R.uniform(70, 760); add(star(x, y, R.uniform(10, 26), R.uniform(0, 45)))
def snowflake(x, y, r, a0):
    d = ''
    for i in range(6):
        a = math.radians(a0 + i * 60); ca, sa = math.cos(a), math.sin(a)
        d += f'M{x:.0f} {y:.0f}L{x + ca * r:.1f} {y + sa * r:.1f}'
        for t, l in ((.45, .3), (.72, .22)):
            bx, by = x + ca * r * t, y + sa * r * t
            for s_ in (-1, 1):
                b = a + s_ * math.radians(45)
                d += f'M{bx:.1f} {by:.1f}L{bx + math.cos(b) * r * l:.1f} {by + math.sin(b) * r * l:.1f}'
    return f'<path class="ln" d="{d}"/><circle class="sh" cx="{x:.0f}" cy="{y:.0f}" r="{r * .12:.1f}"/>'
for x, y in [(500, 420), (1150, 80), (1400, 440), (2330, 100), (2720, 380), (920, 610), (2150, 580), (1880, 330), (200, 560)]:
    add(snowflake(x, y, R.uniform(38, 60), R.uniform(0, 30)))
g, w, h = place('sleigh', 1520, 130, w=520); add(g)
# far skyline
x = 50
while x < 2900:
    w = R.uniform(110, 220); h = R.uniform(420, 820); y = G - h
    add(f'<path class="sh" d="M{x:.0f} {G}V{y + w / 2:.0f}a{w / 2:.0f} {w / 2:.0f} 0 0 1 {w:.0f} 0V{G}Z"/>' if R.random() > .5 else f'<path class="sh" d="M{x:.0f} {G}V{y:.0f}h{w:.0f}V{G}Z"/>')
    for wy in range(int(y + 90), G - 140, 110):
        for wx in (x + w * .28, x + w * .62):
            if R.random() > .45: add(f'<rect class="sh" x="{wx:.0f}" y="{wy}" width="26" height="36"/>')
    x += w + R.uniform(10, 50)

# main houses
houses = []
x = 70
POSTER_AT = {0: 'define', 2: 'excite', 3: 'create', 4: 'empower', 6: 'apply'}
WINDOW_ART = ['apply', 'interview1', 'interview2', 'employed']
k = 0
while x < 2880:
    w = min(R.uniform(300, 400), 2900 - x)
    if w < 220: break
    h = R.uniform(820, 1280); roof = ['flat', 'gable', 'arch', 'step', 'shed'][k % 5]
    top = G - h
    rd = {'gable': w * .38, 'arch': w / 2, 'step': 70, 'shed': w * .28, 'flat': 0}[roof]
    body = {
        'flat': f'M{x} {top}H{x + w}V{G}H{x}Z',
        'gable': f'M{x} {G}V{top + rd}L{x + w / 2} {top}L{x + w} {top + rd}V{G}Z',
        'arch': f'M{x} {G}V{top + w / 2}A{w / 2} {w / 2} 0 0 1 {x + w} {top + w / 2}V{G}Z',
        'step': f'M{x} {G}V{top + 70}H{x + w * .25}V{top}H{x + w * .75}V{top + 70}H{x + w}V{G}Z',
        'shed': f'M{x} {G}V{top + rd}L{x + w} {top}V{G}Z',
    }[roof]
    # chimney first (behind)
    if roof in ('gable', 'flat', 'shed') and k % 2 == 0:
        cx = x + w * .72; ctop = top - 90 if roof != 'shed' else top - 60
        add(f'<rect class="sh" x="{cx:.0f}" y="{ctop:.0f}" width="54" height="160"/><rect class="sh" x="{cx - 8:.0f}" y="{ctop - 18:.0f}" width="70" height="22"/>')
        add(f'<path class="ln" d="M{cx + 27:.0f} {ctop - 30:.0f} c-30 -30 30 -50 0 -80 c-30 -30 30 -50 0 -80 M{cx + 50:.0f} {ctop - 40:.0f} c-20 -24 20 -40 0 -64"/>')
        if k == 2: add(place('sock', cx - 10, ctop + 40, h=110, rot=-8)[0])
    add(f'<path class="sh" d="{body}"/>')
    # snow on the roof
    if roof == 'flat': add(f'<path class="sh" d="M{x - 8} {top}C{x + w * .2} {top - 26} {x + w * .5} {top - 10} {x + w * .7} {top - 24}S{x + w + 10} {top - 14} {x + w + 8} {top}Z"/>')
    if roof == 'gable': add(f'<path class="sh" d="M{x - 10} {top + rd + 6}L{x + w / 2} {top - 14}L{x + w + 10} {top + rd + 6}L{x + w - 10} {top + rd + 18}C{x + w * .8} {top + rd * .7} {x + w * .66} {top + rd * .6} {x + w / 2} {top + 18}C{x + w * .3} {top + rd * .5} {x + w * .2} {top + rd * .7} {x + 10} {top + rd + 20}Z"/>')
    # cornice line and house number
    cy0 = top + max(rd, 60) + 40
    add(f'<line class="ln" x1="{x}" y1="{cy0}" x2="{x + w}" y2="{cy0}"/>')
    add('<path class="sh" d="' + ''.join(f'M{ix:.0f} {cy0}l7 {R.uniform(14, 30):.0f}l7 -{0}' for ix in [x + 6 + j * 18 for j in range(int((w - 12) / 18))]).replace('l7 -0', 'l7 0') + '"/>')
    if roof == 'arch':
        for rr in range(int(w / 2 - 30), 40, -34): add(f'<path class="ln" d="M{x + w / 2 - rr:.0f} {top + w / 2:.0f}A{rr} {rr} 0 0 1 {x + w / 2 + rr:.0f} {top + w / 2:.0f}"/>')
    if roof == 'gable':
        for j in range(1, 6):
            yy0 = top + rd * j / 6; half = (w / 2) * j / 6
            add(f'<path class="ln" d="M{x + w / 2 - half:.0f} {yy0:.0f}' + ''.join(f'q{half / 4:.1f} 16 {half / 2:.1f} 0' for _ in range(4)) + '"/>')
    if k % 3 == 1:
        for _ in range(9):
            bx0, by0 = R.uniform(x + 10, x + w - 80), R.uniform(cy0 + 40, G - 260)
            add(f'<rect class="sh" x="{bx0:.0f}" y="{by0:.0f}" width="40" height="18"/><rect class="sh" x="{bx0 + 20:.0f}" y="{by0 + 18:.0f}" width="40" height="18"/><rect class="sh" x="{bx0 - 20:.0f}" y="{by0 + 18:.0f}" width="40" height="18"/>')
    # the advent window with shutters, number and the eye
    wy = top + max(rd, 60) + 90
    ww = 150
    wx = x + (w - ww) / 2
    add(f'<rect class="sh" x="{wx - 46:.0f}" y="{wy:.0f}" width="44" height="150"/><rect class="sh" x="{wx + ww + 2:.0f}" y="{wy:.0f}" width="44" height="150"/>')
    add(f'<rect class="sh" x="{wx:.0f}" y="{wy:.0f}" width="{ww}" height="150"/>')
    add(eye(wx + 25, wy + 20, 100))
    add(f'<text x="{wx + ww / 2:.0f}" y="{wy + 136:.0f}" text-anchor="middle" font-size="44" style="stroke-width:{SW / 1.6:.2f}">{[7, 12, 3, 24, 18, 9, 1, 15, 21][k % 9]}</text>')
    # rows of windows: shutters, crosses, wreaths, posters and brand illustrations
    rows = list(range(int(wy + 230), int(G - 330), 150))
    cols = 3 if w > 340 else 2
    gap = (w - cols * 64) / (cols + 1)
    poster_row = rows[0] if rows else None
    for ry in rows:
        if ry == poster_row and k in POSTER_AT:
            pw = w * .7; px = x + (w - pw) / 2
            add(f'<rect class="sh" x="{px:.0f}" y="{ry - 10:.0f}" width="{pw:.0f}" height="{pw * .62:.0f}"/>')
            g, iw, ih = place(POSTER_AT[k], 0, 0, w=pw * .62)
            add(place(POSTER_AT[k], px + (pw - iw) / 2, ry - 10 + (pw * .62 - ih) / 2, w=pw * .62)[0])
            continue
        if poster_row and ry > poster_row and ry < poster_row + w * .62: continue
        for c in range(cols):
            cx = x + gap + c * (64 + gap)
            if R.random() < .16 and WINDOW_ART:
                a = WINDOW_ART[(k + c) % 4]
                add(f'<rect class="sh" x="{cx - 14:.0f}" y="{ry - 8:.0f}" width="92" height="106"/>')
                add(place(a, cx - 6, ry + 6, w=76)[0])
                continue
            add(f'<rect class="sh" x="{cx:.0f}" y="{ry:.0f}" width="64" height="90"/><line class="ln" x1="{cx + 32:.0f}" y1="{ry}" x2="{cx + 32:.0f}" y2="{ry + 90}"/><line class="ln" x1="{cx:.0f}" y1="{ry + 40}" x2="{cx + 64:.0f}" y2="{ry + 40}"/>')
            add(f'<rect class="sh" x="{cx - 8:.0f}" y="{ry + 90}" width="80" height="12"/>')
            if R.random() < .3: add(f'<path class="sh" d="M{cx:.0f} {ry + 90} q8 -18 16 0 q8 -14 16 0 q8 -18 16 0 q8 -14 16 0Z"/>')
            if R.random() < .2: add(star(cx + 32, ry + 22, 12, R.uniform(0, 40)))
    # door with wreath, steps, lantern
    dx = x + w * R.uniform(.28, .6)
    add(f'<rect class="sh" x="{dx - 62:.0f}" y="{G - 14}" width="124" height="14"/>')
    add(f'<path class="sh" d="M{dx - 44:.0f} {G - 14}V{G - 160}a44 44 0 0 1 88 0V{G - 14}Z"/><line class="ln" x1="{dx:.0f}" y1="{G - 202}" x2="{dx:.0f}" y2="{G - 14}"/><circle class="sh" cx="{dx + 26:.0f}" cy="{G - 90}" r="6"/>')
    if k % 2 == 0:
        aw = 200; ax0 = dx - aw / 2; ay0 = G - 300
        add(f'<path class="sh" d="M{ax0 + 20:.0f} {ay0}h{aw - 40}l20 60h-{aw}z"/>' + ''.join(f'<path class="sh" d="M{ax0 + 20 + j * (aw - 40) / 6:.0f} {ay0}l{-20 + j * 40 / 6:.1f} 60h{aw / 6:.1f}l{20 - (j + 1) * 40 / 6 + 0:.1f} -60z"/>' for j in range(0, 6, 2)))
        add('<path class="sh" d="M' + f'{ax0:.0f} {ay0 + 60}' + ''.join(f'q{aw / 12:.1f} 26 {aw / 6:.1f} 0' for _ in range(6)) + 'z"/>')
    add(f'<circle class="sh" cx="{dx:.0f}" cy="{G - 238}" r="28"/><circle class="sh" cx="{dx:.0f}" cy="{G - 238}" r="15"/><path class="sh" d="M{dx:.0f} {G - 212} l-16 12 l4 -16z M{dx:.0f} {G - 212} l16 12 l-4 -16z"/>')
    for bx in range(int(x + 16), int(x + w - 16), 46):
        add(f'<path class="ln" d="M{bx} {G - 4}h30"/>') if R.random() < .3 else None
    houses.append((x, w, top, rd, roof))
    k += 1
    x += w + R.uniform(40, 90)

# garlands of lights between neighbouring houses
for (x1, w1, t1, r1, _), (x2, w2, t2, r2, _) in zip(houses, houses[1:]):
    ya, yb = max(t1 + r1, t1) + 60 + 120, max(t2 + r2, t2) + 60 + 120
    xa, xb = x1 + w1 - 6, x2 + 6
    mx, my = (xa + xb) / 2, max(ya, yb) + 70
    add(f'<path class="ln" d="M{xa:.0f} {ya:.0f}Q{mx:.0f} {my + 40:.0f} {xb:.0f} {yb:.0f}"/>')
    for i in range(1, 6):
        t = i / 6; bx = (1 - t) ** 2 * xa + 2 * (1 - t) * t * mx + t * t * xb; by = (1 - t) ** 2 * ya + 2 * (1 - t) * t * (my + 40) + t * t * yb
        add(f'<rect class="sh" x="{bx - 5:.0f}" y="{by:.0f}" width="10" height="8"/><ellipse class="sh" cx="{bx:.0f}" cy="{by + 20:.0f}" rx="9" ry="13"/>')

# sidewalk and cobbled street
add(f'<rect class="sh" x="40" y="{G}" width="2890" height="130"/>')
for i, xx in enumerate(range(40, 2930, 120)): add(f'<line class="ln" x1="{xx}" y1="{G}" x2="{xx}" y2="{G + 130}"/>')
yy = G + 130
row = 0
while yy < 2050:
    off = 0 if row % 2 else 40
    for xx in range(40 - off, 2930, 80):
        x0, x1 = max(xx + 6, 44), min(xx + 74, 2926)
        if x1 - x0 > 14: add(f'<rect class="sh" x="{x0}" y="{yy + 6}" width="{x1 - x0}" height="{min(48, 2054 - yy - 6)}" rx="10"/>')
    yy += 58; row += 1
# street lamps
LAMPS = (640, 1520, 2380); LH = 400
for a, b in zip(LAMPS, LAMPS[1:]):
    ya = G - LH + 40; mx = (a + b) / 2; my = ya + 120
    add(f'<path class="ln" d="M{a} {ya}Q{mx} {my + 60} {b} {ya}"/>')
    for i in range(1, 12):
        t = i / 12; fx = (1 - t) ** 2 * a + 2 * (1 - t) * t * mx + t * t * b; fy = (1 - t) ** 2 * ya + 2 * (1 - t) * t * (my + 60) + t * t * ya
        add(f'<path class="sh" d="M{fx - 16:.0f} {fy:.0f}h32l-16 40z"/>')
for lx in LAMPS:
    add(f'<rect class="sh" x="{lx - 9}" y="{G - LH}" width="18" height="{LH}"/><rect class="sh" x="{lx - 30}" y="{G - 30}" width="60" height="30"/><path class="sh" d="M{lx - 46} {G - LH}h92l-16 -90h-60z"/><path class="sh" d="M{lx - 56} {G - LH}h112v18h-112z"/><path class="sh" d="M{lx - 26} {G - LH - 90}h52l-26 -34z"/>')
    add(f'<path class="ln" d="M{lx - 30} {G - LH - 20}l10 -60M{lx + 30} {G - LH - 20}l-10 -60M{lx} {G - LH - 10}v-70"/>')
    add(bauble(lx + 60, G - LH + 120, 26))
    add(place('cane', lx - 120, G - LH + 70, h=120, flip=True)[0])

# the brand figures stand on the street, among the Christmas cast
add(place('open', 120, G - 300, h=330)[0])
add(place('curious', 1000, G - 270, h=300)[0])
add(place('responsible', 1880, G - 300, h=330)[0])
add(place('passionate', 2600, G - 290, h=310)[0])
add(place('santa', 820, G - 250, h=270, flip=True)[0])
add(place('elf', 1250, G - 230, h=250)[0])
add(place('ginger', 1700, G - 190, h=200)[0])
add(place('snowman', 2180, G - 280, h=300)[0])
add(place('elf', 2780, G - 210, h=220, flip=True)[0])
add(place('ginger', 560, G - 160, h=170, flip=True)[0])
# presents piles
for px0 in (430, 1420, 2460):
    add(parcel(px0, G - 110, 120, 110)); add(parcel(px0 + 128, G - 80, 80, 80)); add(parcel(px0 + 30, G - 190, 76, 80))
# trees in the front, left and right
add(place('tree', 40, G - 640, h=820)[0])
add(place('tree', 2560, G - 600, h=780, flip=True)[0])
for bx, by in ((150, G - 380), (250, G - 240), (2740, G - 330), (2660, G - 200)): add(bauble(bx, by, 22))
# snow drifts in front
add(f'<path class="sh" d="M40 2060C300 1990 520 2050 760 2010S1160 1990 1400 2030 1900 1980 2200 2020 2700 1990 2930 2030V2060Z"/>')
for _ in range(40):
    add(f'<circle class="sh" cx="{R.uniform(60, 2910):.0f}" cy="{R.uniform(60, 1500):.0f}" r="{R.uniform(4, 9):.1f}"/>')
add(f'<text x="2900" y="2040" text-anchor="end" font-size="26" style="stroke-width:{SW / 2.4:.2f}">STRICHPUNKT ADVENT 2026</text>')
open(f'{ROOT}/assets/diy/ausmalbild.svg', 'w').write(svg(''.join(out), 'Strichpunkt Advent 2026: Ausmalbild'))

# ======================================================================
# 2) SKETCHES of the six DIY ideas (presentation, lilac allowed as fill)
# ======================================================================
o = []
P = 970  # panel width
def panel(i, title, sub):
    px, py = 40 + (i % 3) * (P + 0), 40 + (i // 3) * 1010
    o.append(f'<rect class="ln" x="{px + 10}" y="{py + 10}" width="{P - 20}" height="990"/>')
    o.append(f'<text x="{px + 40}" y="{py + 80}" font-size="44" style="stroke:none;fill:#000">{i + 1} {title}</text>')
    o.append(f'<text x="{px + 40}" y="{py + 124}" font-size="24" style="stroke:none;fill:#000;font-weight:400;font-stretch:100%">{sub}</text>')
    return px, py
# 1 paper chain from "Open"
px, py = panel(0, 'PAPIERKETTE', '„Open“ falten, einmal schneiden, auffalten: alle halten sich an der Hand.')
o.append(f'<path class="ln" d="M{px + 40} {py + 330} Q{px + 485} {py + 400} {px + 930} {py + 330}"/>')
for j in range(3):
    o.append(place('open', px + 50 + j * 290, py + 360, w=300)[0])
for j in range(4): o.append(f'<line class="ln" x1="{px + 60 + j * 290}" y1="{py + 560}" x2="{px + 60 + j * 290}" y2="{py + 600}" stroke-dasharray="8 8"/>')
o.append(f'<path class="sh" d="M{px + 120} {py + 700} h560 l60 40 l-60 40 h-560 l60 -40z"/>')
o.append(f'<text x="{px + 400}" y="{py + 752}" text-anchor="middle" font-size="30" style="stroke:none;fill:#000">ZICKZACK FALTEN</text>')
o.append(place('open', px + 300, py + 820, h=140)[0])
# 2 tree topper "Excite"
px, py = panel(1, 'BAUMSPITZE', '„Excite“ auf Karton, in der Mitte gefaltet, auf die Spitze gesteckt.')
o.append(f'<path class="sh" d="M{px + 485} {py + 420} L{px + 760} {py + 900} H{px + 210}Z"/><rect class="sh" x="{px + 455}" y="{py + 900}" width="60" height="60"/>')
for j in range(9): o.append(f'<circle class="sh" cx="{px + 330 + (j * 97) % 320}" cy="{py + 560 + (j * 53) % 300}" r="16" style="fill:#B78CFF"/>')
o.append(place('excite', px + 315, py + 170, w=340)[0])
o.append(f'<path class="ln" d="M{px + 485} {py + 470}v-40"/>')
# 3 value ornaments
px, py = panel(2, 'WERTE-ANHÄNGER', 'Open, Passionate, Responsible, Curious: ein Wert pro Zweig.')
o.append(f'<path class="ln" d="M{px + 60} {py + 230} Q{px + 485} {py + 320} {px + 910} {py + 230}"/>')
for j, kk in enumerate(['open', 'passionate', 'responsible', 'curious']):
    cx = px + 150 + j * 225; o.append(f'<line class="ln" x1="{cx}" y1="{py + 255 + (j % 2) * 12}" x2="{cx}" y2="{py + 360 + j % 2 * 60}"/>')
    o.append(f'<circle class="sh" cx="{cx}" cy="{py + 460 + j % 2 * 60}" r="100" style="fill:#F3E6E0"/>')
    o.append(place(kk, cx - 70, py + 400 + j % 2 * 60, w=140)[0])
o.append(f'<text x="{px + 485}" y="{py + 760}" text-anchor="middle" font-size="30" style="stroke:none;fill:#000">EIN BOGEN, VIER ANHÄNGER</text>')
# 4 record ornament
px, py = panel(3, 'PLATTEN-ANHÄNGER', '„Create“ als runde Scheibe am Faden, dreht sich im Luftzug.')
o.append(f'<line class="ln" x1="{px + 485}" y1="{py + 160}" x2="{px + 485}" y2="{py + 300}"/>')
o.append(f'<circle class="sh" cx="{px + 485}" cy="{py + 560}" r="250"/>')
o.append(place('create', px + 255, py + 330, w=460)[0])
o.append(f'<path class="ln" d="M{px + 160} {py + 400} a330 330 0 0 1 80 -120 M{px + 810} {py + 720} a330 330 0 0 1 -80 120"/><path class="sh" d="M{px + 240} {py + 280} l-30 4 l14 26z M{px + 730} {py + 840} l30 -4 l-14 -26z"/>')
# 5 icing sugar stencil
px, py = panel(4, 'PUDERZUCKER-SCHABLONE', 'Herz aus „Passionate“ ausschneiden, auf Keks oder Cappuccino legen, bestäuben.')
o.append(f'<circle class="sh" cx="{px + 330}" cy="{py + 640}" r="220" style="fill:#F3E6E0"/>')
for _ in range(220):
    a, r = R.uniform(0, 6.28), R.uniform(0, 1) ** .5 * 200
    o.append(f'<circle cx="{px + 330 + r * math.cos(a):.0f}" cy="{py + 640 + r * math.sin(a):.0f}" r="2.4" fill="#000"/>')
o.append(f'<rect class="sh" x="{px + 470}" y="{py + 220}" width="420" height="420" transform="rotate(10 {px + 680} {py + 430})"/>')
o.append(place('passionate', px + 545, py + 270, h=320, rot=10)[0])
o.append(f'<path class="ln" d="M{px + 600} {py + 680} q-60 40 -130 0" stroke-dasharray="10 10"/><path class="sh" d="M{px + 470} {py + 680} l20 -24 l12 30z"/>')
# 6 gift tags
px, py = panel(5, 'GESCHENKANHÄNGER', 'Die kleinen Motive mit „Für“ und „Von“, zum Ausschneiden.')
for j, kk in enumerate(['apply', 'interview1', 'interview2', 'employed']):
    tx, ty = px + 70 + (j % 2) * 440, py + 190 + (j // 2) * 400
    o.append(f'<path class="sh" d="M{tx} {ty + 40} l40 -40 h340 v340 h-340 l-40 -40z" transform="rotate({(-4, 3, 2, -3)[j]} {tx + 190} {ty + 170})"/><circle class="sh" cx="{tx + 36}" cy="{ty + 170}" r="12"/>')
    o.append(place(kk, tx + 120, ty + 40, w=200)[0])
    o.append(f'<text x="{tx + 90}" y="{ty + 270}" font-size="24" style="stroke:none;fill:#000">FÜR</text><line class="ln" x1="{tx + 150}" y1="{ty + 270}" x2="{tx + 350}" y2="{ty + 270}"/>')
    o.append(f'<text x="{tx + 90}" y="{ty + 316}" font-size="24" style="stroke:none;fill:#000">VON</text><line class="ln" x1="{tx + 150}" y1="{ty + 316}" x2="{tx + 350}" y2="{ty + 316}"/>')
open(f'{ROOT}/mockups/diy-ideen.svg', 'w').write(svg(''.join(o), 'Strichpunkt Advent 2026: DIY-Ideen'))
print('ok')
