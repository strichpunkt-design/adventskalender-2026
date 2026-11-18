#!/usr/bin/env python3
# Step 1: raw face detections per frame, cached next to each clip as <clip>_raw.json.
# Usage: python3 tools/detect_faces.py clip1.mp4 clip2.mp4 ...
import cv2, json, sys
cas = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml')
for c in sys.argv[1:]:
    cap = cv2.VideoCapture(c); out = []
    while True:
        ok, f = cap.read()
        if not ok: break
        g = cv2.equalizeHist(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY))
        out.append([list(map(int, d)) for d in cas.detectMultiScale(g, 1.05, 2, minSize=(18, 18), maxSize=(420, 420))])
    json.dump(out, open(c.replace('.mp4', '_raw.json'), 'w')); print(c, sum(map(len, out)), flush=True)
