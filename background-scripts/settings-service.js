// Firefox port - adapted for browser.* API
// browserAPI is defined in browser-polyfill.js

class SettingsService {
    domainBlacklist;
    adminSettings = new TaskCompletionSource();

    constructor() {
        this.getSettings = this.getSettings.bind(this);
        this.getSetting = this.getSetting.bind(this);
        this.updateSettings = this.updateSettings.bind(this);
        this.domainBlacklist = new DomainBlackList();
        this.updateSettings({ showFoldersInCredentialList: true });
    }

    async init() {
        try {
            const autoFillEnabled = await this.getSetting("autoFillEnabled");
            if (autoFillEnabled === undefined) {
                await this.updateSettings({ autoFillEnabled: true });
            }
            const captureEnabled = await this.getSetting("captureEnabled");
            if (captureEnabled === undefined) {
                await this.updateSettings({ captureEnabled: true });
            }
        } catch (e) {
            console.warn("SettingsService init: using defaults", e);
            await this.updateSettings({ autoFillEnabled: true, captureEnabled: true });
        }
    }

    async fetchAdminSettingsAsync(t = null) {
        this.adminSettings = new TaskCompletionSource();
        const defaultSettings = {
            ChromeExtension: false,
            PasswordUse: false,
            AutoFill: false,
            PasswordCapture: false,
            ChooseFolder: false
        };
        try {
            const result = await apiService.callV6EndpointAsync(
                "pluginpolicy",
                "GET",
                "Could not load policy settings",
                null,
                null,
                t
            );
            if (!result.ChromeExtension) {
                await loginService.logoutAsync();
            }
            this.adminSettings.resolve(result);
            return result;
        } catch (e) {
            this.adminSettings.resolve(defaultSettings);
            throw e;
        }
    }

    async getAdminSettingsAsync(t) {
        const timeout = new Promise(resolve => {
            setTimeout(() => resolve(null), 100);
        });
        try {
            const result = await Promise.race([timeout, this.adminSettings.promise]);
            if (result === null) {
                return await this.fetchAdminSettingsAsync(t);
            }
            return result;
        } catch (e) {
            console.error("Error getting admin settings:", e);
            return await this.fetchAdminSettingsAsync(t);
        }
    }

    async getSetting(t) {
        try {
            const result = await browserAPI.storage.local.get(t);
            // Handle case where result is empty or key doesn't exist
            if (result && typeof result === 'object' && t in result) {
                return result[t];
            }
            return undefined;
        } catch (e) {
            console.error(`Failed to get setting "${t}":`, e);
            return undefined;
        }
    }

    async getSettings(t) {
        try {
            return await browserAPI.storage.local.get(t);
        } catch (e) {
            console.error("Failed to get settings:", e);
            return {};
        }
    }

    async updateSettings(t) {
        try {
            await browserAPI.storage.local.set(t);
        } catch (e) {
            console.error("Failed to update settings:", e);
            throw e;
        }
    }

    isDomainBlacklisted(t) {
        return this.domainBlacklist.containsDomain(t);
    }

    blackListDomain(t, i) {
        if (i) {
            this.domainBlacklist.addDomain(t);
        } else {
            this.domainBlacklist.removeDomain(t);
        }
    }

    /**
     * Pages where heavy content scripts (field-detector, capture, etc.) must not run.
     * Includes domain blacklist (never save) plus optional host list in storage.
     */
    async isAutomationSuppressedForUrl(url) {
        if (!url) return false;
        if (this.isDomainBlacklisted(url)) return true;
        try {
            const hosts = await this.getSetting("suppressedAutomationHosts");
            if (!Array.isArray(hosts) || hosts.length === 0) return false;
            const hostname = new URL(url).hostname.toLowerCase();
            for (const h of hosts) {
                if (!h || typeof h !== "string") continue;
                const pat = h.trim().toLowerCase();
                if (!pat) continue;
                if (hostname === pat) return true;
                if (hostname.endsWith("." + pat)) return true;
            }
        } catch (e) {
            console.warn("isAutomationSuppressedForUrl:", e);
        }
        return false;
    }
}
