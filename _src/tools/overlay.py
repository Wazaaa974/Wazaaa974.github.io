"""Contrôle visuel d'un relevé : murs (rouge), ouvertures (bleu), soffites (hachures vertes) et pièces
superposés au plan de vente d'origine, après recalage automatique échelle + décalage.
usage: python3 tools/overlay.py out/geo/<lot>.json <plan.png> <sortie.png> [px_par_m_approx]"""
import cv2, numpy as np, json, sys

def wallmask(im):
    H, W = im.shape
    dark = (im < 70).astype(np.uint8); dark[:int(H*0.12)] = 0; dark[int(H*0.84):] = 0; dark[:, int(W*0.73):] = 0
    return cv2.morphologyEx(dark, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7)))

def render(rects, s, ox, oz, shape):
    m = np.zeros(shape, np.uint8)
    for x0, z0, x1, z1 in rects:
        cv2.rectangle(m, (int(round(ox + x0*s)), int(round(oz + z0*s))), (int(round(ox + x1*s))-1, int(round(oz + z1*s))-1), 1, -1)
    return m

def iou(walls, s, ox, oz, mask):
    r = render(walls, s, ox, oz, mask.shape); inter = (r & mask).sum(); return inter / (r.sum() + mask.sum() - inter + 1)

def fit(walls, mask, s0):
    ys, xs = np.nonzero(mask); best = (0, None)
    wx0 = min(w[0] for w in walls); wz0 = min(w[1] for w in walls)
    for s in np.arange(s0 - 5, s0 + 5, 0.5):
        ox0 = xs.min() - wx0*s; oz0 = ys.min() - wz0*s
        for dx in range(-30, 31, 3):
            for dz in range(-30, 31, 3):
                sc = iou(walls, s, ox0+dx, oz0+dz, mask)
                if sc > best[0]: best = (sc, (s, ox0+dx, oz0+dz))
    sc, (s, ox, oz) = best
    for step in (0.1, 0.02):
        better = True
        while better:
            better = False
            for ds, dx, dz in [(step,0,0),(-step,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]:
                c = iou(walls, s+ds, ox+dx, oz+dz, mask)
                if c > sc: sc, s, ox, oz, better = c, s+ds, ox+dx, oz+dz, True
    return sc, s, ox, oz

if __name__ == '__main__':
    geo = json.load(open(sys.argv[1])); im = cv2.imread(sys.argv[2], cv2.IMREAD_GRAYSCALE)
    sc, s, ox, oz = fit(geo['walls'], wallmask(im), float(sys.argv[4]) if len(sys.argv) > 4 else 131)
    P = lambda x, z: (int(round(ox + x*s)), int(round(oz + z*s)))
    col = cv2.cvtColor(im, cv2.COLOR_GRAY2BGR); ov = col.copy()
    ov[render(geo['walls'], s, ox, oz, im.shape) > 0] = (40, 40, 220)
    for o in geo['openings']:
        x0, z0, x1, z1 = o['r']; cv2.rectangle(ov, P(x0, z0), P(x1, z1), (220, 120, 30), -1)
    out = cv2.addWeighted(col, 0.45, ov, 0.55, 0)
    for so in geo.get('soffits', []):
        x0, z0, x1, z1 = so[:4]; a, b = P(x0, z0), P(x1, z1)
        cv2.rectangle(out, a, b, (40, 150, 40), 3)
        for k in range(a[0] - (b[1]-a[1]), b[0], 18):
            p1 = (max(k, a[0]), a[1] + max(0, a[0]-k)); p2 = (min(k + (b[1]-a[1]), b[0]), b[1] - max(0, k + (b[1]-a[1]) - b[0]))
            cv2.line(out, p1, p2, (40, 150, 40), 1)
    for r in geo['rooms']:
        pts = np.array([P(x, z) for x, z in r['poly']], np.int32); cv2.polylines(out, [pts], True, (160, 60, 160), 2)
    H, W = im.shape
    crop = out[int(H*0.12):int(H*0.84), :int(W*0.73)]
    ys, xs = np.nonzero(render(geo['walls'], s, ox, oz, im.shape)[int(H*0.12):int(H*0.84), :int(W*0.73)])
    crop = crop[max(0, ys.min()-40):ys.max()+40, max(0, xs.min()-40):xs.max()+40]
    cv2.imwrite(sys.argv[3], cv2.resize(crop, None, fx=0.6, fy=0.6, interpolation=cv2.INTER_AREA))
    print(json.dumps({"recouvrement_murs": round(sc, 3), "px_par_m": round(s, 2), "ox": round(ox, 1), "oz": round(oz, 1)}))
