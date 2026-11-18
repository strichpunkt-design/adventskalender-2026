import cv2, json, sys
V = sys.argv[1]
cap = cv2.VideoCapture(V); fps = cap.get(cv2.CAP_PROP_FPS)
cas = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml')
frames = []
while True:
    ok, f = cap.read()
    if not ok: break
    g = cv2.equalizeHist(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY))
    det = cas.detectMultiScale(g, 1.05, 3, minSize=(30, 30), maxSize=(160, 160))
    frames.append([list(map(int, d)) for d in det])
print(len(frames), fps)
print([len(x) for x in frames])
print(frames[0], frames[60])
json.dump({'fps': fps, 'raw': frames}, open('raw_track.json', 'w'))
