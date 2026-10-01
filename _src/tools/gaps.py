"""Ouvertures candidates : trous entre deux rectangles de mur alignés (même épaisseur), 0,55 à 3 m.
usage: python3 tools/gaps.py out/releve/<lot>_murs.json"""
import json, sys
W = json.load(open(sys.argv[1]))['walls']; T = 0.03; out = []
for i, a in enumerate(W):
    for j, b in enumerate(W):
        if i == j: continue
        # horizontal: même bande z, b à droite de a
        if abs(a[1]-b[1]) < T and abs(a[3]-b[3]) < T and 0.55 < b[0]-a[2] < 3.0:
            z0, z1 = max(a[1], b[1]), min(a[3], b[3]); x0, x1 = a[2], b[0]
            if not any(w[0] < x1-0.02 and w[2] > x0+0.02 and w[1] < z1 and w[3] > z0 for k, w in enumerate(W) if k not in (i, j)):
                out.append(('h', round(x0, 3), round(z0, 3), round(x1, 3), round(z1, 3), i, j))
        # vertical: même bande x, b en dessous de a
        if abs(a[0]-b[0]) < T and abs(a[2]-b[2]) < T and 0.55 < b[1]-a[3] < 3.0:
            x0, x1 = max(a[0], b[0]), min(a[2], b[2]); z0, z1 = a[3], b[1]
            if not any(w[1] < z1-0.02 and w[3] > z0+0.02 and w[0] < x1 and w[2] > x0 for k, w in enumerate(W) if k not in (i, j)):
                out.append(('v', round(x0, 3), round(z0, 3), round(x1, 3), round(z1, 3), i, j))
for g in sorted(set(out), key=lambda g: (g[0], g[2], g[1])):
    L = g[3]-g[1] if g[0] == 'h' else g[4]-g[2]; t = g[4]-g[2] if g[0] == 'h' else g[3]-g[1]
    print(f"{g[0]} r=[{g[1]}, {g[2]}, {g[3]}, {g[4]}]  largeur {L:.2f} m  ép. {t:.2f} m  murs {g[5]}|{g[6]}")
