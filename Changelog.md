# Changelog

## [1.0.44] - 2026-05-05

### Barre latérale : retrait du manifeste

- Suppression de **`sidebar_action`**, de la permission **`menus`** et de la logique associée dans **`background.js`** : `sidebarAction.close()` n’est pas utilisable de façon fiable sans geste utilisateur après OAuth ; l’usage courant repose sur le **popup** (OAuth en arrière-plan inchangé).

### Popup : réglages utilisables (hauteur + scroll)

- **`popup.htm`** : classes **`ppass-html-popup`** / **`ppass-body-popup`** à la place des dimensions `body` en inline `!important` (bloquaient l’agrandissement).
- **`plugin.css`** : pas de **`max-height: 100vh`** sur le `html` du popup (souvent ~0 px → bandeau 1 px) ; **`#ppass-main-column`** avec **`min-height`** explicite (512 px, 580 px en réglages) ; **`html`** en **`overflow-y: auto`** si le contenu dépasse.
- En **Paramètres**, la **barre d’actions du bas** est masquée pour libérer la hauteur (`popup.js`).

### Hôtes exclus : UX et sauvegarde

- Carte, intro i18n, bouton **Ajouter une ligne** ; sauvegarde sur **`input`** (debounce) + bouton ; **`fetch`** des templates via **`browserAPI.runtime.getURL`** ; textes d’aide mis à jour (EN/FR/DE/ES/NL).

### Détection des champs

- **`content-scripts/validate.js`** : filtrage des champs invisibles / hors-login (ex. `type=search`, `autocomplete` carte bancaire) tout en restant compatible avec **`field-detector.js`**.

### Fichiers

- `manifest.json`, `views/popup.htm`, `views/popup.js`, `views/plugin.css`, `views/templates/main-menu-settings.html`, `content-scripts/validate.js`, `background-scripts/background.js`, `_locales/*/messages.json`

---

## [1.0.38] - 2026-05-05

### Sidebar après connexion

- **`__MSG_…` brut** : la page `sidebar-idle.htm` ne passait pas par le pipeline de build Mozilla ; le texte est maintenant injecté via **`sidebar-idle.js`** + `browser.i18n.getMessage`.
- **Fermeture** : bouton **« Fermer la barre latérale »** (`sidebarCloseButton`) appelle `browser.sidebarAction.close()` (geste utilisateur = fiable). Tentative supplémentaire depuis `onLoginSuccess` après `setPanel` (peut être ignorée par Firefox sans geste).
- **Réglages — textarea hôtes** : la classe `.ppass-save-prompt-input` imposait **`height: 56px`** (définition générique) ; surcharges **`height: auto`**, **`min-height: 112px`**, bordure visible, **`padding-bottom`** sur la zone scroll pour ne pas passer sous la barre d’actions du bas.

### Fichiers

- `views/sidebar-idle.htm`, `views/sidebar-idle.js`, `views/popup.js`, `views/plugin.css`, `background-scripts/background.js`, `_locales/*/messages.json`, `manifest.json`

---

## [1.0.37] - 2026-05-05

### Barre latérale : uniquement pour la connexion

- Après connexion, `browser.sidebarAction.setPanel` bascule le panneau vers **`views/sidebar-idle.htm`** (court message : utiliser l’icône barre d’outils ; la sidebar sert surtout au login).
- Après déconnexion, le panneau revient sur **`views/sidebar.htm`** (UI complète).
- Le menu contextuel **« Ouvrir le panneau latéral »** sur l’icône n’est affiché **que lorsque vous êtes déconnecté** (évite d’ouvrir la sidebar pour l’usage courant).

### Réglages : mise en page corrigée

- **Cause** : `ppass-styles.css` impose `.ppass-save-prompt-toggle-container { height: 15px }`, incompatible avec des libellés sur plusieurs lignes → chevauchement avec la section hôtes exclus.
- **Correctifs** : lignes d’options en **flex** (`height: auto !important`, suppression du `float` du curseur), section **hôtes** séparée avec titre `<h2>`, texte d’aide en paragraphe.

### Fichiers

- `background-scripts/background.js`, `views/sidebar-idle.htm`, `views/templates/main-menu-settings.html`, `views/plugin.css`, `_locales/*/messages.json`, `manifest.json`

---

## [1.0.36] - 2026-05-05

### Barre latérale Firefox (`sidebar_action`)

- Nouveau panneau **`views/sidebar.htm`** : même logique que le popup (`popup.js`), avec **`sidebar.css`** pour un agencement fluide en largeur variable et défilement.
- **`manifest.json`** : entrée `sidebar_action` (titre i18n `sidebarTitle`) + permission **`menus`**.
- **Clic droit sur l’icône** de l’extension → *« Ouvrir le panneau latéral… »* (`openSidebarMenu`) appelle `browser.sidebarAction.open()` pour afficher la barre latérale sans passer par le menu Affichage de Firefox.

Utile notamment pour la **connexion OAuth** : le panneau latéral reste ouvert pendant que l’onglet de login est utilisé.

### Fichiers

- `views/sidebar.htm`, `views/sidebar.css`, `background-scripts/background.js`, `manifest.json`, `_locales/*/messages.json`

---

## [1.0.35] - 2026-05-05

### Connexion OAuth sans dépendre du popup

- Le flux **ouverture d’onglet + échange de jetons** s’exécute entièrement dans le **script d’arrière-plan** (`RunOAuthLoginInBackground`). Même si le panneau de l’extension se ferme quand vous cliquez sur l’onglet de connexion (comportement normal de Firefox), la connexion peut se terminer ; au **prochain** clic sur l’icône, l’état « connecté » s’affiche sans devoir tout resaisir.
- Message d’information sous le formulaire serveur (`oauthTabOpenedHint`) + protection contre deux connexions simultanées.

### Réglages : mise en page

- Zone réglages avec **défilement vertical** (`.settings-body-scroll`) et **marges** pour les interrupteurs afin d’éviter le chevauchement avec le bloc « hôtes exclus ».
- Colonne principale du popup : `min-height: 0` pour un flex correct.

### Fichiers modifiés

- `views/popup.htm`, `views/popup.js`, `views/plugin.css`, `views/templates/main-menu-settings.html`, `background-scripts/message-service.js`, `_locales/*/messages.json`, `manifest.json`

---

## [1.0.34] - 2026-05-05

### OAuth (Firefox) : capture de redirection plus fiable

- `tabs.onUpdated` : prise en charge de l’URL via `tab.url` lorsque `changeInfo.url` est absent (comportement parfois observé selon les navigations).
- Sondage léger (`tabs.get` toutes les 400 ms) tant que l’onglet d’auth est ouvert, pour ne pas rater la redirection vers `*.chromiumapp.org`.
- Nettoyage des minuteurs / intervalle à la fin du flux.

### Performances : exclusion par hôte (ex. Home Assistant)

- Nouveau réglage **« Désactiver l’automatisation sur ces hôtes »** (une ligne = un hostname) : pas d’injection de `field-detector`, `capture`, icônes, autofill sur ces sites.
- L’ancienne liste « ne jamais enregistrer pour ce site » reste incluse dans cette logique.
- Le script `injector` interroge l’exclusion **avant** la boucle d’attente des services, pour limiter le travail sur les pages exclues.

### Fichiers modifiés

- `background-scripts/login-service.js`, `background-scripts/settings-service.js`, `background-scripts/message-service.js`
- `content-scripts/injector.js`, `views/popup.js`, `views/templates/main-menu-settings.html`
- `_locales/*/messages.json`, `manifest.json` (version 1.0.34)

---

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
