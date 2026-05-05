class Validate {
    constructor() {}
    _visible(e) {
        if (!e || e.localName !== "input" || e.disabled) {
            return false;
        }
        const st = window.getComputedStyle(e);
        if (st.display === "none" || st.visibility === "hidden" || parseFloat(st.opacity) < 0.08) {
            return false;
        }
        const r = e.getBoundingClientRect();
        if (r.width < 1 && r.height < 1) {
            return false;
        }
        return true;
    }
    validatePasswordField(e) {
        if (!this._visible(e)) {
            return false;
        }
        if (e.type === "password") {
            return true;
        }
        const ac = (e.getAttribute("autocomplete") || "").toLowerCase();
        if (ac === "new-password" || ac === "current-password") {
            return true;
        }
        return this._looksLikePasswordField(e);
    }
    _looksLikePasswordField(e) {
        const blob = (
            (e.name || "") +
            (e.id || "") +
            (e.className || "") +
            (e.getAttribute("data-type") || "") +
            (e.getAttribute("data-testid") || "") +
            (e.getAttribute("data-test") || "")
        ).toLowerCase();
        return /(pass|pwd|secret|pin)/.test(blob);
    }
    validateUsernameField(e) {
        if (!this._visible(e)) {
            return false;
        }
        const t = (e.type || "").toLowerCase();
        if (
            ["hidden", "submit", "button", "reset", "file", "checkbox", "radio", "range", "color", "search"].includes(
                t
            )
        ) {
            return false;
        }
        const ac = (e.getAttribute("autocomplete") || "").toLowerCase();
        if (ac === "one-time-code" || ac.startsWith("cc-")) {
            return false;
        }
        return ["text", "email", "tel", "url"].includes(t);
    }
}
