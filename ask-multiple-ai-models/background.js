// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Log messages from content scripts
    if (request.log) {
        console.log(request.log);
    }
});

// Function to open extension in new tab
function openAIBridge() {
    chrome.tabs.create({
        url: 'tab.html'
    });
}

// Open extension in new tab when clicked
chrome.action.onClicked.addListener(openAIBridge);

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command, tab) => {
    console.log('Command received:', command);  // Debug log
    if (command === 'open-ai-bridge') {
        console.log('Opening AI Bridge');  // Debug log
        openAIBridge();
    }
});
