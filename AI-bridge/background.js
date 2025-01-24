// Function to open AI-Bridge
function openAIBridge() {
    chrome.tabs.create({
        url: 'tab.html',
        active: true
    }).catch(error => {
        console.error('Error opening AI-Bridge:', error);
    });
}

// Listen for keyboard commands
chrome.commands.onCommand.addListener((command) => {
    console.log('Command received:', command);
    if (command === "_execute_action") {
        openAIBridge();
    }
});

// Handle toolbar icon click
chrome.action.onClicked.addListener(() => {
    openAIBridge();
});

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.theme === 'dark' || request.theme === 'light') {
        chrome.action.setIcon({ 
            path: {
                "16": "icons/icon16.png",
                "32": "icons/icon32.png",
                "48": "icons/icon48.png",
                "128": "icons/icon128.png"
            }
        });
    }
});

// Log on startup
console.log('AI-Bridge background script loaded');

