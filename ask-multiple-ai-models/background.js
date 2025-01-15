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

chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({
        url: 'tab.html'
    });
});
