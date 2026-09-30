# Maquettes 3D · Cap Ouest

Un moteur unique, un relevé par lot. Ce dossier commence par `_` : GitHub Pages ne le publie pas.

```
engine/moteur.js    le moteur 3D (three.js) : lit window.GEO et construit la maquette
engine/shell.html   l'interface commune (cartouche repliable, barre de commandes, mini-plan)
engine/index.html   gabarit de la page d'accueil (une carte par lot)
lots/<lot>.json     le relevé d'un lot, en mètres. Un lot peut hériter d'un autre :
                    { "base": "c105", "soffits": [...] } = le C105 avec ses soffites
tools/build.mjs     génère ../maquettes/ : moteur.js partagé + une page par lot + l'accueil
tools/preview.py    images d'aperçu 1200×630 (cartes + WhatsApp)
tools/overlay.py    contrôle : le relevé superposé au plan de vente d'origine
tools/shots.py      captures de contrôle (visites, mobile, erreurs console)
tools/compare.py    non-régression : même scénario sur deux versions d'une page
```

## Ajouter ou modifier un lot

```sh
cd _src && npm install          # une fois
node tools/build.mjs            # vérifie les surfaces et régénère ../maquettes/
python3 tools/preview.py ../maquettes
```

Le build compare chaque pièce relevée à la surface du plan (écart toléré : 1 % ou 0,2 m²) et le signale sinon.
Les PDF du promoteur ne sont pas versionnés ici.
