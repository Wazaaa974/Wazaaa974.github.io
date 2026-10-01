"""Aide au relevé d'un plan de vente Signature (image 250 ppi, échelle 1:75 ≈ 130,85 px/m).
- murs : le poché noir épais décomposé en rectangles (mètres, origine = coin haut-gauche des murs)
- grille : le plan recadré avec une grille métrique tous les 0,5 m, pour lire la position des équipements
usage: python3 tools/releve.py <plan.png> <prefixe_sortie> [px_par_m]
sorties: <prefixe>_murs.json  <prefixe>_grille.png  <prefixe>_murs.png"""
import cv2, numpy as np, json, sys

S_DEF = 130.85

def wall_mask(im):
    H, W = im.shape
    m = (im < 70).astype(np.uint8)
    m[:int(H*0.12)] = 0; m[int(H*0.84):] = 0; m[:, int(W*0.73):] = 0
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)))
    # ôte les petites taches (flèches, symboles pleins)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 900: m[lab == i] = 0
    return m

def rects_from_mask(m):
    """Décompose le masque en rectangles : runs horizontaux fusionnés verticalement."""
    H, W = m.shape; open_ = {}; out = []
    for y in range(H + 1):
        runs = set()
        if y < H:
            row = m[y]; d = np.diff(np.concatenate([[0], row, [0]]))
            st, en = np.nonzero(d == 1)[0], np.nonzero(d == -1)[0]
            runs = set(zip(st.tolist(), en.tolist()))
        for key in list(open_):
            if key not in runs: out.append((key[0], open_.pop(key), key[1], y))
        for r in runs:
            if r not in open_: open_[r] = y
    # fusion des rectangles quasi alignés (anti-crénelage)
    out = [r for r in out if (r[2]-r[0]) >= 4 and (r[3]-r[1]) >= 2]
    changed = True
    while changed:
        changed = False; out.sort()
        for i in range(len(out)):
            for j in range(i+1, len(out)):
                a, b = out[i], out[j]
                # même colonne, empilés
                if abs(a[0]-b[0]) <= 2 and abs(a[2]-b[2]) <= 2 and (abs(a[3]-b[1]) <= 2 or abs(b[3]-a[1]) <= 2):
                    out[i] = (min(a[0],b[0]), min(a[1],b[1]), max(a[2],b[2]), max(a[3],b[3])); out.pop(j); changed = True; break
                # même rangée, côte à côte
                if abs(a[1]-b[1]) <= 2 and abs(a[3]-b[3]) <= 2 and (abs(a[2]-b[0]) <= 2 or abs(b[2]-a[0]) <= 2):
                    out[i] = (min(a[0],b[0]), min(a[1],b[1]), max(a[2],b[2]), max(a[3],b[3])); out.pop(j); changed = True; break
            if changed: break
    return [r for r in out if (r[2]-r[0]) * (r[3]-r[1]) >= 120]

if __name__ == '__main__':
    path, pre = sys.argv[1], sys.argv[2]; S = float(sys.argv[3]) if len(sys.argv) > 3 else S_DEF
    im = cv2.imread(path, cv2.IMREAD_GRAYSCALE); m = wall_mask(im)
    R = rects_from_mask(m)
    ox = min(r[0] for r in R); oz = min(r[1] for r in R)
    walls = [[round((r[0]-ox)/S, 3), round((r[1]-oz)/S, 3), round((r[2]-ox)/S, 3), round((r[3]-oz)/S, 3)] for r in R]
    json.dump({"pxPerM": S, "originPx": [ox, oz], "walls": walls}, open(pre + '_murs.json', 'w'))
    col = cv2.cvtColor(im, cv2.COLOR_GRAY2BGR)
    x1 = max(r[2] for r in R); z1 = max(r[3] for r in R)
    pad = int(0.6*S); crop = col[max(0, oz-pad):z1+pad, max(0, ox-pad):x1+pad].copy()
    cx, cz = ox - max(0, ox-pad), oz - max(0, oz-pad)
    g = crop.copy()
    for k in range(-1, int((x1-ox)/S*2) + 3):
        x = int(cx + k*S/2); cv2.line(g, (x, 0), (x, g.shape[0]), (255, 160, 0) if k % 2 else (0, 140, 255), 1)
        if k % 2 == 0: cv2.putText(g, f"{k/2:g}", (x+2, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 100, 230), 1)
    for k in range(-1, int((z1-oz)/S*2) + 3):
        z = int(cz + k*S/2); cv2.line(g, (0, z), (g.shape[1], z), (255, 160, 0) if k % 2 else (0, 140, 255), 1)
        if k % 2 == 0: cv2.putText(g, f"{k/2:g}", (2, z-3), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 100, 230), 1)
    cv2.imwrite(pre + '_grille.png', g)
    w = crop.copy()
    for i, r in enumerate(R):
        a = (r[0]-ox+cx, r[1]-oz+cz); b = (r[2]-ox+cx, r[3]-oz+cz)
        cv2.rectangle(w, a, b, (0, 0, 230), 2); cv2.putText(w, str(i), (a[0]+2, a[1]+14), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 0, 160), 1)
    cv2.imwrite(pre + '_murs.png', w)
    print(f"{len(walls)} rectangles de mur · emprise {round((x1-ox)/S, 2)} × {round((z1-oz)/S, 2)} m · origine px {ox},{oz}")
