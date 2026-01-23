// Firefox override for chrome.identity.launchWebAuthFlow
// This script MUST be loaded BEFORE popup.js

(function() {
    const originalBrowserAPI = typeof browser !== 'undefined' ? browser : chrome;
    
    // Create a proxy for browserAPI.identity that overrides launchWebAuthFlow
    const identityProxy = {
        getRedirectURL: function() {
            // Return the Chrome-style redirect URL that the server accepts
            return "https://eaedglemlchhplocegehpjfeganapaij.chromiumapp.org/";
        },
        
        launchWebAuthFlow: function(options, callback) {
            console.log("[Firefox Auth Override] Intercepting launchWebAuthFlow");
            console.log("[Firefox Auth Override] Auth URL:", options.url);
            
            // Send message to background to open auth tab
            originalBrowserAPI.runtime.sendMessage({
                type: "LaunchAuthFlowViaTab",
                authUrl: options.url
            }).then(result => {
                console.log("[Firefox Auth Override] Result:", result);
                if (result && result.redirectUrl) {
                    // Success - call callback with redirect URL
                    callback(result.redirectUrl);
                } else {
                    // Error - set lastError and call callback with undefined
                    originalBrowserAPI.runtime.lastError = {
                        message: result ? result.error : "Authentication failed or cancelled"
                    };
                    callback(undefined);
                }
            }).catch(err => {
                console.error("[Firefox Auth Override] Error:", err);
                originalBrowserAPI.runtime.lastError = {
                    message: err.message || "Authentication failed"
                };
                callback(undefined);
            });
        },
        
        clearAllCachedAuthTokens: function(callback) {
            // No-op for Firefox - supports both callback and promise styles
            console.log("[Firefox Auth Override] clearAllCachedAuthTokens called (no-op)");
            if (callback) {
                callback();
                return;
            }
            return Promise.resolve();
        },
        
        getAuthToken: function(options, callback) {
            // No-op for Firefox - supports both callback and promise styles
            console.log("[Firefox Auth Override] getAuthToken called (no-op)");
            if (callback) {
                callback(null);
                return;
            }
            return Promise.resolve(null);
        },
        
        removeCachedAuthToken: function(options, callback) {
            // No-op for Firefox - supports both callback and promise styles
            console.log("[Firefox Auth Override] removeCachedAuthToken called (no-op)");
            if (callback) {
                callback();
                return;
            }
            return Promise.resolve();
        },
        
        launchWebAuthFlowPromise: function(options) {
            // Promise-based version of launchWebAuthFlow
            return new Promise((resolve, reject) => {
                this.launchWebAuthFlow(options, (redirectUrl) => {
                    if (redirectUrl) {
                        resolve(redirectUrl);
                    } else {
                        reject(new Error("Authentication failed or cancelled"));
                    }
                });
            });
        }
    };
    
    // Override browserAPI globally (will be used by popup.js)
    window.browserAPI = new Proxy(originalBrowserAPI, {
        get: function(target, prop) {
            if (prop === 'identity') {
                return identityProxy;
            }
            return target[prop];
        }
    });
    
    console.log("[Firefox Auth Override] browserAPI.identity overridden");
})();
