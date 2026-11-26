#!/usr/bin/env python3
# Paper chain template from the "Open" illustration: A4 landscape, three strips.
# Each strip is folded like an accordion at the dashed lines; the figure on the first panel is cut through all layers.
# The outer hands of "Open" touch both fold lines at the same height, so the unfolded chain holds hands.
# Usage: python3 tools/gen_chain.py <repo folder> [en]
import json, sys
ROOT = sys.argv[1]; EN = len(sys.argv) > 2 and sys.argv[2] == 'en'
T = (lambda de, en: en if EN else de)
s = open(f'{ROOT}/js/illu.js').read()
o = json.loads(s[s.index('export const ILLU=') + 18:s.index(';\nexport const illu')])['open']
W, H = 2970, 2100            # 10 units = 1 mm
PH = 520                     # panel height (52 mm)
PW = PH * o['w'] / o['h']    # panel width follows the figure
N = 3                        # panels per strip
SX = (W - N * PW) / 2
body = []
add = body.append
add(f'<text x="{SX}" y="150" class="h">{T("PAPIERKETTE „OPEN“", "PAPER CHAIN “OPEN”")}</text>')
add(f'<text x="{SX}" y="215" class="t">{T("1 Einen Streifen ausschneiden.  2 An den gestrichelten Linien zickzack falten, die Figur liegt oben.  3 Entlang der Figur durch alle Lagen schneiden,", "1 Cut out one strip.  2 Fold it zigzag along the dashed lines, the figure on top.  3 Cut along the figure through all layers,")}</text>')
add(f'<text x="{SX}" y="262" class="t">{T("die Hände an den Falzkanten nicht durchschneiden.  4 Auffalten: Alle halten sich an der Hand. Mehrere Streifen mit Klebeband verbinden.", "do not cut the hands at the folds.  4 Unfold: everyone holds hands. Tape several strips together for a longer chain.")}</text>')
for r in range(3):
    y = 380 + r * (PH + 60)
    add(f'<rect x="{SX}" y="{y}" width="{N * PW:.1f}" height="{PH}" class="strip"/>')
    for i in range(1, N):
        x = SX + i * PW
        add(f'<line x1="{x:.1f}" y1="{y}" x2="{x:.1f}" y2="{y + PH}" class="fold"/>')
        add(f'<text x="{x:.1f}" y="{y + PH + 34}" class="s" text-anchor="middle">{(T("Talfalte", "Valley fold") if i % 2 else T("Bergfalte", "Mountain fold"))}</text>')
    sc = PH / o['h']
    add(f'<g transform="translate({SX} {y}) scale({sc:.5f})" class="fig">{o["b"]}</g>')
    # where the hands meet the fold: do not cut here
    hy = y + 100 * sc
    for x, anchor, dx in ((SX, 'start', 12), (SX + PW, 'start', 12)):
        add(f'<path d="M{x:.1f} {y + 30 * sc:.1f}v{140 * sc:.1f}" class="keep"/>')
    add(f'<text x="{SX + PW + 16:.1f}" y="{y + 70}" class="s">{T("Hand an der Falzkante: nicht schneiden", "Hand at the fold: do not cut")}</text>')
    for i in range(1, N):
        add(f'<text x="{SX + (i + .5) * PW:.1f}" y="{y + PH / 2 + 10:.1f}" class="ghost" text-anchor="middle">{T("falten", "fold")}</text>')
add(f'<text x="{W - SX:.0f}" y="{H - 70}" class="s" text-anchor="end">{T("Strichpunkt Advent 2026 · 22. Dezember", "Strichpunkt Advent 2026 · December 22")}</text>')

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 {W} {H}">
<title>{T('Papierkette „Open“: Vorlage', 'Paper chain “Open”: template')}</title>
<style>
text{{font-family:'Strichpunkt Sans',Archivo,Arial,sans-serif;fill:#000}}
.h{{font-size:62px;font-weight:900;font-stretch:150%}} .t{{font-size:30px}} .s{{font-size:22px}}
.ghost{{font-size:34px;fill:#B8B8B8;letter-spacing:.1em;text-transform:uppercase}}
.strip{{fill:#fff;stroke:#000;stroke-width:3}}
.fold{{stroke:#000;stroke-width:3;stroke-dasharray:18 12}}
.fig path,.fig g{{fill:#D6D6D6}}
.keep{{stroke:#B78CFF;stroke-width:14;stroke-linecap:round;fill:none}}
</style>
<rect width="{W}" height="{H}" fill="#fff"/>
{''.join(body).replace('currentColor', '#D6D6D6')}
</svg>
'''
open(f"{ROOT}/assets/diy/{T('papierkette', 'paper-chain')}.svg", 'w').write(svg)
print('ok', round(PW / 10, 1), 'mm per panel')
