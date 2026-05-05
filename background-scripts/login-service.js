// Firefox port - adapted for browser.* API and MV2
// browserAPI, TaskCompletionSource, StorageHelper are defined in browser-polyfill.js

const TOKEN_REFRESH_BUFFER = 60;
const MAX_RETRY_ATTEMPTS = 2;
const RETRY_DELAY = 1000;

const Logger = {
    debug: (e, t) => { console.log(`[LoginService] ${e}`, t || ""); },
    error: (e, t) => { console.error(`[LoginService] ${e}`, t); },
    warn: (e, t) => { console.warn(`[LoginService] ${e}`, t || ""); }
};

class LoginService {
    constructor() {
        this.loginAsync = this.loginAsync.bind(this);
        this.getDefaultLoginAsync = this.getDefaultLoginAsync.bind(this);
        this.isLoggedIn = this.isLoggedIn.bind(this);
        this.authRequest = this.authRequest.bind(this);
        this.tokenRequest = this.tokenRequest.bind(this);
        this.refreshAccessToken = this.refreshAccessToken.bind(this);
        this.getAccessToken = this.getAccessToken.bind(this);
        this.logoutAsync = this.logoutAsync.bind(this);
        this.launchAuthFlowViaTab = this.launchAuthFlowViaTab.bind(this);
        
        // Use Chrome-style redirect URL that Pleasant server already accepts
        // Format: https://<extension-id>.chromiumapp.org/
        this.chromeExtensionId = "eaedglemlchhplocegehpjfeganapaij";
        this.appUrl = `https://${this.chromeExtensionId}.chromiumapp.org/`;
        
        this.redirectUrl = this.appUrl + "views/popup.htm";
        this.authorizeUrl = "/oauth2/authorize";
        this.tokenUrl = "/oauth2/token";
        this.clientIdUrlEncoded = "%7B6F4DD530-905C-4F20-8D4C-728B5B2682BB%7D";
        this._isLoggedInPromise = null;
        this._getAccessTokenPromise = null;
        this._getRefreshTokenPromise = null;
        
        try {
            const e = new URL(this.appUrl);
            this.cookieDomain = e.hostname;
        } catch (e) {
            Logger.warn("Could not parse app URL for cookie domain", e);
            this.cookieDomain = null;
        }
        
        this.tokenSemaphore = new AsyncSemaphore(1, 10000, 10000);
        this._lockDepth = 0;
        this._tokenRefreshTimeout = null;
        this._tokenRefreshPromise = null;
        this._initPromise = new TaskCompletionSource();
    }

    _logSemaphoreState() {
        this.tokenSemaphore && Logger.debug(`Semaphore state: count=${this.tokenSemaphore.count}, queue=${this.tokenSemaphore.queue ? this.tokenSemaphore.queue.length : "unknown"}`);
    }

    async init() {
        this.settingsService = await this._getService("settingsService");
        Logger.debug("LoginService dependencies initialized");
        this._initialize();
        this._initPromise.resolve(true);
    }

    async _initialize() {
        Logger.debug("Initializing LoginService");
        try {
            if (await this._checkLoginStatusDirectly()) {
                await this._scheduleTokenRefreshDirectly();
            }
            Logger.debug("LoginService initialized successfully");
        } catch (e) {
            Logger.error("Failed to initialize LoginService", e);
        }
    }

    async _checkLoginStatusDirectly() {
        try {
            if (!await this._getSafeServerUrl()) return false;
            
            // Check storage.local instead of storage.session (MV2 compatibility)
            let e = await StorageHelper.get(["accessToken"]);
            if (!e || !e.accessToken || !e.accessToken.value) {
                let e = await browserAPI.cookies.get({ url: this.appUrl, name: "ppass_access_token" });
                if (!e || !e.value) {
                    let e = await browserAPI.cookies.get({ url: this.appUrl, name: "ppass_refresh_token" });
                    if (!e || !e.value) {
                        let e = await StorageHelper.get(["refreshToken"]);
                        if (!e || !e.refreshToken) return false;
                    }
                }
            }
            return true;
        } catch (e) {
            return Logger.error("Error checking login status directly", e), false;
        }
    }

    async _scheduleTokenRefreshDirectly() {
        this._tokenRefreshTimeout && (clearTimeout(this._tokenRefreshTimeout), this._tokenRefreshTimeout = null);
        try {
            const e = await StorageHelper.get(["accessToken"]);
            if (!e || !e.accessToken || !e.accessToken.expirationDate) return;
            const t = e.accessToken.expirationDate;
            const r = t - Date.now() / 1000 - 60;
            if (r <= 0) return;
            Logger.debug(`Scheduling token refresh in ${r} seconds`);
            this._tokenRefreshTimeout = setTimeout(async () => {
                try {
                    const e = await this._getSafeServerUrl();
                    e && await this.refreshAccessToken(e);
                } catch (e) {
                    Logger.error("Scheduled token refresh failed", e);
                }
            }, 1000 * r);
        } catch (e) {
            Logger.error("Failed to schedule token refresh directly", e);
        }
    }

    async _getService(e, t = 5000) {
        const r = globalThis[e];
        if (r) {
            Logger.debug(`Got ${e} from global`);
            return r;
        }
        if (globalThis.serviceManager && typeof globalThis.serviceManager.getService === "function") {
            return new Promise(r => {
                globalThis.serviceManager.getService(e, t => {
                    if (t) {
                        Logger.debug(`Got ${e} from ServiceRegistry`);
                        r(t);
                    } else {
                        Logger.warn(`${e} not available`);
                        r(null);
                    }
                }, t);
            });
        }
        Logger.warn(`${e} not available`);
        return null;
    }

    async _scheduleTokenRefresh() {
        this._tokenRefreshTimeout && (clearTimeout(this._tokenRefreshTimeout), this._tokenRefreshTimeout = null);
        try {
            const e = await StorageHelper.get(["accessToken"]);
            if (!e || !e.accessToken || !e.accessToken.expirationDate) return;
            const t = e.accessToken.expirationDate;
            const r = t - Date.now() / 1000 - 60;
            if (r <= 0) {
                const e = await this._getSafeServerUrl();
                return void (e && await this.refreshAccessToken(e));
            }
            Logger.debug(`Scheduling token refresh in ${r} seconds`);
            this._tokenRefreshTimeout = setTimeout(async () => {
                try {
                    const e = await this._getSafeServerUrl();
                    e && await this.refreshAccessToken(e);
                } catch (e) {
                    Logger.error("Scheduled token refresh failed", e);
                }
            }, 1000 * r);
        } catch (e) {
            Logger.error("Failed to schedule token refresh", e);
        }
    }

    async _getSafeServerUrl() {
        try {
            if (this.settingsService) {
                return await this.settingsService.getSetting("passwordServerURL");
            }
            Logger.warn("Settings service not available");
            return null;
        } catch (e) {
            Logger.error("Failed to get server URL", e);
            return null;
        }
    }

    // Firefox alternative to chrome.identity.launchWebAuthFlow
    // Opens a tab and monitors for redirect to capture the auth code
    async launchAuthFlowViaTab(authUrl) {
        return new Promise((resolve, reject) => {
            let authTabId = null;
            let resolved = false;
            let pollIntervalId = null;
            let timeoutId = null;
            const redirectBase = this.appUrl.replace(/\/+$/, "");

            const cleanup = () => {
                if (pollIntervalId) {
                    clearInterval(pollIntervalId);
                    pollIntervalId = null;
                }
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                browserAPI.tabs.onUpdated.removeListener(onTabUpdated);
                browserAPI.tabs.onRemoved.removeListener(onTabRemoved);
                if (authTabId) {
                    browserAPI.tabs.remove(authTabId).catch(() => {});
                    authTabId = null;
                }
            };

            const tryResolveWithUrl = (url) => {
                if (resolved || !url || typeof url !== "string") return;
                Logger.debug("Auth tab candidate URL:", url);
                if (url.startsWith(redirectBase)) {
                    resolved = true;
                    cleanup();
                    resolve(url);
                    return;
                }
                if (url.includes("error=")) {
                    resolved = true;
                    cleanup();
                    resolve(url);
                }
            };

            const onTabUpdated = (tabId, changeInfo, tab) => {
                if (tabId !== authTabId) return;
                const url = changeInfo.url || (tab && tab.url) || null;
                if (url) tryResolveWithUrl(url);
            };

            const onTabRemoved = (tabId) => {
                if (tabId === authTabId && !resolved) {
                    cleanup();
                    reject(new Error("Authentication cancelled by user"));
                }
            };

            browserAPI.tabs.onUpdated.addListener(onTabUpdated);
            browserAPI.tabs.onRemoved.addListener(onTabRemoved);

            browserAPI.tabs.create({ url: authUrl }).then(tab => {
                authTabId = tab.id;
                Logger.debug("Opened auth tab with ID:", authTabId);
                if (tab && tab.url) tryResolveWithUrl(tab.url);

                pollIntervalId = setInterval(() => {
                    if (resolved || !authTabId) return;
                    browserAPI.tabs.get(authTabId).then(t => {
                        if (t && t.url) tryResolveWithUrl(t.url);
                    }).catch(() => {});
                }, 400);

                timeoutId = setTimeout(() => {
                    if (!resolved) {
                        cleanup();
                        reject(new Error("Authentication timeout"));
                    }
                }, 300000);
            }).catch(err => {
                cleanup();
                reject(err);
            });
        });
    }

    async withLoginLock(e, t = e.name || "anonymous") {
        const r = Date.now();
        if (this._lockDepth > 0) {
            this._lockDepth++;
            try {
                return await e();
            } finally {
                this._lockDepth--;
            }
        }
        try {
            const e = this.tokenSemaphore.acquire("LoginService:" + t);
            let r;
            const o = new Promise((e, o) => {
                r = setTimeout(() => o(new Error(`Semaphore acquisition timeout for ${t}`)), 5000);
            });
            await Promise.race([e.then(e => (clearTimeout(r), e)), o]);
        } catch (r) {
            Logger.error(`Failed to acquire lock for ${t}`, r);
            return await e();
        }
        this._lockDepth = 1;
        try {
            return await e();
        } finally {
            const e = Date.now() - r;
            e > 5000 && Logger.warn(`Long-running operation detected: ${t} took ${e}ms`);
            this._lockDepth = 0;
            this.tokenSemaphore.release();
        }
    }

    async _withRetry(e, t) {
        let r;
        for (let o = 0; o <= 2; o++) {
            try {
                return await e();
            } catch (e) {
                r = e;
                if (e instanceof InvalidSessionError || (e.message && e.message.includes("invalid_grant"))) throw e;
                if (o < 2) {
                    const r = 1000 * Math.pow(2, o);
                    Logger.warn(`${t} failed (attempt ${o + 1}/3), retrying in ${r}ms`, e);
                    await new Promise(e => setTimeout(e, r));
                }
            }
        }
        Logger.error(`${t} failed after 3 attempts`, r);
        throw r;
    }

    async loginAsync(e, t) {
        await this._initPromise.promise;
        return await this.withLoginLock(async () => {
            try {
                Logger.debug(`Starting login flow for server: ${e}`);
                if (!e) throw new Error("Server URL is required");
                const [r, o] = await this.authRequest(e, t);
                const s = await this._extractAuthCode(r);
                await this._withRetry(() => this.tokenRequest(e, s, o), "Token request");
                await globalThis.onLoginSuccess();
                return true;
            } catch (e) {
                Logger.error("Login failed", e);
                throw e;
            }
        }, "loginAsync");
    }

    async _extractAuthCode(e) {
        if (!e) throw new Error("No authorization code provided");
        if (e.startsWith("http")) {
            const t = new URL(e);
            const r = t.searchParams.get("code");
            if (!r) {
                const e = t.searchParams.get("error");
                const r = t.searchParams.get("error_description");
                if (e) throw new Error(`Authentication error: ${e}${r ? ` - ${decodeURIComponent(r)}` : ""}`);
                throw new Error("No authorization code in response URL");
            }
            return r;
        }
        return e;
    }

    async getDefaultLoginAsync() {
        try {
            return await browserAPI.storage.local.get(["url", "username"]);
        } catch (e) {
            Logger.error("Failed to get default login credentials", e);
            throw e;
        }
    }

    async isLoggedIn() {
        await this._initPromise.promise;
        if (this._isLoggedInPromise) return this._isLoggedInPromise;
        
        this._isLoggedInPromise = (async () => {
            try {
                return await this.withLoginLock(async () => {
                    try {
                        if (!await this._getSafeServerUrl()) return false;
                        try {
                            if (!await this.getAccessToken(true)) {
                                if (!await this.getRefreshToken()) return false;
                            }
                        } catch (e) {
                            return false;
                        }
                        return true;
                    } catch (e) {
                        Logger.error("Error checking login status", e);
                        return false;
                    }
                }, "isLoggedIn");
            } finally {
                setTimeout(() => { this._isLoggedInPromise = null; }, 100);
            }
        })();
        return this._isLoggedInPromise;
    }

    async authRequest(e, t) {
        return new Promise(async (r, o) => {
            try {
                e = e.replace(/\/$/, "");
                if (this.settingsService && this.settingsService.updateSettings) {
                    await this.settingsService.updateSettings({ passwordServerURL: e });
                } else {
                    Logger.warn("Settings service not available, skipping server URL storage");
                }
                let o = this.generateCodeVerifier();
                let s = this.generateCodeChallenge(o);
                let i = await this.getDeviceId();
                let n = e + this.authorizeUrl + "?client_id=" + this.clientIdUrlEncoded + 
                    (t == null ? "" : "&client_user=" + encodeURIComponent(t)) + 
                    "&response_type=code&redirect_uri=" + encodeURIComponent(this.redirectUrl) + 
                    "&code_challenge=" + encodeURIComponent(s) + 
                    "&code_challenge_method=S256&device_id=" + i;
                Logger.debug("Generated authorization URL");
                r([n, o]);
            } catch (e) {
                Logger.error("Could not generate authorization URL", e);
                o(e);
            }
        });
    }

    async tokenRequest(e, t, r) {
        await this._initPromise.promise;
        if (!t) throw new Error("No authorization code provided");
        
        let o = new URL(t);
        let s = o.searchParams.get("code");
        
        if (s == null) {
            var i = o.searchParams.get("error");
            if (i == null) {
                let e = this._getMessage("authCodeNotReturned");
                console.error("tokenRequest: " + e);
                throw new Error(e);
            } else {
                i = decodeURIComponent(i);
                let e = o.searchParams.get("error_description");
                let t = this._getMessage("errorReturnedInAuthorization") + "\n" + 
                    this._getMessage("error") + ": " + i + 
                    (e == null ? "" : "\n" + this._getMessage("description") + ": " + decodeURIComponent(e));
                console.error("tokenRequest: " + t);
                throw new Error(t);
            }
        }
        
        let n = "client_id=" + this.clientIdUrlEncoded + 
            "&grant_type=authorization_code&code=" + s + 
            "&redirect_uri=" + this.redirectUrl + 
            "&code_verifier=" + encodeURIComponent(r);
        
        Logger.debug("Requesting tokens with authorization code");
        
        let a = await fetch(e + this.tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: n
        });
        
        let c = await a.json();
        
        if (!a.ok) {
            const e = this._getMessage("errorReturnedInTokenRequest") || "Failed to get access token";
            Logger.error(`Token request failed: ${a.status} - ${c.error || "Unknown error"}`, {
                status: a.status,
                error: c.error,
                description: c.error_description
            });
            throw new Error(e);
        }
        
        try {
            if (this.settingsService && this.settingsService.fetchAdminSettingsAsync) {
                try {
                    var h = await this.settingsService.fetchAdminSettingsAsync(c.access_token);
                    if (h && !h.ChromeExtension) {
                        await this.logoutAsync();
                        throw new Error(this._getMessage("accessDeniedContactAdmin") || "Access denied by administrator");
                    }
                } catch (e) {
                    Logger.warn("Admin settings check failed", e);
                    await this.logoutAsync();
                    throw e;
                }
            }
            await this.setAccessToken(c.access_token, c.expires_in);
            await this.setRefreshToken(c.refresh_token);
            await this._scheduleTokenRefresh();
            await globalThis.onLoginSuccess();
            return true;
        } catch (e) {
            Logger.error("Failed to process token response", e);
            throw e;
        }
    }

    // Helper for i18n messages with fallback
    _getMessage(key) {
        try {
            return browserAPI.i18n.getMessage(key);
        } catch (e) {
            return key;
        }
    }

    async refreshAccessToken(e, t = false) {
        await this._initPromise.promise;
        let r = false;
        
        if (this._tokenRefreshPromise) {
            Logger.debug("Token refresh already in progress, waiting for it to complete");
            return this._tokenRefreshPromise;
        }
        
        r = true;
        
        const o = async () => {
            try {
                let r = await this.getRefreshToken();
                if (!r) {
                    throw new InvalidSessionError(this._getMessage("refreshTokenInvalid") || "Session expired. Please login again.");
                }
                
                let o = "client_id=" + this.clientIdUrlEncoded + 
                    "&grant_type=refresh_token&refresh_token=" + r + 
                    "&redirect_uri=" + this.redirectUrl;
                
                Logger.debug("Refreshing access token");
                
                let s = await fetch(e + this.tokenUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: o
                });
                
                let i = await s.json();
                
                if (!s.ok) {
                    if (s.status === 400 && i.error === "invalid_grant") {
                        Logger.error("Refresh token is invalid, need to re-login");
                        await this.logoutAsync();
                        throw new InvalidSessionError(this._getMessage("accessTokenInvalid") || "Session expired. Please login again.");
                    }
                    const e = this._getMessage("errorReturnedInTokenRequest") || "Failed to refresh access token";
                    Logger.error(`Token refresh failed: ${s.status} - ${i.error || "Unknown error"}`);
                    throw new InvalidSessionError(e);
                }
                
                if (this.settingsService && this.settingsService.fetchAdminSettingsAsync) {
                    try {
                        var t = await this.settingsService.fetchAdminSettingsAsync(i.access_token);
                        if (t && !t.ChromeExtension) {
                            await this.logoutAsync();
                            throw new Error(this._getMessage("accessDeniedContactAdmin") || "Access denied by administrator");
                        }
                    } catch (e) {
                        Logger.warn("Admin settings check failed during token refresh", e);
                        await this.logoutAsync();
                        throw e;
                    }
                }
                
                await this.setAccessToken(i.access_token, i.expires_in);
                if (i.refresh_token) {
                    await this.setRefreshToken(i.refresh_token);
                }
                await this._scheduleTokenRefresh();
                return i.access_token;
            } catch (e) {
                Logger.error("Access token refresh failed", e);
                throw e;
            }
        };
        
        try {
            this._tokenRefreshPromise = t ? o() : this.withLoginLock(o, "refreshAccessToken");
            return await this._tokenRefreshPromise;
        } finally {
            this._tokenRefreshPromise = null;
        }
    }

    async logoutAsync() {
        try {
            Logger.debug("Logging out user");
            this._tokenRefreshTimeout && (clearTimeout(this._tokenRefreshTimeout), this._tokenRefreshTimeout = null);
            await this.removeToken(true, true);
            globalThis.onLogoutSuccess();
            if (typeof globalThis.updatePopupIcon === "function") {
                globalThis.updatePopupIcon(null);
            }
            Logger.debug("Logout complete");
        } catch (e) {
            Logger.error("Unexpected error during logout", e);
        }
    }

    async getAccessToken(e = false) {
        await this._initPromise.promise;
        
        if (this._getAccessTokenPromise) return this._getAccessTokenPromise;
        
        this._getAccessTokenPromise = (async () => {
            try {
                return await this.withLoginLock(async () => {
                    try {
                        let t = await browserAPI.cookies.get({ url: this.appUrl, name: "ppass_access_token" });
                        let r = null;
                        
                        if (t && t.value) {
                            try {
                                r = { accessToken: JSON.parse(t.value) };
                            } catch (e) {
                                Logger.warn("Failed to parse access token cookie", e);
                            }
                        }
                        
                        if (!r || !r.accessToken) {
                            r = await StorageHelper.get(["accessToken"]);
                        }
                        
                        let o = Date.now() / 1000;
                        
                        if (!r || !r.accessToken || !r.accessToken.value || r.accessToken.expirationDate < o) {
                            if (e) return null;
                            let t = await this._getSafeServerUrl();
                            if (!t) throw new Error("No server URL configured");
                            let r = null;
                            try {
                                r = await this.refreshAccessToken(t, true);
                            } catch (e) {
                                Logger.error("Failed to refresh access token", e);
                                throw new InvalidSessionError(this._getMessage("accessTokenInvalid") || "Session expired. Please login again.");
                            }
                            return r;
                        } else {
                            const t = r.accessToken.expirationDate - o;
                            if (!e && t < 60) {
                                Logger.debug("Token expiring soon, refreshing proactively");
                                let e = await this._getSafeServerUrl();
                                if (e) {
                                    try {
                                        return await this.refreshAccessToken(e, true);
                                    } catch (e) {
                                        Logger.warn("Proactive token refresh failed, using existing token", e);
                                    }
                                }
                            }
                            return r.accessToken.value;
                        }
                    } catch (e) {
                        Logger.error("Failed to get access token", e);
                        throw e;
                    }
                }, "getAccessToken");
            } finally {
                setTimeout(() => { this._getAccessTokenPromise = null; }, 100);
            }
        })();
        
        return this._getAccessTokenPromise;
    }

    async setAccessToken(e, t) {
        return await this.withLoginLock(async () => {
            let r = Date.now() / 1000;
            try {
                await browserAPI.cookies.set({
                    url: this.appUrl,
                    name: "ppass_access_token",
                    value: JSON.stringify({ value: e, expirationDate: r + t }),
                    secure: true,
                    httpOnly: true,
                    sameSite: "strict"
                });
                await StorageHelper.set({ accessToken: { value: e, expirationDate: r + t } });
                Logger.debug(`Access token stored, expires in ${t}s`);
            } catch (e) {
                Logger.error("Could not save access token", e);
                throw e;
            }
        }, "setAccessToken");
    }

    async setRefreshToken(e) {
        return await this.withLoginLock(async () => {
            try {
                await browserAPI.cookies.set({
                    url: this.appUrl,
                    name: "ppass_refresh_token",
                    value: e,
                    secure: true,
                    httpOnly: true,
                    sameSite: "strict"
                });
                await StorageHelper.set({ refreshToken: e });
                Logger.debug("Refresh token stored");
            } catch (e) {
                Logger.error("Could not save refresh token", e);
                throw e;
            }
        }, "setRefreshToken");
    }

    async getRefreshToken() {
        if (this._getRefreshTokenPromise) return this._getRefreshTokenPromise;
        
        this._getRefreshTokenPromise = (async () => {
            try {
                return await this.withLoginLock(async () => {
                    try {
                        let e = await browserAPI.cookies.get({ url: this.appUrl, name: "ppass_refresh_token" });
                        let t = e && e.value;
                        if (!t) {
                            t = (await StorageHelper.get(["refreshToken"])).refreshToken;
                        }
                        return t;
                    } catch (e) {
                        const t = this._getMessage("unexpectedErrorGettingToken") || "Unexpected error getting token";
                        Logger.error(t, e);
                        throw new Error(t);
                    }
                }, "getRefreshToken");
            } finally {
                setTimeout(() => { this._getRefreshTokenPromise = null; }, 100);
            }
        })();
        
        return this._getRefreshTokenPromise;
    }

    async removeToken(e = false, t = false) {
        return await this.withLoginLock(async () => {
            try {
                if (e) {
                    await browserAPI.cookies.remove({ url: this.appUrl, name: "ppass_access_token" });
                    await StorageHelper.remove("accessToken");
                    Logger.debug("Access token removed from cookies and storage");
                }
                if (t) {
                    await browserAPI.cookies.remove({ url: this.appUrl, name: "ppass_refresh_token" });
                    await StorageHelper.remove("refreshToken");
                    Logger.debug("Refresh token removed from cookies and storage");
                }
            } catch (e) {
                Logger.error("Error removing tokens", e);
                throw e;
            }
        }, "removeToken");
    }

    randInt32ToChar(e) {
        let t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
        return t[e % 66];
    }

    generateCodeVerifier() {
        var e = new Uint32Array(64);
        crypto.getRandomValues(e);
        return Array.from(e, this.randInt32ToChar).join("");
    }

    generateCodeChallenge(e) {
        if (typeof sjcl !== "undefined" && sjcl.hash && sjcl.hash.sha256) {
            let t = sjcl.hash.sha256.hash(e);
            return sjcl.codec.base64.fromBits(t);
        }
        Logger.warn("SJCL not available, using alternate code challenge method");
        throw new Error("SJCL library required for code challenge generation");
    }

    async getDeviceId() {
        return await this.withLoginLock(async () => {
            let e = await browserAPI.storage.local.get("deviceId");
            if (e.deviceId !== undefined) {
                return e.deviceId;
            } else {
                let e = this.generateDeviceId();
                try {
                    await this.saveNewDeviceId(e);
                } catch (e) {
                    Logger.warn("Unable to save new device ID", e);
                }
                return e;
            }
        }, "getDeviceId");
    }

    async saveNewDeviceId(e) {
        return await this.withLoginLock(async () => {
            try {
                await browserAPI.storage.local.set({ deviceId: e });
                Logger.debug("New device ID saved");
            } catch (e) {
                Logger.error("Error saving new device ID", e);
                throw e;
            }
        }, "saveNewDeviceId");
    }

    generateDeviceId() {
        let e = new Uint8Array(32);
        crypto.getRandomValues(e);
        let t = "";
        for (var r = 0; r < e.length; ++r) {
            t += e[r].toString(16).padStart(2, "0");
        }
        return t;
    }
}
