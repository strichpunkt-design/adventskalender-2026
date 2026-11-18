#!/usr/bin/env python3
# Step 2: face track per clip from the cached detections (step 1: tools/detect_faces.py). A face counts only with a lilac hat above it and skin inside it.
# Usage: python3 tools/track_faces.py clip1.mp4 clip2.mp4 ... (writes clips/track.json)
# Face track for each clip from the cached detections: keep only hits with a lilac hat right above them,
# then follow a left and a right elf from frame to frame; short gaps are filled, long ones stay hidden.
import cv2, json, math, sys, numpy as np
def hat_ok(hsv, b):
    x, y, s = b[0], b[1], b[2]
    y0, y1 = max(0, int(y - 0.9 * s)), max(1, int(y - 0.05 * s))
    band = hsv[y0:y1, max(0, x):x + s]
    if band.size == 0: return False
    hcol, sat, val = band[..., 0], band[..., 1], band[..., 2]
    lil = (hcol > 118) & (hcol < 150) & (sat > 50) & (val > 110)
    return lil.mean() > 0.22
def skin_ok(hsv, b):
    x, y, s = b[0], b[1], b[2]
    c = hsv[int(y + .25 * s):int(y + .8 * s), int(x + .2 * s):int(x + .8 * s)]
    if c.size == 0: return False
    h, sa, v = c[..., 0], c[..., 1], c[..., 2]
    sk = ((h < 22) | (h > 170)) & (sa > 25) & (sa < 175) & (v > 90)
    return sk.mean() > 0.35
def run(clip):
    raw = json.load(open(clip.replace('.mp4', '_raw.json')))
    cap = cv2.VideoCapture(clip); good = []; frames = []
    for dets in raw:
        ok, f = cap.read(); frames.append(f)
        hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV)
        good.append([b for b in dets if hat_ok(hsv, b) and skin_ok(hsv, b)])
    n = len(good)
    # remove nested duplicates (keep the larger box of overlapping hits)
    for i, g in enumerate(good):
        keep = []
        for b in sorted(g, key=lambda b: -b[2]):
            if all(math.hypot(b[0] + b[2] / 2 - k[0] - k[2] / 2, b[1] + b[3] / 2 - k[1] - k[3] / 2) > 0.5 * k[2] for k in keep): keep.append(b)
        good[i] = keep
    L, R = [None] * n, [None] * n
    for i, g in enumerate(good):
        g = sorted(g, key=lambda b: b[0])
        if len(g) >= 2: L[i], R[i] = g[0], g[-1]
        elif len(g) == 1:
            b = g[0]; cx = b[0] + b[2] / 2
            # which elf: the one whose last known centre is nearer
            pl = next((L[k] for k in range(i - 1, -1, -1) if L[k]), None); pr = next((R[k] for k in range(i - 1, -1, -1) if R[k]), None)
            dl = abs(cx - (pl[0] + pl[2] / 2)) if pl else 1e9; dr = abs(cx - (pr[0] + pr[2] / 2)) if pr else 1e9
            if dl <= dr: L[i] = b
            else: R[i] = b
    out = []
    for seq in (L, R):
        # drop jumps: a box that moves more than its own size from both neighbours is a stray hit
        for i in range(n):
            if seq[i] is None: continue
            nb = [seq[k] for k in (i - 1, i + 1) if 0 <= k < n and seq[k]]
            if nb and all(math.hypot(seq[i][0] - q[0], seq[i][1] - q[1]) > 1.1 * q[2] for q in nb): seq[i] = None
        i = 0
        while i < n:
            if seq[i] is None:
                j = i
                while j < n and seq[j] is None: j += 1
                a = seq[i - 1] if i else None; b = seq[j] if j < n else None
                if a and b and j - i <= 6:
                    for k in range(i, j):
                        t = (k - i + 1) / (j - i + 1); seq[k] = [round(a[m] + (b[m] - a[m]) * t) for m in range(4)]
                i = j
            else: i += 1
        sm = []
        for k in range(n):
            if seq[k] is None: sm.append(None); continue
            win = [seq[q] for q in range(max(0, k - 1), min(n, k + 2)) if seq[q]]
            sm.append([round(sum(w[m] for w in win) / len(win)) for m in range(4)])
        out.append(sm)
    return out, frames
faces = [[], []]; sheets = []
for c in sys.argv[1:]:
    (L, R), frames = run(c)
    print(c, 'missing L', sum(b is None for b in L), 'R', sum(b is None for b in R))
    for idx, tr in enumerate((L, R)):
        faces[idx] += [None if b is None else [round((b[0] + b[2] / 2) / 1920, 4), round((b[1] + b[3] / 2) / 1080, 4), round(b[2] / 1920, 4)] for b in tr]
    shots = []
    for k in np.linspace(0, len(frames) - 1, 8).astype(int):
        f = frames[k].copy()
        for tr, col in ((L, (0, 0, 255)), (R, (255, 0, 0))):
            b = tr[k]
            if b: cv2.rectangle(f, (b[0], b[1]), (b[0] + b[2], b[1] + b[3]), col, 7)
        shots.append(cv2.resize(f, (300, 169)))
    sheets.append(np.hstack(shots))
cv2.imwrite('clips/trackcheck.png', np.vstack(sheets))
json.dump({'fps': 24, 'w': 1920, 'h': 1080, 'faces': faces}, open('clips/track.json', 'w'), separators=(',', ':'))
