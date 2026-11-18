#!/usr/bin/env python3
# Face crops of everyone with a photo on sp.design/en/experts (needs web/team_raw.json from the experts page). Usage: python3 tools/team_faces.py <repo folder>
# Face crops of everyone on sp.design/en/experts who has a real photo, for the Elf Yourself picker.
import json, re, unicodedata, urllib.request, cv2, numpy as np, os, sys
ROOT = sys.argv[1]; out_dir = f'{ROOT}/assets/elf/team'; os.makedirs(out_dir, exist_ok=True)
cas = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml')
team = json.load(open('web/team_raw.json')); res = []; nofaces = []
# faces the detector misses or gets wrong: centre x, centre y, face width on the 600 px photo
FIX = {'Agnetha Wohlert': (300, 275, 190), 'Antje Grieshaber': (318, 272, 210), 'Hadjar Kennane': (300, 258, 205), 'Jan-Christoph Prilop': (291, 300, 200), 'Markus Stöckli': (300, 315, 215)}
slug = lambda n: re.sub(r'[^a-z0-9]+', '-', unicodedata.normalize('NFKD', n).encode('ascii', 'ignore').decode().lower()).strip('-')
for p in team:
    m = re.match(r'image-([0-9a-f]+)-(\d+x\d+)-(\w+)', p['ref']); url = f'https://cdn.sanity.io/images/hb8ixx6h/production/{m.group(1)}-{m.group(2)}.{m.group(3)}?w=1200&fm=jpg&q=86'
    try: data = urllib.request.urlopen(url, timeout=30).read()
    except Exception as e: print('fail', p['name'], e); continue
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR); H, W = img.shape[:2]
    g = cv2.equalizeHist(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY))
    f = cas.detectMultiScale(g, 1.08, 4, minSize=(120, 120))
    if name_fix := FIX.get(p['name']):
        cx, cy, cw = name_fix[0] * W / 600, name_fix[1] * W / 600, name_fix[2] * 1.42 * W / 600
    elif len(f):
        x, y, w, h = max(f, key=lambda r: r[2]); cx, cy, cw = x + w / 2, y + h / 2 + .03 * h, w * 1.42
    else:
        nofaces.append(p['name']); cx, cy, cw = W / 2, H * .36, W * .45
    ch = cw * 350 / 310
    x0, y0 = int(max(0, cx - cw / 2)), int(max(0, cy - ch / 2)); x1, y1 = int(min(W, x0 + cw)), int(min(H, y0 + ch))
    crop = cv2.resize(img[y0:y1, x0:x1], (372, 420), interpolation=cv2.INTER_AREA)
    name = slug(p['name']); cv2.imwrite(f'{out_dir}/{name}.jpg', crop, [cv2.IMWRITE_JPEG_QUALITY, 84])
    res.append({'name': p['name'], 'file': name, 'location': p['location']})
res.sort(key=lambda r: r['name'])
json.dump(res, open(f'{ROOT}/assets/elf/team.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(res), 'saved; no face found:', nofaces)
