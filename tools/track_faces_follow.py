import json, math, cv2
d = json.load(open('raw_track.json')); raw = d['raw']; n = len(raw)
tracks = []
for start in ([641, 368, 87, 87], [1151, 380, 89, 89]):
    prev = start; out = []
    for dets in raw:
        cx, cy = prev[0] + prev[2] / 2, prev[1] + prev[3] / 2
        best = None
        for b in dets:
            if not 66 <= b[2] <= 120: continue
            bx, by = b[0] + b[2] / 2, b[1] + b[3] / 2
            dist = math.hypot(bx - cx, by - cy)
            if dist < 70 and (best is None or dist < best[0]): best = (dist, b)
        if best: prev = best[1]; out.append(list(best[1]))
        else: out.append(None)
    # fill short gaps by interpolation; long gaps stay hidden (turned away)
    i = 0
    while i < n:
        if out[i] is None:
            j = i
            while j < n and out[j] is None: j += 1
            a = out[i - 1] if i > 0 else None; b = out[j] if j < n else None
            if a and b and j - i <= 5:
                for k in range(i, j):
                    t = (k - i + 1) / (j - i + 1); out[k] = [round(a[m] + (b[m] - a[m]) * t) for m in range(4)]
            i = j
        else: i += 1
    # smooth a little
    sm = []
    for k in range(n):
        if out[k] is None: sm.append(None); continue
        win = [out[q] for q in range(max(0, k - 1), min(n, k + 2)) if out[q]]
        sm.append([round(sum(w[m] for w in win) / len(win)) for m in range(4)])
    tracks.append(sm)
    print('missing', sum(1 for x in sm if x is None), [k for k, x in enumerate(sm) if x is None])
# store as centre x, centre y, size relative to the frame (1920x1080)
T = [[None if b is None else [round((b[0] + b[2] / 2) / 1920, 4), round((b[1] + b[3] / 2) / 1080, 4), round(b[2] / 1920, 4)] for b in tr] for tr in tracks]
json.dump({'fps': d['fps'], 'w': 1920, 'h': 1080, 'faces': T}, open('track.json', 'w'), separators=(',', ':'))
# check: draw boxes onto some frames
cap = cv2.VideoCapture('/root/.claude/uploads/ab3a936f-c6b2-5b89-9833-d2e6da447e4b/e86dcc9a-Elves_Dance_Routine.mp4'); k = 0; shots = []
while True:
    ok, f = cap.read()
    if not ok: break
    if k in (0, 30, 50, 70, 85, 100, 110, 120):
        for tr, col in zip(tracks, ((0, 0, 255), (255, 0, 0))):
            b = tr[k]
            if b: cv2.rectangle(f, (b[0], b[1]), (b[0] + b[2], b[1] + b[3]), col, 4)
        shots.append(cv2.resize(f[150:900, 300:1600], (520, 300)))
    k += 1
import numpy as np
grid = np.vstack([np.hstack(shots[i:i + 4]) for i in (0, 4)]); cv2.imwrite('trackcheck.png', grid)
