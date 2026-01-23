// Firefox/Chrome API polyfill - loaded first
if (typeof globalThis.browserAPI === 'undefined') {
    globalThis.browserAPI = typeof browser !== 'undefined' ? browser : chrome;
}

if (!globalThis.browserAPI.scripting && globalThis.browserAPI.tabs && globalThis.browserAPI.tabs.executeScript) {
    globalThis.browserAPI.scripting = {
        async executeScript({ target, files, func, args }) {
            if (!target || !target.tabId) {
                throw new Error("executeScript requires target.tabId");
            }
            const tabId = target.tabId;
            const options = {};
            if (target.allFrames) {
                options.allFrames = true;
            }
            if (files && files.length) {
                for (const file of files) {
                    await globalThis.browserAPI.tabs.executeScript(tabId, { file, ...options });
                }
                return [];
            }
            if (func) {
                const serializedArgs = (args || []).map(arg => JSON.stringify(arg)).join(",");
                const code = `(${func.toString()})(${serializedArgs});`;
                return globalThis.browserAPI.tabs.executeScript(tabId, { code, ...options });
            }
            return [];
        }
    };
}

// TaskCompletionSource polyfill
if (typeof globalThis.TaskCompletionSource === 'undefined') {
    globalThis.TaskCompletionSource = class TaskCompletionSource {
        constructor() {
            this.promise = new Promise((resolve, reject) => {
                this.resolve = resolve;
                this.reject = reject;
            });
        }
    };
}

// StorageHelper for MV2 compatibility (no storage.session)
if (typeof globalThis.StorageHelper === 'undefined') {
    globalThis.StorageHelper = {
        async get(keys) {
            return browserAPI.storage.local.get(keys);
        },
        async set(items) {
            return browserAPI.storage.local.set(items);
        },
        async remove(keys) {
            return browserAPI.storage.local.remove(keys);
        }
    };
}
