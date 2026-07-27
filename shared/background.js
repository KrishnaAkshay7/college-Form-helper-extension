/**
 * background.js
 * -------------
 * Minimal Manifest V3 service worker. Currently just handles first-install
 * logging. Kept intentionally thin — all real logic lives in storage.js
 * (data) and content-script.js (page interaction), which the popup talks to
 * directly via chrome.tabs.sendMessage. This file exists mainly because
 * Manifest V3 requires a background entry, and it's a natural place to add
 * cross-tab features later (e.g. a right-click context menu "Fill this
 * field" option) without restructuring anything else.
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("College Helper installed. All data stays local to this browser.");
  }
});
