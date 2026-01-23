// Firefox port - adapted for browser.* API
// browserAPI is defined in browser-polyfill.js

const semaphore = new AsyncSemaphore(1);

class APIService {
    constructor() {
        this.callV6EndpointAsync = this.callV6EndpointAsync.bind(this);
        this.clientId = "{6F4DD530-905C-4F20-8D4C-728B5B2682BB}";
        this.semaphore = new AsyncSemaphore(1);
    }

    async init() {
        this.settingsService = globalThis.settingsService;
        this.loginService = globalThis.loginService;
        console.log("APIService dependencies initialized");
    }

    async callV6EndpointAsync(e, r, t, s = null, n = null, i = null) {
        return this._executeApiCall(e, r, t, s, n, i);
    }

    async _executeApiCall(e, r, t, s = null, n = null, i = null) {
        if (i === null) {
            return this.semaphore.withLock(() => this._performApiRequest(e, r, t, s, n, null, true));
        }
        return this._performApiRequest(e, r, t, s, n, i, false);
    }

    async _performApiRequest(e, r, t, s, n, i, o) {
        const a = await this.settingsService.getSetting("passwordServerURL");
        if (!a) {
            throw new Error(this._getMessage("errorRetrieveServerUrl"));
        }
        
        let c = o ? 1 : 0;
        
        for (;;) {
            try {
                const o = i ?? await this.loginService.getAccessToken();
                const c = this._prepareFetchSettings(r, o, s, n);
                const h = await fetch(`${a}/api/v6/rest/${e}`, c);
                return await this._handleApiResponse(h, r, t);
            } catch (e) {
                if (e instanceof InvalidSessionError && o && c <= 1) {
                    c++;
                    await this.loginService.removeToken(true, false);
                    continue;
                }
                throw e;
            }
        }
    }

    _prepareFetchSettings(e, r, t, s) {
        const n = {
            method: e,
            headers: {
                authorization: r,
                "X-Pleasant-Client-Identifier": this.clientId
            }
        };
        if (t) Object.assign(n.headers, t);
        if (s) n.body = s;
        return n;
    }

    async _handleApiResponse(e, r, t) {
        const s = r === "PATCH" ? 204 : 200;
        
        switch (e.status) {
            case s:
                return r === "PATCH" || await e.json();
            case 401:
                throw new InvalidSessionError(this._getMessage("accessTokenInvalid"));
            case 403:
                throw new Error(this._getMessage("accessDenied"));
            case 404:
                throw new Error(this._getMessage("resourceNotFound"));
            case 400:
                try {
                    const r = await e.json();
                    throw new Error(r.message || t);
                } catch (e) {
                    throw new Error(t);
                }
            default:
                if (e.status >= 500) {
                    throw new Error(this._getMessage("serverError") || "Server error occurred");
                }
                throw new Error(`${t} (Status: ${e.status})`);
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
}
