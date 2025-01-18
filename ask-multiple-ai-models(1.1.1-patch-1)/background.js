// Listen for keyboard command
chrome.commands.onCommand.addListener((command, tab) => {
    if (command === "open-ai-bridge") {
        chrome.tabs.create({
            url: 'tab.html'
        });
    }
});

// Listen for theme changes and other messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Received request: ", request);

    if (request.theme === 'dark') {
        chrome.action.setIcon({ 
            path: {
                "16": "icons/icon16.png",
                "32": "icons/icon32.png",
                "48": "icons/icon48.png",
                "128": "icons/icon128.png"
            }
        });
    }
    else if (request.theme === 'light') {
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

// Handle toolbar icon click
chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({
        url: 'tab.html'
    });
});

