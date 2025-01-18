import { AIToggle } from "./ai-toggle.js";

// Patch the createTab method to create tabs in the background
const originalCreateTab = AIToggle.prototype.createTab;
AIToggle.prototype.createTab = function() {
    if (!this.createTabUrl) {
        throw new Error('"createTabUrl" attribute is required');
    }
    return chrome.tabs.create({ 
        url: this.createTabUrl, 
        pinned: true,
        active: false  // Create tab in background
    });
}; 