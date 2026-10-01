"""Zoom métrique sur une zone du plan : grille tous les 0,1 m, étiquettes tous les 0,5 m.
usage: python3 tools/zoom.py <plan.png> <murs.json> x0 z0 x1 z1 <sortie.png> [facteur]"""
import cv2, json, sys
im = cv2.imread(sys.argv[1]); d = json.load(open(sys.argv[2])); S = d['pxPerM']; ox, oz = d['originPx']
x0, z0, x1, z1 = map(float, sys.argv[3:7]); out = sys.argv[7]; f = float(sys.argv[8]) if len(sys.argv) > 8 else 2.0
c = im[int(oz+z0*S):int(oz+z1*S), int(ox+x0*S):int(ox+x1*S)].copy()
c = cv2.resize(c, None, fx=f, fy=f, interpolation=cv2.INTER_CUBIC)
k0 = int(x0*10); k1 = int(x1*10)+1
for k in range(k0, k1+1):
    x = int((k/10 - x0)*S*f)
    if 0 <= x < c.shape[1]:
        major = k % 5 == 0; cv2.line(c, (x, 0), (x, c.shape[0]), (0, 120, 255) if major else (255, 200, 120), 1)
        if major: cv2.putText(c, f"{k/10:.1f}", (x+2, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 90, 220), 1)
for k in range(int(z0*10), int(z1*10)+2):
    z = int((k/10 - z0)*S*f)
    if 0 <= z < c.shape[0]:
        major = k % 5 == 0; cv2.line(c, (0, z), (c.shape[1], z), (0, 120, 255) if major else (255, 200, 120), 1)
        if major: cv2.putText(c, f"{k/10:.1f}", (2, z-3), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 90, 220), 1)
cv2.imwrite(out, c); print(c.shape)
