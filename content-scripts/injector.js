// Firefox port - use browser.* API with browserAPI.* fallback
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

async function ensureServicesReady(){
    try {
        let e = null;
        const t = 10;
        for (let r = 0; r < t; r++) {
            try {
                e = await browserAPI.runtime.sendMessage({type: "getServicesStatus"});
                if (e && e.ready) return true;
            } catch(e) {
                console.log(`Waiting for services... attempt ${r+1}/${t}`);
            }
            await new Promise(e => setTimeout(e, 750));
        }
        return false;
    } catch(e) {
        console.error("Failed to ensure services are ready:", e);
        return false;
    }
}

window.addEventListener("load", async () => {
    if (window.__ppassScriptsInjected) return;

    const pageUrl = window.location.href;
    const hostname = window.location.hostname;

    try {
        const suppress = await browserAPI.runtime.sendMessage({
            type: "IsAutomationSuppressedForUrl",
            url: pageUrl
        });
        if (suppress && suppress.suppressed) {
            window.__ppassScriptsInjected = true;
            return;
        }
    } catch (e) {
        console.debug("ppass: exclusion check failed, continuing", e);
    }

    window.__ppassScriptsInjected = true;

    try {
        if (!await ensureServicesReady()) return;
        const response = await browserAPI.runtime.sendMessage({type: "LoginStatusRequest"});
        if (response.isLoggedIn) {
            browserAPI.runtime.sendMessage({type: "InjectScriptsIntoTab", data: {url: pageUrl, host: hostname}});
        }
    } catch(e) {
        console.error("Failed to check login status:", e);
    }
});