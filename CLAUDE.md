# Plugin Obsidian "Colbert" — repo de dev

> Ce fichier est lu automatiquement par Claude Code à l'ouverture du repo.
> Il contient les contraintes critiques que toute session Claude doit respecter.

---

## RÈGLE ABSOLUE — À NE JAMAIS ENFREINDRE

Ce repo est le **code source** d'un plugin Obsidian. Le **vault Obsidian
patrimonial** (où le plugin s'exécute en production) est un répertoire
**séparé** sur la machine de l'utilisateur, hors de ce repo.

L'utilisateur exporte typiquement le path du vault dans `$VAULT` :

```bash
export VAULT="<chemin absolu vers le vault patrimonial>"
```

Tu peux **LIRE** des fichiers de ce vault uniquement pour deux raisons :

1. Lire `99 - LLM/scripts/committee.sh` pour confirmer ses flags CLI et son
   nommage de fichiers de sortie.
2. Référence ponctuelle si une spec t'y renvoie explicitement (ex. lister les
   `committee-bootstrap-*.md` de `06 - Analyses/Committees/`, lire un Final
   Report pour debug).

Tu ne dois **JAMAIS** :

- Écrire, créer, modifier ou supprimer un fichier dans le vault.
- Lancer `committee.sh` ou tout autre script du vault.
- Faire un `git init` / `git add` / `git commit` qui touche le vault.
- Installer le plugin dans `.obsidian/plugins/` du vault directement
  (cf. section BRAT ci-dessous : c'est BRAT qui le fait).

**Tout le développement se fait dans ce repo dédié, hors du vault.**

---

## Distribution via BRAT

Ce plugin n'est PAS publié dans le store officiel Obsidian. Il est installé
chez l'utilisateur via [BRAT](https://github.com/TfTHacker/obsidian42-brat),
qui clone un repo GitHub directement dans `.obsidian/plugins/<id>/` et le
maintient à jour.

**Mode utilisé : "no-release"** — BRAT lit `main.js`, `manifest.json`,
`styles.css` à la racine du repo (pas besoin de tagger des releases).

Conséquences pour le workflow de dev :

1. `npm run build` produit `main.js` à la racine du repo.
2. `main.js` est **commité au repo** (le `.gitignore` ne l'exclut PAS).
3. Push sur `main` → l'utilisateur lance `Cmd+P → "BRAT: Check for updates
   to all beta plugins"` dans Obsidian → BRAT pull et reload le plugin.

Cycle d'itération typique :

```bash
npm run build
git add main.js manifest.json styles.css src/
git commit -m "..."
git push
# (dans Obsidian) Cmd+P → "BRAT: Check for updates..."
```

Quand on bump la version (changement breaking ou release stable) : éditer
`manifest.json` (`version`) + `versions.json` + commit.

---

## Conséquences pratiques pour Claude

- `cwd` pour `git` et `npm` = ce repo, jamais le vault.
- **Ne jamais** copier des fichiers vers `$VAULT/.obsidian/plugins/colbert/`
  manuellement — BRAT s'en occupe.
- Avant de proposer `git push`, **toujours demander confirmation** à
  l'utilisateur (action visible publiquement).
- Si une étape requiert de toucher au vault (ex. tester l'installation),
  **demander à l'utilisateur de le faire**.
- Audit de toute info qui passerait dans un commit public (pas de chemins
  absolus locaux, pas de tokens, pas de noms d'utilisateur système).

---

## Mode itératif

L'utilisateur valide chaque étape avant de passer à la suivante. Réponses
succinctes, pas de re-paraphrase du code écrit.
