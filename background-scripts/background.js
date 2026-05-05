// Firefox port - scripts are loaded via manifest.json background.scripts
// No importScripts needed
// browserAPI is defined in browser-polyfill.js

serviceManager.registerServiceFactory("settingsService", () => new SettingsService);
serviceManager.registerServiceFactory("loginService", () => new LoginService);
serviceManager.registerServiceFactory("apiService", () => new APIService);
serviceManager.registerServiceFactory("passwordService", () => new PasswordService);
serviceManager.registerServiceFactory("messageService", () => new MessageService);

class BackgroundService {
    constructor() {
        this.adminAutoFill = false;
        this.getUrlMatchers = this.getUrlMatchers.bind(this);
        this.updatePopupIcon = this.updatePopupIcon.bind(this);
        this.enablePopup = this.enablePopup.bind(this);
        this.disablePopup = this.disablePopup.bind(this);
        this.switchTab = this.switchTab.bind(this);
        this.setIconGrey = this.setIconGrey.bind(this);
        this.setIconBlue = this.setIconBlue.bind(this);
        this.main = this.main.bind(this);
        this.loadCredentialsOnce = this.loadCredentialsOnce.bind(this);
        this.credentialsLoaded = false;
        this.initEventListeners();
    }

    getActionApi() {
        return browserAPI.action || browserAPI.browserAction;
    }

    async initialize() {
        return this._initPromise || (this._initPromise = this._doInitialize()), this._initPromise;
    }

    async _doInitialize() {
        try {
            console.log("BackgroundService: Initializing services...");
            await serviceManager.initializeAll();
            this.loginService = serviceManager.getServiceSync("loginService");
            this.passwordService = serviceManager.getServiceSync("passwordService");
            this.settingsService = serviceManager.getServiceSync("settingsService");
            this.apiService = serviceManager.getServiceSync("apiService");
            this.messageService = serviceManager.getServiceSync("messageService");
            this.initEventListeners();
            this._servicesReady = true;
            console.log("BackgroundService: All services ready");
            globalThis.setIconGrey = this.setIconGrey;
            globalThis.setIconBlue = this.setIconBlue;
            globalThis.updatePopupIcon = this.updatePopupIcon;
            return true;
        } catch (e) {
            throw console.error("BackgroundService: Failed to initialize", e), e;
        }
    }

    async ensureReady() {
        if (!this._servicesReady) {
            let e;
            const s = new Promise((s, a) => {
                e = setTimeout(() => {
                    a("Failed to ensure services are ready in 10 seconds");
                }, 5000);
            });
            let a = new Promise(async (s, a) => {
                try {
                    await this.initialize();
                    s();
                } catch (e) {
                    console.error("Failed to ensure services are ready", e);
                    a(e);
                } finally {
                    clearTimeout(e);
                }
            });
            await Promise.race([a, s]);
        }
    }

    isValidString(e) {
        return "string" == typeof e && e.trim().length > 0;
    }

    async getUrlMatchers() {
        const e = [];
        return (await this.passwordService.getCredentialMap()).forEach((s, a) => {
            this.isValidString(a) && s.forEach(s => {
                this.isValidString(s.url) && e.push({
                    hostSuffix: a.toLowerCase(),
                    urlContains: s.url.toLowerCase().split("#")[0]
                });
            });
        }), e;
    }

    async updatePopupIcon(e) {
        const actionApi = this.getActionApi();
        if (!actionApi) return;
        if (await this.ensureReady(), null === e || !await this.loginService.isLoggedIn()) {
            actionApi.setBadgeText({ text: "" }, () => {
                if (browserAPI.runtime.lastError) {
                    console.warn("setBadgeText failed:", browserAPI.runtime.lastError.message);
                }
            });
            return void this.setIconGrey();
        }
        browserAPI.tabs.get(e, async tab => {
            if (browserAPI.runtime.lastError) {
                return void console.error("tabs.get failed:", browserAPI.runtime.lastError.message);
            }
            const s = await this.passwordService.getCredentials(tab.url.toLowerCase());
            actionApi.setBadgeText({ text: s?.length ? `${s.length}` : "" }, () => {
                if (browserAPI.runtime.lastError) {
                    console.warn("setBadgeText failed:", browserAPI.runtime.lastError.message);
                }
            });
            this.setIconBlue();
        });
    }

    async enablePopup(e) {
        const actionApi = this.getActionApi();
        if (!actionApi) return;
        browserAPI.tabs.query({ active: true, currentWindow: true }, s => {
            if (browserAPI.runtime.lastError) {
                console.error("tabs.query failed:", browserAPI.runtime.lastError.message);
            } else if (s?.[0]?.id === e) {
                actionApi.enable(e, () => {
                    if (browserAPI.runtime.lastError) {
                        console.error("action.enable failed:", browserAPI.runtime.lastError.message);
                    } else {
                        this.updatePopupIcon(e);
                    }
                });
            }
        });
    }

    async disablePopup(e) {
        const actionApi = this.getActionApi();
        if (!actionApi) return;
        actionApi.disable(e, () => {
            if (browserAPI.runtime.lastError) {
                console.error("action.disable failed:", browserAPI.runtime.lastError.message);
            }
        });
        actionApi.setBadgeText({ text: "" }, () => {
            if (browserAPI.runtime.lastError) {
                console.warn("setBadgeText failed:", browserAPI.runtime.lastError.message);
            }
        });
    }

    async switchTab(e) {
        if (e.tabId !== browserAPI.tabs.TAB_ID_NONE) {
            await this.updatePopupIcon(e.tabId);
        } else {
            this.disablePopup(e.tabId);
        }
    }

    setIconGrey() {
        const actionApi = this.getActionApi();
        if (!actionApi) return;
        actionApi.setIcon({
            path: {
                16: "../images/ppass-icon-grey-16_solid.png",
                32: "../images/ppass-icon-grey-32.png",
                48: "../images/ppass-icon-grey-48.png",
                128: "../images/ppass-icon-grey-128.png"
            }
        }, () => {
            if (browserAPI.runtime.lastError) {
                console.warn("setIcon failed:", browserAPI.runtime.lastError.message);
            }
        });
    }

    setIconBlue() {
        const actionApi = this.getActionApi();
        if (!actionApi) return;
        actionApi.setIcon({
            path: {
                16: "../images/ppass-icon-blue-16.png",
                32: "../images/ppass-icon-blue-32.png",
                48: "../images/ppass-icon-blue-48.png",
                128: "../images/ppass-icon-blue-128.png"
            }
        }, () => {
            if (browserAPI.runtime.lastError) {
                console.warn("setIcon failed:", browserAPI.runtime.lastError.message);
            }
        });
    }

    async main() {
        try {
            if (await this.loginService.isLoggedIn()) {
                await this.loadCredentialsOnce();
                await this.setIconBlue();
            } else {
                this.setIconGrey();
            }
        } catch (e) {
            console.debug("Main init error:", e);
        }
    }

    loadCredentialsOnceSemaphore = new AsyncSemaphore(1);
    _credentialsLoadedPromise = null;

    async loadCredentialsOnce() {
        if (!this._credentialsLoadedPromise) {
            this._credentialsLoadedPromise = this.loadCredentialsOnceSemaphore.withLock(async () => {
                if (!this.credentialsLoaded) {
                    await this.passwordService.loadAllCredentials();
                    this.credentialsLoaded = true;
                }
            });
        }
        return this._credentialsLoadedPromise;
    }

    initEventListeners() {
        browserAPI.tabs.onUpdated.addListener(this.enablePopup);
        browserAPI.tabs.onActivated.addListener(this.switchTab);
    }
}

const backgroundService = new BackgroundService();

backgroundService.initialize().then(async () => {
    console.log("Background service initialized, starting main...");
    await backgroundService.main();
}).catch(e => {
    console.error("Failed to initialize background service:", e);
});

// Firefox doesn't have onStartup in the same way, use runtime.onStartup
browserAPI.runtime.onStartup.addListener(async () => {
    console.log("Extension started up");
    await backgroundService.ensureReady();
    if (await backgroundService.loginService.isLoggedIn()) {
        console.log("User is logged in on startup");
        await backgroundService.loadCredentialsOnce();
    } else {
        console.log("User not logged in on startup");
    }
});

browserAPI.runtime.onInstalled.addListener(async () => {
    console.log("Extension installed or updated");
    await backgroundService.ensureReady();
    if (await backgroundService.loginService.isLoggedIn()) {
        console.log("User is logged in on install");
        await backgroundService.loadCredentialsOnce();
    } else {
        console.log("User not logged in on install");
    }
});

globalThis.onLoginSuccess = async () => {
    console.log("Login successful, initializing services...");
    await backgroundService.ensureReady();
    await backgroundService.loadCredentialsOnce();
};

globalThis.onLogoutSuccess = async () => {
    console.log("Logout successful, initializing services...");
    if (typeof passwordService !== "undefined") {
        passwordService.credentialMap && passwordService.credentialMap.clear();
        passwordService.cachedFolders = null;
        passwordService.clearCredentialMapFromLocalStorage && await passwordService.clearCredentialMapFromLocalStorage();
    }
};
