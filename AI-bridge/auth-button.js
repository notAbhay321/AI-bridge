document.addEventListener('DOMContentLoaded', () => {
    const authBtn = document.getElementById('auth-btn');
    if (authBtn) {
        authBtn.addEventListener('click', () => {
            const authUrl = chrome.runtime.getURL('auth.html');
            chrome.tabs.create({ url: authUrl });
        });
    }
}); 