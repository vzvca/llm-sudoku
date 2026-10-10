# llm-sudoku

Application web single-page **sans backend** de jeu de sudoku, propulsée par
l'IA Mistral. Écrite en JavaScript vanilla + [Mithril.js](https://mithril.js.org)
(inspirée de l'architecture de [leitner](https://github.com/vzvca/leitner)).

## Fonctionnalités

- Génération de grilles de sudoku (facile / moyen / difficile) à solution unique,
  entièrement en local dans le navigateur.
- Saisie au clavier ou à la souris, détection des conflits en temps réel.
- **Interaction IA** : l'utilisateur écrit (ou parle au micro, reconnaissance
  vocale `fr-FR` via le navigateur) une commande en français, ex.
  « prépare une nouvelle grille difficile », « mets un 5 ligne 2 colonne 7 »,
  « donne-moi un indice », « vérifie ma grille », « résous la grille ».
  Le message est envoyé à l'API Mistral (chat completions) avec des
  **outils de function calling** au format JSON standard. Le LLM renvoie une
  liste d'appels de fonctions avec paramètres ; les fonctions correspondantes
  (codées en JavaScript) sont exécutées localement et mettent à jour la grille.
- Suggestions d'aide : la case la plus facile à déduire est mise en évidence
  (indice sans révéler la valeur).
- Persistance de la partie et des réglages via `localStorage`.

## Outils exposés au LLM (function calling)

| Fonction | Paramètres | Rôle |
|---|---|---|
| `new_grid` | `difficulty` (`facile`\|`moyen`\|`difficile`) | Nouvelle grille |
| `check_grid` | — | Vérifie complétude / conflits |
| `place_value` | `row`, `column`, `value` (1-9) | Place une valeur |
| `clear_cell` | `row`, `column` | Efface une case |
| `get_hint` | — | Suggère la case la plus facile |
| `solve_grid` | — | Résolution automatique |
| `reset_grid` | — | Retour aux indices de départ |

## Utilisation

Ouvrir `index.html` directement dans un navigateur (aucun build, aucune
dépendance à installer ; mithril est servi localement depuis `vendor/`).

1. Onglet **Réglages** : renseigner votre clé API Mistral
   (stockée uniquement dans le `localStorage` du navigateur, jamais envoyée
   ailleurs qu'à `api.mistral.ai`) et éventuellement le modèle
   (`mistral-small-latest` par défaut).
2. Onglet **Jeu** : jouer, taper ou dicter des commandes.
   La reconnaissance vocale nécessite Chrome ou Edge (API `SpeechRecognition`).

## Tests

```sh
node --test test/logic.test.js
```

## Structure

```
index.html            point d'entrée SPA
css/app.css           styles
vendor/mithril.min.js mithril (vendé)
js/models/sudoku.js   moteur sudoku (génération, solveur, indices, sérialisation)
js/services/
  mistral.js          client API Mistral + définition des outils (function calling)
  speech.js           reconnaissance vocale (fr-FR)
  settings.js         réglages (localStorage)
  store.js            état du jeu + fonctions appelées par le LLM
js/views/             composants Mithril (Layout, Board, Game, Settings)
test/logic.test.js    tests node:test
```
