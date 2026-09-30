// Génère le site des maquettes à partir du moteur unique et des relevés.
//   node tools/build.mjs [dossier_de_sortie]      (par défaut ../maquettes)
// Sorties :
//   <out>/moteur.js                 moteur + three.js, partagé par toutes les pages (mis en cache)
//   <out>/cap-ouest-<lot>.html      une page légère par lot (relevé en ligne + aperçu WhatsApp)
//   out/hors-ligne/<LOT>.html       un fichier autonome par lot, à envoyer par mail
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as esbuild from 'esbuild';

const SRC = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.resolve(SRC, process.argv[2] || '../maquettes');
const OFFLINE = path.join(SRC, 'out', 'hors-ligne');
const BASE_URL = process.env.BASE_URL || 'https://wazaaa974.github.io/maquettes';
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(OFFLINE, { recursive: true });

// ---------- relevés : un lot peut hériter d'un autre ("base") et n'écrire que ses différences
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const merge = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = isObj(v) && isObj(a[k]) ? merge(a[k], v) : v; return o; };
const raw = Object.fromEntries(fs.readdirSync(path.join(SRC, 'lots')).filter(f => f.endsWith('.json'))
  .map(f => [f.replace('.json', ''), JSON.parse(fs.readFileSync(path.join(SRC, 'lots', f), 'utf8'))]));
const resolve = id => { const d = raw[id]; if (!d.base) return d; const { base, ...rest } = d; return merge(resolve(base), rest); };
const lots = Object.keys(raw).sort().map(id => ({ id, geo: resolve(id) }));

// ---------- contrôle : surfaces recalculées (polygones) contre surfaces du plan
const area = p => Math.abs(p.reduce((s, [x, z], i) => { const [x2, z2] = p[(i + 1) % p.length]; return s + x * z2 - x2 * z; }, 0)) / 2;
let bad = 0;
for (const { id, geo } of lots) for (const r of geo.rooms) {
  const a = area(r.poly), e = Math.abs(a - r.plan);
  if (e > Math.max(0.2, r.plan * 0.01)) { bad++; console.warn(`  ⚠ ${id} · ${r.name} : ${a.toFixed(2)} m² relevés pour ${r.plan} m² au plan`); }
}

// ---------- moteur : empaqueté une seule fois
const res = await esbuild.build({ entryPoints: [path.join(SRC, 'engine/moteur.js')], bundle: true, format: 'esm', minify: true, write: false, target: 'es2020', legalComments: 'none' });
const engine = res.outputFiles[0].text;
const ver = crypto.createHash('sha1').update(engine).digest('hex').slice(0, 8);
fs.writeFileSync(path.join(OUT, 'moteur.js'), engine);

// ---------- gabarit
const shell = fs.readFileSync(path.join(SRC, 'engine/shell.html'), 'utf8').replace(/<title>.*?<\/title>\s*/, '');
const fontFace = (pkg, family, w) => {
  const f = path.join(SRC, 'node_modules/@fontsource', pkg, 'files', `${pkg}-latin-${w}-normal.woff2`);
  return `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${fs.readFileSync(f).toString('base64')}) format("woff2")}`;
};
const fonts = [...[400, 500, 600].map(w => fontFace('jost', 'Jost', w)), ...[400, 500].map(w => fontFace('ibm-plex-mono', 'IBM Plex Mono', w))].join('\n');
const reset = ':root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function page({ id, geo }, offline) {
  const m = geo.meta, title = `${m.name} Cap Ouest`, url = `${BASE_URL}/cap-ouest-${id}.html`;
  const body = shell.replaceAll('{{NAME}}', esc(m.name));
  const head = offline
    ? body.replace(/<link rel="preconnect"[^>]*>\s*/g, '').replace(/<link rel="stylesheet" href="https:\/\/fonts[^>]*>\s*/g, '')
    : body;
  const og = offline ? '' : `
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)} · maquette 3D">
<meta property="og:description" content="${esc(`${m.type} · ${m.facts[1]} · ${m.facts[2]}. Maquette 3D relevée sur le plan de vente : visite pièce par pièce, mode photo, soir d'été.`)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${url.replace(/\.html$/, '.jpg')}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">`;
  const data = `<script>window.GEO = ${JSON.stringify(geo).replace(/<\//g, '<\\/')};</script>`;
  const script = offline ? `<script type="module">\n${engine.replace(/<\/script/gi, '<\\/script')}\n</script>` : `<script type="module" src="moteur.js?v=${ver}"></script>`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>${og}
<style>${reset}${offline ? '\n' + fonts : ''}</style>
</head>
<body>
${head.trim()}
${data}
${script}
</body>
</html>
`;
}

for (const lot of lots) {
  fs.writeFileSync(path.join(OUT, `cap-ouest-${lot.id}.html`), page(lot, false));
  fs.writeFileSync(path.join(OFFLINE, `Cap-Ouest-${lot.geo.meta.name}-maquette-3D.html`), page(lot, true));
}
fs.writeFileSync(path.join(SRC, 'out', 'lots.json'), JSON.stringify(lots.map(({ id, geo }) => ({ id, ...geo.meta })), null, 1));
fs.mkdirSync(path.join(SRC, 'out', 'geo'), { recursive: true });
for (const { id, geo } of lots) fs.writeFileSync(path.join(SRC, 'out', 'geo', `${id}.json`), JSON.stringify(geo));

// ---------- page d'accueil : une carte par lot (bâtiment, puis étage)
const WORDS = ['Zéro', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf', 'Dix', 'Onze', 'Douze'];
const cards = [...lots].sort((a, b) => (a.geo.meta.building + a.geo.meta.level + a.id).localeCompare(b.geo.meta.building + b.geo.meta.level + b.id)).map(({ id, geo: { meta: m } }) => {
  const ext = (m.overview.match(/\+ ([\d,]+ m²) ext/) || [])[1];
  const facts = [m.facts[0], m.facts[1], ext && `+ ${ext} ext.`, m.facts[2], m.facts[3]].filter(Boolean).map(f => `<span>${esc(f)}</span>`).join('');
  return `    <a class="lot" href="cap-ouest-${id}.html">
      <img src="cap-ouest-${id}.jpg" alt="Vue 3D en plongée de l'appartement ${esc(m.name)} meublé" width="1200" height="630" loading="lazy">
      <div class="lot-body">
        <div class="lot-head"><h2>${esc(m.name)}</h2><span class="bat">Bâtiment ${esc(m.building)}</span></div>
        <div class="facts">${facts}</div>
        <span class="go">Ouvrir la maquette</span>
      </div>
    </a>`;
}).join('\n');
const index = fs.readFileSync(path.join(SRC, 'engine/index.html'), 'utf8')
  .replace('{{CARDS}}', cards).replaceAll('{{COUNT}}', WORDS[lots.length] || String(lots.length)).replaceAll('{{BASE}}', BASE_URL);
fs.writeFileSync(path.join(OUT, 'index.html'), index);
console.log(`moteur.js ${(engine.length / 1024).toFixed(0)} Ko (v${ver}) · ${lots.length} lots : ${lots.map(l => l.id).join(', ')} → ${path.relative(process.cwd(), OUT) || '.'}${bad ? ` · ${bad} écart(s) de surface` : ' · surfaces OK'}`);
