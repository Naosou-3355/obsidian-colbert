# Colbert — plugin Obsidian

Sidebar Obsidian qui orchestre un script bash externe (`committee.sh`)
réalisant un comité d'analyse multi-experts. Le plugin est un "thin UI" :
toute la logique métier reste dans le script ; le plugin se contente de
spawn le subprocess, streamer ses logs et ouvrir le rapport final.

**Statut** : beta privée, distribuée via [BRAT](https://github.com/TfTHacker/obsidian42-brat).
Pas publié dans le store officiel.

## Installation (BRAT)

1. Installer le plugin BRAT dans Obsidian (Settings → Community plugins →
   chercher "BRAT" → Install).
2. `Cmd+P` → "BRAT: Add a beta plugin for testing".
3. Coller l'URL : `https://github.com/Naosou-3355/obsidian-colbert`.
4. Activer "Colbert" dans Settings → Community plugins.
5. Settings → Colbert → renseigner :
   - **Chemin de committee.sh** (chemin absolu).
   - **Binaire claude** (optionnel, sinon PATH étendu).
   - **Dossier des bootstraps** (relatif au vault, défaut `06 - Analyses/Committees`).
   - **Dossier des Final Reports** (relatif au vault, défaut `06 - Analyses/Final Reports`).

Mises à jour : `Cmd+P` → "BRAT: Check for updates to all beta plugins".

## Contraintes

- Desktop only (`child_process` n'existe pas sur mobile).
- macOS / Linux : le script `committee.sh` est invoqué via `bash`.
- Le script attend un fichier "bootstrap" pré-existant dans le dossier
  `committees` configuré (le plugin propose un sélecteur).

## Développement

```bash
npm install
npm run build      # produit main.js à la racine
```

`main.js` est commité au repo (mode BRAT no-release).

## Licence

0-BSD.
