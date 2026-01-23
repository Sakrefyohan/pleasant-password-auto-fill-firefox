# Changelog

## [1.0.33-firefox-3] - 2026-01-20

### Fix override de l'API identity dans le popup

#### Problème
`browserAPI` était défini avec `const` dans `translate.js`, empêchant l'override `identity` et causant `clearAllCachedAuthTokens is not a function` sous Firefox.

#### Solution
- `browserAPI` est maintenant exposé via `window` pour permettre l'override dans `firefox-auth-override.js`

#### Fichiers modifiés
- `views/translate.js` : utilisation de `var browserAPI` lié à `window`

---

## [1.0.33-firefox-2] - 2026-01-20

### Fix OAuth redirect URI issue

#### Problème
Le serveur Pleasant Password Server n'acceptait que l'URI de redirection Chrome, pas celle de Firefox.

#### Solution
- Utilisation de l'URI de redirection Chrome originale (`https://eaedglemlchhplocegehpjfeganapaij.chromiumapp.org/`)
- Remplacement de `browser.identity.launchWebAuthFlow` par une ouverture d'onglet normale
- Surveillance de l'onglet pour capturer le code OAuth lors de la redirection
- Fermeture automatique de l'onglet après authentification

#### Fichiers modifiés
- `background-scripts/login-service.js` : Nouvelle fonction `launchAuthFlowViaTab()`
- `background-scripts/message-service.js` : Handler pour `LaunchAuthFlowViaTab`
- `views/popup.js` : Utilisation du nouveau flux d'authentification

---

## [1.0.33-firefox] - 2026-01-20

### Portage initial depuis Chrome vers Firefox

#### Modifications du manifest.json
- Passage de Manifest V3 à Manifest V2 pour compatibilité Firefox
- Ajout de `browser_specific_settings.gecko` avec ID Firefox
- Remplacement de `action` par `browser_action`
- Remplacement de `service_worker` par `background.scripts`
- Conversion de `web_accessible_resources` au format MV2
- Suppression de la permission `scripting` (non nécessaire en MV2)
- Ajout de la permission `activeTab`

#### Modifications du background.js
- Suppression de `importScripts()` (chargement via manifest)
- Remplacement de `chrome.action.*` par `browserAPI.browserAction.*`
- Ajout du polyfill `browserAPI` (browser/chrome)

#### Modifications du login-service.js
- Remplacement de `chrome.storage.session` par `storage.local` (MV2)
- Ajout du helper `StorageHelper` pour abstraction du stockage
- Adaptation de `chrome.identity.getRedirectURL()` pour Firefox
- Ajout du polyfill `TaskCompletionSource`
- Utilisation de `browserAPI` partout

#### Modifications de api-service.js
- Ajout du polyfill `browserAPI`
- Helper `_getMessage()` pour i18n avec fallback

#### Modifications de popup.js
- Remplacement global de `chrome.` par `browserAPI.`

#### Modifications de injector.js
- Ajout du polyfill `browserAPI`
- Reformatage du code pour lisibilité

### Fichiers ajoutés
- `README.md` : Documentation d'installation
- `Changelog.md` : Ce fichier

### Notes techniques
- Version Firefox minimale requise : 109.0
- ID extension : `pleasant-password-autofiller@local.dev`
- L'extension n'est pas signée - installation en mode développeur requise
