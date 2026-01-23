# Pleasant Password Server Auto-Filler - Firefox Port

Portage non-officiel de l'extension Chrome "Pleasant Password Server Auto-Filler" vers Firefox.

## Description

Cette extension permet le remplissage automatique des identifiants depuis un serveur Pleasant Password Server dans Firefox.
C'est un portage **direct** de l'extension Chrome d'origine : le code a été adapté pour Firefox avec un minimum de modifications,
en conservant la structure et le comportement de la version Chrome.

## Portage

Le portage a été effectué à partir du code Chrome, en s'appuyant sur la compatibilité WebExtension :
ajustements ciblés du `manifest.json`, adaptation des appels API (`browser.*`/`chrome.*`), et correctifs spécifiques
au flux OAuth sous Firefox.

## Installation (Développement)

### Prérequis
- Firefox 109+ 
- web-ext (optionnel, pour le développement)

### Installation temporaire (développement)

1. Ouvrir Firefox et aller à `about:debugging`
2. Cliquer sur "Ce Firefox" (This Firefox)
3. Cliquer sur "Charger un module complémentaire temporaire"
4. Sélectionner le fichier `manifest.json` dans ce dossier

### Installation avec web-ext

```bash
# Installer web-ext
npm install -g web-ext

# Lancer Firefox avec l'extension
cd pleasant-firefox-port
web-ext run

# Vérifier l'extension
web-ext lint

# Construire le package
web-ext build
```

## Installation permanente

Pour une installation permanente sans signature Mozilla :

1. Dans Firefox, aller à `about:config`
2. Définir `xpinstall.signatures.required` sur `false` (Firefox Developer/Nightly uniquement)
3. Installer le fichier `.xpi` généré par `web-ext build`

**Note**: Pour Firefox standard, l'extension doit être signée via le programme AMO (addons.mozilla.org) en mode "unlisted".

## Différences avec la version Chrome

- Utilisation de Manifest V2 (MV2) au lieu de MV3 pour une meilleure compatibilité Firefox
- `browser_action` au lieu de `action`
- `background.scripts` au lieu de `service_worker`
- `storage.local` au lieu de `storage.session`
- Utilisation de l'API `browser.*` avec fallback vers `chrome.*`
- `browserAPI` exposé via `window` pour l'override `identity` dans le popup

## Détails techniques (pour les curieux)

- Architecture en services côté background (`ServiceManager`) : login, API, mots de passe, settings, messagerie
- Cache des identifiants en `IndexedDB` (chargement initial + recherche locale rapide)
- Flux OAuth2 adapté Firefox (override `identity` + fallback ouverture d'onglet)
- Polyfill `browser-polyfill.js` + wrapper `browserAPI` pour unifier `browser`/`chrome`
- Scripts de contenu injectés pour détection des champs et auto-remplissage
- `crypto.js` embarque SJCL (lib crypto utilisée par l'extension d'origine)

## Permissions requises

- `storage` : Stockage des paramètres et tokens
- `cookies` : Gestion des sessions OAuth
- `tabs` : Détection des onglets actifs
- `identity` : Flux d'authentification OAuth2
- `<all_urls>` : Injection des scripts sur toutes les pages

## Configuration

1. Cliquer sur l'icône de l'extension
2. Entrer l'URL de votre serveur Pleasant Password Server
3. Se connecter avec vos identifiants

## Avertissement

Ce portage est pour **usage personnel uniquement**. L'extension originale appartient à Pleasant Solutions. Ne redistribuez pas cette extension.

## Licence

Usage personnel uniquement - Pas de redistribution autorisée.
