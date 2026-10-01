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
tools/smoke.py      chaque page hors ligne se charge, parcourt toutes ses vues et calcule son ensoleillement sans erreur
tools/soleil.py     contrôle du mode Soleil : captures à des dates et heures données + bilan par pièce
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

## Mode Soleil

Le soleil est calculé pour Carcans (45,08° N ; 1,09° O), à l'heure légale de Paris, pour la date et l'heure choisies.
`northDeg` dans un relevé donne le nord vrai, en degrés depuis le haut du plan dans le sens horaire. Il est mesuré sur le plan
de masse : 6,2° pour le bâtiment A, 78,7° pour B et C.
Les ombres viennent du bâtiment lui-même (planchers, balcons couverts) et des volumes voisins (`mass`), prolongés jusqu'au
faîtage d'un R+3. Les arbres ne comptent pas : ils sont décoratifs et ne sont pas placés fidèlement.
Le bilan par pièce lance des rayons vers le soleil depuis un point du sol tous les 30 cm, toutes les 10 minutes. Le soleil
compte entre le lever et le coucher, au-dessus de 4° (horizon de pins et de dunes), dès qu'au moins 2 % du sol est éclairé.
