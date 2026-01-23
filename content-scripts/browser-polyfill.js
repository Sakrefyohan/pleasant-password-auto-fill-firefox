// Firefox/Chrome API polyfill for content scripts
if (typeof window.browserAPI === 'undefined') {
    window.browserAPI = typeof browser !== 'undefined' ? browser : chrome;
}
