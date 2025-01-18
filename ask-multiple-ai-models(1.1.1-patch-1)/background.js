// Function to open AI-Bridge
function openAIBridge() {
    console.log('Opening AI-Bridge...');
    chrome.tabs.create({
        url: 'tab.html'
    }).then(() => {
        console.log('Tab created successfully');
    }).catch((error) => {
        console.error('Error creating tab:', error);
    });
}

// Listen for keyboard command
chrome.commands.onCommand.addListener((command) => {
    console.log('Command received:', command);
    if (command === "open-ai-bridge") {
        console.log('Executing open-ai-bridge command');
        openAIBridge();
    }
});

// Handle toolbar icon click
chrome.action.onClicked.addListener(() => {
    console.log('Icon clicked');
    openAIBridge();
});

// Listen for theme changes and other messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Received request: ", request);
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

