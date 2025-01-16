// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Log messages from content scripts
    if (request.log) {
        console.log(request.log);
    }
});

// Open extension in new tab when clicked
chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({
        url: 'tab.html'
    });
});
