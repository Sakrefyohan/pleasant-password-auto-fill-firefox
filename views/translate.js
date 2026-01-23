// Firefox port - browserAPI polyfill
var browserAPI = window.browserAPI || (typeof browser !== "undefined" ? browser : chrome);
window.browserAPI = browserAPI;

var messageRegex=/__MSG_(\w+)__/g;function localizeHtmlPage(e){const t=[e,...e.querySelectorAll("*")];for(const e of t)if(e.hasAttributes())for(let t=0;t<e.attributes.length;t++){const n=e.attributes[t];n.name.match(messageRegex)&&(n.name=n.name.replace(messageRegex,localizeString)),n.value.match(messageRegex)&&(n.value=n.value.replace(messageRegex,localizeString))}const n=document.createTreeWalker(e,NodeFilter.SHOW_TEXT,null,!1);let r;for(;r=n.nextNode();)r.nodeValue=r.nodeValue.replace(messageRegex,localizeString)}function localizeString(e,t){return t?browserAPI.i18n.getMessage(t):""}document.addEventListener("DOMContentLoaded",(async function(){localizeHtmlPage(document.body)}));
