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
tools/releve.py     relevé : murs extraits du plan (rectangles en mètres) + grille métrique
tools/zoom.py       relevé : agrandissement d'une zone du plan avec la grille, pour lire les cotes fines
tools/overlay.py    contrôle : le relevé superposé au plan de vente d'origine
tools/shots.py      captures de contrôle (visites, mobile, erreurs console)
tools/compare.py    non-régression : même scénario sur deux versions d'une page
tools/smoke.py      chaque page hors ligne se charge et parcourt toutes ses vues sans erreur
```

## Lots sous toiture

Un lot peut décrire ses rampants dans `roof` : chaque pan est un rectangle (`r`), le côté bas (`dir`),
la ligne où la hauteur vaut `h0` (`edge`), la pente (`slope`, en m par m) et le plafond plat (`cap`).
Le moteur en tire les plafonds inclinés, le dessus des murs, les retombées (jouées de lucarne),
la zone sous 1,80 m hachurée au sol et interdite à la marche, et perce les fenêtres de toit (`skylights`).
Une pièce peut porter `low` : sa surface sous 1,80 m, hors surface habitable (voir A301).

## Ajouter ou modifier un lot

```sh
cd _src && npm install          # une fois
node tools/build.mjs            # vérifie les surfaces et régénère ../maquettes/
python3 tools/preview.py ../maquettes
```

Le build compare chaque pièce relevée à la surface du plan (écart toléré : 1 % ou 0,2 m²) et le signale sinon.
Les PDF du promoteur ne sont pas versionnés ici.
