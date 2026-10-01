import * as NS from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const THREE = Object.assign({}, NS, { RoundedBoxGeometry, RoomEnvironment });
const GEO = window.GEO;
(function(){
const H = GEO.ceiling, TOP = H + 0.22, EYE = 1.65, R = 0.22, GROUND = GEO.ground ?? -(GEO.meta.level ?? 2) * 2.95;
const fmtM = n => n.toFixed(2).replace('.', ',');
const OBST = GEO.obst ? GEO.obst.map(o => o.r) : [...GEO.walls, ...(GEO.rails || []), ...(GEO.screens || []).map(s => s.r),
  ...GEO.openings.filter(o => o.type === 'window' || o.kind === 'entry').map(o => o.block || o.r)];
const SOFF = (GEO.soffits || []).map(s => Array.isArray(s) ? {r: s.slice(0, 4), h: s[4] ?? GEO.soffitH} : {r: s.r, h: s.h ?? GEO.soffitH});
// rampants (sous toiture) : pans rectangulaires, hauteur h0 sur la ligne edge, pente vers l'intérieur, plafond plat à cap
const ROOF = GEO.roof || {}, PANS = ROOF.pans || [], LOWH = ROOF.low ?? 1.8;
const panT = (p, x, z) => p.dir === 'n' ? z - p.edge : p.dir === 's' ? p.edge - z : p.dir === 'w' ? x - p.edge : p.edge - x;
const panH = (p, x, z) => Math.min(p.cap ?? H, p.h0 + p.slope * panT(p, x, z));
const panAt = (x, z) => PANS.find(p => x > p.r[0] && x < p.r[2] && z > p.r[1] && z < p.r[3]);
const ceilAt = (x, z) => { const p = panAt(x, z); return p ? panH(p, x, z) : H; };
const panLine = (p, h) => p.edge + (p.dir === 'n' || p.dir === 'w' ? 1 : -1) * (h - p.h0) / p.slope;   // où le pan atteint la hauteur h
const panAxis = p => p.dir === 'n' || p.dir === 's' ? 'z' : 'x';
const LOWR = PANS.map(p => { const v = panLine(p, LOWH), r = p.r.slice();            // bande où l'on ne tient pas debout (< 1,80 m)
  if (p.dir === 'n') r[3] = Math.min(r[3], v); else if (p.dir === 's') r[1] = Math.max(r[1], v); else if (p.dir === 'w') r[2] = Math.min(r[2], v); else r[0] = Math.max(r[0], v);
  return r; }).filter(r => r[2] > r[0] && r[3] > r[1]);
OBST.push(...(GEO.obst ? [] : LOWR));
const $ = id => document.getElementById(id);
const META = GEO.meta; $('mEye').textContent = META.eyebrow; $('mName').textContent = META.name; $('mFacts').innerHTML = META.facts.map(x => `<span>${x}</span>`).join('');
$('mSrc').textContent = META.src; $('hsp').textContent = 'Sous plafond ' + fmtM(GEO.ceiling) + ' m' + (SOFF.length ? ' · soffite ' + [...new Set(SOFF.map(s => fmtM(s.h)))].join(' / ') + ' m' : '')
  + (PANS.length ? ' · rampants ' + fmtM(Math.min(...PANS.map(p => p.h0))) + ' → ' + fmtM(Math.max(...PANS.map(p => p.cap ?? H))) + ' m' : ' · portes 2,04 m');
$('kitSeg').title = 'Aucun meuble de cuisine fourni de base : option Teisseire à ' + META.kitchenPrice;
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); renderer.useLegacyLights = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfdfe5);
scene.fog = new THREE.Fog(0xd5e2e6, 35, 140);
const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 400);
camera.rotation.order = 'YXZ';

const hemi = new THREE.HemisphereLight(0xffffff, 0xdcd8cf, 0.72); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfffaf3, 0.33); sun.position.set(-18, 30, 26); scene.add(sun);
const fill = new THREE.DirectionalLight(0xeef3ff, 0.14); fill.position.set(10, 12, -30); scene.add(fill);

const mat = (c, o={}) => new THREE.MeshStandardMaterial(Object.assign({color:c, roughness:.9, metalness:0}, o));
const M = {
  wall: mat(0xecebe6), cap: mat(0x2b322f,{roughness:1}), ceil: mat(0xf4f4f1,{side:THREE.DoubleSide, emissive:0x2c2c2a}),
  pvc: mat(0xcfd4d6,{roughness:.5}), glass: new THREE.MeshPhysicalMaterial({color:0xbfe0e8, roughness:.05, transparent:true, opacity:.2, depthWrite:false}),
  frost: new THREE.MeshPhysicalMaterial({color:0xeef3f3, transparent:true, opacity:.86, roughness:.8}), door: mat(0xfbfbf9,{roughness:.5}),
  entry: mat(0xdedcd6,{roughness:.5}), steel: mat(0xb8bdc1,{metalness:.55, roughness:.35}), dark: mat(0x22262a,{roughness:.35}),
  ceramic: mat(0xfcfcfb,{roughness:.2}), tubIn: mat(0xeef1f2,{roughness:.15}), basin: mat(0xdde2e4,{roughness:.2}), kfront: mat(0xa2b09a,{roughness:.55}), front: mat(0xf3f1ec,{roughness:.55}), oak: mat(0xc49a6b,{roughness:.6}),
  plinth: mat(0x6b706f), rail: mat(0x7e858b,{metalness:.45, roughness:.5}), post: mat(0x9b968c,{roughness:.85}),
  slab: mat(0xd7d6d0,{roughness:1}), concrete: mat(0xb9b8b2,{roughness:1}), deck: mat(0xc4c2bb,{roughness:1}),
  ground: mat(0x98a07a,{roughness:1}), trunk: mat(0x7a6656), crown: mat(0x3f5a3b), crown2: mat(0x4d6a45),
  faience: mat(0xf4f4f2,{roughness:.3}), mirror: mat(0xdfe8ea,{metalness:.8, roughness:.08})
};

// ---------- procedural textures (1 texture unit = metres)
function tex(size, metres, draw){
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1/metres, 1/metres);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
}
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const woodTex = tex(1024, 2.4, (g, S) => {           // vinyle en lé, décor lames 1,20 × 0,20 m
  const rows = 12, ph = S/rows, pw = S/2;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * pw * 0.5 + (r % 3) * pw * 0.17;
    for (let i = -1; i < 3; i++) {
      const x = off + i*pw, l = 55 + rnd()*8, h = 30 + rnd()*5;
      g.fillStyle = `hsl(${h},${24+rnd()*8}%,${l}%)`; g.fillRect(x, r*ph, pw, ph);
      g.strokeStyle = 'rgba(90,60,30,.10)'; g.lineWidth = 1;
      for (let k = 0; k < 7; k++) { const y = r*ph + 4 + rnd()*(ph-8); g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x+pw*.3, y+rnd()*6-3, x+pw*.7, y+rnd()*6-3, x+pw, y); g.stroke(); }
      g.fillStyle = 'rgba(70,45,25,.35)'; g.fillRect(x, r*ph, 2, ph);
    }
    g.fillStyle = 'rgba(70,45,25,.3)'; g.fillRect(0, r*ph, S, 1.5);
  }
});
const tileTex = tex(512, 0.9, (g, S) => {             // grès 45 × 45 cm
  g.fillStyle = '#9d9a94'; g.fillRect(0,0,S,S);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const v = 208 + rnd()*10|0; g.fillStyle = `rgb(${v},${v-3},${v-8})`; g.fillRect(i*S/2+2, j*S/2+2, S/2-4, S/2-4); }
});
const faienceTex = tex(512, 0.6, (g, S) => {          // faïence 60 × 30 cm, pose à joints décalés
  g.fillStyle = '#c9cac6'; g.fillRect(0,0,S,S); g.fillStyle = '#f5f5f2';
  g.fillRect(1.5, 1.5, S-3, S/2-3); g.fillRect(-S/2+1.5, S/2+1.5, S-3, S/2-3); g.fillRect(S/2+1.5, S/2+1.5, S-3, S/2-3);
});
M.vinyl = mat(0xffffff,{map:woodTex, roughness:.62}); M.tile = mat(0xffffff,{map:tileTex, roughness:.5});
M.faience.map = faienceTex; M.faience.color.set(0xffffff);

// ---------- helpers
const groups = { walls:new THREE.Group(), caps:new THREE.Group(), ceil:new THREE.Group(), kitchen:new THREE.Group(), world:new THREE.Group(), furn:new THREE.Group() };
Object.values(groups).forEach(g => scene.add(g));
// objets qui portent une ombre sans être dessinés (plafonds en vue maquette, étages au-dessus des voisins) : mode Soleil
const SHADOW_M = new THREE.MeshBasicMaterial({colorWrite:false, depthWrite:false}), shadowOnly = new THREE.Group(); shadowOnly.visible = false; scene.add(shadowOnly);
const TREES = [], ROOFH = GEO.roofTop ?? ((GEO.storeys ?? 3) + 1 - (GEO.meta.level ?? 2)) * 2.95 + 1.3;   // TREES : maillages des pins ; ROOFH : faîtage approximatif des bâtiments en R+3
function box(x0, z0, x1, z1, y0, y1, m, parent = groups.walls){
  const w = Math.abs(x1-x0), d = Math.abs(z1-z0), h = y1-y0; if (w < 1e-4 || d < 1e-4 || h < 1e-4) return null;
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set((x0+x1)/2, (y0+y1)/2, (z0+z1)/2); parent.add(b); return b;
}
function shapeOf(poly, flip){ const s = new THREE.Shape(); poly.forEach(([x,z],i) => i ? s.lineTo(x, flip?-z:z) : s.moveTo(x, flip?-z:z)); return s; }
function flat(poly, y, m, parent, up = true){
  const g = new THREE.ShapeGeometry(shapeOf(poly, up)); const me = new THREE.Mesh(g, m);
  me.rotation.x = up ? -Math.PI/2 : Math.PI/2; me.position.y = y; parent.add(me); return me;
}
// pavé dont le dessous et le dessus suivent yb(x,z) et yt(x,z) aux quatre coins (murs et plafonds sous rampant)
function hexa(c, yb, yt, m, parent){
  const [x0,z0,x1,z1] = c, P = [[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
  const B = P.map(([x,z]) => [x, Math.min(yb(x,z), yt(x,z)), z]), T = P.map(([x,z]) => [x, yt(x,z), z]);
  const pos = [], uv = [];
  for (const q of [[T[0],T[3],T[2],T[1]], [B[0],B[1],B[2],B[3]], [B[0],T[0],T[1],B[1]], [B[1],T[1],T[2],B[2]], [B[2],T[2],T[3],B[3]], [B[3],T[3],T[0],B[0]]])
    for (const v of [q[0],q[1],q[2],q[0],q[2],q[3]]){ pos.push(v[0], v[1], v[2]); uv.push(v[0] + v[2], v[1]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  const me = new THREE.Mesh(g, m); parent.add(me); return me;
}
// découpe un rectangle selon les lignes de rupture des rampants (bords des pans, début du plafond plat, ligne des 1,80 m)
function gridCells(x0, z0, x1, z1, exX = [], exZ = []){
  const xs = new Set([x0, x1, ...exX]), zs = new Set([z0, z1, ...exZ]);
  for (const p of PANS){ xs.add(p.r[0]); xs.add(p.r[2]); zs.add(p.r[1]); zs.add(p.r[3]); for (const h of [p.cap ?? H, LOWH]) (panAxis(p) === 'z' ? zs : xs).add(panLine(p, h)); }
  const X = [...xs].filter(v => v >= x0 && v <= x1).sort((a,b) => a-b), Z = [...zs].filter(v => v >= z0 && v <= z1).sort((a,b) => a-b), out = [];
  for (let i = 0; i < X.length-1; i++) for (let j = 0; j < Z.length-1; j++) if (X[i+1]-X[i] > 1e-4 && Z[j+1]-Z[j] > 1e-4) out.push([X[i], Z[j], X[i+1], Z[j+1]]);
  return out;
}
const cellFn = c => { const p = panAt((c[0]+c[2])/2, (c[1]+c[3])/2); return p ? (x, z) => panH(p, x, z) : () => H; };
const touchesPan = r => PANS.some(p => r[0] < p.r[2] && r[2] > p.r[0] && r[1] < p.r[3] && r[3] > p.r[1]);
// mur ou linteau : de y0 jusqu'au-dessus du plafond (+0,22 m de dalle), en suivant les rampants ; chapeau sombre en vue maquette
function solid(r, y0, m, parent = groups.walls){
  if (!touchesPan(r)){ box(r[0], r[1], r[2], r[3], y0, TOP, m, parent); box(r[0], r[1], r[2], r[3], TOP, TOP + 0.01, M.cap, groups.caps); return; }
  for (const c of gridCells(...r)){ const f = cellFn(c); if ([[c[0],c[1]],[c[2],c[1]],[c[2],c[3]],[c[0],c[3]]].every(([x,z]) => f(x,z) + 0.22 <= y0)) continue;
    hexa(c, () => y0, (x,z) => f(x,z) + 0.22, m, parent); hexa(c, (x,z) => f(x,z) + 0.22, (x,z) => f(x,z) + 0.23, M.cap, groups.caps); }
}

// ---------- floors, slabs, ceilings
for (const r of GEO.rooms){
  const fm = r.floor === 'vinyl' ? M.vinyl : r.floor === 'tile' ? M.tile : r.floor === 'deck' ? M.deck : M.concrete;
  flat(r.poly, 0.002, fm, groups.walls);
  const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(shapeOf(r.poly, true), {depth:0.22, bevelEnabled:false}), M.slab);
  slab.rotation.x = -Math.PI/2; slab.position.y = -0.22; groups.walls.add(slab);
  if (!touchesPan(polyBox(r.poly))){
    const top = slab.clone(); top.position.y = H; groups.ceil.add(top);
    if (r.floor !== 'deck') flat(r.poly, H - 0.002, M.ceil, groups.ceil, false);
  }
}
for (const s of SOFF) box(s.r[0], s.r[1], s.r[2], s.r[3], s.h, H, M.ceil, groups.ceil);

// ---------- sous toiture : plafonds en rampant, retombées, fenêtres de toit, zone < 1,80 m hachurée au sol
function polyBox(p){ return [Math.min(...p.map(v => v[0])), Math.min(...p.map(v => v[1])), Math.max(...p.map(v => v[0])), Math.max(...p.map(v => v[1]))]; }
const SKY = (ROOF.skylights || []).map(s => s.r || s), LOWCELLS = [];
const inRect = (r, x, z) => x > r[0] && x < r[2] && z > r[1] && z < r[3];
const inRoom = (x, z, ext = false) => GEO.rooms.some(r => (ext || !r.ext) && inPolyG(x, z, r.poly));
function inPolyG(x, z, p){ let c = false; for (let i = 0, j = p.length-1; i < p.length; j = i++){ const [xi,zi] = p[i], [xj,zj] = p[j]; if ((zi > z) !== (zj > z) && x < (xj-xi)*(z-zi)/(zj-zi) + xi) c = !c; } return c; }
if (PANS.length) (function(){
  const hatchT = tex(128, 0.32, (c, S) => { c.clearRect(0,0,S,S); c.strokeStyle = 'rgba(184,106,75,.55)'; c.lineWidth = S*0.09;
    for (let k = -1; k <= 1; k++){ c.beginPath(); c.moveTo(k*S, S); c.lineTo(k*S + S, 0); c.stroke(); } });
  const hatchM = new THREE.MeshBasicMaterial({map:hatchT, transparent:true, depthWrite:false, color:0xffffff});
  const quadY = (c, y, m, parent) => { const g = new THREE.PlaneGeometry(c[2]-c[0], c[3]-c[1]); g.rotateX(-Math.PI/2); g.translate((c[0]+c[2])/2, y, (c[1]+c[3])/2);
    const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), -p.getZ(i)); const me = new THREE.Mesh(g, m); parent.add(me); return me; };
  for (const r of GEO.rooms){
    const bb = polyBox(r.poly); if (!touchesPan(bb)) continue;
    const ex = [...r.poly.map(v => v[0]), ...SKY.flatMap(s => [s[0], s[2]])], ez = [...r.poly.map(v => v[1]), ...SKY.flatMap(s => [s[1], s[3]])];
    for (const c of gridCells(...bb, ex, ez)){
      const cx = (c[0]+c[2])/2, cz = (c[1]+c[3])/2; if (!inPolyG(cx, cz, r.poly)) continue;
      const f = cellFn(c);
      if (!SKY.some(s => inRect(s, cx, cz))) hexa(c, (x,z) => f(x,z) - 0.002, (x,z) => f(x,z) + 0.2, M.ceil, groups.ceil);
      if (!r.ext && f(c[0],c[1]) <= LOWH + 1e-6 && f(c[2],c[3]) <= LOWH + 1e-6 && f(c[0],c[3]) <= LOWH + 1e-6 && f(c[2],c[1]) <= LOWH + 1e-6){
        const h = quadY(c, 0.004, hatchM, groups.walls); h.userData.ao = true; h.renderOrder = 2; LOWCELLS.push(c); }
    }
  }
  // retombées : faces verticales là où deux plafonds voisins n'ont pas la même hauteur (jouée de lucarne, bord de pan)
  const vquad = (a, b, ya0, ya1, yb0, yb1) => { const g = new THREE.BufferGeometry(), P = [a[0],ya0,a[1], b[0],yb0,b[1], b[0],yb1,b[1], a[0],ya0,a[1], b[0],yb1,b[1], a[0],ya1,a[1]];
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(12).fill(0), 2)); g.computeVertexNormals(); groups.ceil.add(new THREE.Mesh(g, M.ceil)); };
  const e = 0.01;
  for (const p of PANS){
    const [x0,z0,x1,z1] = p.r, cuts = gridCells(x0, z0, x1, z1, GEO.rooms.flatMap(r => r.poly.map(v => v[0])), GEO.rooms.flatMap(r => r.poly.map(v => v[1])));
    const xs = [...new Set(cuts.flatMap(c => [c[0], c[2]]))].sort((a,b) => a-b), zs = [...new Set(cuts.flatMap(c => [c[1], c[3]]))].sort((a,b) => a-b);
    const side = (fixed, along, axis, sgn) => { for (let i = 0; i < along.length-1; i++){ const a = along[i], b = along[i+1], m = (a+b)/2;
      const P = (u, s) => axis === 'x' ? [fixed + s*e, u] : [u, fixed + s*e], [mxI, mzI] = P(m, -sgn), [mxO, mzO] = P(m, sgn);
      const po = panAt(mxO, mzO); if (!inRoom(mxI, mzI) || !inRoom(mxO, mzO) || po === p || (po && PANS.indexOf(po) < PANS.indexOf(p))) continue;
      const fo = cellFn([mxO-e, mzO-e, mxO+e, mzO+e]), hi = (u) => { const [x,z] = P(u, 0); return panH(p, x, z); }, ho = (u) => { const [x,z] = P(u, 0); return fo(x, z); };
      if (Math.abs(hi(a) - ho(a)) < 0.005 && Math.abs(hi(b) - ho(b)) < 0.005) continue;
      vquad(P(a, 0), P(b, 0), hi(a), ho(a), hi(b), ho(b)); } };
    side(x0, zs, 'x', -1); side(x1, zs, 'x', 1); side(z0, xs, 'z', -1); side(z1, xs, 'z', 1);
  }
  // fenêtres de toit : embrasure, dormant PVC, vitrage dans le plan du toit (0,28 m au-dessus du plafond)
  for (const s of SKY){
    const f = cellFn(s), d = 0.28, w = 0.065, C = [[s[0],s[1]],[s[2],s[1]],[s[2],s[3]],[s[0],s[3]]];
    for (let i = 0; i < 4; i++){ const a = C[i], b = C[(i+1)%4]; vquad(a, b, f(...a), f(...a) + d, f(...b), f(...b) + d); }
    hexa([s[0], s[1], s[2], s[3]], (x,z) => f(x,z) + d - 0.012, (x,z) => f(x,z) + d - 0.006, M.glass, groups.ceil);
    for (const q of [[s[0], s[1], s[2], s[1]+w], [s[0], s[3]-w, s[2], s[3]], [s[0], s[1], s[0]+w, s[3]], [s[2]-w, s[1], s[2], s[3]]]) hexa(q, (x,z) => f(x,z) + d - 0.05, (x,z) => f(x,z) + d, M.pvc, groups.ceil);
    hexa([(s[0]+s[2])/2 - 0.12, s[1] + w, (s[0]+s[2])/2 + 0.12, s[1] + w + 0.025], (x,z) => f(x,z) + d - 0.075, (x,z) => f(x,z) + d - 0.05, M.dark, groups.ceil);   // barre de manœuvre
  }
})();

// ---------- walls (+ dark section caps seen from above, like the poché of a plan)
for (const w of GEO.walls) solid(w, -0.22, M.wall);

// ---------- windows & openings
function pane(w, y0, y1, glassMat){               // PVC frame along +x from 0 to w, centred on z = 0
  const g = new THREE.Group(), f = 0.06, d = 0.07;
  box(0, -d/2, w, d/2, y0, y0+f, M.pvc, g); box(0, -d/2, w, d/2, y1-f, y1, M.pvc, g);
  box(0, -d/2, f, d/2, y0, y1, M.pvc, g); box(w-f, -d/2, w, d/2, y0, y1, M.pvc, g);
  box(f, -0.01, w-f, 0.01, y0+f, y1-f, glassMat, g); return g;
}
function place(obj, a, b){ const dx = b[0]-a[0], dz = b[1]-a[1]; obj.position.set(a[0], 0, a[1]); obj.rotation.y = -Math.atan2(dz, dx); return Math.hypot(dx, dz); }
for (const o of GEO.openings){
  const [x0,z0,x1,z1] = o.r;
  solid(o.r, o.head, o.imposte ? M.door : M.wall);              // imposte : panneau fixe au-dessus d'une porte basse (sous rampant)
  box(x0, z0, x1, z1, -0.22, o.sill || 0, M.wall);
  for (const p of o.panes || []){ const len = Math.hypot(p.b[0]-p.a[0], p.b[1]-p.a[1]), pg = pane(len, p.y0, p.y1, p.frost ? M.frost : M.glass); place(pg, p.a, p.b); groups.walls.add(pg); }
}
// ---------- doors : tap / click / E to open or close (hinges and swings from the plan)
const doors = [], doorHits = new THREE.Group(), hitMat = new THREE.MeshBasicMaterial({visible:false}); doorHits.visible = false; scene.add(doorHits);
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
for (const d of GEO.doors){
  const pivot = new THREE.Group(); pivot.position.set(d.hinge[0], 0, d.hinge[1]);
  const ac = Math.atan2(d.closed[1]-d.hinge[1], d.closed[0]-d.hinge[0]), ao = Math.atan2(d.open[1]-d.hinge[1], d.open[0]-d.hinge[0]);
  const len = Math.hypot(d.closed[0]-d.hinge[0], d.closed[1]-d.hinge[1]);
  if (d.kind === 'glass') pivot.add(pane(len, 0.02, d.head, M.glass));
  else { box(0, -0.02, len, 0.02, 0.005, d.h ?? 2.02, d.kind === 'entry' ? M.entry : M.door, pivot);
         box(len-0.09, -0.045, len-0.07, 0.045, 0.99, 1.01, M.steel, pivot); }
  groups.walls.add(pivot);
  const dr = {d, pivot, ac, diff: wrapA(ao - ac), len, t: d.isOpen ? 1 : 0, target: d.isOpen ? 1 : 0};
  pivot.traverse(o => { o.userData.door = dr; });
  const hitPanel = new THREE.Mesh(new THREE.BoxGeometry(len, 2.04, 0.3), hitMat); hitPanel.position.set(d.hinge[0] + Math.cos(ac)*len/2, 1.02, d.hinge[1] + Math.sin(ac)*len/2); hitPanel.rotation.y = -ac; hitPanel.userData.door = dr; doorHits.add(hitPanel);
  doors.push(dr);
}
const doorAngle = dr => dr.ac + dr.diff * dr.t;
const setDoorPose = dr => { if (dr.slide){ const s = dr.slide, o = s.dir*s.open*dr.t; if (s.axis === 'z') dr.pivot.position.set(s.plane, 0, s.a + o); else dr.pivot.position.set(s.a + o, 0, s.plane); } else dr.pivot.rotation.y = -doorAngle(dr); };
doors.forEach(setDoorPose);
const becsDoor = GEO.kit.cols ? doors.find(dr => dr.d.id === 'becs') : null; if (becsDoor) becsDoor.pivot.visible = false;
function toggleDoor(dr){ const tgt = dr.target ? 0 : 1; doors.forEach(o => { if (o === dr || (dr.d.pair && o.d.pair === dr.d.pair)) o.target = tgt; }); }
function doorRects(){
  const out = [];
  for (const dr of doors){ if (dr.t > 0.15 || !dr.pivot.visible) continue; if (dr.slide){ out.push(dr.slide.rect); continue; } const a = doorAngle(dr), hx = dr.d.hinge[0], hz = dr.d.hinge[1], ex = hx + Math.cos(a)*dr.len, ez = hz + Math.sin(a)*dr.len;
    out.push([Math.min(hx, ex)-0.03, Math.min(hz, ez)-0.03, Math.max(hx, ex)+0.03, Math.max(hz, ez)+0.03]); }
  return out;
}
// what sits inside the two closets
(function(){
  if (GEO.becs){ const becs = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.75, 28), M.ceramic); becs.position.set(GEO.becs[0], 0.93, GEO.becs[1]); groups.walls.add(becs); }
  if (!GEO.washer) return;
  const w = GEO.washer; box(w[0], w[1], w[2], w[3], 0, 0.85, M.ceramic);
  const port = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 28), M.dark); port.rotation.x = Math.PI/2; port.position.set((w[0]+w[2])/2, 0.5, w[1]-0.005); groups.walls.add(port);
})();

// ---------- balcony: grey metal railing set back from the wooden posts
const railMeshes = [];
for (const r of GEO.rails){
  const alongX = (r[2]-r[0]) > (r[3]-r[1]); const cx = (r[0]+r[2])/2, cz = (r[1]+r[3])/2;
  const a = alongX ? [r[0], cz] : [cx, r[1]], b = alongX ? [r[2], cz] : [cx, r[3]];
  const g = new THREE.Group(); const len = place(g, a, b);
  box(0, -0.025, len, 0.025, 0.98, 1.02, M.rail, g); box(0, -0.015, len, 0.015, 0.08, 0.11, M.rail, g);
  const n = Math.floor(len / 0.11), bars = []; for (let i = 0; i < n; i++) bars.push(new THREE.BoxGeometry(0.018, 0.87, 0.018).translate(0.055 + i*0.11, 0.545, 0));
  g.add(new THREE.Mesh(mergeGeometries(bars), M.rail)); groups.walls.add(g); railMeshes.push(g);
}
for (const p of GEO.posts) box(p[0]-0.04, p[1]-0.06, p[0]+0.04, p[1]+0.06, 0, H, M.post);
// séparatifs de balcon en lames de bois (hauteur par défaut 1,80 m)
(function(){
  const wood = mat(0xa9805a, {roughness:.8}), frame = mat(0x6f5a46, {roughness:.7});
  for (const sc of GEO.screens || []){
    const [x0, z0, x1, z1] = sc.r, h = sc.h ?? 1.8, alongX = (x1-x0) >= (z1-z0), L = alongX ? x1-x0 : z1-z0;
    for (let y = 0.06; y < h - 0.04; y += 0.12) box(x0, z0, x1, z1, y, y + 0.09, wood);
    for (const u of [0, L - 0.05]) alongX ? box(x0+u, z0, x0+u+0.05, z1, 0, h, frame) : box(x0, z0+u, x1, z0+u+0.05, 0, h, frame);
  }
})();

// ---------- kitchen (option Teisseire) : façades sauge, plan chêne, linéaires relevés sur le plan
const edgeOf = (r, s, d) => { const [x0,z0,x1,z1] = r; return s === 'w' ? [x0,z0,x0+d,z1] : s === 'e' ? [x1-d,z0,x1,z1] : s === 'n' ? [x0,z0,x1,z0+d] : [x0,z1-d,x1,z1]; };
const OPP = {w:'e', e:'w', n:'s', s:'n'};
(function(){
  const k = GEO.kit, g0 = groups.kitchen, gA = new THREE.Group(), gB = new THREE.Group(); g0.add(gA, gB); groups.kitA = gA; groups.kitB = gB;
  const grp = lay => lay === 'A' ? gA : lay === 'B' ? gB : g0;     // 'A' = plan d'origine, 'B' = variante, rien = commun
  const shift = (r, s, d) => { const q = r.slice(); if (s === 'w') q[0] += d; else if (s === 'e') q[2] -= d; else if (s === 'n') q[1] += d; else q[3] -= d; return q; };
  const B = (r, y0, y1, m, g = g0) => box(r[0], r[1], r[2], r[3], y0, y1, m, g);
  for (const run of k.runs){
    const g = grp(run.layout), r = run.r, fr = OPP[run.wall], alongZ = run.wall === 'w' || run.wall === 'e';
    B(shift(r, fr, 0.05), 0, 0.1, M.plinth, g); B(r, 0.1, 0.87, M.kfront, g); B(shift(r, fr, -0.02), 0.87, 0.9, M.oak, g);
    const L = alongZ ? r[3]-r[1] : r[2]-r[0], s0 = alongZ ? r[1] : r[0], fz = fr === 'e' ? r[2] : fr === 'w' ? r[0] : fr === 's' ? r[3] : r[1];
    for (let u = 0.6; u < L - 0.1; u += 0.6){ const p = s0 + u; if (alongZ) box(fz-0.002, p-0.002, fz+0.002, p+0.002, 0.12, 0.85, M.plinth, g); else box(p-0.002, fz-0.002, p+0.002, fz+0.002, 0.12, 0.85, M.plinth, g); }
    B(edgeOf(r, run.wall, 0.01), 0.9, 1.45, M.faience, g);
    if (run.upper) B(edgeOf(r, run.wall, 0.35), 1.45, 2.15, M.kfront, g);
  }
  for (const u of k.upper || []) B(u, 1.45, 2.15, M.kfront);
  for (const q of k.tall || []){ const r = q.r || q; box(r[0]+0.02, r[1]+0.02, r[2]-0.02, r[3]-0.02, 0, 1.85, M.steel, grp(q.layout)); }
  B(k.hob, 0.9, 0.906, M.dark); B(k.sink, 0.9, 0.904, M.steel);
  const tp = edgeOf(k.sink, k.sinkWall || 'w', 0.03), tx = (tp[0]+tp[2])/2, tz = (tp[1]+tp[3])/2; box(tx-0.015, tz-0.015, tx+0.015, tz+0.015, 0.9, 1.2, M.steel, g0);
  if (k.hood){ const [y0, y1] = k.hoodY || [1.5, 1.58]; B(k.hood, y0, y1, M.steel); }
  if (k.cols){
    // mur de colonnes sous la soffite (variante B) : réfrigérateur · four + micro-ondes · accès au ballon thermodynamique
    const g = gB, [cx0, cz0, cx1, cz1] = k.cols, top = (k.colsTop ?? GEO.soffitH) - 0.004, f = cx0 - 0.004, [s1, s2] = k.splits;
    box(cx0+0.05, cz0, cx1, cz1, 0, 0.1, M.plinth, g); box(cx0, cz0, cx1, cz1, 0.1, top, M.kfront, g);
    const joint = (za, zb, y0, y1) => box(f, za, cx0, zb, y0, y1, M.plinth, g), hj = (za, zb, y) => joint(za, zb, y-0.003, y+0.003);
    [s1, s2].forEach(z => joint(z-0.003, z+0.003, 0.1, top)); hj(cz0, s1, 1.3); hj(cz0, s2, 1.97); hj(s1, s2, 0.5);
    box(f-0.003, s1+0.03, cx0, s2-0.03, 0.86, 1.46, M.dark, g); box(f-0.003, s1+0.05, cx0, s2-0.05, 1.53, 1.9, M.dark, g);
    for (let y = 2.03; y < 2.2; y += 0.035) box(f-0.003, s2+0.1, cx0, cz1-0.1, y, y+0.014, M.plinth, g);
    [[s1-0.08, s1-0.06, 0.6, 1.2], [s1-0.08, s1-0.06, 1.45, 1.85], [s2+0.06, s2+0.08, 0.7, 1.7], [s1+0.1, s2-0.1, 0.4, 0.42]].forEach(([a,b,y0,y1]) => box(f-0.028, a, f-0.006, b, y0, y1, M.steel, g));
  }
})();

// ---------- bathroom & WC
(function(){
  const b = GEO.bath, g = groups.walls;
  const wallPlane = (a, bb, n, y0, y1, m) => { const w = Math.hypot(bb[0]-a[0], bb[1]-a[1]), p = new THREE.Mesh(new THREE.PlaneGeometry(w, y1-y0), m);
    p.position.set((a[0]+bb[0])/2 + n[0]*0.003, (y0+y1)/2, (a[1]+bb[1])/2 + n[1]*0.003); p.rotation.y = Math.atan2(n[0], n[1]);
    const uv = p.geometry.attributes.uv, ps = p.geometry.attributes.position, ya = Math.min(y1, ceilAt(a[0] + n[0]*0.05, a[1] + n[1]*0.05)), yb2 = Math.min(y1, ceilAt(bb[0] + n[0]*0.05, bb[1] + n[1]*0.05));
    const toB = n[1]*(bb[0]-a[0]) - n[0]*(bb[1]-a[1]) > 0;          // le +x local de la plaque pointe vers b ?
    for (let i = 0; i < uv.count; i++){ if (ps.getY(i) > 0){ const t = (uv.getX(i) > 0.5) === toB ? yb2 : ya; ps.setY(i, t - (y0+y1)/2); uv.setY(i, (t - y0)/(y1 - y0)); } }
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i)*w, uv.getY(i)*(y1-y0)); g.add(p); return p; };
  if (b.wc){ const r = b.wc.r, bk = b.wc.back; box(...edgeOf(r, bk, 0.17), 0, 0.82, M.ceramic, g);
    const alongX = bk === 'w' || bk === 'e', cx = (r[0]+r[2])/2, cz = (r[1]+r[3])/2, o = 0.09;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.16, 0.4, 20), M.ceramic);
    if (alongX){ bowl.scale.x = 1.3; bowl.position.set(cx + (bk === 'w' ? o : -o), 0.2, cz); } else { bowl.scale.z = 1.3; bowl.position.set(cx, 0.2, cz + (bk === 'n' ? o : -o)); }
    g.add(bowl); }
  if (b.tub){ const r = b.tub; box(r[0],r[1],r[2],r[3], 0, 0.56, M.ceramic, g); box(r[0]+0.07,r[1]+0.07,r[2]-0.07,r[3]-0.07, 0.22, 0.562, M.tubIn, g);
    box(r[0]+0.005, (r[1]+r[3])/2-0.04, r[0]+0.09, (r[1]+r[3])/2+0.04, 0.64, 0.7, M.steel, g); }
  if (b.shower){ const q = b.shower; box(q.r[0], q.r[1], q.r[2], q.r[3], 0, 0.04, M.ceramic, g);
    if (q.screen) box(q.screen[0], q.screen[1], q.screen[2], q.screen[3], 0.04, 2.0, M.glass, g);
    if (q.bar) box(q.bar[0], q.bar[1], q.bar[2], q.bar[3], 0.9, 1.95, M.steel, g); }
  if (b.vanity){ const v = b.vanity, r = v.r; box(r[0],r[1],r[2],r[3], 0.12, 0.82, M.front, g); box(r[0],r[1],r[2],r[3], 0.82, 0.86, M.ceramic, g);
    for (const [x,z] of v.basins || []){ const bs = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.012, 28), M.basin); bs.scale.set(1, 1, 0.75); bs.position.set(x, 0.862, z); g.add(bs);
      const f = edgeOf([x-0.02, z-0.02, x+0.02, z+0.02], v.back, 0.04), wz = edgeOf(r, v.back, 0.05); const fx = v.back === 'n' || v.back === 's' ? x : (wz[0]+wz[2])/2, fzz = v.back === 'n' || v.back === 's' ? (wz[1]+wz[3])/2 : z;
      box(fx-0.015, fzz-0.015, fx+0.015, fzz+0.015, 0.86, 1.02, M.steel, g); } }
  if (b.washer){ const r = b.washer.r, fr = b.washer.front; box(r[0],r[1],r[2],r[3], 0, 0.85, M.ceramic, g);
    const port = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 28), M.dark), cx = (r[0]+r[2])/2, cz = (r[1]+r[3])/2;
    if (fr === 'n' || fr === 's'){ port.rotation.x = Math.PI/2; port.position.set(cx, 0.5, fr === 'n' ? r[1]-0.005 : r[3]+0.005); } else { port.rotation.z = Math.PI/2; port.position.set(fr === 'w' ? r[0]-0.005 : r[2]+0.005, 0.5, cz); }
    g.add(port); }
  for (const tl of b.tiles || []) wallPlane(tl.a, tl.b, tl.n, 0, H, M.faience);
  for (const q of b.murets || []) box(q.r[0], q.r[1], q.r[2], q.r[3], 0, q.h, M.faience, g);      // muret faïencé (ex. 0,70 m dans la douche)
  if (b.mirror) wallPlane(b.mirror.a, b.mirror.b, b.mirror.n, b.mirror.y0, b.mirror.y1, M.mirror);
})();

// ---------- furniture : esprit bord de mer bohème (rotin, cannage, lin, jute, bois clair), cotes standard
const FX = { lamps:[], glow:[], ao:[] };
(function(){
  let g = groups.furn, curLay = null; const gA = new THREE.Group(), gB = new THREE.Group(); g.add(gA, gB); groups.furnA = gA; groups.furnB = gB;
  let worldR = null; const aoPush = r => FX.ao.push({r: worldR || r, lay: curLay});
  const ANG = {e:0, s:-Math.PI/2, w:Math.PI, n:Math.PI/2}, BASEDIR = {bed:'e', wardrobe:'n', sofa:'w', tvunit:'w', lounger:'e', towel:'w'};
  const linenT = tex(256, 0.25, (c, S) => { c.fillStyle = '#ededed'; c.fillRect(0,0,S,S);
    for (let i = 0; i < S; i += 2){ c.fillStyle = `rgba(0,0,0,${0.025+rnd()*0.05})`; c.fillRect(0,i,S,1); c.fillStyle = `rgba(255,255,255,${0.05+rnd()*0.07})`; c.fillRect(i,0,1,S); } });
  const caneT = tex(256, 0.1, (c, S) => { c.clearRect(0,0,S,S); c.strokeStyle = '#cfa86e'; c.lineCap = 'round'; c.lineWidth = S*0.045; const n = 4, st = S/n;
    for (let i = -n; i <= 2*n; i++){ [[i*st,0,i*st,S],[0,i*st,S,i*st],[i*st,0,i*st+S,S],[i*st,0,i*st-S,S]].forEach(([a,b,c2,d]) => { c.beginPath(); c.moveTo(a,b); c.lineTo(c2,d); c.stroke(); }); } });
  const rattanT = tex(256, 0.14, (c, S) => { c.fillStyle = '#b8894f'; c.fillRect(0,0,S,S);
    for (let y = 0; y < S; y += 16) for (let x = 0; x < S; x += 32){ c.fillStyle = `hsl(33,${42+rnd()*10}%,${58+rnd()*8}%)`; c.fillRect(x + ((y/16)%2)*16, y+1, 30, 14); } });
  const weaveT = tex(256, 0.14, (c, S) => { c.clearRect(0,0,S,S); c.fillStyle = '#c8a06a';
    for (let y = 0; y < S; y += 20) c.fillRect(0, y, S, 11); for (let x = 0; x < S; x += 28) c.fillRect(x, 0, 5, S); });
  const juteT = tex(256, 0.3, (c, S) => { c.fillStyle = '#b89a70'; c.fillRect(0,0,S,S);
    for (let y = 0; y < S; y += 8) for (let x = 0; x < S; x += 8){ const v = (x/8 + y/8) % 2; c.fillStyle = v ? 'rgba(255,240,210,.2)' : 'rgba(60,40,20,.16)'; c.beginPath(); c.ellipse(x+4, y+4, 4.3, 2.4, v ? 0.7 : -0.7, 0, 7); c.fill(); } });
  const stripeT = tex(256, 0.5, (c, S) => { for (let i = 0; i < 8; i++){ c.fillStyle = i % 2 ? '#3f6b80' : '#efe7d8'; c.fillRect(i*S/8, 0, S/8, S); } });
  const frondT = tex(256, 1, (c, S) => { c.clearRect(0,0,S,S); c.strokeStyle = '#4f6e3f'; c.lineWidth = 5; c.beginPath(); c.moveTo(S/2, S); c.lineTo(S/2, 8); c.stroke();
    c.lineWidth = 3; for (let y = 16; y < S-10; y += 9){ const l = (S*0.46) * Math.sin(Math.PI * (S - y)/S) + 10; c.strokeStyle = y % 2 ? '#5d7e48' : '#4b6b3c';
      c.beginPath(); c.moveTo(S/2, y); c.lineTo(S/2 - l, y + l*0.55); c.moveTo(S/2, y); c.lineTo(S/2 + l, y + l*0.55); c.stroke(); } });
  frondT.repeat.set(1, 1);
  const artT = motif => { const t = tex(512, 1, (c, S) => {
    if (motif === 'sea'){ c.fillStyle = '#efe6d6'; c.fillRect(0,0,S,S); c.fillStyle = '#c0694a'; c.beginPath(); c.arc(S*0.64, S*0.38, S*0.16, 0, 7); c.fill();
      [['#8fa487',0.6],['#3f6b80',0.72],['#d6c3a0',0.84]].forEach(([col,y]) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, S*y); for (let x = 0; x <= S; x += 8) c.lineTo(x, S*y + Math.sin(x/S*Math.PI*3 + y*9)*S*0.025); c.lineTo(S, S); c.lineTo(0, S); c.fill(); }); }
    else { c.fillStyle = '#f1e9dc'; c.fillRect(0,0,S,S); [['#d9c09a',0.45,0.8],['#c9965a',0.62,1.3],['#a8623f',0.8,0.9]].forEach(([col,y,f]) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, S);
      for (let x = 0; x <= S; x += 8) c.lineTo(x, S*y - Math.sin(x/S*Math.PI*f + y*5)*S*0.08); c.lineTo(S, S); c.fill(); }); c.fillStyle = '#2f3a3a'; c.fillRect(S*0.1, S*0.18, S*0.8, 2); }
  }); t.repeat.set(1, 1); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };

  const FM = {
    ecru: mat(0xe7dfcf,{map:linenT, roughness:.95}), sauge: mat(0x9dad8f,{map:linenT, roughness:.95}), terra: mat(0xb86a4b,{map:linenT, roughness:.95}),
    ocre: mat(0xc9994f,{map:linenT, roughness:.95}), sheet: mat(0xf6f3ec,{map:linenT, roughness:.95}),
    oak: mat(0xc8a47c,{roughness:.6}), teak: mat(0xa4764e,{roughness:.6}), black: mat(0x242424,{roughness:.5}),
    cane: mat(0xffffff,{map:caneT, alphaTest:.5, side:THREE.DoubleSide, roughness:.8}), rattan: mat(0xffffff,{map:rattanT, roughness:.85}),
    weave: mat(0xffffff,{map:weaveT, alphaTest:.5, side:THREE.DoubleSide, roughness:.85}), jute: mat(0xffffff,{map:juteT, roughness:1}),
    juteDark: mat(0x8f7652,{roughness:1}), stripe: mat(0xffffff,{map:stripeT, roughness:1}), frond: mat(0xffffff,{map:frondT, alphaTest:.45, side:THREE.DoubleSide, roughness:.7}),
    terracotta: mat(0xb5673f,{roughness:.9}), glaze: mat(0xc8784f,{roughness:.35}), olive: mat(0x7f8d68,{roughness:.9}), olive2: mat(0x93a07a,{roughness:.9}),
    screen: mat(0x0b0c0d,{roughness:.15, metalness:.2}), cushion: mat(0xefe8da,{map:linenT, roughness:.95}),
    shade: mat(0xf1e8d8,{map:linenT, side:THREE.DoubleSide, emissive:0xffc98a, emissiveIntensity:0}), bulb: mat(0xfff1d6,{emissive:0xffd7a0, emissiveIntensity:0})
  };
  FX.glow.push(FM.shade, FM.bulb);
  const rb = (x0,z0,x1,z1,y0,y1,m,par=g,r=0.04) => { const w = x1-x0, d = z1-z0, h = y1-y0; const rr = Math.max(0.002, Math.min(r, w/2-0.001, d/2-0.001, h/2-0.001));
    const me = new THREE.Mesh(new THREE.RoundedBoxGeometry(w, h, d, 3, rr), m); me.position.set((x0+x1)/2, (y0+y1)/2, (z0+z1)/2); par.add(me); return me; };
  const cy = (x,z,y0,y1,rBot,rTop,m,par=g,seg=24,open=false) => { const me = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, y1-y0, seg, 1, open), m); me.position.set(x, (y0+y1)/2, z); par.add(me); return me; };
  const pl = (w,h,m,x,y,z,ry,par=g) => { const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); me.position.set(x,y,z); me.rotation.y = ry; par.add(me); return me; };
  const lamp = (x,y,z) => FX.lamps.push([x,y,z,curLay]);
  const pegs = (x0,z0,x1,z1,h,m,par=g,r=0.02,inset=0.06) => { for (const [x,z] of [[x0+inset,z0+inset],[x1-inset,z0+inset],[x0+inset,z1-inset],[x1-inset,z1-inset]]) cy(x,z,0,h,r*0.8,r,m,par,10); };

  for (const f of GEO.furn){
    let r = f.r; curLay = f.layout || null; g = curLay === 'A' ? gA : curLay === 'B' ? gB : groups.furn; worldR = null;
    if (f.dir && r && f.dir !== (BASEDIR[f.t] || 'e')){ const th = ANG[f.dir] - ANG[BASEDIR[f.t] || 'e'], [x0,z0,x1,z1] = r, dx = x1-x0, dz = z1-z0, sw = Math.abs(Math.sin(th)) > 0.5;
      const G = new THREE.Group(); G.position.set((x0+x1)/2, 0, (z0+z1)/2); G.rotation.y = th; g.add(G); g = G; worldR = r;
      r = sw ? [-dz/2, -dx/2, dz/2, dx/2] : [-dx/2, -dz/2, dx/2, dz/2]; }
    switch (f.t){
      case 'rug': { const [x0,z0,x1,z1] = r; box(x0,z0,x1,z1,0.003,0.013,FM.jute,g); const b = 0.07;
        [[x0,z0,x1,z0+b],[x0,z1-b,x1,z1],[x0,z0,x0+b,z1],[x1-b,z0,x1,z1]].forEach(q => box(q[0],q[1],q[2],q[3],0.003,0.0135,FM.juteDark,g)); break; }
      case 'sofa': { const [x0,z0,x1,z1] = r; pegs(x0,z0,x1,z1,0.12,FM.teak,g,0.025,0.09);
        rb(x0,z0,x1,z1,0.12,0.4,FM.ecru,g,0.06); rb(x0,z0,x0+0.2,z1,0.36,0.84,FM.ecru,g,0.08);
        rb(x0+0.02,z0,x1,z0+0.16,0.36,0.64,FM.ecru,g,0.07); rb(x0+0.02,z1-0.16,x1,z1,0.36,0.64,FM.ecru,g,0.07);
        const L = (z1-z0-0.32)/3;
        for (let i = 0; i < 3; i++){ const a = z0+0.16+i*L, b = a+L; rb(x0+0.2,a+0.005,x1-0.01,b-0.005,0.4,0.54,FM.ecru,g,0.05);
          const bc = rb(x0+0.19,a+0.01,x0+0.36,b-0.01,0.5,0.86,FM.ecru,g,0.06); bc.rotation.z = 0.12; }
        const c1 = rb(x0+0.3,z0+0.2,x0+0.45,z0+0.62,0.52,0.92,FM.terra,g,0.06); c1.rotation.z = 0.22;
        const c2 = rb(x0+0.3,z1-0.62,x0+0.45,z1-0.2,0.52,0.92,FM.ocre,g,0.06); c2.rotation.z = 0.22;
        rb(x0+0.25,z1-0.17,x1+0.01,z1+0.01,0.64,0.66,FM.sauge,g,0.008); rb(x1-0.005,z1-0.16,x1+0.012,z1-0.03,0.2,0.66,FM.sauge,g,0.005);
        aoPush(r); break; }
      case 'coffee': { const [x,z] = f.c; cy(x,z,0.38,0.42,f.rad,f.rad,FM.teak,g,48);
        for (let k = 0; k < 3; k++){ const a = k*2.094 + 0.4; cy(x+Math.cos(a)*f.rad*0.62, z+Math.sin(a)*f.rad*0.62, 0, 0.38, 0.018, 0.024, FM.teak, g, 10); }
        cy(x+0.14,z-0.1,0.42,0.66,0.07,0.045,FM.terracotta,g,20); rb(x-0.22,z+0.02,x+0.06,z+0.22,0.42,0.455,FM.sauge,g,0.004); rb(x-0.2,z+0.04,x+0.04,z+0.2,0.455,0.48,FM.ecru,g,0.004);
        aoPush([x-f.rad,z-f.rad,x+f.rad,z+f.rad]); break; }
      case 'floorlamp': { const [x,z] = f.c; cy(x,z,0,0.03,0.15,0.15,FM.oak,g,24); cy(x,z,0.03,1.42,0.014,0.014,FM.oak,g,8);
        cy(x,z,1.36,1.66,0.23,0.19,FM.shade,g,32,true); const b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), FM.bulb); b.position.set(x,1.46,z); g.add(b); lamp(x,1.45,z); break; }
      case 'tvunit': { const [x0,z0,x1,z1] = r; pegs(x0,z0,x1,z1,0.1,FM.teak,g,0.02,0.05); rb(x0,z0,x1,z1,0.1,0.52,FM.oak,g,0.015);
        const w = (z1-z0)/2 - 0.03; [z0 + (z1-z0)/4, z0 + 3*(z1-z0)/4].forEach(zc => { box(x0-0.004,zc-w/2,x0,zc+w/2,0.14,0.48,FM.black,g); pl(w-0.04,0.3,FM.cane,x0-0.006,0.31,zc,-Math.PI/2); });
        const zc = (z0+z1)/2, xc = x0+0.16; box(xc-0.02,zc-0.72,xc+0.01,zc+0.72,0.64,1.47,FM.screen,g); box(xc-0.02,zc-0.12,xc+0.02,zc+0.12,0.52,0.64,FM.black,g);
        cy(x0+0.17,z1-0.12,0.52,0.74,0.07,0.05,FM.glaze,g,20); aoPush(r); break; }
      case 'round': { const [x,z] = f.c, h = f.h || 0.75, m = f.wood === 'teak' ? FM.teak : FM.oak; cy(x,z,h-0.035,h,f.rad,f.rad,m,g,48);
        cy(x,z,0.03,h-0.035,0.07,0.05,m,g,20); cy(x,z,0,0.03,0.27,0.28,m,g,32); aoPush([x-f.rad,z-f.rad,x+f.rad,z+f.rad]); break; }
      case 'chair': { const [x,z] = f.c, ch = new THREE.Group(), m = FM.teak;
        for (const [a,b] of [[-0.19,-0.19],[0.19,-0.19],[-0.19,0.19],[0.19,0.19]]) cy(a,b,0,0.44,0.014,0.019,m,ch,10);
        rb(-0.22,-0.22,0.22,0.22,0.43,0.47,m,ch,0.015);
        if (f.plain){ rb(-0.22,0.17,0.22,0.21,0.47,0.84,m,ch,0.012); }
        else { const s = pl(0.36,0.36,FM.cane,0,0.472,0,0,ch); s.rotation.x = -Math.PI/2;
          cy(-0.2,0.2,0.47,0.88,0.017,0.017,m,ch,10); cy(0.2,0.2,0.47,0.88,0.017,0.017,m,ch,10); rb(-0.22,0.18,0.22,0.22,0.82,0.9,m,ch,0.012); pl(0.37,0.3,FM.cane,0,0.66,0.2,0,ch); }
        ch.position.set(x,0,z); ch.rotation.y = Math.atan2(-(f.face[0]-x), -(f.face[1]-z)); g.add(ch); aoPush([x-0.25,z-0.25,x+0.25,z+0.25]); break; }
      case 'pendant': { const [x,z] = f.c; cy(x,z,1.95,2.5,0.004,0.004,FM.black,g,6);
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.27, 32, 16), FM.weave); s.scale.y = 0.72; s.position.set(x,1.78,z); g.add(s);
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), FM.bulb); b.position.set(x,1.8,z); g.add(b); lamp(x,1.7,z); break; }
      case 'table': { const [x0,z0,x1,z1] = r; rb(x0,z0,x1,z1,0.72,0.755,FM.oak,g,0.01); pegs(x0,z0,x1,z1,0.72,FM.oak,g,0.025,0.06);
        if (f.laptop){ const xm = (x0+x1)/2, zm = z1-0.32; rb(xm-0.12,zm-0.17,xm+0.12,zm+0.17,0.755,0.772,FM.black,g,0.006); const s = rb(xm+0.12,zm-0.17,xm+0.135,zm+0.17,0.772,0.99,FM.black,g,0.004); s.rotation.z = 0.2; }
        cy((x0+x1)/2, z0+0.28, 0.755, 0.95, 0.06, 0.045, FM.terracotta, g, 16); aoPush(r); break; }
      case 'desk': { const [x0,z0,x1,z1] = r; rb(x0,z0,x1,z1,0.72,0.755,FM.oak,g,0.01);
        for (const [a,b] of [[x0+0.05,z0+0.05],[x1-0.05,z0+0.05],[x0+0.05,z1-0.05],[x1-0.05,z1-0.05]]) cy(a,b,0,0.72,0.008,0.008,FM.black,g,6);
        const xm = (x0+x1)/2; rb(xm-0.17,z0+0.14,xm+0.17,z0+0.38,0.755,0.772,FM.black,g,0.006); const scr = rb(xm-0.17,z0+0.12,xm+0.17,z0+0.135,0.772,0.99,FM.black,g,0.004); scr.rotation.x = -0.2;
        cy(x1-0.12,z0+0.12,0.755,0.9,0.06,0.05,FM.terracotta,g,16); const lf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1,1), FM.olive); lf.position.set(x1-0.12,0.98,z0+0.12); g.add(lf);
        aoPush(r); break; }
      case 'palm': { const [x,z] = f.c; cy(x,z,0,0.42,0.19,0.23,FM.rattan,g,28); cy(x,z,0.4,0.41,0.2,0.2,FM.juteDark,g,28);
        seed = 11; for (let k = 0; k < 11; k++){ const geo = new THREE.PlaneGeometry(0.42, 1.0); geo.translate(0, 0.5, 0); const fr = new THREE.Mesh(geo, FM.frond);
          fr.position.set(x + (rnd()-.5)*0.08, 0.42 + rnd()*0.35, z + (rnd()-.5)*0.08); fr.rotation.set(0, k*2.4 + rnd(), 0); fr.rotateX(0.35 + rnd()*0.55); fr.scale.setScalar(0.8 + rnd()*0.6); g.add(fr); }
        aoPush([x-0.25,z-0.25,x+0.25,z+0.25]); break; }
      case 'olive': { const [x,z] = f.c; cy(x,z,0,0.45,0.15,0.21,FM.terracotta,g,24); cy(x,z,0.45,1.05,0.025,0.02,FM.teak,g,8);
        seed = 5; for (let k = 0; k < 7; k++){ const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 + rnd()*0.08, 1), k % 2 ? FM.olive : FM.olive2); b.position.set(x + (rnd()-.5)*0.4, 1.05 + rnd()*0.35, z + (rnd()-.5)*0.4); g.add(b); }
        aoPush([x-0.22,z-0.22,x+0.22,z+0.22]); break; }
      case 'art': { const par = new THREE.Group(); rb(-f.w/2-0.03,-0.02,f.w/2+0.03,0.0,-f.h/2-0.03,f.h/2+0.03,FM.oak,par,0.006);
        const p = new THREE.Mesh(new THREE.PlaneGeometry(f.w, f.h), mat(0xffffff,{map:artT(f.motif), roughness:.9})); p.position.z = 0.002; par.add(p);
        par.position.set(f.pos[0], f.pos[1], f.pos[2]); par.rotation.y = f.ry; g.add(par); break; }
      case 'bed': { const [x0,z0,x1,z1] = r; pegs(x0,z0,x1,z1,0.1,FM.oak,g,0.03,0.08); rb(x0,z0,x1,z1,0.1,0.3,FM.oak,g,0.02);
        rb(x0+0.02,z0+0.02,x1-0.03,z1-0.02,0.3,0.52,FM.sheet,g,0.06); rb(x0-0.02,z0-0.03,x1-0.55,z1+0.03,0.38,0.6,FM.terra,g,0.07);
        rb(x0-0.03,z0-0.05,x0+0.38,z1+0.05,0.6,0.635,FM.ocre,g,0.02);
        rb(x1-0.5,z0+0.12,x1-0.08,z0+0.77,0.52,0.7,FM.sheet,g,0.07); rb(x1-0.5,z1-0.77,x1-0.08,z1-0.12,0.52,0.7,FM.sheet,g,0.07);
        const p1 = rb(x1-0.62,z0+0.3,x1-0.48,z0+0.72,0.56,0.9,FM.sauge,g,0.06); p1.rotation.z = -0.28; const p2 = rb(x1-0.62,z1-0.72,x1-0.48,z1-0.3,0.56,0.9,FM.sauge,g,0.06); p2.rotation.z = -0.28;
        rb(x1-0.05,z0-0.06,x1,z1+0.06,1.08,1.16,FM.teak,g,0.015); rb(x1-0.05,z0-0.06,x1,z1+0.06,0.3,0.4,FM.teak,g,0.015);
        rb(x1-0.05,z0-0.06,x1,z0,0.1,1.16,FM.teak,g,0.012); rb(x1-0.05,z1,x1,z1+0.06,0.1,1.16,FM.teak,g,0.012);
        pl(z1-z0, 0.68, FM.cane, x1-0.025, 0.74, (z0+z1)/2, -Math.PI/2); aoPush([x0-0.05,z0-0.05,x1,z1+0.05]); break; }
      case 'night': { const [x,z] = f.c; cy(x,z,0,0.5,f.rad,f.rad,FM.rattan,g,28); cy(x,z,0.5,0.53,f.rad+0.02,f.rad+0.02,FM.oak,g,28);
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), FM.glaze); b.position.set(x,0.62,z); g.add(b); cy(x,z,0.7,0.73,0.012,0.012,FM.black,g,6);
        cy(x,z,0.73,0.9,0.14,0.1,FM.shade,g,28,true); lamp(x,0.82,z); aoPush([x-f.rad,z-f.rad,x+f.rad,z+f.rad]); break; }
      case 'wardrobe': { const [x0,z0,x1,z1] = r; rb(x0,z0,x1,z1,0,2.2,FM.oak,g,0.012); const n = 4, dw = (x1-x0)/n;
        for (let i = 0; i < n; i++){ const a = x0 + i*dw; if (i > 0) box(a-0.003,z0-0.004,a+0.003,z0,0.03,2.17,FM.black,g);
          if (i === 1 || i === 2) pl(dw-0.12, 1.85, FM.cane, a + dw/2, 1.12, z0-0.006, Math.PI);
          const k = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), FM.black); k.position.set(a + (i % 2 ? 0.06 : dw-0.06), 1.05, z0-0.02); g.add(k); }
        aoPush(r); break; }
      case 'towel': { const [x0,z0,x1,z1] = r; for (let y = 0.35; y < 1.5; y += 0.09) box(x0+0.02,z0,x1,z1,y,y+0.025,M.ceramic,g);
        box(x0+0.02,z0,x1,z0+0.03,0.3,1.52,M.ceramic,g); box(x0+0.02,z1-0.03,x1,z1,0.3,1.52,M.ceramic,g); rb(x1,z0+0.08,x1+0.035,z1-0.08,0.85,1.38,FM.terra,g,0.012); break; }
      case 'bathmat': box(r[0],r[1],r[2],r[3],0,0.012,FM.cushion,g); break;
      case 'outrug': box(r[0],r[1],r[2],r[3],0.002,0.01,FM.stripe,g); break;
      case 'lounger': { const [x0,z0,x1,z1] = r; pegs(x0,z0,x1,z1,0.28,FM.teak,g,0.022,0.05); rb(x0,z0,x1-0.55,z1,0.28,0.33,FM.teak,g,0.01); rb(x0+0.03,z0+0.03,x1-0.58,z1-0.03,0.33,0.4,FM.cushion,g,0.03);
        const bk = rb(0,0,0.64,z1-z0,0,0.05,FM.teak,g,0.01); bk.position.set(x1-0.3,0.52,(z0+z1)/2); bk.rotation.z = 0.7; aoPush(r); break; }
      case 'garland': { const [ax,az] = f.a, [bx,bz] = f.b, alongX = Math.abs(bx-ax) > Math.abs(bz-az), n = 34, geo = new THREE.SphereGeometry(0.03, 10, 8), parts = [], span = f.spans;
        for (let i = 0; i < n; i++){ const s = alongX ? ax + (bx-ax)*i/(n-1) : az + (bz-az)*i/(n-1); let k = 0; while (k < span.length-2 && s > span[k+1]) k++;
          const tt = Math.min(1, Math.max(0, (s - span[k]) / (span[k+1] - span[k]))), y = 2.36 - Math.sin(Math.PI*tt)*0.16;
          parts.push(geo.clone().translate(alongX ? s : ax - 0.03, y, alongX ? az + 0.03 : s)); }
        g.add(new THREE.Mesh(mergeGeometries(parts), FM.bulb)); break; }
    }
  }
})();

// ---------- surroundings: ground two floors below, maritime pines to the north
(function(){
  const g = groups.world;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), M.ground); ground.rotation.x = -Math.PI/2; ground.position.set(GEO.center[0], GROUND, GEO.center[1]); g.add(ground);
  for (const b of GEO.mass){ box(b[0], b[1], b[2], b[3], GROUND, b[4] ?? TOP, M.slab, g);   // 5e valeur : hauteur au-dessus du plancher (bâtiment voisin)
    if (b[4] === undefined) box(b[0], b[1], b[2], b[3], TOP, ROOFH, SHADOW_M, shadowOnly); }   // étages du dessus : ombre portée seulement
  const N = 190, trunkG = new THREE.CylinderGeometry(0.16, 0.26, 1, 7), crownG = new THREE.IcosahedronGeometry(1, 0);
  const gT = [], g1 = [], g2 = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  seed = 42;
  for (let i = 0; i < N; i++){
    const FO = GEO.forest, NV = FO.dir || GEO.north || [0,-1], EV = [-NV[1], NV[0]];  /* FO.dir : côté de la forêt, nord par défaut */ let d, l; if (i < 160){ d = FO.d0 + rnd()*(FO.d1-FO.d0); l = FO.lat0 + rnd()*(FO.lat1-FO.lat0); } else { d = -30 + rnd()*40; l = -(16 + rnd()*30); }
    const x = FO.origin[0] + NV[0]*d + EV[0]*l, z = FO.origin[1] + NV[1]*d + EV[1]*l;
    const h = 13 + rnd()*7, r = 2.2 + rnd()*1.6;
    ps.set(x, GROUND + h/2, z); sc.set(1, h, 1); q.set(0,0,0,1); m4.compose(ps, q, sc); gT.push(trunkG.clone().applyMatrix4(m4));
    e.set(rnd(), rnd()*3, rnd()); q.setFromEuler(e);
    ps.set(x, GROUND + h - 0.2, z); sc.set(r, r*0.55, r*0.9); m4.compose(ps, q, sc); g1.push(crownG.clone().applyMatrix4(m4));
    ps.set(x + rnd()*1.6 - .8, GROUND + h - 1.6, z + rnd()*1.6 - .8); sc.set(r*.8, r*.45, r*.75); m4.compose(ps, q, sc); g2.push(crownG.clone().applyMatrix4(m4));
  }
  TREES.push(new THREE.Mesh(mergeGeometries(gT), M.trunk), new THREE.Mesh(mergeGeometries(g1), M.crown), new THREE.Mesh(mergeGeometries(g2), M.crown2)); g.add(...TREES);
})();

// ---------- portes coulissantes suspendues (option) : chambre et salle d'eau, rail acier noir
const slideG = new THREE.Group(); groups.walls.add(slideG);
(function(){
  const wood = mat(0xc8a47c,{roughness:.55}), steel = mat(0x1f2124,{roughness:.4, metalness:.5}), groove = mat(0x9c7b56,{roughness:.7});
  for (const s of GEO.slides){
    const L = s.b - s.a, H2 = 2.12, th = 0.035, panel = new THREE.Group();
    const P = (u0,u1,y0,y1,v0,v1,m,par=panel) => s.axis === 'z' ? box(v0,u0,v1,u1,y0,y1,m,par) : box(u0,v0,u1,v1,y0,y1,m,par);
    P(0, L, 0.015, H2, -th/2, th/2, wood);
    for (let k = 1; k < 6; k++){ const u = L*k/6; P(u-0.0025, u+0.0025, 0.04, H2-0.03, -th/2-0.001, th/2+0.001, groove); }
    for (const side of [-1, 1]) P(0.07, 0.09, 0.75, 1.45, side*(th/2+0.005), side*(th/2+0.035), steel);
    for (const u of [0.14, L-0.18]) P(u, u+0.04, H2-0.02, 2.2, s.wall*0.01-0.005, s.wall*0.01+0.005, steel);
    groups.walls.add(panel);
    const R0 = s.rail[0], R1 = s.rail[1], rv = s.plane + s.wall*0.012;
    if (s.axis === 'z') box(rv-0.012, R0, rv+0.012, R1, 2.18, 2.22, steel, slideG); else box(R0, rv-0.012, R1, rv+0.012, 2.18, 2.22, steel, slideG);
    if (s.ceil) for (const u of [R0+0.05, (R0+R1)/2, R1-0.05]) (s.axis === 'z' ? box(rv-0.006, u-0.006, rv+0.006, u+0.006, 2.22, 2.5, steel, slideG) : box(u-0.006, rv-0.006, u+0.006, rv+0.006, 2.22, 2.5, steel, slideG));
    const dr = {d:{id:s.id, kind:'slide'}, pivot:panel, slide:s, t:1, target:1, len:L, mid:s.mid, ac:0, diff:0};
    panel.traverse(o => { o.userData.door = dr; });
    const [x0,z0,x1,z1] = s.rect, hp = new THREE.Mesh(new THREE.BoxGeometry(Math.max(x1-x0,0.3), 2.04, Math.max(z1-z0,0.3)), hitMat); hp.position.set((x0+x1)/2, 1.02, (z0+z1)/2); hp.userData.door = dr; doorHits.add(hp);
    doors.push(dr); setDoorPose(dr);
  }
})();
const swingRep = doors.filter(dr => GEO.slides.some(s => s.replaces === dr.d.id));
function setSlide(on){ slideG.visible = on; doors.forEach(dr => { if (dr.slide) dr.pivot.visible = on; }); swingRep.forEach(dr => { dr.pivot.visible = !on; }); }
setSlide(GEO.slides.length > 0);

// ---------- realism : curtains, skirting, contact shadows, colour management, image-based light, soft sun shadows, lamps
(function(){
  const g = groups.walls;
  // linen curtains with soft folds, on black rods at 2,42 m
  const curtainM = mat(0xefe9dd,{side:THREE.DoubleSide, roughness:.95, transparent:true, opacity:.93});
  for (const c of GEO.curtains){
    const dx = c.b[0]-c.a[0], dz = c.b[1]-c.a[1], w = Math.hypot(dx, dz), geo = new THREE.PlaneGeometry(w, 2.38, 40, 1), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++){ const u = (p.getX(i) + w/2) / w; p.setZ(i, Math.sin(u * Math.PI * 2 * Math.max(3, w/0.09)) * 0.035); }
    geo.computeVertexNormals(); const me = new THREE.Mesh(geo, curtainM); me.position.set((c.a[0]+c.b[0])/2, 1.21, (c.a[1]+c.b[1])/2); me.rotation.y = -Math.atan2(dz, dx); g.add(me);
  }
  for (const rd of GEO.rods){ const dx = rd.b[0]-rd.a[0], dz = rd.b[1]-rd.a[1], rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, Math.hypot(dx, dz), 10), M.dark), G = new THREE.Group();
    rod.rotation.z = Math.PI/2; G.add(rod); G.position.set((rd.a[0]+rd.b[0])/2, 2.42, (rd.a[1]+rd.b[1])/2); G.rotation.y = -Math.atan2(dz, dx); g.add(G); }

  // skirting boards 7 cm (cut at door and window openings) + a soft ambient-occlusion band on the floor along the walls
  const aoBand = tex(8, 1, () => {}); { const c = aoBand.image, x = c.getContext('2d'); c.width = 4; c.height = 64; const gr = x.createLinearGradient(0,0,0,64); gr.addColorStop(0,'rgba(0,0,0,0)'); gr.addColorStop(1,'rgba(0,0,0,.34)'); x.fillStyle = gr; x.fillRect(0,0,4,64); aoBand.repeat.set(1,1); aoBand.needsUpdate = true; }
  const aoBlob = tex(8, 1, () => {}); { const c = aoBlob.image, x = c.getContext('2d'); c.width = c.height = 128; const gr = x.createRadialGradient(64,64,10,64,64,64); gr.addColorStop(0,'rgba(0,0,0,.42)'); gr.addColorStop(.55,'rgba(0,0,0,.3)'); gr.addColorStop(1,'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0,0,128,128); aoBlob.repeat.set(1,1); aoBlob.needsUpdate = true; }
  const bandM = new THREE.MeshBasicMaterial({map:aoBand, transparent:true, depthWrite:false}), blobM = new THREE.MeshBasicMaterial({map:aoBlob, transparent:true, depthWrite:false});
  const skirtM = mat(0xf4f2ed,{roughness:.6});
  const openings = GEO.openings.map(o => o.r);
  for (const room of GEO.rooms){
    if (room.floor === 'deck') continue;
    const P = room.poly; let A = 0; for (let i = 0; i < P.length; i++){ const [x0,z0] = P[i], [x1,z1] = P[(i+1)%P.length]; A += x0*z1 - x1*z0; }
    for (let i = 0; i < P.length; i++){
      const [ax,az] = P[i], [bx,bz] = P[(i+1)%P.length], dx = bx-ax, dz = bz-az, L = Math.hypot(dx, dz); if (L < 0.05) continue;
      const nx = (A > 0 ? -dz : dz)/L, nz = (A > 0 ? dx : -dx)/L;          // inward normal
      const band = new THREE.Mesh(new THREE.PlaneGeometry(L, 0.3), bandM); band.rotation.order = 'YXZ';
      band.rotation.set(-Math.PI/2, Math.atan2(-nx, -nz), 0);
      band.position.set((ax+bx)/2 + nx*0.15, 0.005, (az+bz)/2 + nz*0.15); band.renderOrder = 1; band.userData.ao = true; g.add(band);
      if (room.ext) continue;
      const horiz = Math.abs(dz) < 1e-6; let segs = [[Math.min(horiz?ax:az, horiz?bx:bz), Math.max(horiz?ax:az, horiz?bx:bz)]];
      for (const o of openings){ const hit = horiz ? (az >= o[1]-0.07 && az <= o[3]+0.07) : (ax >= o[0]-0.07 && ax <= o[2]+0.07); if (!hit) continue;
        const lo = horiz ? o[0] : o[1], hi = horiz ? o[2] : o[3]; segs = segs.flatMap(([s,e]) => (hi <= s || lo >= e) ? [[s,e]] : [[s, lo], [hi, e]].filter(q => q[1]-q[0] > 0.02)); }
      for (const [s,e] of segs){ if (horiz) box(s, az, e, az + nz*0.012, 0, 0.07, skirtM, g); else box(ax, s, ax + nx*0.012, e, 0, 0.07, skirtM, g); }
    }
  }
  for (const a of FX.ao){ const r = a.r, m = 0.14, b = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), blobM); b.scale.set(r[2]-r[0]+2*m, r[3]-r[1]+2*m, 1); b.rotation.x = -Math.PI/2; b.position.set((r[0]+r[2])/2, 0.006, (r[1]+r[3])/2); b.renderOrder = 1; b.userData.ao = true; (a.lay === 'A' ? groups.furnA : a.lay === 'B' ? groups.furnB : groups.furn).add(b); }
})();

const LAY = { cur:'A' };
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
const shadowsDirty = () => { renderer.shadowMap.needsUpdate = true; };
(function(){
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  const seen = new Set();
  scene.traverse(o => {
    if (!o.isMesh) return; const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms){ if (seen.has(m)) continue; seen.add(m);
      if (m.map) m.map.colorSpace = THREE.SRGBColorSpace; m.needsUpdate = true; }
    const basic = o.material && o.material.isMeshBasicMaterial, clear = o.material === M.glass || o.material === M.frost;
    o.castShadow = !basic && !clear; o.receiveShadow = !basic;
  });
  FX.std = [...seen].filter(m => m.isMeshStandardMaterial);
  groups.ceil.traverse(o => { if (!o.isMesh || o.material === M.glass) return; o.updateWorldMatrix(true, false); const c = new THREE.Mesh(o.geometry, SHADOW_M); c.applyMatrix4(o.matrixWorld); shadowOnly.add(c); });
  shadowOnly.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = false; } });
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 220;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.target.position.set(GEO.center[0], 0, GEO.center[1]); scene.add(sun.target);
  FX.points = FX.lamps.map(([x,y,z,lay]) => { const p = new THREE.PointLight(0xffb46b, 0, 6.5, 2); p.userData.lay = lay; p.position.set(x,y,z); scene.add(p); return p; });
})();
const PRESETS = {
  day: {sky:0xc6dbe4, fog:0xcfdfe4, hemi:.42, fill:.1, sun:[16,40,24], sunC:0xfff4e6, sunI:1.2, env:.6, lamp:0, glow:0, exp:.88}
};
function applyPreset(k){
  const P = PRESETS[k]; scene.background.set(P.sky); scene.fog.color.set(P.fog); scene.environmentIntensity = 1;   // rendu d'origine
  hemi.intensity = P.hemi; fill.intensity = P.fill; const NV = GEO.north || [0,-1], EV = [-NV[1], NV[0]], v = new THREE.Vector3(P.sun[0]*EV[0] - P.sun[2]*NV[0], P.sun[1], P.sun[0]*EV[1] - P.sun[2]*NV[1]).setLength(55);
  sun.position.set(GEO.center[0] + v.x, v.y, GEO.center[1] + v.z); sun.color.set(P.sunC); sun.intensity = P.sunI;
  FX.std.forEach(m => { m.envMapIntensity = P.env; }); FX.points.forEach(p => { p.intensity = (!p.userData.lay || p.userData.lay === LAY.cur) ? P.lamp : 0; }); FX.glow.forEach(m => { m.emissiveIntensity = P.glow; });
  renderer.toneMappingExposure = P.exp; shadowsDirty();
}
applyPreset('day');

// ---------- state, collisions, rooms
const state = { mode:'orbit', ceil:true, kitchen:true, furn:true, layout:'A', slide: GEO.slides.length > 0, theta:0.5, phi:0.72, radius:19, yaw:0, pitch:-0.05, x:0, z:0, visited:false };
const target = new THREE.Vector3(GEO.center[0], 0.4, GEO.center[1]);
const keys = new Set(), joy = {x:0, y:0};
function collide(){
  const rects = OBST.concat(doorRects());
  for (let pass = 0; pass < 3; pass++) for (const rc of rects){
    const [x0,z0,x1,z1] = rc; const cx = Math.max(x0, Math.min(state.x, x1)), cz = Math.max(z0, Math.min(state.z, z1));
    let dx = state.x - cx, dz = state.z - cz, d = Math.hypot(dx, dz);
    if (d >= R) continue;
    if (d < 1e-6){ const opts = [[state.x-x0,-1,0],[x1-state.x,1,0],[state.z-z0,0,-1],[z1-state.z,0,1]].sort((a,b)=>a[0]-b[0])[0]; state.x += opts[1]*(opts[0]+R); state.z += opts[2]*(opts[0]+R); continue; }
    state.x += dx/d*(R-d); state.z += dz/d*(R-d);
  }
}
function inPoly(x, z, p){ let c = false; for (let i = 0, j = p.length-1; i < p.length; j = i++){ const [xi,zi] = p[i], [xj,zj] = p[j]; if ((zi > z) !== (zj > z) && x < (xj-xi)*(z-zi)/(zj-zi) + xi) c = !c; } return c; }
const fmt = n => n.toFixed(1).replace('.', ',');
let lastRoom = null;
function updateRoom(){
  if (state.mode !== 'visit'){ if (lastRoom !== '') { $('roomName').textContent = "Vue d'ensemble"; $('roomArea').textContent = META.overview; lastRoom = ''; } return; }
  const r = GEO.rooms.find(r => inPoly(state.x, state.z, r.poly)); const name = r ? r.name : 'Seuil';
  const so = SOFF.find(s => state.x > s.r[0] && state.x < s.r[2] && state.z > s.r[1] && state.z < s.r[3]);
  const pn = panAt(state.x, state.z), ch = ceilAt(state.x, state.z), slopeHere = pn && ch < (pn.cap ?? H) - 0.005;
  const key = name + (so ? so.h : '') + '|' + ch.toFixed(2); if (key === lastRoom) return; lastRoom = key;
  $('roomName').textContent = name; $('roomArea').textContent = r ? fmt(r.plan) + ' m²' + (r.low ? ' + ' + fmt(r.low) + ' m² sous 1,80 m' : '') : '';
  $('hsp').textContent = r && r.floor === 'deck' ? 'Balcon couvert · garde-corps 1,00 m' : so ? 'Sous soffite : ' + fmtM(so.h) + ' m'
    : slopeHere ? 'Sous rampant : ' + fmtM(ch) + ' m (' + fmtM(pn.h0) + ' → ' + fmtM(pn.cap ?? H) + ' m)' : 'Sous plafond : ' + fmtM(ch) + ' m';
  document.querySelectorAll('#chips button').forEach(b => b.classList.toggle('here', name.startsWith(b.dataset.room) || (b.dataset.room === 'Séjour' && name.startsWith('Séjour'))));
  if (SUN.on) sunReadout();
}

// ---------- soleil réel à Carcans : position du soleil (formules NOAA, ±0,1°), heure légale de Paris,
//            ombres en temps réel et bilan d'ensoleillement par pièce (lancer de rayons sur un modèle simplifié)
const SITE = {lat: GEO.lat ?? 45.08, lon: GEO.lon ?? -1.09};
const NDEG = GEO.northDeg ?? ({'0,-1':0, '1,0':90, '0,1':180, '-1,0':270}[String(GEO.north || [0,-1])] ?? 0);   // nord vrai, en degrés depuis le haut du plan (sens horaire)
const NR = NDEG*Math.PI/180, NVT = [Math.sin(NR), -Math.cos(NR)], EVT = [Math.cos(NR), Math.sin(NR)];
function sunPos(t){                                   // t : instant en ms UTC → hauteur et azimut (rad ; azimut depuis le nord, sens horaire)
  const r = Math.PI/180, d = t/86400000 - 10957.5;   // jours depuis J2000.0
  const g = (357.529 + 0.98560028*d)*r, L = (280.459 + 0.98564736*d + 1.915*Math.sin(g) + 0.020*Math.sin(2*g))*r, e = (23.439 - 3.6e-7*d)*r;
  const ra = Math.atan2(Math.cos(e)*Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e)*Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908*d) % 24 + 24) % 24, Hh = (gmst*15 + SITE.lon)*r - ra, la = SITE.lat*r;
  const alt = Math.asin(Math.sin(la)*Math.sin(dec) + Math.cos(la)*Math.cos(dec)*Math.cos(Hh));
  const az = Math.atan2(-Math.sin(Hh), Math.tan(dec)*Math.cos(la) - Math.sin(la)*Math.cos(Hh));
  return {alt, az: (az + 2*Math.PI) % (2*Math.PI)};
}
const horiz = az => [NVT[0]*Math.cos(az) + EVT[0]*Math.sin(az), NVT[1]*Math.cos(az) + EVT[1]*Math.sin(az)];   // direction du soleil dans le plan
const lastSunday = (y, m) => { const d = new Date(Date.UTC(y, m + 1, 0)); return d.getUTCDate() - d.getUTCDay(); };
function toUTC(y, doy, min){                          // jour de l'année + minutes à l'heure de Paris → ms UTC
  const base = Date.UTC(y, 0, doy), d = new Date(base), m = d.getUTCMonth(), dd = d.getUTCDate();
  const summer = (m > 2 && m < 9) || (m === 2 && dd >= lastSunday(y, 2)) || (m === 9 && dd < lastSunday(y, 9));
  return base + (min - (summer ? 120 : 60))*60000;
}
function todayParis(){
  try { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Paris', year:'numeric', month:'numeric', day:'numeric', hour:'numeric', minute:'numeric', hourCycle:'h23'}).formatToParts(new Date()).map(x => [x.type, x.value]));
    const y = +p.year; return {doy: Math.min(365, Math.round((Date.UTC(y, p.month - 1, +p.day) - Date.UTC(y, 0, 0))/864e5)), min: (+p.hour)*60 + (+p.minute)}; }
  catch (e){ return {doy: 172, min: 960}; }
}
const SUN = {on:false, play:false, init:false, year:new Date().getFullYear(), day:172, min:960, alt:0, az:0, rise:360, set:1320};
const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'], MOIS3 = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const DIRS = ['nord','nord-est','est','sud-est','sud','sud-ouest','ouest','nord-ouest'];
const dayLabel = (doy, short) => { const d = new Date(Date.UTC(SUN.year, 0, doy)); return d.getUTCDate() + (d.getUTCDate() === 1 ? 'er' : '') + ' ' + (short ? MOIS3 : MOIS)[d.getUTCMonth()]; };
const hm = m => { const r = Math.round(m); return Math.floor(r/60) + ' h ' + String(r % 60).padStart(2, '0'); };
const dur = m => { const r = Math.round(m/5)*5; return r >= 60 ? Math.floor(r/60) + ' h' + (r % 60 ? ' ' + String(r % 60).padStart(2, '0') : '') : r + ' min'; };
const toward = az => { const d = DIRS[Math.round(az/(Math.PI/4)) % 8]; return /^[eo]/.test(d) ? "à l'" + d : 'au ' + d; };
function riseSet(){
  let rise = null, set = null; for (let m = 180; m <= 1440; m += 2){ if (sunPos(toUTC(SUN.year, SUN.day, m)).alt > -0.0145){ if (rise === null) rise = m; set = m; } }
  SUN.rise = rise ?? 480; SUN.set = set ?? 1080;
}
// ambiance selon la hauteur du soleil (°) : nuit, crépuscule, heure dorée, fin d'après-midi, plein jour
const AMB = [
  {a:-12, sky:0x1b2433, fog:0x1f2838, hemi:.06, fill:.02, sunC:0xff9a5a, sunI:0,   env:.12, lamp:1.7, glow:1.25, exp:1.2},
  {a:-3,  sky:0x7b7890, fog:0x878195, hemi:.12, fill:.03, sunC:0xff9a5a, sunI:0,   env:.3,  lamp:1.4, glow:1.1,  exp:1.1},
  {a:3,   sky:0xe8b896, fog:0xdcb08f, hemi:.14, fill:.03, sunC:0xff9d55, sunI:3.0, env:.42, lamp:.6,  glow:.5,   exp:1.05},
  {a:12,  sky:0xe2d4c2, fog:0xdcd3c4, hemi:.18, fill:.04, sunC:0xffd6a8, sunI:2.8, env:.5,  lamp:0,   glow:0,    exp:1.0},
  {a:30,  sky:0xc6dbe4, fog:0xcfdfe4, hemi:.22, fill:.05, sunC:0xfff4e6, sunI:2.6, env:.55, lamp:0,   glow:0,    exp:.95}
];
const cA = new THREE.Color(), cB = new THREE.Color(), HORIZ = 4;   // en dessous de 4°, soleil considéré masqué par l'horizon
function applySun(){
  const {alt, az} = sunPos(toUTC(SUN.year, SUN.day, SUN.min)), ad = alt*180/Math.PI;
  let i = 0; while (i < AMB.length - 2 && ad > AMB[i+1].a) i++;
  const A = AMB[i], Bk = AMB[i+1], t = Math.min(1, Math.max(0, (ad - A.a)/(Bk.a - A.a))), mix = k => A[k] + (Bk[k] - A[k])*t, col = k => cA.set(A[k]).lerp(cB.set(Bk[k]), t);
  scene.background.copy(col('sky')); scene.fog.color.copy(col('fog')); hemi.intensity = mix('hemi'); fill.intensity = mix('fill');
  const h = horiz(az), a = Math.max(alt, 0.03);
  sun.position.set(GEO.center[0] + h[0]*Math.cos(a)*90, Math.sin(a)*90, GEO.center[1] + h[1]*Math.cos(a)*90);
  const rise = Math.min(1, Math.max(0, ad/HORIZ)); sun.color.copy(col('sunC')); sun.intensity = mix('sunI') * rise*rise*(3 - 2*rise);   // le soleil émerge de l'horizon (pins, dunes) entre 0 et 4°
  const env = mix('env'), lamp = mix('lamp'), glow = mix('glow');
  scene.environmentIntensity = env;   // three r164 : l'environnement de la scène suit scene.environmentIntensity, pas material.envMapIntensity
  FX.points.forEach(p => { p.intensity = (!p.userData.lay || p.userData.lay === LAY.cur) ? lamp : 0; }); FX.glow.forEach(m => { m.emissiveIntensity = glow; });
  renderer.toneMappingExposure = mix('exp'); shadowsDirty();
  SUN.alt = alt; SUN.az = az; sunReadout();
}
function refreshLight(){ if (SUN.on) applySun(); else applyPreset('day'); }

// --- bilan : pour chaque pièce, part du sol qui voit le soleil, toutes les 10 minutes
let OCC = null, BILAN = null, bilanT = null, bilanJob = 0;
function buildOcc(){
  const boxes = [], add = (r, y0, y1) => { if (y1 > y0 + 1e-3) boxes.push([r[0], y0, r[1], r[2], y1, r[3]]); };
  const solidB = (r, y0) => { if (!touchesPan(r)){ add(r, y0, TOP); return; }
    for (const c of gridCells(...r)){ const f = cellFn(c); add(c, y0, Math.max(f(c[0],c[1]), f(c[2],c[1]), f(c[2],c[3]), f(c[0],c[3])) + 0.22); } };
  for (const w of GEO.walls) solidB(w, -0.3);
  for (const o of GEO.openings){ solidB(o.r, o.head); if (o.sill) add(o.r, -0.3, o.sill); }
  for (const p of GEO.posts || []) add([p[0]-0.04, p[1]-0.06, p[0]+0.04, p[1]+0.06], 0, H);
  for (const sc of GEO.screens || []) add(sc.r, 0, sc.h ?? 1.8);
  for (const b of GEO.mass) add(b, GROUND, b[4] ?? ROOFH);
  const bb = polyBox(GEO.rooms.flatMap(r => r.poly)), S = 0.05, x0 = bb[0] - 0.3, z0 = bb[1] - 0.3, nx = Math.ceil((bb[2] - bb[0] + 0.6)/S), nz = Math.ceil((bb[3] - bb[1] + 0.6)/S);
  const g = new Float32Array(nx*nz).fill(1e9); let maxH = 0;     // hauteur sous plafond (ou soffite) par case de 5 cm ; trous des fenêtres de toit
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++){ const x = x0 + (i + 0.5)*S, z = z0 + (j + 0.5)*S;
    if (!GEO.rooms.some(r => inPolyG(x, z, r.poly)) || SKY.some(s => inRect(s, x, z))) continue;
    let c = ceilAt(x, z); for (const so of SOFF) if (inRect(so.r, x, z)) c = Math.min(c, so.h); g[j*nx + i] = c; maxH = Math.max(maxH, c); }
  return {boxes, g, x0, z0, nx, nz, S, maxH};
}
function sunlit(O, D){
  for (const b of OCC.boxes){ let t0 = 1e-4, t1 = 1e9, hit = true;
    for (let k = 0; k < 3; k++){ const d = D[k] || 1e-12, a = (b[k] - O[k])/d, c = (b[k+3] - O[k])/d;
      if (a < c){ if (a > t0) t0 = a; if (c < t1) t1 = c; } else { if (c > t0) t0 = c; if (a < t1) t1 = a; } if (t0 > t1){ hit = false; break; } }
    if (hit) return false; }
  const st = OCC.S*0.8/Math.max(Math.hypot(D[0], D[2]), 0.05);
  for (let t = st*0.5; ; t += st){ const y = O[1] + D[1]*t, i = Math.floor((O[0] + D[0]*t - OCC.x0)/OCC.S), j = Math.floor((O[2] + D[2]*t - OCC.z0)/OCC.S);
    if (i < 0 || j < 0 || i >= OCC.nx || j >= OCC.nz) break; if (y >= OCC.g[j*OCC.nx + i]) return false; if (y > OCC.maxH + 0.3) break; }
  return true;
}
function roomPts(r, sp = 0.3){ const b = polyBox(r.poly), out = []; for (let x = b[0] + sp/2; x < b[2]; x += sp) for (let z = b[1] + sp/2; z < b[3]; z += sp) if (inPolyG(x, z, r.poly)) out.push([x, 0.05, z]); return out; }
function rangesOf(ms, frac){
  const out = []; let cur = null;
  ms.forEach((m, k) => { if (frac[k] > 0){ if (cur && m - cur[1] <= 15) cur[1] = m + 5; else { cur = [m - 5, m + 5]; out.push(cur); } } });
  out.forEach(r => { r[0] = Math.max(r[0], SUN.rise); r[1] = Math.min(r[1], SUN.set); }); return out.filter(r => r[1] > r[0]);
}
function scheduleBilan(){ clearTimeout(bilanT); if (!SUN.on) return; if (!BILAN || BILAN.day !== SUN.day){ BILAN = null; sunReadout(); } bilanT = setTimeout(runBilan, 250); }
function runBilan(){
  if (!OCC) OCC = buildOcc(); const job = ++bilanJob, day = SUN.day, steps = [];
  for (let m = 240; m <= 1410; m += 10){ const p = sunPos(toUTC(SUN.year, day, m)); if (p.alt > HORIZ*Math.PI/180) steps.push({m, alt:p.alt, az:p.az}); }
  const rooms = GEO.rooms.map(r => ({r, pts: roomPts(r), lit: []})); let k = 0, cpu = 0;
  const chunk = () => { if (job !== bilanJob) return; const t0 = performance.now();
    while (k < steps.length && performance.now() - t0 < 14){ const st = steps[k++], h = horiz(st.az), ca = Math.cos(st.alt), D = [h[0]*ca, Math.sin(st.alt), h[1]*ca];
      for (const R of rooms){ let n = 0; for (const p of R.pts) if (sunlit(p, D)) n++; R.lit.push(n >= Math.max(4, 0.02*R.pts.length) ? n / R.pts.length : 0); } }
    cpu += performance.now() - t0; if (k < steps.length){ setTimeout(chunk, 0); return; }
    const ms = steps.map(s => s.m); BILAN = {day, ms, cpu: Math.round(cpu), rays: steps.length * rooms.reduce((s, R) => s + R.pts.length, 0), rooms: rooms.map(R => ({name: R.r.name, ext: R.r.ext, frac: R.lit, ranges: rangesOf(ms, R.lit)}))}; sunReadout(); };
  chunk();
}
function sunReadout(){
  if (!SUN.on) return;
  const ad = Math.round(SUN.alt*180/Math.PI);
  $('sunNow').textContent = (SUN.alt > 0 ? 'Soleil à ' + ad + '° ' + toward(SUN.az) : 'Soleil couché') + ' · lever ' + hm(SUN.rise) + ', coucher ' + hm(SUN.set);
  const el = $('sunRooms');
  if (!BILAN || BILAN.day !== SUN.day){ el.textContent = 'calcul des heures de soleil…'; return; }
  const tot = R => R.ranges.reduce((s, r) => s + r[1] - r[0], 0), short = n => n.replace(/^Entrée \/ /, '').replace(/ \/ Cuisine$/, '');
  const here = state.mode === 'visit' && BILAN.rooms.find(R => inPoly(state.x, state.z, GEO.rooms.find(g => g.name === R.name).poly));
  if (here){
    let k = 0; BILAN.ms.forEach((m, i) => { if (Math.abs(m - SUN.min) < Math.abs(BILAN.ms[k] - SUN.min)) k = i; });
    const now = SUN.alt > 0 && BILAN.ms.length && Math.abs(BILAN.ms[k] - SUN.min) <= 10 ? Math.round(here.frac[k]*100) : 0;
    el.textContent = short(here.name) + ' : ' + (here.ranges.length ? 'soleil direct ' + here.ranges.map(r => hm(r[0]) + ' → ' + hm(r[1])).join(', ') + ' (' + dur(tot(here)) + ')' + (now ? ' · ' + now + ' % du sol au soleil à cette heure' : '') : 'pas de soleil direct ce jour-là');
    return;
  }
  const rs = BILAN.rooms.filter(R => !R.ext || R.ranges.length).sort((a, b) => tot(b) - tot(a));
  el.textContent = 'Soleil direct ce jour : ' + rs.map(R => short(R.name) + ' ' + (R.ranges.length ? dur(tot(R)) : '0')).join(' · ');
}
// --- interface : curseurs date et heure, journées types, lecture
const sunDay = $('sunDay'), sunMin = $('sunMin'), sunPlay = $('sunPlay');
const PLAY_I = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M5 3.5v9l7.5-4.5z" fill="currentColor"/></svg>', PAUSE_I = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4.5 3.5h2.5v9H4.5zM9 3.5h2.5v9H9z" fill="currentColor"/></svg>';
function syncSunUI(){ sunDay.value = SUN.day; sunMin.value = SUN.min; $('sunDayL').textContent = dayLabel(SUN.day, true); $('sunMinL').textContent = hm(SUN.min);
  sunPlay.innerHTML = SUN.play ? PAUSE_I : PLAY_I; sunPlay.setAttribute('aria-label', SUN.play ? 'Mettre en pause' : 'Faire défiler la journée'); }
function dayChanged(){ riseSet(); applySun(); syncSunUI(); scheduleBilan(); }
function sunTick(dt){ const end = Math.min(1380, SUN.set + 40); SUN.min = Math.min(end, SUN.min + dt*55); if (SUN.min >= end) SUN.play = false; applySun(); syncSunUI(); }
function setSun(on){
  SUN.on = on; $('tSun').setAttribute('aria-pressed', on); $('sunRow').hidden = !on; shadowOnly.visible = on; if (!on) SUN.play = false;
  TREES.forEach(m => { m.castShadow = !on; });   // ensoleillement : ombres des bâtiments seulement, la végétation n'est pas modélisée fidèlement
  if (on){ if (!SUN.init){ const t = todayParis(); SUN.day = t.doy; SUN.min = t.min; riseSet(); if (sunPos(toUTC(SUN.year, SUN.day, SUN.min)).alt < 0.1) SUN.min = 960; SUN.init = true; } dayChanged(); }
  else applyPreset('day');
  shadowsDirty(); lastRoom = null; updateRoom();
}
sunDay.addEventListener('input', () => { SUN.day = +sunDay.value; dayChanged(); });
sunMin.addEventListener('input', () => { SUN.min = +sunMin.value; applySun(); syncSunUI(); });
sunPlay.addEventListener('click', () => { SUN.play = !SUN.play; if (SUN.play && SUN.min >= Math.min(1380, SUN.set + 40) - 5) SUN.min = Math.max(300, SUN.rise - 20); syncSunUI(); });
document.querySelectorAll('#sunPresets button').forEach(b => b.addEventListener('click', () => { SUN.day = b.dataset.day === 'today' ? todayParis().doy : +b.dataset.day; dayChanged(); }));
$('tSun').addEventListener('click', () => setSun(!SUN.on));

// ---------- modes & UI
const hint = $('hint');
const coarse = window.matchMedia('(pointer: coarse)').matches;
function visitFov(){ return Math.min(100, Math.max(60, 2*Math.atan(Math.tan(46*Math.PI/180)/camera.aspect)*180/Math.PI)); }
function setMode(m){
  state.mode = m; $('bOrbit').setAttribute('aria-pressed', m === 'orbit'); $('bVisit').setAttribute('aria-pressed', m === 'visit');
  $('tCeil').hidden = m !== 'visit'; $('joy').hidden = m !== 'visit';
  groups.ceil.visible = m === 'visit' && state.ceil; groups.caps.visible = m === 'orbit'; shadowsDirty();
  camera.fov = m === 'visit' ? visitFov() : 45; camera.updateProjectionMatrix();
  if (m === 'visit' && !state.visited) goTo('Entrée');
  hint.textContent = m === 'orbit' ? (coarse ? 'Glisse pour tourner · pince pour zoomer · touche une porte' : 'Glisse pour tourner · molette pour zoomer · clic sur une porte pour l’ouvrir')
    : (coarse ? 'Joystick pour marcher · touche une porte pour l’ouvrir' : 'ZQSD ou flèches pour marcher · clic ou E pour ouvrir une porte · on traverse les meubles');
  lastRoom = null; updateRoom();
}
function goTo(name){
  const v = (state.layout === 'B' && GEO.viewsB && GEO.viewsB[name]) || GEO.views[name]; state.visited = true; state.x = v.p[0]; state.z = v.p[1];
  state.yaw = Math.atan2(-(v.look[0]-v.p[0]), -(v.look[1]-v.p[1])); state.pitch = v.pitch ?? -0.06;
  if (state.mode !== 'visit') setMode('visit'); lastRoom = null; updateRoom();
}
const chips = $('chips');
Object.keys(GEO.views).forEach(n => { const b = document.createElement('button'); b.textContent = n; b.dataset.room = n; b.addEventListener('click', () => goTo(n)); chips.appendChild(b); });
$('bOrbit').addEventListener('click', () => setMode('orbit'));
$('bVisit').addEventListener('click', () => setMode('visit'));
$('tCeil').addEventListener('click', e => { state.ceil = !state.ceil; e.currentTarget.setAttribute('aria-pressed', state.ceil); groups.ceil.visible = state.ceil; shadowsDirty(); });
$('tFurn').addEventListener('click', e => { state.furn = !state.furn; e.currentTarget.setAttribute('aria-pressed', state.furn); groups.furn.visible = state.furn; shadowsDirty(); });
function setKitchen(k){
  state.kitchen = k !== '0'; if (k !== '0') state.layout = LAY.cur = k;
  groups.kitchen.visible = state.kitchen; groups.kitA.visible = groups.furnA.visible = state.layout === 'A'; groups.kitB.visible = groups.furnB.visible = state.layout === 'B';
  if (becsDoor) becsDoor.pivot.visible = !state.kitchen || state.layout === 'A';
  ['0','A','B'].forEach(x => $('k'+x).setAttribute('aria-pressed', x === k)); refreshLight(); lastRoom = null;
}
['0','A','B'].forEach(x => $('k'+x).addEventListener('click', () => setKitchen(x)));
$('tSlide').addEventListener('click', e => { state.slide = !state.slide; e.currentTarget.setAttribute('aria-pressed', state.slide); setSlide(state.slide); shadowsDirty(); });
if (!GEO.kit.cols){ $('kB').hidden = true; $('kA').textContent = 'Cuisine'; }
if (!GEO.slides.length) $('tSlide').hidden = true;
setKitchen('A');

// ---------- input
const ptrs = new Map(); let pinch = 0;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let downAt = null, hoverQ = null;
function hitDoor(cx, cy){ const r = canvas.getBoundingClientRect(); ndc.set((cx-r.left)/r.width*2-1, -(cy-r.top)/r.height*2+1); ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects([doorHits, groups.walls, groups.furn, groups.kitchen], true).find(h => { const d = h.object.userData.door; return d ? d.pivot.visible : h.object.visible && h.object.material !== M.glass; });
  return hit && hit.distance < 45 ? hit.object.userData.door || null : null; }
canvas.addEventListener('pointerdown', e => { downAt = ptrs.size === 0 ? {x:e.clientX, y:e.clientY, t:performance.now()} : null; canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY}); if (ptrs.size === 2){ const [a,b] = [...ptrs.values()]; pinch = Math.hypot(a.x-b.x, a.y-b.y); } });
canvas.addEventListener('pointermove', e => {
  if (downAt && Math.hypot(e.clientX-downAt.x, e.clientY-downAt.y) > 7) downAt = null;
  const p = ptrs.get(e.pointerId); if (!p){ if (e.pointerType === 'mouse') hoverQ = [e.clientX, e.clientY]; return; } const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 2){ const [a,b] = [...ptrs.values()]; const d = Math.hypot(a.x-b.x, a.y-b.y); if (pinch && state.mode === 'orbit') state.radius = Math.min(45, Math.max(5, state.radius * pinch / d)); pinch = d; return; }
  if (state.mode === 'orbit'){ state.theta -= dx*0.006; state.phi = Math.min(1.45, Math.max(0.12, state.phi - dy*0.006)); }
  else { state.yaw += dx*0.0038; state.pitch = Math.min(1.2, Math.max(-1.2, state.pitch + dy*0.0038)); }
});
const up = e => { if (e.type === 'pointerup' && downAt && performance.now() - downAt.t < 450){ const dr = hitDoor(e.clientX, e.clientY); if (dr) toggleDoor(dr); } downAt = null; ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = 0; };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', e => { e.preventDefault(); if (state.mode === 'orbit') state.radius = Math.min(45, Math.max(5, state.radius * (1 + e.deltaY*0.001))); }, {passive:false});
window.addEventListener('keydown', e => { if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault(); keys.add(e.code);
  if (e.code === 'KeyE' && state.mode === 'visit'){ let best = null, bd = 1.7; for (const dr of doors){ if (!dr.pivot.visible) continue; const [mx, mz] = dr.mid || [dr.d.hinge[0] + Math.cos(dr.ac)*dr.len/2, dr.d.hinge[1] + Math.sin(dr.ac)*dr.len/2], dd = Math.hypot(mx-state.x, mz-state.z); if (dd < bd){ bd = dd; best = dr; } } if (best) toggleDoor(best); }
  if (state.mode === 'orbit' && ['KeyW','ArrowUp'].includes(e.code)) setMode('visit'); });
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
const joyEl = $('joy'), knob = $('knob');
joyEl.addEventListener('pointerdown', e => { joyEl.setPointerCapture(e.pointerId); moveJoy(e); });
joyEl.addEventListener('pointermove', e => { if (joyEl.hasPointerCapture(e.pointerId)) moveJoy(e); });
const endJoy = () => { joy.x = joy.y = 0; knob.style.transform = ''; };
joyEl.addEventListener('pointerup', endJoy); joyEl.addEventListener('pointercancel', endJoy);
function moveJoy(e){ const r = joyEl.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width/2), dy = e.clientY - (r.top + r.height/2); const d = Math.hypot(dx, dy), m = 38; if (d > m){ dx *= m/d; dy *= m/d; } joy.x = dx/m; joy.y = dy/m; knob.style.transform = `translate(${dx}px,${dy}px)`; }

// ---------- minimap
const mini = $('mini'), mg = mini.getContext('2d');
const B = (() => { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const r of GEO.rooms) for (const [x,z] of r.poly){ x0 = Math.min(x0,x); z0 = Math.min(z0,z); x1 = Math.max(x1,x); z1 = Math.max(z1,z); } return {x0:x0-0.3, z0:z0-0.3, x1:x1+0.3, z1:z1+0.3}; })();
function miniXf(){ const w = mini.clientWidth, h = mini.clientHeight, s = Math.min((w-8)/(B.x1-B.x0), (h-8)/(B.z1-B.z0)); return {s, ox:(w - s*(B.x1-B.x0))/2 - B.x0*s, oz:(h - s*(B.z1-B.z0))/2 - B.z0*s}; }
function drawMini(){
  const dpr = Math.min(window.devicePixelRatio||1, 2), w = mini.clientWidth, h = mini.clientHeight;
  if (w < 20 || h < 20) return;
  if (mini.width !== w*dpr){ mini.width = w*dpr; mini.height = h*dpr; }
  const cs = getComputedStyle(document.documentElement), ink = cs.getPropertyValue('--ink').trim(), acc = cs.getPropertyValue('--accent').trim(), chip = cs.getPropertyValue('--chip').trim();
  const {s, ox, oz} = miniXf(); mg.setTransform(dpr,0,0,dpr,0,0); mg.clearRect(0,0,w,h);
  for (const r of GEO.rooms){ mg.beginPath(); r.poly.forEach(([x,z],i) => i ? mg.lineTo(ox+x*s, oz+z*s) : mg.moveTo(ox+x*s, oz+z*s)); mg.closePath(); mg.fillStyle = r.ext ? 'rgba(214,176,92,.35)' : chip; mg.fill(); }
  mg.fillStyle = 'rgba(184,106,75,.3)'; for (const c of LOWCELLS) mg.fillRect(ox+c[0]*s, oz+c[1]*s, (c[2]-c[0])*s, (c[3]-c[1])*s);
  mg.fillStyle = ink; for (const wl of GEO.walls) mg.fillRect(ox+wl[0]*s, oz+wl[1]*s, (wl[2]-wl[0])*s, (wl[3]-wl[1])*s);
  if (state.furn){ mg.strokeStyle = cs.getPropertyValue('--muted').trim(); mg.lineWidth = 1;
    for (const f of GEO.furn){ if (f.nomap || (f.layout && f.layout !== state.layout)) continue; if (f.r) mg.strokeRect(ox+f.r[0]*s, oz+f.r[1]*s, (f.r[2]-f.r[0])*s, (f.r[3]-f.r[1])*s); else { mg.beginPath(); mg.arc(ox+f.c[0]*s, oz+f.c[1]*s, (f.rad || 0.2)*s, 0, 7); mg.stroke(); } } }
  mg.strokeStyle = ink; mg.lineWidth = 1.4; for (const dr of doors){ if (!dr.pivot.visible) continue; if (dr.slide){ const sl = dr.slide, o = sl.dir*sl.open*dr.t; mg.beginPath(); if (sl.axis === 'z'){ mg.moveTo(ox+sl.plane*s, oz+(sl.a+o)*s); mg.lineTo(ox+sl.plane*s, oz+(sl.b+o)*s); } else { mg.moveTo(ox+(sl.a+o)*s, oz+sl.plane*s); mg.lineTo(ox+(sl.b+o)*s, oz+sl.plane*s); } mg.stroke(); continue; } const a = doorAngle(dr), hx = dr.d.hinge[0], hz = dr.d.hinge[1]; mg.beginPath(); mg.moveTo(ox+hx*s, oz+hz*s); mg.lineTo(ox+(hx+Math.cos(a)*dr.len)*s, oz+(hz+Math.sin(a)*dr.len)*s); mg.stroke(); }
  mg.fillStyle = acc;
  if (state.mode === 'visit'){
    const px = ox+state.x*s, pz = oz+state.z*s, a = Math.atan2(-Math.cos(state.yaw), -Math.sin(state.yaw));
    mg.globalAlpha = .28; mg.beginPath(); mg.moveTo(px, pz); mg.arc(px, pz, 26, a-0.6, a+0.6); mg.closePath(); mg.fill(); mg.globalAlpha = 1;
    mg.beginPath(); mg.arc(px, pz, 3.5, 0, 7); mg.fill();
  }
  // flèche du nord vrai, et soleil sur le bord de la vignette (mode Soleil)
  const nx = w - 20, nz = 21; mg.strokeStyle = ink; mg.fillStyle = ink; mg.lineWidth = 1.3; mg.beginPath(); mg.moveTo(nx - NVT[0]*6, nz - NVT[1]*6); mg.lineTo(nx + NVT[0]*5, nz + NVT[1]*5); mg.stroke();
  mg.beginPath(); mg.moveTo(nx + NVT[0]*8, nz + NVT[1]*8); mg.lineTo(nx + NVT[0]*3 - NVT[1]*3, nz + NVT[1]*3 + NVT[0]*3); mg.lineTo(nx + NVT[0]*3 + NVT[1]*3, nz + NVT[1]*3 - NVT[0]*3); mg.fill();
  mg.font = '600 9px ' + cs.getPropertyValue('--sans'); mg.textAlign = 'center'; mg.textBaseline = 'middle'; mg.fillText('N', nx + NVT[0]*14, nz + NVT[1]*14); mg.textAlign = 'start'; mg.textBaseline = 'alphabetic';
  if (SUN.on && SUN.alt > 0){ const hz = horiz(SUN.az), tt = Math.min((w/2 - 8)/Math.max(Math.abs(hz[0]), 1e-3), (h/2 - 8)/Math.max(Math.abs(hz[1]), 1e-3)), sx = w/2 + hz[0]*tt, sz = h/2 + hz[1]*tt;
    mg.strokeStyle = '#e0a12e'; mg.fillStyle = '#f2b134'; mg.lineWidth = 1.2; for (let k = 0; k < 8; k++){ const a = k*Math.PI/4; mg.beginPath(); mg.moveTo(sx + Math.cos(a)*6, sz + Math.sin(a)*6); mg.lineTo(sx + Math.cos(a)*8.5, sz + Math.sin(a)*8.5); mg.stroke(); }
    mg.beginPath(); mg.arc(sx, sz, 4.5, 0, 7); mg.fill(); }
}
mini.addEventListener('click', e => {
  const r = mini.getBoundingClientRect(), {s, ox, oz} = miniXf(); const x = (e.clientX - r.left - ox)/s, z = (e.clientY - r.top - oz)/s;
  if (GEO.rooms.some(rm => inPoly(x, z, rm.poly))){ if (state.mode !== 'visit') { state.visited = true; setMode('visit'); } state.x = x; state.z = z; collide(); lastRoom = null; updateRoom(); }
});

// ---------- loop
function resize(){ const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w/h; if (state.mode === 'visit') camera.fov = visitFov(); camera.updateProjectionMatrix();
  document.documentElement.style.setProperty('--bar-h', $('bar').offsetHeight + 'px'); }
window.addEventListener('resize', resize); resize();
// ---------- panneaux repliables, cadrage portrait, indice qui s'efface
const compactMQ = window.matchMedia('(max-width:560px), (max-height:520px)');
const infoCard = $('info'), infoBtn = $('infoToggle'), barEl = $('bar'), optBtn = $('bOpts');
$('idSub').textContent = [...infoCard.querySelectorAll('.facts span')].slice(0, 2).map(s => s.textContent).join(' · ');
function setInfo(open){ infoCard.classList.toggle('is-collapsed', !open); infoBtn.setAttribute('aria-expanded', open); infoBtn.setAttribute('aria-label', open ? 'Replier les informations' : 'Afficher les informations'); }
function setOpts(open){ barEl.classList.toggle('opts-open', open); optBtn.setAttribute('aria-expanded', open); }
infoBtn.addEventListener('click', e => { e.stopPropagation(); setInfo(infoCard.classList.contains('is-collapsed')); });
infoCard.addEventListener('click', () => { if (infoCard.classList.contains('is-collapsed')) setInfo(true); });
optBtn.addEventListener('click', () => setOpts(!barEl.classList.contains('opts-open')));
function applyCompact(){ setInfo(!compactMQ.matches); setOpts(!compactMQ.matches); }
compactMQ.addEventListener('change', applyCompact); applyCompact();
canvas.addEventListener('pointerdown', () => { if (compactMQ.matches){ setInfo(false); setOpts(false); } });
new ResizeObserver(() => document.documentElement.style.setProperty('--bar-h', barEl.offsetHeight + 'px')).observe(barEl);
let autoR = true;
const bb = GEO.rooms.flatMap(r => r.poly).reduce((b, [x, z]) => [Math.min(b[0], x), Math.min(b[1], z), Math.max(b[2], x), Math.max(b[3], z)], [1e9, 1e9, -1e9, -1e9]);
const fitHalf = 0.47 * Math.hypot(bb[2] - bb[0], bb[3] - bb[1]);
function fitOrbit(){ if (autoR) state.radius = Math.min(40, Math.max(19, fitHalf / (Math.tan(22.5*Math.PI/180) * camera.aspect))); }
canvas.addEventListener('wheel', () => { autoR = false; }, {passive:true});
canvas.addEventListener('touchstart', e => { if (e.touches.length > 1) autoR = false; }, {passive:true});
window.addEventListener('resize', fitOrbit); fitOrbit();
let hintT;
function showHint(){ hint.classList.remove('gone'); clearTimeout(hintT); hintT = setTimeout(() => hint.classList.add('gone'), 6000); }
new MutationObserver(showHint).observe(hint, {childList:true, characterData:true, subtree:true}); showHint();
let last = performance.now();
function frame(now){
  const dt = Math.min(0.05, (now - last)/1000); last = now;
  for (const dr of doors){ if (dr.t !== dr.target){ const s = dt*2.4; dr.t = dr.target > dr.t ? Math.min(dr.target, dr.t + s) : Math.max(dr.target, dr.t - s); setDoorPose(dr); shadowsDirty(); if (state.mode === 'visit') collide(); } }
  if (hoverQ){ canvas.style.cursor = hitDoor(hoverQ[0], hoverQ[1]) ? 'pointer' : ''; hoverQ = null; }
  if (state.mode === 'visit'){
    const run = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 2.6 : 1.4;
    let f = (keys.has('KeyW')||keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS')||keys.has('ArrowDown') ? 1 : 0) - joy.y;
    let st = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + joy.x;
    state.yaw += ((keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0)) * 1.8 * dt;
    const mag = Math.hypot(f, st); if (mag > 1){ f /= mag; st /= mag; }
    if (mag > 0.01){
      const sy = Math.sin(state.yaw), cy = Math.cos(state.yaw);
      state.x += (-sy*f + cy*st) * run * dt; state.z += (-cy*f - sy*st) * run * dt; collide(); updateRoom();
    }
    camera.position.set(state.x, EYE, state.z); camera.rotation.set(state.pitch, state.yaw, 0);
  } else {
    const sp = Math.sin(state.phi);
    camera.position.set(target.x + state.radius*sp*Math.sin(state.theta), target.y + state.radius*Math.cos(state.phi), target.z + state.radius*sp*Math.cos(state.theta));
    camera.lookAt(target);
  }
  if (SUN.play) sunTick(dt);
  renderer.render(scene, camera);
  drawMini();
  requestAnimationFrame(frame);
}
setMode('orbit'); requestAnimationFrame(frame);
window.__lot = window.__a201 = {state, goTo, setMode, doors, toggleDoor, collide, hitDoor, applyPreset, SUN, setSun, applySun, sunPos, bilan: () => BILAN};
})();
